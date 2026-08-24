'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getSolfeggioScale, getChromaticScale, playNote, playCorrectSound, playWrongSound } from '@/lib/audio-playback';
import type { PitchResult } from '@/lib/pitch-detection';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCcw,
  Trophy,
  Target,
  Volume2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

type Difficulty = 'easy' | 'medium' | 'hard';

const DIFFICULTY_CONFIG: Record<Difficulty, {
  label: string;
  threshold: number;
  description: string;
  color: string;
  bg: string;
  border: string;
}> = {
  easy: {
    label: 'آسان',
    threshold: 20,
    description: '±۲۰ سنت',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800/40',
  },
  medium: {
    label: 'متوسط',
    threshold: 10,
    description: '±۱۰ سنت',
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-50 dark:bg-yellow-950/30',
    border: 'border-yellow-200 dark:border-yellow-800/40',
  },
  hard: {
    label: 'سخت',
    threshold: 5,
    description: '±۵ سنت',
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800/40',
  },
};

const NOTE_COLORS: Record<string, string> = {
  'C': 'from-red-400 to-rose-500',
  'C#': 'from-rose-400 to-pink-500',
  'D': 'from-orange-400 to-amber-500',
  'D#': 'from-amber-400 to-yellow-500',
  'E': 'from-yellow-400 to-yellow-500',
  'F': 'from-green-400 to-emerald-500',
  'F#': 'from-emerald-400 to-teal-500',
  'G': 'from-teal-400 to-cyan-500',
  'G#': 'from-cyan-400 to-sky-500',
  'A': 'from-sky-400 to-blue-500',
  'A#': 'from-blue-400 to-indigo-500',
  'B': 'from-violet-400 to-purple-500',
};

interface PracticeModeProps {
  currentPitch: PitchResult | null;
  isActive: boolean;
}

type ScaleType = 'natural' | 'chromatic';

export function PracticeMode({ currentPitch, isActive }: PracticeModeProps) {
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [scaleType, setScaleType] = useState<ScaleType>('natural');
  const [targetIndex, setTargetIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [noteResult, setNoteResult] = useState<'correct' | 'wrong' | null>(null);
  const [isPlayingRef, setIsPlayingRef] = useState(false);
  const [practiceOctave, setPracticeOctave] = useState(4);
  const detectedRef = useRef(false);
  const playRefRef = useRef<() => void>(() => {});

  const scale = scaleType === 'chromatic' ? getChromaticScale(practiceOctave) : getSolfeggioScale(practiceOctave);
  const targetNote = scale[targetIndex];
  const config = DIFFICULTY_CONFIG[difficulty];

  // Check if current pitch matches target — uses timeout to avoid synchronous setState in effect
  useEffect(() => {
    if (!isActive || !currentPitch || !isPracticeMode || detectedRef.current) return;

    const matchesNote = currentPitch.note === targetNote.note && currentPitch.octave === targetNote.octave;
    const withinThreshold = Math.abs(currentPitch.cents) <= config.threshold;

    if (matchesNote && withinThreshold) {
      detectedRef.current = true;
      queueMicrotask(() => {
        playCorrectSound();
        setNoteResult('correct');
        setScore((s) => s + 1);
        setAttemptCount((a) => a + 1);
        setStreak((s) => {
          const next = s + 1;
          setBestStreak((b) => Math.max(b, next));
          return next;
        });
      });

      // Auto-advance after 1.5s
      const timeout = setTimeout(() => {
        setTargetIndex((i) => (i + 1) % scale.length);
        setNoteResult(null);
        detectedRef.current = false;
      }, 1500);

      return () => clearTimeout(timeout);
    }
  }, [currentPitch, isActive, isPracticeMode, targetNote, config.threshold, scale.length]);

  const handlePlayReference = useCallback(() => {
    const stop = playNote(targetNote.frequency, 1.5);
    playRefRef.current = stop;
    setIsPlayingRef(true);
    setTimeout(() => setIsPlayingRef(false), 1500);
  }, [targetNote.frequency]);

  const handleNext = useCallback(() => {
    playWrongSound();
    detectedRef.current = false;
    setNoteResult(null);
    setAttemptCount((a) => a + 1);
    setStreak(0);
    setTargetIndex((i) => (i + 1) % scale.length);
  }, [scale.length]);

  const handlePrev = useCallback(() => {
    detectedRef.current = false;
    setNoteResult(null);
    setTargetIndex((i) => (i - 1 + scale.length) % scale.length);
  }, [scale.length]);

  const handleReset = useCallback(() => {
    detectedRef.current = false;
    setTargetIndex(0);
    setScore(0);
    setAttemptCount(0);
    setStreak(0);
    setBestStreak(0);
    setNoteResult(null);
  }, []);

  if (!isPracticeMode) {
    return (
      <Card className="border-dashed border-2 border-border/40 bg-gradient-to-br from-muted/10 to-muted/5 hover:border-rose-300/50 transition-all duration-300 group cursor-pointer"
        onClick={() => setIsPracticeMode(true)}
      >
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-500/20 group-hover:shadow-rose-500/40 transition-shadow">
            <Target className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold">حالت تمرین</h3>
            <p className="text-xs text-muted-foreground mt-0.5">نت‌ها را به ترتیب بخوانید و امتیاز بگیرید</p>
            <div className="flex gap-1.5 mt-1.5">
              <Badge variant="outline" className="text-[9px] h-4">نت‌های طبیعی</Badge>
              <Badge variant="outline" className="text-[9px] h-4 text-amber-600 border-amber-300/50">کروماتیک</Badge>
            </div>
          </div>
          <ChevronLeft className="h-5 w-5 text-muted-foreground group-hover:text-rose-500 transition-colors" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/50 shadow-lg shadow-black/5 overflow-hidden">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Target className="h-4 w-4 text-rose-500" />
            حالت تمرین
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsPracticeMode(false)} className="h-7 text-xs text-muted-foreground">
            بستن
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {/* Scale type toggle */}
        <div className="flex gap-2 bg-muted/20 rounded-lg p-1">
          <button
            onClick={() => { setScaleType('natural'); setTargetIndex(0); detectedRef.current = false; setNoteResult(null); }}
            className={cn(
              'flex-1 py-1.5 rounded-md text-xs font-medium transition-all',
              scaleType === 'natural' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >طبیعی</button>
          <button
            onClick={() => { setScaleType('chromatic'); setTargetIndex(0); detectedRef.current = false; setNoteResult(null); }}
            className={cn(
              'flex-1 py-1.5 rounded-md text-xs font-medium transition-all',
              scaleType === 'chromatic' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >کروماتیک</button>
        </div>

        {/* Difficulty selector */}
        <div className="flex gap-2">
          {(Object.entries(DIFFICULTY_CONFIG) as [Difficulty, typeof DIFFICULTY_CONFIG.easy][]).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setDifficulty(key)}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all',
                difficulty === key
                  ? cn(cfg.bg, cfg.border, cfg.color)
                  : 'bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/50'
              )}
            >
              {cfg.label}
              <span className="block text-[10px] opacity-60 mt-0.5">{cfg.description}</span>
            </button>
          ))}
        </div>

        {/* Octave selector */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs text-muted-foreground">اکتاو:</span>
          <div className="flex gap-1">
            {[3, 4, 5].map((oct) => (
              <button
                key={oct}
                onClick={() => { setPracticeOctave(oct); setTargetIndex(0); detectedRef.current = false; setNoteResult(null); }}
                className={cn(
                  'h-7 w-9 rounded-md text-xs font-medium transition-all',
                  practiceOctave === oct
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                {oct}
              </button>
            ))}
          </div>
        </div>

        {/* Target note display */}
        <div className="flex flex-col items-center py-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${targetNote.note}-${targetNote.octave}`}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              className="flex flex-col items-center"
            >
              <div className={cn(
                'text-5xl sm:text-6xl font-black tabular-nums bg-gradient-to-br bg-clip-text text-transparent',
                NOTE_COLORS[targetNote.note] || 'from-gray-400 to-gray-500'
              )}>
                {targetNote.solfege}
              </div>
              <div className="text-sm text-muted-foreground font-mono mt-1">
                {targetNote.note}{targetNote.octave} — {targetNote.frequency} Hz
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Result indicator */}
          <AnimatePresence>
            {noteResult && (
              <motion.div
                initial={{ scale: 0, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0, y: -10 }}
                className={cn(
                  'mt-3 px-4 py-1.5 rounded-full text-sm font-bold',
                  noteResult === 'correct'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400'
                )}
              >
                {noteResult === 'correct' ? 'آفرین! درست بود' : 'دوباره تلاش کنید'}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Progress dots */}
        <div className={cn('flex justify-center', scale.length > 7 ? 'gap-1' : 'gap-1.5')}>{scale.map((n, i) => (
            <div
              key={i}
              className={cn(
                'rounded-full transition-all duration-300',
                scale.length > 7 ? 'h-1.5 w-1.5' : 'h-2 w-2',
                i === targetIndex
                  ? 'bg-rose-500 scale-125'
                  : i < targetIndex
                    ? 'bg-emerald-400'
                    : 'bg-muted'
              )}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrev} className="h-9 w-9 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePlayReference}
            className={cn('h-9 w-9 p-0 gap-1', isPlayingRef && 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/40')}
          >
            <Volume2 className={cn('h-4 w-4', isPlayingRef && 'text-amber-600')} />
          </Button>
          <Button variant="outline" size="sm" onClick={handleNext} className="h-9 w-9 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset} className="h-9 w-9 p-0 text-muted-foreground">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Score */}
        <div className="grid grid-cols-3 gap-2 bg-muted/30 rounded-xl p-3">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-lg font-bold tabular-nums">{score}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">امتیاز</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold tabular-nums">{streak}</div>
            <div className="text-[10px] text-muted-foreground">پاس‌متوالی</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold tabular-nums text-amber-500">{bestStreak}</div>
            <div className="text-[10px] text-muted-foreground">بهترین پاس</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
