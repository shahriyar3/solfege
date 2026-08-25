'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wind,
  Play,
  Square,
  X,
  ChevronLeft,
  Clock,
  RotateCcw,
  Timer,
} from 'lucide-react';

// ─── Persian numeral helper ────────────────────────────────

function toPersianNum(n: number): string {
  const d = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  return String(n).replace(/\d/g, c => d[parseInt(c)]);
}

// ─── Types ────────────────────────────────────────────────

type Phase = 'inhale' | 'hold' | 'exhale';

interface Pattern {
  id: string;
  label: string;
  name: string;
  inhale: number;
  hold: number;
  exhale: number;
}

interface BreathingExerciseProps {
  soundEnabled: boolean;
}

// ─── Patterns ─────────────────────────────────────────────

const PATTERNS: Pattern[] = [
  { id: '4-4-8', label: '۴-۴-۸', name: 'آرام‌بخش', inhale: 4, hold: 4, exhale: 8 },
  { id: '4-7-8', label: '۴-۷-۸', name: 'تمرکز', inhale: 4, hold: 7, exhale: 8 },
  { id: '6-2-6', label: '۶-۲-۶', name: 'انرژی‌بخش', inhale: 6, hold: 2, exhale: 6 },
];

const PHASE_LABELS: Record<Phase, string> = {
  inhale: 'نفس کشیدن',
  hold: 'نگه داشتن',
  exhale: 'بازدم',
};

// ─── Component ─────────────────────────────────────────────

export function BreathingExercise({ soundEnabled }: BreathingExerciseProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<Pattern>(PATTERNS[0]);
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>('inhale');
  const [countdown, setCountdown] = useState(0);
  const [cycles, setCycles] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const phaseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const countdownRef = useRef(0);

  // ─── Audio helpers ──────────────────────────────────────

  const stopAudio = useCallback(() => {
    try {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
        oscillatorRef.current = null;
      }
      if (gainRef.current) {
        gainRef.current.disconnect();
        gainRef.current = null;
      }
    } catch {
      // ignore
    }
  }, []);

  const playTone = useCallback(
    (startFreq: number, endFreq: number, duration: number) => {
      if (!soundEnabled) return;
      stopAudio();
      try {
        // Always create a fresh context for reliability
        if (audioCtxRef.current) {
          try { audioCtxRef.current.close(); } catch { /* */ }
          audioCtxRef.current = null;
        }
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        // Ensure context is running (resume in user gesture context)
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + duration);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.3);
        gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + duration - 0.3);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
        oscillatorRef.current = osc;
        gainRef.current = gain;
      } catch {
        // ignore audio errors
      }
    },
    [soundEnabled, stopAudio],
  );

  // ─── Stop everything ────────────────────────────────────

  const stopExercise = useCallback(() => {
    if (phaseTimerRef.current) {
      clearInterval(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    stopAudio();
    setIsRunning(false);
    setPhase('inhale');
    setCountdown(0);
  }, [stopAudio]);

  // ─── Start a phase (via ref to avoid self-reference) ────

  const startPhaseRef = useRef<(p: Phase) => void>(() => {});

  const startPhaseInner = useCallback(
    (p: Phase) => {
      let duration: number;
      switch (p) {
        case 'inhale':
          duration = selectedPattern.inhale;
          if (soundEnabled) playTone(200, 400, duration);
          break;
        case 'hold':
          duration = selectedPattern.hold;
          break;
        case 'exhale':
          duration = selectedPattern.exhale;
          if (soundEnabled) playTone(400, 200, duration);
          break;
      }

      setPhase(p);
      setCountdown(duration);
      countdownRef.current = duration;

      if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);

      phaseTimerRef.current = setInterval(() => {
        countdownRef.current -= 1;
        if (countdownRef.current <= 0) {
          if (p === 'exhale') {
            setCycles((c) => c + 1);
            startPhaseRef.current('inhale');
          } else if (p === 'inhale') {
            startPhaseRef.current('hold');
          } else {
            startPhaseRef.current('exhale');
          }
        } else {
          setCountdown(countdownRef.current);
        }
      }, 1000);
    },
    [selectedPattern, soundEnabled, playTone],
  );

  useEffect(() => {
    startPhaseRef.current = startPhaseInner;
  }, [startPhaseInner]);

  // ─── Handle play/stop ───────────────────────────────────

  const handleToggle = useCallback(() => {
    if (isRunning) {
      stopExercise();
      return;
    }

    setCycles(0);
    setElapsed(0);
    setIsRunning(true);

    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);

    startPhaseRef.current('inhale');
  }, [isRunning, stopExercise]);

  // ─── Handle pattern change ──────────────────────────────

  const handlePatternChange = useCallback(
    (p: Pattern) => {
      if (isRunning) stopExercise();
      setCycles(0);
      setElapsed(0);
      setSelectedPattern(p);
    },
    [isRunning, stopExercise],
  );

  // ─── Handle reset ───────────────────────────────────────

  const handleReset = useCallback(() => {
    stopExercise();
    setCycles(0);
    setElapsed(0);
  }, [stopExercise]);

  // ─── Cleanup on unmount ─────────────────────────────────

  useEffect(() => {
    return () => {
      if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      stopAudio();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, [stopAudio]);

  // ─── Derived values ─────────────────────────────────────

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${toPersianNum(minutes)}:${toPersianNum(seconds.toString().padStart(2, '0'))}`;

  // Circle animation params based on phase
  const getCircleScale = () => {
    if (!isRunning) return 1;
    switch (phase) {
      case 'inhale':
        return 1.5;
      case 'hold':
        return 1.5;
      case 'exhale':
        return 1;
    }
  };

  const getCircleColor = () => {
    if (!isRunning) return '#6b7280';
    switch (phase) {
      case 'inhale':
        return '#34d399'; // emerald-400
      case 'hold':
        return '#fbbf24'; // amber-400
      case 'exhale':
        return '#38bdf8'; // sky-400
    }
  };

  const getRingColor = () => {
    if (!isRunning) return 'rgba(107,114,128,0.2)';
    switch (phase) {
      case 'inhale':
        return 'rgba(52,211,153,0.35)';
      case 'hold':
        return 'rgba(251,191,36,0.35)';
      case 'exhale':
        return 'rgba(56,189,248,0.35)';
    }
  };

  // ─── Teaser ─────────────────────────────────────────────

  if (!expanded) {
    return (
      <Card
        className="border-dashed border-2 border-border/30 bg-gradient-to-br from-muted/10 to-muted/5 hover:border-emerald-300/40 transition-all duration-300 group cursor-pointer card-hover"
        onClick={() => setExpanded(true)}
      >
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/35 transition-all duration-300 group-hover:scale-105">
            <Wind className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold">تمرین تنفس</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              تمرین کنترل تنفس برای خوانندگی
            </p>
            <div className="flex gap-1.5 mt-1.5">
              <Badge variant="outline" className="text-[9px] h-4">
                ۳ الگو
              </Badge>
            </div>
          </div>
          <ChevronLeft className="h-5 w-5 text-muted-foreground/50 group-hover:text-emerald-500 transition-colors" />
        </CardContent>
      </Card>
    );
  }

  // ─── Active State ───────────────────────────────────────

  return (
    <Card className="border border-border/40 bg-card/90 backdrop-blur-sm shadow-lg shadow-black/[0.04] overflow-hidden">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Wind className="h-4 w-4 text-emerald-500" />
            تمرین تنفس
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
              onClick={() => {
                stopExercise();
                setExpanded(false);
              }}
              className="h-7 w-7 p-0 text-muted-foreground"
              title="بستن"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {/* Pattern selector */}
        <div className="flex gap-1.5">
          {PATTERNS.map((p) => (
            <button
              key={p.id}
              onClick={() => handlePatternChange(p)}
              disabled={isRunning}
              className={cn(
                'flex-1 h-9 rounded-lg text-xs font-medium transition-all duration-200 flex flex-col items-center justify-center leading-tight',
                selectedPattern.id === p.id
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/25'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted disabled:opacity-50',
              )}
            >
              <span className="font-bold">{p.label}</span>
              <span className="text-[9px] opacity-80">{p.name}</span>
            </button>
          ))}
        </div>

        {/* Breathing circle */}
        <div className="flex justify-center py-4">
          <div className="relative w-52 h-52 flex items-center justify-center">
            <svg
              width="208"
              height="208"
              viewBox="0 0 208 208"
              className="absolute inset-0"
            >
              {/* Outer pulsing ring */}
              {isRunning && (
                <motion.circle
                  cx="104"
                  cy="104"
                  r="80"
                  fill="none"
                  stroke={getRingColor()}
                  strokeWidth="2"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0, 0.5],
                  }}
                  transition={{
                    duration: phase === 'hold' ? 2 : 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  style={{ originX: '104px', originY: '104px' }}
                />
              )}
              {/* Main breathing circle */}
              <motion.circle
                cx="104"
                cy="104"
                r="60"
                fill={getCircleColor()}
                opacity={0.2}
                animate={{
                  scale: getCircleScale(),
                  fill: getCircleColor(),
                }}
                transition={{
                  duration: isRunning
                    ? phase === 'inhale'
                      ? selectedPattern.inhale
                      : phase === 'exhale'
                        ? selectedPattern.exhale
                        : 0.3
                    : 0.3,
                  ease: 'easeInOut',
                }}
                style={{ originX: '104px', originY: '104px' }}
              />
              {/* Inner circle (brighter) */}
              <motion.circle
                cx="104"
                cy="104"
                r="45"
                fill={getCircleColor()}
                opacity={0.15}
                animate={{
                  scale: getCircleScale(),
                  fill: getCircleColor(),
                }}
                transition={{
                  duration: isRunning
                    ? phase === 'inhale'
                      ? selectedPattern.inhale
                      : phase === 'exhale'
                        ? selectedPattern.exhale
                        : 0.3
                    : 0.3,
                  ease: 'easeInOut',
                }}
                style={{ originX: '104px', originY: '104px' }}
              />
            </svg>

            {/* Center text overlay */}
            <div className="relative z-10 flex flex-col items-center justify-center text-center">
              <AnimatePresence mode="wait">
                {isRunning ? (
                  <motion.div
                    key={phase}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center"
                  >
                    <span className="text-lg font-bold text-foreground">
                      {PHASE_LABELS[phase]}
                    </span>
                    <span className="text-3xl font-bold mt-1" style={{ color: getCircleColor() }}>
                      {toPersianNum(countdown)}
                    </span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center"
                  >
                    <Wind className="h-8 w-8 text-muted-foreground/30" />
                    <span className="text-xs text-muted-foreground mt-2">
                      برای شروع دکمه را بزنید
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            <span>
              {toPersianNum(cycles)} دوره
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>{timeStr}</span>
          </div>
        </div>

        {/* Play / Stop button */}
        <div className="flex justify-center">
          <Button
            onClick={handleToggle}
            className={cn(
              'h-11 px-8 rounded-full font-medium transition-all duration-300',
              isRunning
                ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-lg shadow-red-500/25'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25',
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isRunning ? (
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
      </CardContent>
    </Card>
  );
}
