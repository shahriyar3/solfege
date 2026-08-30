'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { playNote, playCorrectSound, playWrongSound, ensureAudioReady } from '@/lib/audio-playback';
import { SCALES, getScaleFrequencies } from '@/lib/scale-patterns';
import type { ScaleDefinition } from '@/lib/scale-patterns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music4,
  Play,
  X,
  ChevronLeft,
  RotateCcw,
  Check,
  Zap,
  VolumeX,
  Pause,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandomScale(): ScaleDefinition {
  return SCALES[Math.floor(Math.random() * SCALES.length)];
}

function octaveToBaseMidi(octave: number): number {
  return (octave + 1) * 12;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ScalePatternsProps {
  soundEnabled?: boolean;
}

export function ScalePatterns({ soundEnabled = true }: ScalePatternsProps) {
  const [expanded, setExpanded] = useState(false);
  const [octave, setOctave] = useState(4);
  const [currentScale, setCurrentScale] = useState<ScaleDefinition | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [selected, setSelected] = useState<ScaleDefinition | null>(null);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [streak, setStreak] = useState(0);

  const mountedRef = useRef(true);
  const stopCallbacksRef = useRef<Array<() => void>>([]);
  const playTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const accuracy = attempts > 0 ? Math.round((score / attempts) * 100) : 0;

  const stopAllPlayback = useCallback(() => {
    stopCallbacksRef.current.forEach((stop) => {
      try { stop(); } catch (_e) { /* already stopped */ }
    });
    stopCallbacksRef.current = [];
    playTimeoutsRef.current.forEach((t) => clearTimeout(t));
    playTimeoutsRef.current = [];
    if (mountedRef.current) {
      setIsPlaying(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopCallbacksRef.current.forEach((stop) => {
        try { stop(); } catch (_e) { /* already stopped */ }
      });
      stopCallbacksRef.current = [];
      playTimeoutsRef.current.forEach((t) => clearTimeout(t));
      playTimeoutsRef.current = [];
    };
  }, []);

  const handlePlay = useCallback(() => {
    if (!soundEnabled || !currentScale || isPlaying) return;
    stopAllPlayback();
    setIsPlaying(true);
    setHasPlayed(true);

    const baseMidi = octaveToBaseMidi(octave);
    const ascending = getScaleFrequencies(currentScale.intervals, baseMidi);
    // Descending: reverse, skip the last note (octave duplicate)
    const descending = ascending.slice(0, -1).reverse();
    const allNotes = [...ascending, ...descending];
    const noteDuration = 0.4;
    const noteGap = 0.1;
    const stepMs = (noteDuration + noteGap) * 1000;

    allNotes.forEach((freq, idx) => {
      const t = setTimeout(() => {
        if (!mountedRef.current) return;
        const handle = playNote(freq, noteDuration);
        stopCallbacksRef.current.push(handle.stop);
      }, idx * stepMs);
      playTimeoutsRef.current.push(t);
    });

    const endT = setTimeout(() => {
      if (mountedRef.current) {
        setIsPlaying(false);
      }
    }, allNotes.length * stepMs);
    playTimeoutsRef.current.push(endT);
  }, [soundEnabled, currentScale, isPlaying, octave, stopAllPlayback]);

  const handleChoice = useCallback(
    (scale: ScaleDefinition) => {
      if (selected || !hasPlayed || isPlaying) return;
      ensureAudioReady();
      setSelected(scale);
      setAttempts((a) => a + 1);
      if (scale.id === currentScale?.id) {
        if (soundEnabled) playCorrectSound();
        setScore((s) => s + 1);
        setStreak((s) => s + 1);
      } else {
        if (soundEnabled) playWrongSound();
        setStreak(0);
      }
    },
    [selected, hasPlayed, isPlaying, soundEnabled, currentScale]
  );

  const pickNewScale = useCallback(() => {
    setCurrentScale(pickRandomScale());
    setHasPlayed(false);
    setSelected(null);
  }, []);

  const handleNext = useCallback(() => {
    pickNewScale();
  }, [pickNewScale]);

  const handleReset = useCallback(() => {
    stopAllPlayback();
    setScore(0);
    setAttempts(0);
    setStreak(0);
    setCurrentScale(null);
    setHasPlayed(false);
    setSelected(null);
  }, [stopAllPlayback]);

  const handleActivate = useCallback(() => {
    setExpanded(true);
    handleReset();
    setTimeout(() => pickNewScale(), 0);
  }, [handleReset, pickNewScale]);

  const handleClose = useCallback(() => {
    stopAllPlayback();
    setExpanded(false);
  }, [stopAllPlayback]);

  const handleOctaveChange = useCallback(
    (oct: number) => {
      stopAllPlayback();
      setOctave(oct);
      setScore(0);
      setAttempts(0);
      setStreak(0);
      setCurrentScale(null);
      setHasPlayed(false);
      setSelected(null);
      setTimeout(() => pickNewScale(), 0);
    },
    [stopAllPlayback, pickNewScale]
  );

  // ----------------------------------------------------------------------
  // Teaser
  // ----------------------------------------------------------------------
  if (!expanded) {
    return (
      <Card
        className="border-dashed border-2 border-border/30 bg-gradient-to-br from-muted/10 to-muted/5 hover:border-violet-300/40 transition-all duration-300 group cursor-pointer card-hover"
        onClick={handleActivate}
      >
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/35 transition-all duration-300 group-hover:scale-105">
            <Music4 className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold">آزمون گام‌ها</h3>
            <p className="text-xs text-muted-foreground mt-0.5">گام را بشنوید و نوع آن را تشخیص دهید</p>
            <div className="flex gap-1.5 mt-1.5">
              <Badge variant="outline" className="text-[9px] h-4">
                ۶ گام
              </Badge>
            </div>
          </div>
          <ChevronLeft className="h-5 w-5 text-muted-foreground/50 group-hover:text-violet-500 transition-colors" />
        </CardContent>
      </Card>
    );
  }

  // ----------------------------------------------------------------------
  // Expanded quiz
  // ----------------------------------------------------------------------
  return (
    <Card className="border border-border/40 bg-card/90 backdrop-blur-sm shadow-lg shadow-black/[0.04] overflow-hidden">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Music4 className="h-4 w-4 text-violet-500" />
            آزمون گام‌ها
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-7 w-7 p-0 text-muted-foreground"
              title="بازنشانی"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-7 w-7 p-0 text-muted-foreground"
              title="بستن"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {/* Octave selector */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs text-muted-foreground">اکتاو:</span>
          <div className="flex gap-1">
            {[3, 4, 5].map((oct) => (
              <button
                key={oct}
                onClick={() => handleOctaveChange(oct)}
                className={cn(
                  'h-7 w-9 rounded-md text-xs font-medium transition-all',
                  octave === oct
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                {oct}
              </button>
            ))}
          </div>
        </div>

        {/* Play button */}
        <div className="flex justify-center py-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentScale?.id ?? 'empty'}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="relative"
            >
              <button
                onClick={handlePlay}
                disabled={!currentScale || !soundEnabled}
                className={cn(
                  'relative h-32 w-32 rounded-full flex flex-col items-center justify-center transition-all duration-300',
                  'bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-950/40 dark:to-purple-950/40 border-2 border-violet-200/50 dark:border-violet-700/30',
                  'hover:border-violet-400/50 hover:shadow-lg hover:shadow-violet-500/10',
                  'active:scale-95 cursor-pointer',
                  isPlaying && 'border-violet-400 shadow-lg shadow-violet-500/20',
                  !soundEnabled && 'opacity-60 cursor-not-allowed'
                )}
              >
                {isPlaying ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-1"
                  >
                    <Pause className="h-7 w-7 text-violet-500" />
                    <span className="text-[10px] text-violet-500 font-medium">در حال پخش…</span>
                  </motion.div>
                ) : !soundEnabled ? (
                  <VolumeX className="h-7 w-7 text-muted-foreground/40" />
                ) : (
                  <>
                    <Play className="h-8 w-8 text-violet-500" />
                    <span className="text-[10px] text-muted-foreground mt-1">
                      {hasPlayed ? 'پخش مجدد' : 'پخش گام'}
                    </span>
                  </>
                )}
              </button>

              {/* Ripple ring while playing */}
              {isPlaying && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-violet-400/50"
                  initial={{ scale: 1, opacity: 0.8 }}
                  animate={{ scale: 1.3, opacity: 0 }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Instruction text */}
        {!hasPlayed && !selected && (
          <p className="text-xs text-center text-muted-foreground">
            برای شنیدن گام، دکمه بالا را بزنید
          </p>
        )}

        {/* Answer grid — 2×3 */}
        <div className="grid grid-cols-2 gap-2">
          <AnimatePresence mode="wait">
            {SCALES.map((scale, idx) => {
              const isCorrectAnswer = currentScale?.id === scale.id;
              const isCorrectReveal = selected && isCorrectAnswer;
              const isWrongReveal = selected?.id === scale.id && !isCorrectAnswer;

              return (
                <motion.button
                  key={scale.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: idx * 0.04 }}
                  onClick={() => handleChoice(scale)}
                  disabled={!!selected || !hasPlayed || isPlaying}
                  className={cn(
                    'relative rounded-xl py-3 px-2 text-sm font-bold transition-all duration-200 border text-center',
                    !selected && hasPlayed && !isPlaying &&
                      'hover:border-violet-400/50 hover:bg-violet-50/50 dark:hover:bg-violet-950/20 cursor-pointer active:scale-95',
                    (!hasPlayed || isPlaying) && 'opacity-50 cursor-not-allowed',
                    selected && 'cursor-default',
                    isCorrectReveal &&
                      'bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-700/40 dark:text-emerald-400',
                    isWrongReveal &&
                      'bg-red-100 border-red-300 text-red-700 dark:bg-red-950/40 dark:border-red-700/40 dark:text-red-400',
                    selected && !isCorrectReveal && !isWrongReveal &&
                      'bg-muted/30 border-border/20 text-muted-foreground'
                  )}
                >
                  <div className="font-bold text-xs sm:text-sm">{scale.name}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{scale.description}</div>
                  {isCorrectReveal && (
                    <Check className="absolute top-1.5 left-1.5 h-3.5 w-3.5 text-emerald-500" />
                  )}
                  {isWrongReveal && (
                    <X className="absolute top-1.5 left-1.5 h-3.5 w-3.5 text-red-500" />
                  )}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Next button */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Button
                onClick={handleNext}
                className="w-full h-9 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white gap-1.5"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="text-sm font-medium">بعدی</span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 bg-gradient-to-b from-muted/30 to-muted/15 rounded-xl p-3 border border-border/10">
          <div className="text-center">
            <div className="flex items-center justify-center gap-0.5">
              <Check className="h-3 w-3 text-emerald-500" />
              <span className="text-base font-bold tabular-nums">{score}</span>
            </div>
            <div className="text-[9px] text-muted-foreground">درست</div>
          </div>
          <div className="text-center">
            <div className="text-base font-bold tabular-nums">{attempts}</div>
            <div className="text-[9px] text-muted-foreground">کل</div>
          </div>
          <div className="text-center">
            <div className="text-base font-bold tabular-nums text-violet-500">{accuracy}%</div>
            <div className="text-[9px] text-muted-foreground">دقت</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-0.5">
              <Zap className="h-3 w-3 text-amber-500" />
              <span className="text-base font-bold tabular-nums text-amber-500">{streak}</span>
            </div>
            <div className="text-[9px] text-muted-foreground">پاس متوالی</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
