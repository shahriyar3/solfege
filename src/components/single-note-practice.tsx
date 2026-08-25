'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { playNote, playCorrectSound, playWrongSound } from '@/lib/audio-playback';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  ChevronLeft,
  Square,
  Shuffle,
  RotateCcw,
  Volume2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Target,
} from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────

const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
type NoteName = (typeof NOTE_NAMES)[number];

const PERSIAN_LABELS: Record<NoteName, string> = {
  C: 'دو',
  D: 'رِ',
  E: 'می',
  F: 'فا',
  G: 'سل',
  A: 'لا',
  B: 'سی',
};

const NOTE_INDICES: Record<NoteName, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

const NOTE_GRADIENTS: Record<NoteName, string> = {
  C: 'from-red-400 to-rose-500',
  D: 'from-orange-400 to-amber-500',
  E: 'from-yellow-400 to-yellow-500',
  F: 'from-green-400 to-emerald-500',
  G: 'from-teal-400 to-cyan-500',
  A: 'from-sky-400 to-blue-500',
  B: 'from-violet-400 to-purple-500',
};

const OCTAVES = [2, 3, 4, 5, 6];

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

function toPersianNum(n: number): string {
  return String(n)
    .split('')
    .map((d) => PERSIAN_DIGITS[parseInt(d)])
    .join('');
}

const A4_FREQ = 440.0;
const A4_MIDI = 69;

function calcFrequency(note: NoteName, octave: number): number {
  const midi = (octave + 1) * 12 + NOTE_INDICES[note];
  return Math.round(A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12) * 10) / 10;
}

// ─── Pitch detection (inline, simplified) ───────────────────

const ALL_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

interface DetectedNote {
  frequency: number;
  note: string;
  octave: number;
  cents: number;
}

function autoCorrelate(
  buf: Float32Array,
  sampleRate: number,
  minFreq: number,
  maxFreq: number,
): number | null {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) {
    rms += buf[i] * buf[i];
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return null;

  const minPeriod = Math.floor(sampleRate / maxFreq);
  const maxPeriod = Math.ceil(sampleRate / minFreq);

  let bestOffset = -1;
  let bestCorrelation = 0;
  let foundGoodCorrelation = false;
  const correlations = new Float32Array(maxPeriod + 1);

  for (let offset = minPeriod; offset <= Math.min(maxPeriod, Math.floor(SIZE / 2)); offset++) {
    let correlation = 0;
    for (let i = 0; i < SIZE - offset; i++) {
      correlation += Math.abs(buf[i] - buf[i + offset]);
    }
    correlation = 1 - correlation / (SIZE - offset);
    correlations[offset] = correlation;

    if (correlation > 0.9 && correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
      foundGoodCorrelation = true;
    } else if (foundGoodCorrelation) {
      const shortAvg = (correlations[bestOffset - 1] + correlations[bestOffset] + correlations[bestOffset + 1]) / 3;
      if (correlation < shortAvg) break;
    }
  }

  if (bestCorrelation > 0.01 && bestOffset > 0) {
    let shift = 0;
    if (bestOffset > 0 && bestOffset < SIZE - 1) {
      const prev = correlations[bestOffset - 1] || 0;
      const next = correlations[bestOffset + 1] || 0;
      shift = (next - prev) / (2 * (2 * bestCorrelation - prev - next));
      if (isNaN(shift)) shift = 0;
    }
    return sampleRate / (bestOffset + shift);
  }
  return null;
}

function frequencyToNote(freq: number): DetectedNote {
  const midiNumber = Math.round(12 * Math.log2(freq / A4_FREQ) + A4_MIDI);
  const exactMidi = 12 * Math.log2(freq / A4_FREQ) + A4_MIDI;
  const cents = Math.round((exactMidi - midiNumber) * 100);
  const clampedCents = Math.max(-50, Math.min(50, cents));
  const noteIndex = ((midiNumber % 12) + 12) % 12;
  const octave = Math.floor(midiNumber / 12) - 1;
  return {
    frequency: Math.round(freq * 10) / 10,
    note: ALL_NOTE_NAMES[noteIndex],
    octave,
    cents: clampedCents,
  };
}

// ─── Types ──────────────────────────────────────────────────

type ResultType = 'correct' | 'wrong-octave' | 'wrong' | null;

type Phase = 'idle' | 'ready' | 'recording' | 'result';

// ─── Component ──────────────────────────────────────────────

export function SingleNotePractice() {
  const [expanded, setExpanded] = useState(false);
  const [selectedNote, setSelectedNote] = useState<NoteName>('E');
  const [selectedOctave, setSelectedOctave] = useState(4);
  const [phase, setPhase] = useState<Phase>('idle');
  const [detected, setDetected] = useState<DetectedNote | null>(null);
  const [result, setResult] = useState<ResultType>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, correct: 0, streak: 0, bestStreak: 0 });

  // Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const bufferRef = useRef<Float32Array>(new Float32Array(0));
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectedRef = useRef<DetectedNote | null>(null);
  const stopEvaluateRef = useRef<() => void>(() => {});

  const targetFreq = calcFrequency(selectedNote, selectedOctave);

  const cleanupAudio = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setDetected(null);
      setResult(null);
      detectedRef.current = null;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, latencyHint: 'interactive' as MediaTrackConstraints },
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      bufferRef.current = new Float32Array(analyser.fftSize);
      setPhase('recording');

      // 8-second timeout
      timeoutRef.current = setTimeout(() => {
        stopEvaluateRef.current();
      }, 8000);

      // Analysis loop
      const analyze = () => {
        if (!analyserRef.current || !audioCtxRef.current) return;
        analyserRef.current.getFloatTimeDomainData(bufferRef.current);

        const freq = autoCorrelate(
          bufferRef.current,
          audioCtxRef.current.sampleRate,
          60,
          1500,
        );

        if (freq !== null) {
          const noteResult = frequencyToNote(freq);
          detectedRef.current = noteResult;
          setDetected(noteResult);
        } else {
          setDetected(null);
        }

        rafRef.current = requestAnimationFrame(analyze);
      };
      analyze();
    } catch (_err) {
      setError('دسترسی به میکروفون رد شد. لطفاً اجازه دسترسی بدهید.');
      setPhase('ready');
    }
  }, []);

  const stopRecordingAndEvaluate = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const d = detectedRef.current;
    cleanupAudio();

    if (!d) {
      setResult('wrong');
      setPhase('result');
      setStats((prev) => ({
        total: prev.total + 1,
        correct: prev.correct,
        streak: 0,
        bestStreak: prev.bestStreak,
      }));
      playWrongSound();
      return;
    }

    const noteMatch = d.note === selectedNote;
    const octaveMatch = d.octave === selectedOctave;
    const centsMatch = Math.abs(d.cents) <= 5;

    let r: ResultType;
    if (noteMatch && octaveMatch && centsMatch) {
      r = 'correct';
      playCorrectSound();
    } else if (noteMatch && !octaveMatch) {
      r = 'wrong-octave';
      playWrongSound();
    } else {
      r = 'wrong';
      playWrongSound();
    }

    setResult(r);
    setPhase('result');

    setStats((prev) => {
      const newCorrect = r === 'correct' ? prev.correct + 1 : prev.correct;
      const newStreak = r === 'correct' ? prev.streak + 1 : 0;
      return {
        total: prev.total + 1,
        correct: newCorrect,
        streak: newStreak,
        bestStreak: Math.max(prev.bestStreak, newStreak),
      };
    });
  }, [selectedNote, selectedOctave, cleanupAudio]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  // Keep latest stopEvaluate in a ref for timeout access
  useEffect(() => {
    stopEvaluateRef.current = stopRecordingAndEvaluate;
  }, [stopRecordingAndEvaluate]);

  const handleStartStop = useCallback(() => {
    if (phase === 'recording') {
      stopRecordingAndEvaluate();
    } else {
      startRecording();
    }
  }, [phase, startRecording, stopRecordingAndEvaluate]);

  const handleNextNote = useCallback(() => {
    const randomNote = NOTE_NAMES[Math.floor(Math.random() * NOTE_NAMES.length)];
    const randomOctave = OCTAVES[Math.floor(Math.random() * OCTAVES.length)];
    setSelectedNote(randomNote);
    setSelectedOctave(randomOctave);
    setPhase('ready');
    setDetected(null);
    setResult(null);
    setError(null);
  }, []);

  const handleResetStats = useCallback(() => {
    setStats({ total: 0, correct: 0, streak: 0, bestStreak: 0 });
  }, []);

  const handlePlayReference = useCallback(() => {
    playNote(targetFreq, 1.5);
  }, [targetFreq]);

  const handleNoteChange = useCallback((val: string) => {
    setSelectedNote(val as NoteName);
    if (phase === 'idle') setPhase('ready');
    setDetected(null);
    setResult(null);
  }, [phase]);

  const handleOctaveChange = useCallback((val: string) => {
    setSelectedOctave(parseInt(val));
    if (phase === 'idle') setPhase('ready');
    setDetected(null);
    setResult(null);
  }, [phase]);

  const handleCollapsedOpen = useCallback(() => {
    setExpanded(true);
    if (phase === 'idle') setPhase('ready');
  }, [phase]);

  // ─── Teaser (collapsed) ──────────────────────────────────
  if (!expanded) {
    return (
      <Card
        className="border-dashed border-2 border-border/30 bg-gradient-to-br from-muted/10 to-muted/5 hover:border-emerald-300/40 transition-all duration-300 group cursor-pointer card-hover"
        onClick={handleCollapsedOpen}
      >
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/35 transition-all duration-300 group-hover:scale-105">
            <Target className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold">تمرین نت تکی</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              یک نت خاص را انتخاب کنید و بخوانید
            </p>
            <div className="flex gap-1.5 mt-1.5">
              <Badge variant="outline" className="text-[9px] h-4">
                ۷ نت
              </Badge>
              <Badge variant="outline" className="text-[9px] h-4">
                ۵ اکتاو
              </Badge>
            </div>
          </div>
          <ChevronLeft className="h-5 w-5 text-muted-foreground/50 group-hover:text-emerald-500 transition-colors" />
        </CardContent>
      </Card>
    );
  }

  // ─── Result display config ───────────────────────────────
  const resultConfig = {
    correct: {
      label: 'درست!',
      color: 'text-emerald-500',
      bg: 'bg-emerald-500',
      glow: 'shadow-emerald-500/40',
      border: 'border-emerald-400',
      icon: <CheckCircle2 className="h-6 w-6 text-emerald-500" />,
      sub: `${PERSIAN_LABELS[selectedNote]} ${selectedOctave} (${selectedNote}${toPersianNum(selectedOctave)})`,
    },
    'wrong-octave': {
      label: 'نت درسته ولی اکتاو اشتباه',
      color: 'text-amber-500',
      bg: 'bg-amber-500',
      glow: 'shadow-amber-500/40',
      border: 'border-amber-400',
      icon: <AlertTriangle className="h-6 w-6 text-amber-500" />,
      sub: detected ? `شما خواندید: ${detected.note}${toPersianNum(detected.octave)}` : '',
    },
    wrong: {
      label: 'اشتباه',
      color: 'text-red-500',
      bg: 'bg-red-500',
      glow: 'shadow-red-500/40',
      border: 'border-red-400',
      icon: <XCircle className="h-6 w-6 text-red-500" />,
      sub: detected ? `شما خواندید: ${detected.note}${toPersianNum(detected.octave)}` : 'صدایی شنیده نشد',
    },
  } as const;

  // ─── Active (expanded) ───────────────────────────────────
  return (
    <Card className="border border-border/40 bg-card/90 backdrop-blur-sm shadow-lg shadow-black/[0.04] overflow-hidden">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-500" />
            تمرین نت تکی
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              cleanupAudio();
              setPhase('idle');
              setExpanded(false);
            }}
            className="h-7 w-7 p-0 text-muted-foreground"
            title="بستن"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {/* Note + Octave selectors */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground mb-1 block">نت</label>
            <Select value={selectedNote} onValueChange={handleNoteChange}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTE_NAMES.map((n) => (
                  <SelectItem key={n} value={n} className="text-sm">
                    {PERSIAN_LABELS[n]} ({n})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-24">
            <label className="text-[10px] text-muted-foreground mb-1 block">اکتاو</label>
            <Select value={String(selectedOctave)} onValueChange={handleOctaveChange}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OCTAVES.map((o) => (
                  <SelectItem key={o} value={String(o)} className="text-sm">
                    {toPersianNum(o)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Target note display */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${selectedNote}-${selectedOctave}`}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="flex flex-col items-center py-2"
          >
            <div className="relative">
              {/* Glow ring when recording */}
              {phase === 'recording' && (
                <motion.div
                  className={cn(
                    'absolute -inset-3 rounded-full blur-lg',
                    detected && detected.note === selectedNote && detected.octave === selectedOctave
                      ? 'bg-emerald-500/30'
                      : 'bg-red-500/20',
                  )}
                  animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.05, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}

              {/* Result glow */}
              {phase === 'result' && result && (
                <motion.div
                  className={cn(
                    'absolute -inset-4 rounded-full blur-xl',
                    resultConfig[result].glow,
                  )}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 0.6, scale: 1 }}
                  transition={{ duration: 0.5 }}
                />
              )}

              <div
                className={cn(
                  'relative h-28 w-28 rounded-full flex flex-col items-center justify-center border-2 transition-all duration-300',
                  'bg-gradient-to-br from-muted/80 to-muted/40',
                  phase === 'recording'
                    ? detected && detected.note === selectedNote && detected.octave === selectedOctave
                      ? 'border-emerald-400 shadow-lg shadow-emerald-500/25'
                      : 'border-red-400 shadow-lg shadow-red-500/20'
                    : phase === 'result' && result
                      ? cn('border', resultConfig[result].border, 'shadow-lg', resultConfig[result].glow)
                      : 'border-border/30 hover:border-border/50',
                )}
              >
                {phase === 'result' && result ? (
                  <>
                    {resultConfig[result].icon}
                    <span className={cn('text-2xl font-bold mt-1', resultConfig[result].color)}>
                      {PERSIAN_LABELS[selectedNote]}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {selectedNote}{toPersianNum(selectedOctave)}
                    </span>
                  </>
                ) : (
                  <>
                    <span
                      className={cn(
                        'text-4xl font-bold bg-gradient-to-br bg-clip-text text-transparent',
                        NOTE_GRADIENTS[selectedNote],
                      )}
                    >
                      {PERSIAN_LABELS[selectedNote]}
                    </span>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      {selectedNote}{toPersianNum(selectedOctave)}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 font-mono">
                      {targetFreq} Hz
                    </span>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Real-time detected note during recording */}
        <AnimatePresence>
          {phase === 'recording' && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-center space-y-1"
            >
              {detected ? (
                <>
                  <div className="flex items-center justify-center gap-2">
                    <Mic className={cn(
                      'h-3.5 w-3.5',
                      detected.note === selectedNote && detected.octave === selectedOctave
                        ? 'text-emerald-500'
                        : 'text-red-400',
                    )} />
                    <span className={cn(
                      'text-sm font-medium',
                      detected.note === selectedNote && detected.octave === selectedOctave
                        ? 'text-emerald-500'
                        : 'text-red-400',
                    )}>
                      شناسایی: {detected.note}{toPersianNum(detected.octave)} ({Math.round(detected.frequency)} Hz)
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      detected.note === selectedNote && detected.octave === selectedOctave && Math.abs(detected.cents) <= 5
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : detected.note === selectedNote
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          : 'bg-red-500/15 text-red-600 dark:text-red-400',
                    )}>
                      {detected.note === selectedNote && detected.octave === selectedOctave && Math.abs(detected.cents) <= 5
                        ? '✓ مطابقت دارد'
                        : detected.note === selectedNote
                          ? 'نت درسته، اکتاو نه'
                          : '✗ مطابقت ندارد'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Mic className="h-3.5 w-3.5 animate-pulse" />
                  <span className="text-xs">در حال گوش دادن... صدا بدهید</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result message */}
        <AnimatePresence>
          {phase === 'result' && result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="text-center space-y-1"
            >
              <p className={cn('text-lg font-bold', resultConfig[result].color)}>
                {resultConfig[result].label}
              </p>
              <p className="text-xs text-muted-foreground">{resultConfig[result].sub}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error message */}
        {error && (
          <p className="text-xs text-red-500 text-center">{error}</p>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-2">
          {/* Play reference tone */}
          <Button
            variant="outline"
            size="sm"
            onClick={handlePlayReference}
            disabled={phase === 'recording'}
            className="h-9 gap-1.5"
          >
            <Volume2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">شنیدن</span>
          </Button>

          {/* Start / Stop */}
          <Button
            onClick={handleStartStop}
            className={cn(
              'h-10 px-6 rounded-full font-medium transition-all duration-300',
              phase === 'recording'
                ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-lg shadow-red-500/25'
                : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25',
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              {phase === 'recording' ? (
                <motion.span
                  key="stop"
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 90 }}
                  className="flex items-center gap-2"
                >
                  <Square className="h-4 w-4" fill="currentColor" />
                  توقف
                </motion.span>
              ) : (
                <motion.span
                  key="start"
                  initial={{ scale: 0, rotate: 90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: -90 }}
                  className="flex items-center gap-2"
                >
                  <Mic className="h-4 w-4" />
                  شروع
                </motion.span>
              )}
            </AnimatePresence>
          </Button>

          {/* Next note */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextNote}
            className="h-9 gap-1.5"
          >
            <Shuffle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">نت بعدی</span>
          </Button>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>تلاش: <span className="font-medium text-foreground">{toPersianNum(stats.total)}</span></span>
            <span>درست: <span className="font-medium text-emerald-500">{toPersianNum(stats.correct)}</span></span>
            <span className="flex items-center gap-0.5">
              <Zap className="h-3 w-3 text-amber-500" />
              {toPersianNum(stats.streak)}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetStats}
            className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            بازنشانی
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
