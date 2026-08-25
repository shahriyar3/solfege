'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { playNote, getSolfeggioScale } from '@/lib/audio-playback';
import type { NoteInfo } from '@/lib/audio-playback';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame,
  ChevronLeft,
  Play,
  Square,
  ArrowUp,
  ArrowDown,
  Waves,
  Clock,
  Gauge,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

interface StepNote {
  note: string;
  solfege: string;
  octave: number;
  frequency: number;
  duration: number; // seconds to hold
}

type ExerciseId = 'ascending' | 'descending' | 'trill' | 'sustain';
type SpeedId = 'slow' | 'medium' | 'fast';

interface ExerciseDef {
  id: ExerciseId;
  name: string;
  icon: React.ReactNode;
  getSteps: (scale: NoteInfo[]) => StepNote[];
}

interface WarmupModuleProps {
  soundEnabled?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

function toPersianNum(n: number): string {
  return String(n)
    .split('')
    .map((d) => PERSIAN_DIGITS[parseInt(d)])
    .join('');
}

// ─── Note color gradients ──────────────────────────────────

const NOTE_GRADIENTS: Record<string, string> = {
  C: 'from-red-400 to-rose-500',
  D: 'from-orange-400 to-amber-500',
  E: 'from-yellow-400 to-yellow-500',
  F: 'from-green-400 to-emerald-500',
  G: 'from-teal-400 to-cyan-500',
  A: 'from-sky-400 to-blue-500',
  B: 'from-violet-400 to-purple-500',
};

// ─── Speed configs (ms per note) ───────────────────────────

const SPEED_CONFIG: Record<SpeedId, { label: string; ms: number }> = {
  slow: { label: 'آهسته', ms: 500 },
  medium: { label: 'متوسط', ms: 300 },
  fast: { label: 'سریع', ms: 150 },
};

// ─── Exercise Definitions ──────────────────────────────────

function getExerciseDefs(): ExerciseDef[] {
  return [
    {
      id: 'ascending',
      name: 'حرکت صعودی',
      icon: <ArrowUp className="h-4 w-4" />,
      getSteps: (scale) => {
        const steps: StepNote[] = scale.map((n) => ({
          note: n.note,
          solfege: n.solfege,
          octave: n.octave,
          frequency: n.frequency,
          duration: 0.8,
        }));
        // Add the octave-up C
        const highC: NoteInfo = {
          note: 'C',
          solfege: 'دو',
          octave: 5,
          frequency: 523.25,
        };
        steps.push({
          note: highC.note,
          solfege: highC.solfege,
          octave: highC.octave,
          frequency: highC.frequency,
          duration: 1.0,
        });
        return steps;
      },
    },
    {
      id: 'descending',
      name: 'حرکت نزولی',
      icon: <ArrowDown className="h-4 w-4" />,
      getSteps: () => {
        const highC: StepNote = {
          note: 'C',
          solfege: 'دو',
          octave: 5,
          frequency: 523.25,
          duration: 1.0,
        };
        const scale = getSolfeggioScale(4);
        const descending = [...scale].reverse().map((n) => ({
          note: n.note,
          solfege: n.solfege,
          octave: n.octave,
          frequency: n.frequency,
          duration: 0.8,
        }));
        return [highC, ...descending];
      },
    },
    {
      id: 'trill',
      name: 'تریل',
      icon: <Waves className="h-4 w-4" />,
      getSteps: (scale) => {
        const steps: StepNote[] = [];
        // C-D-C-D (4 times), D-E-D-E, E-F-E-F
        const pairs: [number, number][] = [[0, 1], [1, 2], [2, 3]];
        for (const [a, b] of pairs) {
          for (let i = 0; i < 4; i++) {
            const na = scale[a];
            const nb = scale[b];
            steps.push({
              note: na.note, solfege: na.solfege,
              octave: na.octave, frequency: na.frequency, duration: 0.3,
            });
            steps.push({
              note: nb.note, solfege: nb.solfege,
              octave: nb.octave, frequency: nb.frequency, duration: 0.3,
            });
          }
        }
        return steps;
      },
    },
    {
      id: 'sustain',
      name: 'سرج آرام',
      icon: <Clock className="h-4 w-4" />,
      getSteps: () => {
        const scale = getSolfeggioScale(4);
        const indices = [0, 2, 4]; // C, E, G
        const steps: StepNote[] = indices.map((i) => ({
          note: scale[i].note,
          solfege: scale[i].solfege,
          octave: scale[i].octave,
          frequency: scale[i].frequency,
          duration: 3.0,
        }));
        // Add C5
        steps.push({
          note: 'C',
          solfege: 'دو',
          octave: 5,
          frequency: 523.25,
          duration: 3.0,
        });
        return steps;
      },
    },
  ];
}

// ─── Component ──────────────────────────────────────────────

export function WarmupModule({ soundEnabled = true }: WarmupModuleProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeExercise, setActiveExercise] = useState<ExerciseId>('ascending');
  const [currentStep, setCurrentStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<SpeedId>('medium');

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const playStepRef = useRef<(idx: number) => void>(() => {});
  const scale = useMemo(() => getSolfeggioScale(4), []);
  const exercises = useMemo(() => getExerciseDefs(), []);

  const steps = useMemo(
    () => exercises.find((e) => e.id === activeExercise)?.getSteps(scale) ?? [],
    [activeExercise, exercises, scale],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (stopRef.current) stopRef.current();
    };
  }, []);

  const stopAll = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (stopRef.current) {
      stopRef.current();
      stopRef.current = null;
    }
    setIsPlaying(false);
    setCurrentStep(-1);
  }, []);

  // Keep latest playStep in a ref so setTimeout can always call the current version
  const playStepFn = useCallback(
    (stepIndex: number) => {
      if (stepIndex >= steps.length) {
        stopAll();
        return;
      }

      const step = steps[stepIndex];
      setCurrentStep(stepIndex);

      if (soundEnabled) {
        // Stop previous note
        if (stopRef.current) {
          stopRef.current();
          stopRef.current = null;
        }
        const { stop } = playNote(step.frequency, step.duration);
        stopRef.current = stop;
      }

      // Determine delay before next step
      let delay: number;
      if (activeExercise === 'trill') {
        delay = SPEED_CONFIG[speed].ms;
      } else if (activeExercise === 'sustain') {
        delay = step.duration * 1000 + 400; // 3s hold + 400ms pause
      } else {
        // ascending / descending
        delay = step.duration * 1000 + 200; // 0.8s hold + 200ms pause
      }

      timerRef.current = setTimeout(() => {
        playStepRef.current(stepIndex + 1);
      }, delay);
    },
    [steps, soundEnabled, activeExercise, speed, stopAll],
  );

  useEffect(() => {
    playStepRef.current = playStepFn;
  }, [playStepFn]);

  const handlePlay = useCallback(() => {
    if (isPlaying) {
      stopAll();
      return;
    }
    setIsPlaying(true);
    setCurrentStep(0);
    playStepRef.current(0);
  }, [isPlaying, stopAll]);

  const handleExerciseChange = useCallback(
    (id: ExerciseId) => {
      stopAll();
      setActiveExercise(id);
    },
    [stopAll],
  );

  // ─── Teaser ─────────────────────────────────────────────
  if (!expanded) {
    return (
      <Card
        className="border-dashed border-2 border-border/30 bg-gradient-to-br from-muted/10 to-muted/5 hover:border-orange-300/40 transition-all duration-300 group cursor-pointer card-hover"
        onClick={() => setExpanded(true)}
      >
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:shadow-orange-500/35 transition-all duration-300 group-hover:scale-105">
            <Flame className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold">گرم کردن صدا</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              تمرینات گرم کردن قبل از سلفژ
            </p>
            <div className="flex gap-1.5 mt-1.5">
              <Badge variant="outline" className="text-[9px] h-4">
                ۴ تمرین
              </Badge>
            </div>
          </div>
          <ChevronLeft className="h-5 w-5 text-muted-foreground/50 group-hover:text-orange-500 transition-colors" />
        </CardContent>
      </Card>
    );
  }

  // ─── Active State ───────────────────────────────────────
  const currentStepData = currentStep >= 0 && currentStep < steps.length
    ? steps[currentStep]
    : null;

  const currentExerciseDef = exercises.find((e) => e.id === activeExercise)!;

  return (
    <Card className="border border-border/40 bg-card/90 backdrop-blur-sm shadow-lg shadow-black/[0.04] overflow-hidden">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            گرم کردن صدا
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              stopAll();
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
        {/* Exercise selector tabs */}
        <div className="flex gap-1.5">
          {exercises.map((ex) => (
            <button
              key={ex.id}
              onClick={() => handleExerciseChange(ex.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-medium transition-all duration-200',
                activeExercise === ex.id
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md shadow-orange-500/25'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted',
              )}
            >
              {ex.icon}
              <span className="hidden sm:inline">{ex.name}</span>
            </button>
          ))}
        </div>

        {/* Speed control for trill */}
        {activeExercise === 'trill' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center justify-center gap-2"
          >
            <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">سرعت:</span>
            {(Object.keys(SPEED_CONFIG) as SpeedId[]).map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={cn(
                  'h-7 px-2.5 rounded-md text-[11px] font-medium transition-all',
                  speed === s
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                )}
              >
                {SPEED_CONFIG[s].label}
              </button>
            ))}
          </motion.div>
        )}

        {/* Current note display */}
        <div className="flex justify-center py-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStepData ? `${currentStepData.note}-${currentStepData.octave}-${currentStep}` : 'empty'}
              initial={{ scale: 0.85, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: -10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="relative"
            >
              <div
                className={cn(
                  'relative h-32 w-32 rounded-full flex flex-col items-center justify-center transition-all duration-300',
                  'bg-gradient-to-br from-muted/80 to-muted/40 border-2 border-border/30',
                  currentStepData && isPlaying
                    ? 'border-orange-400 shadow-lg shadow-orange-500/20'
                    : 'hover:border-border/50',
                )}
              >
                {currentStepData && isPlaying ? (
                  <>
                    {/* Pulsing ring */}
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-orange-400/40"
                      animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0, 0.4] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <span
                      className={cn(
                        'text-3xl font-bold bg-gradient-to-br bg-clip-text text-transparent',
                        NOTE_GRADIENTS[currentStepData.note] ?? 'from-gray-400 to-gray-500',
                      )}
                    >
                      {currentStepData.solfege}
                    </span>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      {currentStepData.note}{toPersianNum(currentStepData.octave)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl text-muted-foreground/40">
                      {currentExerciseDef.icon}
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-1">
                      {currentExerciseDef.name}
                    </span>
                  </>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Step progress dots */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          {steps.map((step, i) => {
            const isCurrent = i === currentStep && isPlaying;
            const isPast = i < currentStep && isPlaying;
            return (
              <motion.div
                key={i}
                initial={false}
                animate={{
                  scale: isCurrent ? 1.4 : 1,
                  opacity: isPast ? 0.4 : isCurrent ? 1 : 0.25,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className={cn(
                  'h-2 w-2 rounded-full transition-colors duration-200',
                  isCurrent
                    ? cn('bg-gradient-to-br', NOTE_GRADIENTS[step.note] ?? 'from-gray-400 to-gray-500')
                    : isPast
                      ? 'bg-muted-foreground/40'
                      : 'bg-border',
                )}
              />
            );
          })}
        </div>

        {/* Play / Stop button */}
        <div className="flex justify-center">
          <Button
            onClick={handlePlay}
            className={cn(
              'h-11 px-8 rounded-full font-medium transition-all duration-300',
              isPlaying
                ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-lg shadow-red-500/25'
                : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-lg shadow-orange-500/25',
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isPlaying ? (
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
                  key="play"
                  initial={{ scale: 0, rotate: 90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: -90 }}
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" fill="currentColor" />
                  شروع
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </div>

        {/* Step counter */}
        {isPlaying && currentStep >= 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-[11px] text-muted-foreground"
          >
            نت {toPersianNum(currentStep + 1)} از {toPersianNum(steps.length)}
          </motion.p>
        )}
      </CardContent>
    </Card>
  );
}
