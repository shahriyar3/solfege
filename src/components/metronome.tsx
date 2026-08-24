'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { playClick } from '@/lib/audio-playback';
import { motion } from 'framer-motion';
import { Timer, Play, Pause, RotateCcw, Minus, Plus } from 'lucide-react';

interface MetronomeProps {
  isTunerActive: boolean;
}

export function Metronome({ isTunerActive }: MetronomeProps) {
  const [bpm, setBpm] = useState(80);
  const [isPlaying, setIsPlaying] = useState(false);
  const [beat, setBeat] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        // Accent the first beat
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

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <Card className="border border-border/50 shadow-lg shadow-black/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <Timer className="h-3.5 w-3.5 text-white" />
          </div>
          <h3 className="text-sm font-bold">مترونوم</h3>
          <div className="flex-1" />
          <span className="text-xs font-mono text-muted-foreground tabular-nums">{formatTime(elapsed)}</span>
        </div>

        {/* Beat indicators */}
        <div className="flex justify-center gap-3 mb-4">
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className={cn(
                'h-4 w-4 rounded-full transition-colors duration-75',
                isPlaying && i === beat
                  ? i === 0
                    ? 'bg-rose-500 shadow-md shadow-rose-500/50'
                    : 'bg-emerald-500 shadow-md shadow-emerald-500/50'
                  : isPlaying
                    ? 'bg-muted'
                    : 'bg-muted/60'
              )}
              animate={isPlaying && i === beat ? { scale: [1, 1.3, 1] } : { scale: 1 }}
              transition={{ duration: 0.15 }}
            />
          ))}
        </div>

        {/* BPM display */}
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
            <div className="text-3xl font-black tabular-nums leading-none">{bpm}</div>
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

        {/* Controls */}
        <div className="flex items-center justify-center gap-2">
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
          {isPlaying && (
            <Button variant="ghost" size="sm" onClick={stop} className="h-8 w-8 p-0">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Quick BPM presets */}
        <div className="flex justify-center gap-1.5 mt-3">
          {[60, 80, 100, 120].map((preset) => (
            <button
              key={preset}
              onClick={() => setBpm(preset)}
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
