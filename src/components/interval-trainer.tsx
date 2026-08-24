'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getNaturalNotes, playNote, playCorrectSound, playWrongSound } from '@/lib/audio-playback';
import type { NoteInfo } from '@/lib/audio-playback';
import type { PitchResult } from '@/lib/pitch-detection';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  RotateCcw,
  Trophy,
  Eye,
  ChevronLeft,
  ArrowUpRight,
  Volume2,
  SkipForward,
  Music,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SOLFEGE: Record<string, string> = {
  C: 'دو', 'C#': 'دو#', D: 'رِ', 'D#': 'رِ#',
  E: 'می', F: 'فا', 'F#': 'فا#',
  G: 'سل', 'G#': 'سل#', A: 'لا', 'A#': 'لا#', B: 'سی',
};

const A4_FREQ = 440.0;
const A4_MIDI = 69;

function midiToFreq(midi: number): number {
  return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12);
}

function midiToNoteInfo(midi: number): NoteInfo {
  const idx = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[idx];
  return { note: name, solfege: SOLFEGE[name] ?? name, octave: oct, frequency: Math.round(midiToFreq(midi) * 100) / 100 };
}

// ---------------------------------------------------------------------------
// Interval data
// ---------------------------------------------------------------------------

interface IntervalDef {
  semitones: number;
  short: string;
  persian: string;
}

interface IntervalCat {
  id: string;
  persian: string;
  english: string;
  intervals: IntervalDef[];
  color: string;
  bg: string;
  border: string;
}

const CATEGORIES: IntervalCat[] = [
  {
    id: 'seconds', persian: 'سکوند', english: 'Seconds',
    color: 'from-rose-400 to-pink-500',
    bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-800/40',
    intervals: [
      { semitones: 1, short: 'm2', persian: 'سکوند کوچک' },
      { semitones: 2, short: 'M2', persian: 'سکوند بزرگ' },
    ],
  },
  {
    id: 'tierce', persian: 'تیرس', english: 'Tierce',
    color: 'from-orange-400 to-amber-500',
    bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800/40',
    intervals: [
      { semitones: 3, short: 'm3', persian: 'تیرس کوچک' },
      { semitones: 4, short: 'M3', persian: 'تیرس بزرگ' },
    ],
  },
  {
    id: 'quarte', persian: 'کوارت', english: 'Quarte',
    color: 'from-emerald-400 to-green-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800/40',
    intervals: [{ semitones: 5, short: 'P4', persian: 'کوارت خالص' }],
  },
  {
    id: 'quinte', persian: 'کوینت', english: 'Quinte',
    color: 'from-cyan-400 to-blue-500',
    bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-200 dark:border-cyan-800/40',
    intervals: [
      { semitones: 6, short: 'TT', persian: 'تری‌تون' },
      { semitones: 7, short: 'P5', persian: 'کوینت خالص' },
    ],
  },
  {
    id: 'sext', persian: 'سکست', english: 'Sexte',
    color: 'from-violet-400 to-purple-500',
    bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200 dark:border-violet-800/40',
    intervals: [
      { semitones: 8, short: 'm6', persian: 'سکست کوچک' },
      { semitones: 9, short: 'M6', persian: 'سکست بزرگ' },
    ],
  },
  {
    id: 'sept', persian: 'سپتیم', english: 'Septime',
    color: 'from-fuchsia-400 to-pink-500',
    bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/30', border: 'border-fuchsia-200 dark:border-fuchsia-800/40',
    intervals: [
      { semitones: 10, short: 'm7', persian: 'سپتیم کوچک' },
      { semitones: 11, short: 'M7', persian: 'سپتیم بزرگ' },
    ],
  },
  {
    id: 'octave', persian: 'اکتاو', english: 'Octave',
    color: 'from-sky-400 to-indigo-500',
    bg: 'bg-sky-50 dark:bg-sky-950/30', border: 'border-sky-200 dark:border-sky-800/40',
    intervals: [{ semitones: 12, short: 'P8', persian: 'اکتاو' }],
  },
];

const ALL_INTERVALS: IntervalDef[] = CATEGORIES.flatMap((c) => c.intervals);

const ROOT_MIDI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function rootMidi(name: string, oct: number) {
  return (oct + 1) * 12 + ROOT_MIDI[name];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Phase = 'setup' | 'playing' | 'result';

interface IntervalTrainerProps {
  currentPitch: PitchResult | null;
  isActive: boolean;
}

export function IntervalTrainer({ currentPitch, isActive }: IntervalTrainerProps) {
  const [expanded, setExpanded] = useState(false);
  const [phase, setPhase] = useState<Phase>('setup');

  // Setup
  const [rootOct, setRootOct] = useState(4);
  const [rootName, setRootName] = useState('C');
  const [catId, setCatId] = useState<string | null>(null);
  const [intIdx, setIntIdx] = useState(0);

  // Play
  const [curInterval, setCurInterval] = useState<IntervalDef | null>(null);
  const [curCat, setCurCat] = useState<IntervalCat | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [playingRoot, setPlayingRoot] = useState(false);
  const [playingTarget, setPlayingTarget] = useState(false);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [resultCents, setResultCents] = useState<number | null>(null);

  // Score
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);

  const detected = useRef(false);
  const phaseRef = useRef<Phase>('setup');
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const notes = useMemo(() => getNaturalNotes(rootOct), [rootOct]);
  const root = notes.find((n) => n.note === rootName) ?? notes[0];
  const rMidi = rootMidi(root.note, root.octave);

  const tMidi = useMemo(() => (curInterval ? rMidi + curInterval.semitones : null), [rMidi, curInterval]);
  const target = useMemo(() => (tMidi !== null ? midiToNoteInfo(tMidi) : null), [tMidi]);

  const avail = useMemo(() => {
    if (!catId) return ALL_INTERVALS;
    const c = CATEGORIES.find((x) => x.id === catId);
    return c ? c.intervals : ALL_INTERVALS;
  }, [catId]);

  const selInterval = avail[intIdx] ?? avail[0];

  // Pitch detection
  useEffect(() => {
    if (!isActive || !currentPitch || phaseRef.current !== 'playing' || detected.current || tMidi === null) return;
    const tName = NOTE_NAMES[((tMidi % 12) + 12) % 12];
    const tOct = Math.floor(tMidi / 12) - 1;
    if (currentPitch.note === tName && currentPitch.octave === tOct && Math.abs(currentPitch.cents) <= 20) {
      detected.current = true;
      queueMicrotask(() => {
        playCorrectSound();
        setResult('correct');
        setResultCents(currentPitch.cents);
        setScore((s) => s + 1);
        setAttempts((a) => a + 1);
        setStreak((s) => { const n = s + 1; setBest((b) => Math.max(b, n)); return n; });
        setRevealed(true);
        setPhase('result');
      });
    }
  }, [currentPitch, isActive, tMidi]);

  const playRootNote = useCallback((freq: number) => {
    const { stop } = playNote(freq, 1.2);
    setPlayingRoot(true);
    setTimeout(() => { setPlayingRoot(false); stop(); }, 1300);
  }, []);

  const begin = useCallback(() => {
    let interval: IntervalDef;
    let category: IntervalCat | null = null;
    if (catId) {
      category = CATEGORIES.find((c) => c.id === catId) ?? null;
      interval = avail[intIdx] ?? avail[0];
    } else {
      interval = ALL_INTERVALS[Math.floor(Math.random() * ALL_INTERVALS.length)];
      category = CATEGORIES.find((c) => c.intervals.some((i) => i.semitones === interval.semitones)) ?? null;
    }
    setCurInterval(interval);
    setCurCat(category);
    setRevealed(false);
    setResult(null);
    setResultCents(null);
    detected.current = false;
    setPhase('playing');
    setTimeout(() => playRootNote(root.frequency), 300);
  }, [catId, avail, intIdx, root.frequency, playRootNote]);

  const reveal = useCallback(() => {
    playWrongSound();
    setRevealed(true);
    setResult('wrong');
    setAttempts((a) => a + 1);
    setStreak(0);
    setPhase('result');
  }, []);

  const next = useCallback(() => {
    let interval: IntervalDef;
    let category: IntervalCat | null = null;
    if (catId) {
      const nextIdx = (intIdx + 1) % avail.length;
      setIntIdx(nextIdx);
      category = CATEGORIES.find((c) => c.id === catId) ?? null;
      interval = avail[nextIdx];
    } else {
      interval = ALL_INTERVALS[Math.floor(Math.random() * ALL_INTERVALS.length)];
      category = CATEGORIES.find((c) => c.intervals.some((i) => i.semitones === interval.semitones)) ?? null;
    }
    setCurInterval(interval);
    setCurCat(category);
    setRevealed(false);
    setResult(null);
    setResultCents(null);
    detected.current = false;
    setPhase('playing');
    setTimeout(() => playRootNote(root.frequency), 300);
  }, [catId, intIdx, avail, root.frequency, playRootNote]);

  const reset = useCallback(() => {
    setPhase('setup');
    setCurInterval(null);
    setCurCat(null);
    setRevealed(false);
    setResult(null);
    setResultCents(null);
    detected.current = false;
    setScore(0);
    setAttempts(0);
    setStreak(0);
    setBest(0);
  }, []);

  const playTargetNote = useCallback(() => {
    if (!target) return;
    const { stop } = playNote(target.frequency, 1.2);
    setPlayingTarget(true);
    setTimeout(() => { setPlayingTarget(false); stop(); }, 1300);
  }, [target]);

  // ------------------------------------------------------------------
  // Teaser
  // ------------------------------------------------------------------
  if (!expanded) {
    return (
      <Card
        className="border-dashed border-2 border-border/40 bg-gradient-to-br from-muted/10 to-muted/5 hover:border-violet-300/50 transition-all duration-300 group cursor-pointer"
        onClick={() => setExpanded(true)}
      >
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40 transition-shadow">
            <Music className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold">تمرین فاصله</h3>
            <p className="text-xs text-muted-foreground mt-0.5">فاصله‌ها را بشنوید و بخوانید</p>
          </div>
          <ChevronLeft className="h-5 w-5 text-muted-foreground group-hover:text-violet-500 transition-colors" />
        </CardContent>
      </Card>
    );
  }

  // ------------------------------------------------------------------
  // Expanded card
  // ------------------------------------------------------------------
  return (
    <Card className="border border-border/50 shadow-lg shadow-black/5 overflow-hidden">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Music className="h-4 w-4 text-violet-500" />
            {'\u062a\u0645\u0631\u06cc\u0646 \u0641\u0627\u0635\u0644\u0647'}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setExpanded(false); reset(); }}
            className="h-7 text-xs text-muted-foreground"
          >
            {'\u0628\u0633\u062a\u0646'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {phase === 'setup' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Root note */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">
                {'\u0646\u062a \u067e\u0627\u06cc\u0647'}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {notes.map((n) => (
                  <button
                    key={`${n.note}${n.octave}`}
                    onClick={() => setRootName(n.note)}
                    className={cn(
                      'h-8 px-3 rounded-lg text-xs font-medium transition-all border',
                      rootName === n.note
                        ? 'bg-primary text-primary-foreground shadow-sm border-primary'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted border-transparent',
                    )}
                  >
                    {n.solfege}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-center gap-1.5 mt-2">
                <span className="text-xs text-muted-foreground">
                  {'\u0627\u06a9\u062a\u0627\u0648:'}
                </span>
                {[3, 4, 5].map((o) => (
                  <button
                    key={o}
                    onClick={() => setRootOct(o)}
                    className={cn(
                      'h-7 w-9 rounded-md text-xs font-medium transition-all',
                      rootOct === o
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">
                {'\u0646\u0648\u0639 \u0641\u0627\u0635\u0644\u0647'}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setCatId(null)}
                  className={cn(
                    'h-8 px-3 rounded-lg text-xs font-medium transition-all border',
                    catId === null
                      ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400 border-violet-200 dark:border-violet-800/40'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted border-transparent',
                  )}
                >
                  <span className="flex items-center gap-1">
                    <RotateCcw className="h-3 w-3" />
                    {'\u062a\u0635\u0627\u062f\u0641\u06cc'}
                  </span>
                </button>
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setCatId(c.id); setIntIdx(0); }}
                    className={cn(
                      'h-8 px-3 rounded-lg text-xs font-medium transition-all border',
                      catId === c.id
                        ? cn(c.bg, c.border, 'text-foreground')
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted border-transparent',
                    )}
                  >
                    {c.persian}
                    <span className="text-[10px] opacity-50 mr-1">{c.english}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-interval picker */}
            {catId && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  {'\u0641\u0627\u0635\u0644\u0647 \u062f\u0642\u06cc\u0642'}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {avail.map((iv, i) => (
                    <button
                      key={iv.semitones}
                      onClick={() => setIntIdx(i)}
                      className={cn(
                        'h-8 px-3 rounded-lg text-xs font-medium transition-all border',
                        intIdx === i
                          ? 'bg-primary text-primary-foreground shadow-sm border-primary'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted border-transparent',
                      )}
                    >
                      {iv.persian}
                      <span className="text-[10px] opacity-50 mr-1">{iv.short}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Preview & start */}
            <div className="flex flex-col items-center pt-2">
              <div className="text-lg font-bold text-muted-foreground">
                {root.solfege}{' '}
                <ArrowUpRight className="inline h-4 w-4" />{' '}
                {catId ? selInterval.persian : '\u0641\u0627\u0635\u0644\u0647 \u062a\u0635\u0627\u062f\u0641\u06cc'}
              </div>
              <Button
                onClick={begin}
                className="mt-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
              >
                <Play className="h-4 w-4 ml-1.5" />
                {'\u0634\u0631\u0648\u0639 \u062a\u0645\u0631\u06cc\u0646'}
              </Button>
            </div>
          </motion.div>
        )}

        {(phase === 'playing' || phase === 'result') && curInterval && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Header: root -> interval */}
            <div className="flex flex-col items-center py-2">
              <div className="flex items-center gap-3 mb-2">
                <div className="text-3xl font-black bg-gradient-to-br from-violet-400 to-indigo-500 bg-clip-text text-transparent">
                  {root.solfege}
                </div>
                <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
                <div className={cn('text-3xl font-black bg-gradient-to-br bg-clip-text text-transparent', curCat?.color ?? 'from-gray-400 to-gray-500')}>
                  {curInterval.persian}
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {curCat?.persian} ({curCat?.english})
              </Badge>
              <div className="text-xs text-muted-foreground font-mono mt-2">
                {root.note}{root.octave} {'\u2014'} {root.frequency} Hz
              </div>
            </div>

            {/* Target (hidden / revealed) */}
            <div className="flex flex-col items-center">
              {revealed && target ? (
                <AnimatePresence>
                  <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
                    <div className="text-xs text-muted-foreground mb-1">
                      {'\u0646\u062a \u0647\u062f\u0641:'}
                    </div>
                    <div className={cn('text-4xl font-black bg-gradient-to-br bg-clip-text text-transparent', curCat?.color ?? 'from-gray-400 to-gray-500')}>
                      {target.solfege}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono mt-1">
                      {target.note}{target.octave} {'\u2014'} {target.frequency} Hz
                    </div>
                  </motion.div>
                </AnimatePresence>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="text-xs text-muted-foreground mb-1">
                    {'\u0646\u062a \u0647\u062f\u0641:'}
                  </div>
                  <div className="h-12 w-28 rounded-xl bg-muted/50 border border-dashed border-border/50 flex items-center justify-center">
                    <span className="text-xs text-muted-foreground/60">؟</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground/50 mt-1">
                    {'\u0628\u062e\u0648\u0627\u0646\u06cc\u062f \u062a\u0627 \u0646\u062a\u06cc\u062c\u0647 \u0645\u0634\u062e\u0635 \u0634\u0648\u062f'}
                  </div>
                </div>
              )}
            </div>

            {/* Result pill */}
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ scale: 0, y: 10 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0, y: -10 }}
                  className={cn(
                    'py-2 px-4 rounded-full text-sm font-bold text-center',
                    result === 'correct'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400',
                  )}
                >
                  {result === 'correct'
                    ? (resultCents !== null && Math.abs(resultCents) <= 5
                        ? '\u0639\u0627\u0644\u06cc! \u062f\u0642\u06cc\u0642 \u0628\u0648\u062d \u2022'
                        : '\u0622\u0641\u0631\u06cc\u0646! \u062f\u0631\u0633\u062a \u0628\u0648\u062f \u2713')
                    : '\u0641\u0627\u0644\u0634 \u0628\u0648\u062f \u2717 \u0646\u062a \u0647\u062f\u0641 \u0631\u0627 \u0628\u0628\u06cc\u0646\u06cc\u062f'}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => playRootNote(root.frequency)}
                className={cn('h-9 gap-1.5', playingRoot && 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/40')}
              >
                <Volume2 className={cn('h-4 w-4', playingRoot && 'text-amber-600')} />
                <span className="text-xs">
                  {'\u067e\u0627\u06cc\u0647'}
                </span>
              </Button>

              {revealed && target && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={playTargetNote}
                  className={cn('h-9 gap-1.5', playingTarget && 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/40')}
                >
                  <Volume2 className={cn('h-4 w-4', playingTarget && 'text-emerald-600')} />
                  <span className="text-xs">
                    {'\u0647\u062f\u0641'}
                  </span>
                </Button>
              )}

              {phase === 'playing' && !revealed && (
                <Button variant="outline" size="sm" onClick={reveal} className="h-9 gap-1.5 text-orange-600">
                  <Eye className="h-4 w-4" />
                  <span className="text-xs">
                    {'\u0646\u0634\u0627\u0646 \u062f\u0627\u062f\u0646'}
                  </span>
                </Button>
              )}

              {phase === 'result' && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={next}
                  className="h-9 gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                >
                  <SkipForward className="h-4 w-4" />
                  <span className="text-xs">
                    {'\u0628\u0639\u062f\u06cc'}
                  </span>
                </Button>
              )}
            </div>

            {/* Score */}
            <div className="grid grid-cols-3 gap-2 bg-muted/30 rounded-xl p-3">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Trophy className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-lg font-bold tabular-nums">{score}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {'\u0627\u0645\u062a\u06cc\u0627\u0632'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold tabular-nums">{streak}</div>
                <div className="text-[10px] text-muted-foreground">
                  {'\u067e\u0627\u0633 \u0645\u062a\u0648\u0627\u0644\u06cc'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold tabular-nums text-amber-500">{best}</div>
                <div className="text-[10px] text-muted-foreground">
                  {'\u0628\u0647\u062a\u0631\u06cc\u0646 \u067e\u0627\u0633'}
                </div>
              </div>
            </div>

            <Button variant="ghost" size="sm" onClick={reset} className="w-full h-8 text-xs text-muted-foreground">
              <RotateCcw className="h-3.5 w-3.5 ml-1" />
              {'\u0628\u0627\u0632\u06af\u0634\u062a \u0628\u0647 \u062a\u0646\u0638\u06cc\u0645\u0627\u062a'}
            </Button>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
