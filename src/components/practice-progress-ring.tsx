'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame } from 'lucide-react';

interface PracticeProgressRingProps {
  current: number;
  total: number;
  score: number;
  streak: number;
}

function toPersianNum(n: number): string {
  const d = ['\u06F0','\u06F1','\u06F2','\u06F3','\u06F4','\u06F5','\u06F6','\u06F7','\u06F8','\u06F9'];
  return String(n).replace(/\d/g, c => d[parseInt(c)]);
}

const RING_SIZE = 120;
const STROKE_WIDTH = 8;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ConfettiParticle({ index, total }: { index: number; total: number }) {
  const angle = (index / total) * 360;
  const distance = 40 + Math.random() * 30;
  const x = Math.cos((angle * Math.PI) / 180) * distance;
  const y = Math.sin((angle * Math.PI) / 180) * distance;
  const colors = [
    'bg-rose-400', 'bg-amber-400', 'bg-emerald-400', 'bg-sky-400',
    'bg-violet-400', 'bg-pink-400', 'bg-orange-400', 'bg-teal-400',
  ];
  const color = colors[index % colors.length];
  const size = 3 + Math.random() * 3;

  return (
    <motion.div
      className={cn('absolute rounded-full', color)}
      style={{ width: size, height: size }}
      initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
      animate={{
        x: [0, x * 0.5, x],
        y: [0, -20 - Math.random() * 20, y + 10],
        opacity: [1, 1, 0],
        scale: [0, 1.2, 0.5],
        rotate: [0, 180 + Math.random() * 180, 360 + Math.random() * 180],
      }}
      transition={{
        duration: 1.2 + Math.random() * 0.5,
        ease: 'easeOut',
        delay: index * 0.03,
      }}
    />
  );
}

export function PracticeProgressRing({ current, total, score, streak }: PracticeProgressRingProps) {
  const progress = total > 0 ? current / total : 0;
  const isComplete = progress >= 1;
  const offset = CIRCUMFERENCE * (1 - progress);

  const displayProgress = useMemo(() => Math.min(current, total), [current, total]);

  return (
    <div className="flex flex-col items-center" dir="rtl">
      <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="-rotate-90"
        >
          <defs>
            <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgb(244 63 94)" />
              <stop offset="50%" stopColor="rgb(251 146 60)" />
              <stop offset="100%" stopColor="rgb(245 158 11)" />
            </linearGradient>
          </defs>

          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            className="stroke-muted/40 dark:stroke-muted/20"
            strokeWidth={STROKE_WIDTH}
          />

          <motion.circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="url(#progress-gradient)"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            key={displayProgress}
            initial={{ scale: 0.8, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-xl font-black tabular-nums text-foreground"
          >
            {toPersianNum(displayProgress)}<span className="text-sm text-muted-foreground font-medium">/{toPersianNum(total)}</span>
          </motion.span>

          <AnimatePresence>
            {streak > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 5, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 5, scale: 0.8 }}
                className="flex items-center gap-0.5 mt-0.5"
              >
                <motion.span
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Flame className="h-3 w-3 text-orange-500" />
                </motion.span>
                <span className="text-[10px] font-bold text-orange-500 dark:text-orange-400 tabular-nums">
                  {toPersianNum(streak)}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {isComplete && (
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: 16 }).map((_, i) => (
                <ConfettiParticle key={i} index={i} total={16} />
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-1 mt-1.5">
        <span className="text-[10px] text-muted-foreground/60">امتیاز:</span>
        <span className={cn(
          'text-xs font-bold tabular-nums',
          score > 0 ? 'text-amber-500 dark:text-amber-400' : 'text-muted-foreground/40'
        )}>
          {toPersianNum(score)}
        </span>
      </div>
    </div>
  );
}
