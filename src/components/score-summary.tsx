'use client';

import { useMemo, useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  Trophy,
  Music,
  Check,
  Target,
  Zap,
  Clock,
  TrendingUp,
  X,
  RotateCcw,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface NoteHistoryEntry {
  note: string;
  solfege: string;
  cents: number;
  isAccurate: boolean;
  frequency: number;
  octave: number;
}

interface ScoreSummaryProps {
  open: boolean;
  onClose: () => void;
  noteHistory: Array<NoteHistoryEntry>;
  bestStreak: number;
  practiceSeconds: number;
  onRetry?: () => void;
}

function toPersianNum(n: number): string {
  const d = ['\u06F0', '\u06F1', '\u06F2', '\u06F3', '\u06F4', '\u06F5', '\u06F6', '\u06F7', '\u06F8', '\u06F9'];
  return String(n).replace(/\d/g, c => d[parseInt(c)]);
}

/* ─── Animated counter hook ─── */
function useAnimatedCount(target: number, duration = 1200, enabled = true) {
  const countRef = useRef(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let startTime: number | null = null;
    let raf: number;

    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(eased * target);
      countRef.current = next;
      setCount(next);
      if (progress < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, enabled]);

  return count;
}

/* ─── Accuracy ring constants ─── */
const RING_SIZE = 180;
const RING_STROKE = 12;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/* ─── Encouragement messages ─── */
function getEncouragement(accuracy: number): { text: string; color: string } {
  if (accuracy >= 90) return { text: 'عالی! عملکرد فوق‌العاده‌ای داشتید!', color: 'text-emerald-400' };
  if (accuracy >= 70) return { text: 'خوب بود! ادامه بدهید!', color: 'text-sky-400' };
  if (accuracy >= 50) return { text: 'قابل قبول. بیشتر تمرین کنید.', color: 'text-amber-400' };
  return { text: 'نیاز به تمرین بیشتر دارید.', color: 'text-rose-400' };
}

/* ─── Format seconds to MM:SS with Persian numerals ─── */
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const mStr = String(m).padStart(2, '0');
  const sStr = String(s).padStart(2, '0');
  return toPersianNum(Number(mStr)) + ':' + toPersianNum(Number(sStr));
}

/* ─── Stat card ─── */
function StatCard({
  icon: Icon,
  label,
  value,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      className="flex flex-col items-center gap-1.5 rounded-xl bg-muted/50 dark:bg-muted/20 border border-border/30 p-3"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-[11px] text-muted-foreground leading-tight">{label}</span>
      <span className="text-base font-bold tabular-nums text-foreground">{value}</span>
    </motion.div>
  );
}

/* ─── Main component ─── */
export function ScoreSummary({
  open,
  onClose,
  noteHistory,
  bestStreak,
  practiceSeconds,
  onRetry,
}: ScoreSummaryProps) {
  /* Computed stats */
  const stats = useMemo(() => {
    const total = noteHistory.length;
    const accurate = noteHistory.filter(n => n.isAccurate).length;
    const accuracy = total > 0 ? Math.round((accurate / total) * 100) : 0;
    const avgDeviation =
      total > 0
        ? Math.round(noteHistory.reduce((sum, n) => sum + Math.abs(n.cents), 0) / total)
        : 0;

    return { total, accurate, accuracy, avgDeviation };
  }, [noteHistory]);

  /* Top 5 most-accurate notes (by lowest avg |cents|, requires ≥1 occurrence) */
  const topNotes = useMemo(() => {
    const map = new Map<string, { solfege: string; totalCents: number; count: number }>();
    for (const entry of noteHistory) {
      const key = entry.solfege || entry.note;
      const existing = map.get(key);
      if (existing) {
        existing.totalCents += Math.abs(entry.cents);
        existing.count += 1;
      } else {
        map.set(key, { solfege: entry.solfege, totalCents: Math.abs(entry.cents), count: 1 });
      }
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        avgCents: Math.round(data.totalCents / data.count),
        count: data.count,
      }))
      .sort((a, b) => a.avgCents - b.avgCents)
      .slice(0, 5);
  }, [noteHistory]);

  const encouragement = getEncouragement(stats.accuracy);
  const animatedAccuracy = useAnimatedCount(stats.accuracy, 1400, open);
  const ringOffset = RING_CIRCUMFERENCE * (1 - stats.accuracy / 100);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        dir="rtl"
        showCloseButton={false}
        className="bg-background/80 backdrop-blur-2xl border-border/30 sm:max-w-md max-h-[90vh] overflow-y-auto"
      >
        {/* ── Close button (top-left for RTL) ── */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 z-10 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* ── Header ── */}
        <DialogHeader className="items-center gap-3 pb-2">
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20"
          >
            <Trophy className="h-7 w-7 text-white" />
          </motion.div>
          <div className="text-center">
            <DialogTitle className="text-xl font-black">خلاصه جلسه</DialogTitle>
            <DialogDescription className="mt-1">نتایج تمرین شما</DialogDescription>
          </div>
        </DialogHeader>

        {/* ── Accuracy ring ── */}
        <div className="flex justify-center -mt-1 mb-2">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="relative"
            style={{ width: RING_SIZE, height: RING_SIZE }}
          >
            <svg
              width={RING_SIZE}
              height={RING_SIZE}
              viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
              className="-rotate-90"
            >
              <defs>
                <linearGradient id="score-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgb(245 158 11)" />
                  <stop offset="100%" stopColor="rgb(244 63 94)" />
                </linearGradient>
              </defs>

              {/* Background track */}
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                className="stroke-muted/30 dark:stroke-muted/15"
                strokeWidth={RING_STROKE}
              />

              {/* Animated progress arc */}
              <motion.circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                stroke="url(#score-ring-gradient)"
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                initial={{ strokeDashoffset: RING_CIRCUMFERENCE }}
                animate={{ strokeDashoffset: ringOffset }}
                transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
              />
            </svg>

            {/* Center percentage */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span
                key={animatedAccuracy}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 120 }}
                className="text-4xl font-black tabular-nums text-foreground"
              >
                {toPersianNum(animatedAccuracy)}
              </motion.span>
              <span className="text-sm text-muted-foreground font-medium mt-0.5">٪</span>
            </div>
          </motion.div>
        </div>

        {/* ── Stats grid (2×3) ── */}
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <StatCard icon={Music} label="کل نت‌ها" value={toPersianNum(stats.total)} delay={0.2} />
          <StatCard icon={Check} label="نت‌های تمیز" value={toPersianNum(stats.accurate)} delay={0.25} />
          <StatCard icon={Target} label="دقت" value={toPersianNum(stats.accuracy) + '٪'} delay={0.3} />
          <StatCard icon={Zap} label="بهترین پاس" value={toPersianNum(bestStreak)} delay={0.35} />
          <StatCard icon={Clock} label="زمان تمرین" value={formatDuration(practiceSeconds)} delay={0.4} />
          <StatCard icon={TrendingUp} label="میانگین انحراف" value={toPersianNum(stats.avgDeviation) + '¢'} delay={0.45} />
        </div>

        {/* ── Note accuracy breakdown ── */}
        {topNotes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="mb-4 rounded-xl bg-muted/40 dark:bg-muted/15 border border-border/30 p-3"
          >
            <h4 className="text-xs font-bold text-muted-foreground mb-2.5">دقت نت‌ها</h4>
            <div className="flex flex-col gap-2">
              {topNotes.map((n, i) => {
                const barWidth = Math.max(8, 100 - n.avgCents);
                return (
                  <motion.div
                    key={n.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.55 + i * 0.06 }}
                    className="flex items-center gap-2"
                  >
                    <span className="w-10 text-xs font-semibold text-foreground text-left tabular-nums">
                      {n.name}
                    </span>
                    <div className="flex-1 h-3 rounded-full bg-muted/60 dark:bg-muted/30 overflow-hidden">
                      <motion.div
                        className={cn(
                          'h-full rounded-full',
                          n.avgCents <= 15
                            ? 'bg-gradient-to-l from-emerald-500 to-emerald-400'
                            : n.avgCents <= 30
                              ? 'bg-gradient-to-l from-amber-500 to-amber-400'
                              : 'bg-gradient-to-l from-rose-500 to-rose-400'
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.6 + i * 0.06 }}
                      />
                    </div>
                    <span className="w-10 text-[11px] text-muted-foreground tabular-nums text-left">
                      {toPersianNum(n.avgCents)}¢
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Encouragement ── */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.7 }}
          className={cn('text-center text-sm font-semibold mb-2', encouragement.color)}
        >
          {encouragement.text}
        </motion.p>

        {/* ── Footer buttons ── */}
        <DialogFooter className="flex-row gap-2 justify-center sm:justify-center">
          {onRetry && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.8 }}
            >
              <Button
                onClick={onRetry}
                variant="outline"
                className="gap-2 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              >
                <RotateCcw className="h-4 w-4" />
                تلاش دوباره
              </Button>
            </motion.div>
          )}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.85 }}
          >
            <Button onClick={onClose} variant="secondary" className="gap-2">
              بستن
            </Button>
          </motion.div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
