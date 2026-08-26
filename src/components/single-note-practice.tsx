'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { playNote, playCorrectSound, playWrongSound, ensureAudioResumed } from '@/lib/audio-playback';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
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
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type { PitchResult } from '@/lib/pitch-detection';

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

const PERSIAN_NOTE_FULL: Record<NoteName, string> = {
  C: 'دو (Do)',
  D: 'رِ (Ré)',
  E: 'می (Mi)',
  F: 'فا (Fa)',
  G: 'سل (Sol)',
  A: 'لا (La)',
  B: 'سی (Si)',
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
    .map((d) => PERSIAN_DIGITS[parseInt(d)] ?? d)
    .join('');
}

const A4_FREQ = 440.0;
const A4_MIDI = 69;

function calcFrequency(note: NoteName, octave: number): number {
  const midi = (octave + 1) * 12 + NOTE_INDICES[note];
  return Math.round(A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12) * 10) / 10;
}

// ─── Types ──────────────────────────────────────────────────

type ResultType = 'correct' | 'wrong-octave' | 'wrong-note' | 'no-sound' | null;
type Phase = 'idle' | 'ready' | 'recording' | 'result';

interface RecordedSample {
  note: string;
  octave: number;
  frequency: number;
  cents: number;
  timestamp: number;
}

// ─── Component ──────────────────────────────────────────────

interface SingleNotePracticeProps {
  currentPitch: PitchResult | null;
  isTunerActive: boolean;
  volume: number;
  soundEnabled?: boolean;
  onStartTuner?: () => void;
}

export function SingleNotePractice({
  currentPitch,
  isTunerActive,
  volume,
  soundEnabled = true,
  onStartTuner,
}: SingleNotePracticeProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedNote, setSelectedNote] = useState<NoteName>('E');
  const [selectedOctave, setSelectedOctave] = useState(4);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<ResultType>(null);
  const [detectedNote, setDetectedNote] = useState<PitchResult | null>(null);
  const [stats, setStats] = useState({ total: 0, correct: 0, streak: 0, bestStreak: 0 });

  const recordingsRef = useRef<RecordedSample[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectedNoteRef = useRef<PitchResult | null>(null);

  const targetFreq = calcFrequency(selectedNote, selectedOctave);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // ─── Collect pitch data from main tuner during recording ──
  // We use a ref + rAF to avoid calling setState in an effect body
  useEffect(() => {
    if (phase !== 'recording') return;
    let rafId: number | null = null;
    const sync = () => {
      if (detectedNoteRef.current !== currentPitch) {
        detectedNoteRef.current = currentPitch;
        // batch state update via rAF callback
        setDetectedNote(currentPitch);
      }
      if (currentPitch) {
        recordingsRef.current.push({
          note: currentPitch.note,
          octave: currentPitch.octave,
          frequency: currentPitch.frequency,
          cents: currentPitch.cents,
          timestamp: Date.now(),
        });
      }
      rafId = requestAnimationFrame(sync);
    };
    rafId = requestAnimationFrame(sync);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [currentPitch, phase]);

  // ─── Volume indicator (0-1 normalized) ────────────────────
  const volumeLevel = useMemo(() => {
    return Math.min(1, volume / 0.15);
  }, [volume]);

  // ─── Evaluate collected samples ───────────────────────────
  const evaluate = useCallback(() => {
    const samples = recordingsRef.current;
    recordingsRef.current = [];

    if (samples.length === 0) {
      setResult('no-sound');
      setPhase('result');
      setStats((prev) => ({
        total: prev.total + 1,
        correct: prev.correct,
        streak: 0,
        bestStreak: prev.bestStreak,
      }));
      if (soundEnabled) playWrongSound();
      return;
    }

    // Find the most common note+octave combination
    const counts: Record<string, { note: string; octave: number; cents: number; freq: number; count: number }> = {};
    for (const s of samples) {
      const key = `${s.note}${s.octave}`;
      if (!counts[key]) {
        counts[key] = { note: s.note, octave: s.octave, cents: s.cents, freq: s.frequency, count: 0 };
      }
      counts[key].count++;
      // Average cents
      counts[key].cents = Math.round(
        (counts[key].cents * (counts[key].count - 1) + s.cents) / counts[key].count
      );
      // Average frequency
      counts[key].freq = Math.round(
        (counts[key].freq * (counts[key].count - 1) + s.frequency) / counts[key].count
      );
    }

    // Pick the most common detection
    let best: { note: string; octave: number; cents: number; freq: number; count: number } | null = null;
    for (const entry of Object.values(counts)) {
      if (!best || entry.count > best.count) best = entry;
    }

    if (!best) {
      setResult('no-sound');
      setPhase('result');
      setStats((prev) => ({
        total: prev.total + 1,
        correct: prev.correct,
        streak: 0,
        bestStreak: prev.bestStreak,
      }));
      if (soundEnabled) playWrongSound();
      return;
    }

    const noteMatch = best.note === selectedNote;
    const octaveMatch = best.octave === selectedOctave;
    const centsMatch = Math.abs(best.cents) <= 15;

    let r: ResultType;
    if (noteMatch && octaveMatch && centsMatch) {
      r = 'correct';
      if (soundEnabled) playCorrectSound();
    } else if (noteMatch && !octaveMatch) {
      r = 'wrong-octave';
      if (soundEnabled) playWrongSound();
    } else {
      r = 'wrong-note';
      if (soundEnabled) playWrongSound();
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
  }, [selectedNote, selectedOctave, soundEnabled]);

  // ─── Start/Stop recording ─────────────────────────────────
  const handleStartStop = useCallback(() => {
    if (phase === 'recording') {
      // Stop and evaluate
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      evaluate();
    } else {
      // Start recording
      if (!isTunerActive) {
        onStartTuner?.();
        // Wait a tick for tuner to start, then begin
        setTimeout(() => {
          recordingsRef.current = [];
          setDetectedNote(null);
          setResult(null);
          setPhase('recording');
          // 8-second timeout
          timeoutRef.current = setTimeout(() => {
            evaluate();
          }, 8000);
        }, 500);
      } else {
        recordingsRef.current = [];
        setDetectedNote(null);
        setResult(null);
        setPhase('recording');
        // 8-second timeout
        timeoutRef.current = setTimeout(() => {
          evaluate();
        }, 8000);
      }
    }
  }, [phase, isTunerActive, onStartTuner, evaluate]);

  const handleNextNote = useCallback(() => {
    const randomNote = NOTE_NAMES[Math.floor(Math.random() * NOTE_NAMES.length)];
    const randomOctave = OCTAVES[Math.floor(Math.random() * OCTAVES.length)];
    setSelectedNote(randomNote);
    setSelectedOctave(randomOctave);
    setPhase('ready');
    setDetectedNote(null);
    setResult(null);
    recordingsRef.current = [];
  }, []);

  const handleResetStats = useCallback(() => {
    setStats({ total: 0, correct: 0, streak: 0, bestStreak: 0 });
  }, []);

  const handlePlayReference = useCallback(async () => {
    try { await ensureAudioResumed(); } catch { /* */ }
    playNote(targetFreq, 1.5);
  }, [targetFreq]);

  const handleNoteChange = useCallback((val: string) => {
    setSelectedNote(val as NoteName);
    if (phase === 'idle' || phase === 'result') setPhase('ready');
    setDetectedNote(null);
    setResult(null);
  }, [phase]);

  const handleOctaveChange = useCallback((val: string) => {
    setSelectedOctave(parseInt(val));
    if (phase === 'idle' || phase === 'result') setPhase('ready');
    setDetectedNote(null);
    setResult(null);
  }, [phase]);

  const handleCollapsedOpen = useCallback(() => {
    setExpanded(true);
    if (phase === 'idle') setPhase('ready');
  }, [phase]);

  // ─── Most common detection (compute before render) ────────
  const detected = detectedNote
    ? { note: detectedNote.note, octave: detectedNote.octave, freq: detectedNote.frequency }
    : null;

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
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
              setPhase('idle');
              setExpanded(false);
              setDetectedNote(null);
              setResult(null);
              recordingsRef.current = [];
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
                    detectedNote && detectedNote.note === selectedNote && detectedNote.octave === selectedOctave
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
                    result === 'correct' ? 'shadow-emerald-500/40' :
                    result === 'wrong-octave' ? 'shadow-amber-500/40' :
                    'shadow-red-500/40',
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
                    ? detectedNote && detectedNote.note === selectedNote && detectedNote.octave === selectedOctave
                      ? 'border-emerald-400 shadow-lg shadow-emerald-500/25'
                      : 'border-red-400 shadow-lg shadow-red-500/20'
                    : phase === 'result' && result
                      ? cn('border',
                          result === 'correct' ? 'border-emerald-400' :
                          result === 'wrong-octave' ? 'border-amber-400' :
                          'border-red-400',
                          'shadow-lg',
                          result === 'correct' ? 'shadow-emerald-500/25' :
                          result === 'wrong-octave' ? 'shadow-amber-500/25' :
                          'shadow-red-500/25',
                        )
                      : 'border-border/30 hover:border-border/50',
                )}
              >
                {phase === 'result' && result ? (
                  <>
                    {result === 'correct' && <CheckCircle2 className="h-6 w-6 text-emerald-500" />}
                    {result === 'wrong-octave' && <AlertTriangle className="h-6 w-6 text-amber-500" />}
                    {(result === 'wrong-note' || result === 'no-sound') && <XCircle className="h-6 w-6 text-red-500" />}
                    <span className={cn('text-2xl font-bold mt-1',
                      result === 'correct' ? 'text-emerald-500' :
                      result === 'wrong-octave' ? 'text-amber-500' :
                      'text-red-500',
                    )}>
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

        {/* Volume bar during recording */}
        {phase === 'recording' && (
          <div className="space-y-1">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-500"
                animate={{ width: `${Math.max(5, volumeLevel * 100)}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>سطح صدا</span>
              <span className={cn(volumeLevel < 0.05 ? 'text-red-400' : volumeLevel < 0.2 ? 'text-amber-400' : 'text-emerald-400')}>
                {volumeLevel < 0.05 ? 'خیلی کم' : volumeLevel < 0.2 ? 'متوسط' : 'خوب'}
              </span>
            </div>
          </div>
        )}

        {/* Real-time detected note during recording */}
        <AnimatePresence>
          {phase === 'recording' && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-center space-y-1"
            >
              {detectedNote ? (
                <>
                  <div className="flex items-center justify-center gap-2">
                    <Mic className={cn(
                      'h-3.5 w-3.5',
                      detectedNote.note === selectedNote && detectedNote.octave === selectedOctave
                        ? 'text-emerald-500'
                        : 'text-red-400',
                    )} />
                    <span className={cn(
                      'text-sm font-medium',
                      detectedNote.note === selectedNote && detectedNote.octave === selectedOctave
                        ? 'text-emerald-500'
                        : 'text-red-400',
                    )}>
                      شناسایی: {detectedNote.note}{toPersianNum(detectedNote.octave)} ({Math.round(detectedNote.frequency)} Hz)
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      detectedNote.note === selectedNote && detectedNote.octave === selectedOctave && Math.abs(detectedNote.cents) <= 15
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : detectedNote.note === selectedNote
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          : 'bg-red-500/15 text-red-600 dark:text-red-400',
                    )}>
                      {detectedNote.note === selectedNote && detectedNote.octave === selectedOctave && Math.abs(detectedNote.cents) <= 15
                        ? '✓ مطابقت دارد'
                        : detectedNote.note === selectedNote
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
              className="text-center space-y-2"
            >
              <p className={cn('text-lg font-bold',
                result === 'correct' ? 'text-emerald-500' :
                result === 'wrong-octave' ? 'text-amber-500' :
                'text-red-500',
              )}>
                {result === 'correct' && 'درست! عالی بود'}
                {result === 'wrong-octave' && 'نت درسته ولی اکتاو اشتباه'}
                {result === 'wrong-note' && 'نت اشتباه بود'}
                {result === 'no-sound' && 'صدایی شنیده نشد'}
              </p>

              {/* Sub-info for correct */}
              {result === 'correct' && (
                <p className="text-xs text-muted-foreground">
                  {PERSIAN_NOTE_FULL[selectedNote]} — اکتاو {toPersianNum(selectedOctave)} ({selectedNote}{toPersianNum(selectedOctave)})
                </p>
              )}

              {/* Detailed feedback for wrong-octave */}
              {result === 'wrong-octave' && detected && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/30 rounded-xl p-3 text-right space-y-2">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400">توضیحات:</span>
                  </div>
                  <div className="text-[11px] leading-relaxed text-amber-800/80 dark:text-amber-300/80 space-y-1.5">
                    <p>
                      نت <span className="font-bold">{PERSIAN_LABELS[selectedNote]}</span> ({selectedNote}) را به درستی خواندید!
                    </p>
                    <p>
                      شما در اکتاو <span className="font-bold text-amber-600 dark:text-amber-400">{toPersianNum(detected.octave)}</span> خواندید،
                      ولی هدف اکتاو <span className="font-bold">{toPersianNum(selectedOctave)}</span> بود.
                    </p>
                    {detected.octave > selectedOctave ? (
                      <div className="flex items-start gap-1.5">
                        <ArrowDown className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                        <p>
                          صدای شما <span className="font-bold">{toPersianNum(detected.octave - selectedOctave)} اکتاو بالاتر</span> از هدف است.
                          باید صدای خود را <span className="font-bold">بم‌تر</span> کنید (پایین‌تر ببرید).
                          سعی کنید صدایتان را آرام‌تر و بم‌تر ادا کنید.
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-start gap-1.5">
                        <ArrowUp className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                        <p>
                          صدای شما <span className="font-bold">{toPersianNum(selectedOctave - detected.octave)} اکتاو پایین‌تر</span> از هدف است.
                          باید صدای خود را <span className="font-bold">زیرتر</span> کنید (بالاتر ببرید).
                          سعی کنید صدایتان را شفاف‌تر و زیرتر ادا کنید.
                        </p>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground pt-1 border-t border-amber-200/30 dark:border-amber-800/20">
                      💡 راهنمایی: ابتدا با دکمه «شنیدن» صدای مرجع را گوش کنید، سپس با همان ارتفاع بخوانید.
                    </p>
                  </div>
                </div>
              )}

              {/* Info for wrong-note */}
              {result === 'wrong-note' && detected && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-800/30 rounded-xl p-3 text-right space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <span className="text-xs font-bold text-red-700 dark:text-red-400">جزئیات:</span>
                  </div>
                  <div className="text-[11px] leading-relaxed text-red-800/80 dark:text-red-300/80">
                    <p>
                      هدف: <span className="font-bold">{PERSIAN_LABELS[selectedNote]}</span> ({selectedNote}{toPersianNum(selectedOctave)}) — {targetFreq} Hz
                    </p>
                    <p>
                      شما خواندید: <span className="font-bold">{detected.note}{toPersianNum(detected.octave)}</span> — {Math.round(detected.freq)} Hz
                    </p>
                  </div>
                  <p className="text-[10px] text-muted-foreground pt-1 border-t border-red-200/30 dark:border-red-800/20">
                    💡 راهنمایی: ابتدا با دکمه «شنیدن» صدای مرجع را گوش کنید تا نت هدف را به خاطر بسپارید.
                  </p>
                </div>
              )}

              {/* Info for no-sound */}
              {result === 'no-sound' && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-800/30 rounded-xl p-3 text-right space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <MicOff className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <span className="text-xs font-bold text-red-700 dark:text-red-400">هیچ صدایی تشخیص داده نشد</span>
                  </div>
                  <div className="text-[11px] leading-relaxed text-red-800/80 dark:text-red-300/80 space-y-1">
                    <p>• مطمئن شوید میکروفون فعال است (دکمه میکروفون بالای صفحه)</p>
                    <p>• با صدای بلند و واضح بخوانید</p>
                    <p>• از بخش «تست میکروفون» سطح صدا را بررسی کنید</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tuner not active warning */}
        {phase === 'recording' && !isTunerActive && (
          <div className="flex items-center gap-2 text-amber-500 text-xs bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2">
            <MicOff className="h-3.5 w-3.5 shrink-0" />
            <span>در حال فعال‌سازی میکروفون...</span>
          </div>
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
