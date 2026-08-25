'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { PitchResult } from '@/lib/pitch-detection';
import { motion, AnimatePresence } from 'framer-motion';

interface PitchStabilityProps {
  isActive: boolean;
  noteHistory: PitchResult[];
}

function toPersianNum(n: number): string {
  const d = ['\u06F0', '\u06F1', '\u06F2', '\u06F3', '\u06F4', '\u06F5', '\u06F6', '\u06F7', '\u06F8', '\u06F9'];
  return String(n).replace(/\d/g, c => d[parseInt(c)]);
}

function calculateStability(noteHistory: PitchResult[]): { stability: number; label: string; zone: 'stable' | 'wobbly' | 'unstable' } {
  if (noteHistory.length < 3) return { stability: 0, label: 'منتظر نت', zone: 'unstable' };

  const recent = noteHistory.slice(-30);
  const lastNote = recent[recent.length - 1];
  const sameNoteReadings = recent.filter(n => n.note === lastNote.note && n.octave === lastNote.octave);

  if (sameNoteReadings.length < 2) return { stability: 0, label: 'ثبت نت', zone: 'unstable' };

  const cents = sameNoteReadings.map(n => n.cents);
  const mean = cents.reduce((a, b) => a + b, 0) / cents.length;
  const variance = cents.reduce((a, b) => a + (b - mean) ** 2, 0) / cents.length;
  const stdDev = Math.sqrt(variance);

  const maxStd = 25;
  const normalizedStd = Math.min(stdDev / maxStd, 1);
  const stability = Math.round((1 - normalizedStd) * 100);

  if (stability >= 70) return { stability, label: 'ثابت', zone: 'stable' };
  if (stability >= 40) return { stability, label: 'لرزان', zone: 'wobbly' };
  return { stability, label: 'نامنظم', zone: 'unstable' };
}

const ZONE_STYLES = {
  stable: {
    bar: 'bg-emerald-500 dark:bg-emerald-400',
    text: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    glow: 'shadow-emerald-500/30',
  },
  wobbly: {
    bar: 'bg-yellow-500 dark:bg-yellow-400',
    text: 'text-yellow-600 dark:text-yellow-400',
    dot: 'bg-yellow-500',
    glow: 'shadow-yellow-500/30',
  },
  unstable: {
    bar: 'bg-red-500 dark:bg-red-400',
    text: 'text-red-500 dark:text-red-400',
    dot: 'bg-red-500',
    glow: 'shadow-red-500/30',
  },
};

export function PitchStability({ isActive, noteHistory }: PitchStabilityProps) {
  const { stability, label, zone } = useMemo(() => calculateStability(noteHistory), [noteHistory]);
  const styles = ZONE_STYLES[zone];

  if (!isActive) {
    return (
      <div className="flex items-center gap-2.5 px-1" dir="rtl">
        <span className="text-[10px] text-muted-foreground/50">پایداری صدای شما</span>
        <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
          <div className="h-full w-0 rounded-full bg-muted-foreground/20" />
        </div>
        <span className="text-[10px] text-muted-foreground/40 tabular-nums w-8 text-left">—</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 px-1" dir="rtl">
      <span className="text-[10px] text-muted-foreground/70">پایداری</span>

      <div className="flex-1 flex items-center gap-1.5">
        <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden relative">
          <motion.div
            className={cn('h-full rounded-full transition-colors duration-500', styles.bar)}
            animate={{ width: `${Math.max(stability, 4)}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
          <div className="absolute inset-0 flex items-center" style={{ direction: 'ltr' }}>
            <div className="w-1/3 h-full border-r border-l border-white/10 dark:border-white/5" />
            <div className="w-1/3 h-full border-r border-l border-white/10 dark:border-white/5" />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {zone === 'stable' ? (
            <motion.div
              key="stable-dot"
              initial={{ scale: 0 }}
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className={cn('h-2 w-2 rounded-full shadow-sm', styles.dot, styles.glow)}
            />
          ) : zone === 'wobbly' ? (
            <motion.div
              key="wobbly-dot"
              animate={{ x: [0, -2, 2, -1, 1, 0] }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
              className={cn('h-2 w-2 rounded-full', styles.dot)}
            />
          ) : (
            <motion.div
              key="unstable-dot"
              animate={{ rotate: [0, -5, 5, -3, 3, 0], scale: [1, 1.1, 0.95, 1] }}
              transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
              className={cn('h-2 w-2 rounded-full', styles.dot)}
            />
          )}
        </AnimatePresence>
      </div>

      <motion.span
        key={label}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn('text-[10px] font-medium tabular-nums w-14 text-left', styles.text)}
      >
        {toPersianNum(stability)}٪ {label}
      </motion.span>
    </div>
  );
}
