'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Lock, ChevronDown, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ─── Props ───────────────────────────────────────────────────────────────────

interface AchievementsProps {
  totalNotes: number;
  accurateNotes: number;
  accuracy: number;
  bestStreak: number;
  practiceSeconds: number;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type AchievementCategory = 'accuracy' | 'streak' | 'notes' | 'time';

type Achievement = {
  id: string;
  emoji: string;
  name: string;
  description: string;
  category: AchievementCategory;
  check: (props: AchievementsProps) => boolean;
};

// ─── Category colour map ─────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<
  AchievementCategory,
  { gradient: string; border: string; badge: string; text: string; ring: string }
> = {
  accuracy: {
    gradient: 'from-emerald-500/20 to-emerald-700/10',
    border: 'border-emerald-500/50 dark:border-emerald-400/40',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-500/30',
  },
  streak: {
    gradient: 'from-amber-500/20 to-amber-700/10',
    border: 'border-amber-500/50 dark:border-amber-400/40',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-500/30',
  },
  notes: {
    gradient: 'from-sky-500/20 to-sky-700/10',
    border: 'border-sky-500/50 dark:border-sky-400/40',
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300',
    text: 'text-sky-700 dark:text-sky-300',
    ring: 'ring-sky-500/30',
  },
  time: {
    gradient: 'from-violet-500/20 to-violet-700/10',
    border: 'border-violet-500/50 dark:border-violet-400/40',
    badge: 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300',
    text: 'text-violet-700 dark:text-violet-300',
    ring: 'ring-violet-500/30',
  },
};

// ─── Achievement definitions ─────────────────────────────────────────────────

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-note',
    emoji: '🎵',
    name: 'شروع سفر',
    description: 'اولین نت را بخوانید',
    category: 'notes',
    check: (p) => p.totalNotes >= 1,
  },
  {
    id: 'warm-up',
    emoji: '🔥',
    name: 'دست گرم',
    description: '۱۰ نت شناسایی شده',
    category: 'notes',
    check: (p) => p.totalNotes >= 10,
  },
  {
    id: 'clean-note',
    emoji: '⭐',
    name: 'یک صدای تمیز',
    description: 'یک نت کاملاً دقیق بخوانید',
    category: 'accuracy',
    check: (p) => p.accurateNotes >= 1,
  },
  {
    id: 'half-accuracy',
    emoji: '🎯',
    name: 'تیرانداز دقیق',
    description: '۵۰٪ دقت کلی',
    category: 'accuracy',
    check: (p) => p.accuracy >= 50,
  },
  {
    id: 'pro',
    emoji: '💎',
    name: 'حرفه‌ای',
    description: '۸۰٪ دقت کلی',
    category: 'accuracy',
    check: (p) => p.accuracy >= 80,
  },
  {
    id: 'master',
    emoji: '🏆',
    name: 'استاد سلفژ',
    description: 'دقت ۹۵٪',
    category: 'accuracy',
    check: (p) => p.accuracy >= 95,
  },
  {
    id: 'streak-5',
    emoji: '🔗',
    name: 'پاس متوالی ۵',
    description: '۵ نت پشت سر هم درست',
    category: 'streak',
    check: (p) => p.bestStreak >= 5,
  },
  {
    id: 'streak-10',
    emoji: '⚡',
    name: 'پاس متوالی ۱۰',
    description: '۱۰ نت پشت سر هم درست',
    category: 'streak',
    check: (p) => p.bestStreak >= 10,
  },
  {
    id: 'hundred-notes',
    emoji: '📚',
    name: 'صد نت',
    description: '۱۰۰ نت در مجموع',
    category: 'notes',
    check: (p) => p.totalNotes >= 100,
  },
  {
    id: 'practitioner',
    emoji: '🎹',
    name: 'تمرین‌کاره',
    description: '۳ دقیقه تمرین',
    category: 'time',
    check: (p) => p.practiceSeconds >= 180,
  },
  {
    id: 'pro-singer',
    emoji: '🎤',
    name: 'خواننده حرفه‌ای',
    description: '۵ دقیقه تمرین',
    category: 'time',
    check: (p) => p.practiceSeconds >= 300,
  },
  {
    id: 'legendary',
    emoji: '🌟',
    name: 'افسانه‌ای',
    description: '۵۰۰ نت و ۹۰٪ دقت',
    category: 'notes',
    check: (p) => p.totalNotes >= 500 && p.accuracy >= 90,
  },
];

const TOTAL = ACHIEVEMENTS.length;

// ─── Persian digit helper ─────────────────────────────────────────────────────

function toPersianDigits(n: number): string {
  const persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return n
    .toString()
    .split('')
    .map((d) => (d >= '0' && d <= '9' ? persian[Number(d)] : d))
    .join('');
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Achievements({
  totalNotes,
  accurateNotes,
  accuracy,
  bestStreak,
  practiceSeconds,
}: AchievementsProps) {
  const [expanded, setExpanded] = useState(false);

  const props: AchievementsProps = {
    totalNotes,
    accurateNotes,
    accuracy,
    bestStreak,
    practiceSeconds,
  };

  const statuses = useMemo(
    () => ACHIEVEMENTS.map((a) => ({ achievement: a, unlocked: a.check(props) })),
    [totalNotes, accurateNotes, accuracy, bestStreak, practiceSeconds],
  );

  const unlockedCount = statuses.filter((s) => s.unlocked).length;
  const latestUnlocked = statuses
    .filter((s) => s.unlocked)
    .slice(-3)
    .reverse();

  const catColors = CATEGORY_COLORS;

  return (
    <div className="rounded-xl border border-border/40 bg-card text-card-foreground overflow-hidden shadow-sm shadow-black/[0.02]">
      {/* ── Compact header ──────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 text-right transition-colors',
          'hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
        aria-expanded={expanded}
        aria-controls="achievements-grid"
      >
        <Trophy className="size-5 shrink-0 text-amber-500" />
        <span className="font-bold text-sm">دستاوردها</span>

        {/* Latest unlocked badges */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
          {latestUnlocked.length > 0 ? (
            latestUnlocked.map(({ achievement }) => {
              const colors = catColors[achievement.category];
              return (
                <Badge
                  key={achievement.id}
                  className={cn('gap-1 text-xs px-2 py-0.5 shrink-0', colors.badge)}
                >
                  <span>{achievement.emoji}</span>
                  <span className="hidden sm:inline">{achievement.name}</span>
                </Badge>
              );
            })
          ) : (
            <span className="text-xs text-muted-foreground">هنوز دستاوردی ندارید</span>
          )}
        </div>

        {/* Count + chevron */}
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {toPersianDigits(unlockedCount)}/{toPersianDigits(TOTAL)} دستاورد
        </span>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="size-4 text-muted-foreground" />
        </motion.div>
      </button>

      {/* ── Expanded grid ───────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id="achievements-grid"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {statuses.map(({ achievement, unlocked }, idx) => {
                  const colors = catColors[achievement.category];

                  return (
                    <motion.div
                      key={achievement.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.25,
                        delay: idx * 0.04,
                        ease: 'easeOut',
                      }}
                    >
                      {/* Gradient border wrapper */}
                      <div
                        className={cn(
                          'rounded-xl p-[2px]',
                          unlocked
                            ? cn(
                                'bg-gradient-to-br',
                                colors.gradient,
                                colors.border,
                              )
                            : 'border border-border/40',
                          !unlocked && 'opacity-40',
                        )}
                      >
                        {/* Inner card */}
                        <div
                          className={cn(
                            'rounded-[10px] p-3 flex flex-col items-center text-center gap-1.5',
                            'bg-card',
                            unlocked && cn('bg-gradient-to-br', colors.gradient),
                          )}
                        >
                          {/* Emoji */}
                          <span className="text-2xl leading-none select-none">
                            {achievement.emoji}
                          </span>

                          {/* Name */}
                          <span
                            className={cn(
                              'font-bold text-sm leading-tight',
                              unlocked ? colors.text : 'text-muted-foreground',
                            )}
                          >
                            {achievement.name}
                          </span>

                          {/* Description */}
                          <span className="text-[11px] text-muted-foreground leading-relaxed">
                            {achievement.description}
                          </span>

                          {/* Status icon */}
                          {unlocked ? (
                            <div
                              className={cn(
                                'mt-0.5 rounded-full p-1',
                                colors.badge,
                              )}
                            >
                              <Check className="size-3" />
                            </div>
                          ) : (
                            <div className="mt-0.5 rounded-full p-1 bg-muted text-muted-foreground">
                              <Lock className="size-3" />
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
