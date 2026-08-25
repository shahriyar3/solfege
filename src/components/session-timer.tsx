'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function toPersianNum(n: number): string {
  const persianDigits = ['\u06F0', '\u06F1', '\u06F2', '\u06F3', '\u06F4', '\u06F5', '\u06F6', '\u06F7', '\u06F8', '\u06F9'];
  return String(n).replace(/\d/g, (d) => persianDigits[parseInt(d)]);
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${toPersianNum(m)}:${toPersianNum(s).padStart(2, '\u06F0')}`;
}

interface SessionTimerProps {
  isActive: boolean;
}

export function SessionTimer({ isActive }: SessionTimerProps) {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    let firstTick = true;
    intervalRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (firstTick) {
          firstTick = false;
          return 1;
        }
        return prev + 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive]);

  const displaySeconds = isActive ? seconds : 0;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-muted-foreground">زمان تمرین</span>
      <div className="flex items-center gap-1.5">
        <AnimatePresence mode="wait">
          {isActive && (
            <motion.span
              key="pulse-dot"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="relative flex h-2 w-2"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </motion.span>
          )}
        </AnimatePresence>
        <span
          className={`font-mono text-sm tabular-nums transition-colors duration-300 ${
            isActive
              ? 'text-emerald-500 dark:text-rose-400'
              : 'text-muted-foreground'
          }`}
        >
          {formatTime(displaySeconds)}
        </span>
      </div>
    </div>
  );
}
