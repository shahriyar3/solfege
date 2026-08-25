'use client';

import { forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ── Helpers ──────────────────────────────────────────────────────────────────

function toPersianNum(n: number): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/\d/g, (d) => persianDigits[parseInt(d)]);
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function isSameDay(a: string, b: string): boolean {
  return a === b;
}

function isYesterday(dateStr: string): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return dateStr === toDateStr(yesterday);
}

function isToday(dateStr: string): boolean {
  return dateStr === toDateStr(new Date());
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface StreakData {
  lastPracticeDate: string;
  streakCount: number;
  totalDays: number;
  bestStreak: number;
  history: string[]; // array of date strings, last 7 days
}

export interface DailyStreakHandle {
  recordPractice: () => void;
}

// ── Storage key ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'solfeggio-streak';

function getDefaultData(): StreakData {
  const today = toDateStr(new Date());
  return {
    lastPracticeDate: today,
    streakCount: 1,
    totalDays: 1,
    bestStreak: 1,
    history: [today],
  };
}

function loadData(): StreakData {
  if (typeof window === 'undefined') return getDefaultData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultData();
    const parsed = JSON.parse(raw) as StreakData;
    // Ensure history array exists (backward compat)
    if (!Array.isArray(parsed.history)) {
      parsed.history = parsed.lastPracticeDate ? [parsed.lastPracticeDate] : [];
    }
    return parsed;
  } catch {
    return getDefaultData();
  }
}

function saveData(data: StreakData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Get last 7 day dates (for display) ───────────────────────────────────────

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(toDateStr(d));
  }
  return days;
}

// ── Component ────────────────────────────────────────────────────────────────

export const DailyStreak = forwardRef<DailyStreakHandle>(function DailyStreak(_props, ref) {
  // Compute initial streak state from localStorage (lazy initializer)
  const [data, setData] = useState<StreakData>(() => {
    const stored = loadData();
    const today = toDateStr(new Date());

    if (isSameDay(stored.lastPracticeDate, today)) {
      return stored;
    } else if (isYesterday(stored.lastPracticeDate)) {
      const updated: StreakData = {
        ...stored,
        lastPracticeDate: today,
        streakCount: stored.streakCount + 1,
        totalDays: stored.totalDays + 1,
        bestStreak: Math.max(stored.bestStreak, stored.streakCount + 1),
      };
      saveData(updated);
      return updated;
    } else {
      const updated: StreakData = {
        ...stored,
        lastPracticeDate: today,
        streakCount: 1,
        totalDays: stored.totalDays + 1,
        bestStreak: stored.bestStreak,
      };
      saveData(updated);
      return updated;
    }
  });

  // Public method: record practice for today
  const recordPractice = useCallback(() => {
    setData((prev) => {
      if (!prev) return prev;
      const today = toDateStr(new Date());
      if (isSameDay(prev.lastPracticeDate, today)) return prev;

      let newStreak = 1;
      if (isYesterday(prev.lastPracticeDate)) {
        newStreak = prev.streakCount + 1;
      }

      const updated: StreakData = {
        lastPracticeDate: today,
        streakCount: newStreak,
        totalDays: prev.totalDays + 1,
        bestStreak: Math.max(prev.bestStreak, newStreak),
        history: [...(prev.history || []), today],
      };
      saveData(updated);
      return updated;
    });
  }, []);

  useImperativeHandle(ref, () => ({ recordPractice }), [recordPractice]);

  const last7 = getLast7Days();
  const showFireGlow = data.streakCount >= 3;
  const showWeekBadge = data.streakCount >= 7;

  return (
    <Card
      className={cn(
        'relative border border-border/40 shadow-lg shadow-black/[0.03] bg-card/90 backdrop-blur-sm card-hover overflow-hidden',
        showFireGlow && 'border-amber-500/30'
      )}
    >
      {/* Fire glow effect */}
      {showFireGlow && (
        <motion.div
          className="pointer-events-none absolute -inset-1 rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/20 blur-md"
          animate={{
            opacity: [0.4, 0.8, 0.4],
            scale: [1, 1.03, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      <div className={cn(
        'h-0.5 w-full',
        showFireGlow
          ? 'bg-gradient-to-l from-amber-500 via-orange-500 to-amber-500'
          : 'bg-gradient-to-l from-emerald-500 via-teal-500 to-emerald-500'
      )} />

      <CardContent className="p-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Fire icon with optional pulse */}
          <motion.span
            className="text-lg leading-none"
            animate={showFireGlow ? { scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            🔥
          </motion.span>

          {/* Streak count */}
          <span className="text-sm font-bold tabular-nums">
            {toPersianNum(data.streakCount)} روز متوالی
          </span>

          {/* Week badge */}
          {showWeekBadge && (
            <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25 text-[10px] px-1.5 py-0 h-5 font-bold">
              هفته آتشین!
            </Badge>
          )}

          <div className="flex-1" />

          {/* 7-day dots sparkline */}
          <div className="flex items-center gap-1" dir="ltr">
            {last7.map((day) => {
              const practiced = (data.history || []).includes(day);
              const today = day === toDateStr(new Date());
              return (
                <div
                  key={day}
                  className={cn(
                    'w-2 h-2 rounded-full transition-colors',
                    practiced
                      ? 'bg-emerald-500'
                      : 'bg-muted-foreground/25',
                    today && 'ring-2 ring-offset-1 ring-emerald-500/60 dark:ring-offset-background'
                  )}
                  title={day}
                />
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
