'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { playClick } from '@/lib/audio-playback';
import { motion } from 'framer-motion';
import { Timer, Play, Pause, RotateCcw, Minus, Plus, Hand } from 'lucide-react';

interface MetronomeProps {
  isTunerActive: boolean;
}

export function Metronome({ isTunerActive }: MetronomeProps) {
  const [bpm, setBpm] = useState(80);
  const [isPlaying, setIsPlaying] = useState(false);
  const [beat, setBeat] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [tapBpm, setTapBpm] = useState<number | null>(null);
  const [tapRipple, setTapRipple] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tapTimesRef = useRef<number[]>([]);

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    intervalRef.current = null;
    timerRef.current = null;
    setIsPlaying(false);
    setBeat(0);
    setElapsed(0);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      const msPerBeat = (60 / bpm) * 1000;
      let currentBeat = 0;

      intervalRef.current = setInterval(() => {
        currentBeat = (currentBeat + 1) % 4;
        setBeat(currentBeat);
        const freq = currentBeat === 0 ? 1200 : 800;
        playClick(freq, 0.06);
      }, msPerBeat);

      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, bpm]);

  const handleTap = useCallback(() => {
    const now = Date.now();
    const times = tapTimesRef.current;

    if (times.length > 0 && now - times[times.length - 1] > 3000) {
      tapTimesRef.current = [];
    }

    tapTimesRef.current = [...tapTimesRef.current, now];

    if (tapTimesRef.current.length > 4) {
      tapTimesRef.current = tapTimesRef.current.slice(-4);
    }

    const t = tapTimesRef.current;
    if (t.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < t.length; i++) {
        intervals.push(t[i] - t[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgInterval);
      if (calculatedBpm >= 30 && calculatedBpm <= 300) {
        setTapBpm(calculatedBpm);
        setBpm(calculatedBpm);
      }
    }
    setTapRipple(true);
    setTimeout(() => setTapRipple(false), 600);
  }, []);

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const pendulumRotate = isPlaying
    ? (beat === 0 || beat === 2 ? 0 : beat === 1 ? 25 : -25)
    : 0;

  return (
    <Card className="border border-border/40 shadow-lg shadow-black/[0.03] bg-card/90 backdrop-blur-sm card-hover">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm shadow-emerald-500/25">
            <Timer className="h-3.5 w-3.5 text-white" />
          </div>
          <h3 className="text-sm font-bold">مترونوم</h3>
          <div className="flex-1" />
          {isPlaying && (
            <span className="text-xs font-mono text-muted-foreground/60 tabular-nums">{formatTime(elapsed)}</span>
          )}
        </div>

        <div className="flex justify-center mb-4">
          <div className="relative flex items-start justify-center w-20 h-9">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-foreground/30 z-10" />
            <motion.div
              className="absolute top-1 left-1/2 -translate-x-1/2 origin-top"
              animate={{ rotate: pendulumRotate }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <div className="w-0.5 h-7 bg-gradient-to-b from-foreground/60 to-foreground/20 rounded-full mx-auto" />
              <div className={cn(
                'h-3 w-3 rounded-full mx-auto -mt-0.5',
                isPlaying
                  ? (beat === 0
                    ? 'bg-rose-500 shadow-md shadow-rose-500/50'
                    : 'bg-emerald-500 shadow-md shadow-emerald-500/50')
                  : 'bg-muted-foreground/40'
              )} />
            </motion.div>
          </div>
        </div>

        <div className="flex justify-center gap-5 mb-4">
          {[0, 1, 2, 3].map(function(i) {
            const isCurrentBeat = isPlaying && i === beat;
            const isDownbeat = i === 0;
            return (
              <div key={i} className="relative flex items-center justify-center">
                {isCurrentBeat && (
                  <motion.div
                    className={cn(
                      'absolute rounded-full',
                      isDownbeat
                        ? 'w-10 h-10 ring-2 ring-rose-500/30'
                        : 'w-9 h-9 ring-2 ring-emerald-500/30'
                    )}
                    initial={{ scale: 0.6, opacity: 0.8 }}
                    animate={{ scale: 1.4, opacity: 0 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                )}
                <motion.div
                  className={cn(
                    'h-7 w-7 rounded-full transition-colors duration-75',
                    isCurrentBeat
                      ? isDownbeat
                        ? 'bg-rose-500 shadow-xl shadow-rose-500/50'
                        : 'bg-emerald-500 shadow-xl shadow-emerald-500/50'
                      : isPlaying
                        ? 'bg-muted'
                        : 'bg-muted/40'
                  )}
                  animate={isCurrentBeat ? { scale: [1, 1.6, 1], y: [0, -4, 0] } : { scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                />
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-4 mb-4">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setBpm((b) => Math.max(30, b - 5))}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <div className="text-center min-w-[80px]">
            <div className="text-3xl font-black tabular-nums leading-none">
              {bpm}
              {tapBpm !== null && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-xs font-normal text-amber-500 dark:text-amber-400 ml-1"
                >
                  tap
                </motion.span>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">ضرب در دقیقه</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setBpm((b) => Math.min(220, b + 5))}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        <div className="flex items-center justify-center gap-2">
          <motion.div whileTap={{ scale: 0.93 }} className="relative">
            {/* Tap ripple ring */}
            {tapRipple && (
              <motion.span
                className="absolute inset-0 rounded-md border-2 border-amber-400/40 pointer-events-none"
                initial={{ scale: 0.9, opacity: 0.7 }}
                animate={{ scale: 1.15, opacity: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleTap}
              disabled={isTunerActive && !isPlaying}
              className={cn(
                'gap-1.5 text-xs h-8 border-amber-300 dark:border-amber-700',
                'text-amber-700 dark:text-amber-400',
                'hover:bg-amber-50 dark:hover:bg-amber-950/30',
                'active:bg-amber-100 dark:active:bg-amber-950/50',
                tapRipple && 'scale-[0.97]'
              )}
            >
              <Hand className="h-3.5 w-3.5" />
              تپ
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.93 }}>
            <Button
              variant={isPlaying ? 'default' : 'outline'}
              size="sm"
              onClick={() => isPlaying ? stop() : setIsPlaying(true)}
              disabled={isTunerActive && !isPlaying}
              className={cn(
                'gap-1.5 text-xs h-8',
                isPlaying && 'bg-emerald-500 hover:bg-emerald-600 shadow-sm shadow-emerald-500/25'
              )}
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {isPlaying ? 'توقف' : 'شروع'}
            </Button>
          </motion.div>
          {isPlaying && (
            <Button variant="ghost" size="sm" onClick={stop} className="h-8 w-8 p-0">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="flex justify-center gap-1.5 mt-3">
          {[60, 80, 100, 120].map((preset) => (
            <button
              key={preset}
              onClick={() => { setBpm(preset); setTapBpm(null); }}
              className={cn(
                'px-2.5 py-1 rounded-md text-[10px] font-medium transition-all',
                bpm === preset
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              {preset}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
