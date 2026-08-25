'use client';

import { PitchResult } from '@/lib/pitch-detection';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface NoteHistoryProps {
  notes: PitchResult[];
  stats: {
    totalNotes: number;
    accurateNotes: number;
    accuracy: number;
  };
}

function getCentsStyle(cents: number) {
  const abs = Math.abs(cents);
  if (abs <= 5) return { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', leftBorder: 'border-l-emerald-500', icon: CheckCircle };
  if (abs <= 10) return { color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', leftBorder: 'border-l-yellow-500', icon: AlertTriangle };
  return { color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', leftBorder: 'border-l-red-500', icon: XCircle };
}

export function NoteHistory({ notes, stats }: NoteHistoryProps) {
  const reversedNotes = [...notes].reverse();
  const nearLimit = notes.length > 80;

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Note list */}
      <div className="flex-1 min-h-0">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8 gap-3">
            <div className="h-12 w-12 rounded-2xl bg-muted/30 flex items-center justify-center">
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Music className="h-6 w-6 text-muted-foreground/40" />
              </motion.div>
            </div>
            <p className="text-sm font-medium">هنوز نت‌ای ثبت نشده</p>
            <p className="text-xs opacity-50 text-center">روی میکروفون بزنید و شروع به سلفژ کنید</p>
          </div>
        ) : (
          <ScrollArea className="h-[280px] sm:h-[340px]">
            <div className="flex flex-col gap-1 px-0.5">
              <AnimatePresence initial={false}>
                {reversedNotes.map((note, i) => {
                  const style = getCentsStyle(note.cents);
                  const Icon = style.icon;
                  return (
                    <motion.div
                      key={`${note.note}${note.octave}-${notes.length - i}`}
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 15 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        'flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors border-l-2',
                        style.leftBorder,
                        i === 0 ? 'bg-muted/60' : i % 2 === 1 ? 'bg-muted/20' : 'hover:bg-muted/30'
                      )}
                    >
                      {/* Note name + frequency */}
                      <div className="flex flex-col min-w-[70px]">
                        <div className="flex items-center gap-1.5">
                          <span className={cn('text-sm font-bold', style.color)}>
                            {note.solfege}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {note.note}{note.octave}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground/60 font-mono leading-tight">
                          {note.frequency.toFixed(1)} Hz
                        </span>
                      </div>

                      {/* Cents bar */}
                      <div className="flex-1 flex items-center">
                        <div className="flex-1 bg-muted rounded-full relative overflow-hidden" dir="ltr" style={{ height: '6px' }}>
                          <div className="absolute top-0 left-1/2 w-px h-full bg-foreground/15" />
                          <div
                            className={cn(
                              'absolute top-0 h-full rounded-full',
                              Math.abs(note.cents) <= 5 ? 'bg-emerald-500' :
                              Math.abs(note.cents) <= 10 ? 'bg-yellow-500' :
                              Math.abs(note.cents) <= 25 ? 'bg-orange-500' : 'bg-red-500'
                            )}
                            style={{
                              width: `${Math.min(Math.abs(note.cents) * 2, 50)}%`,
                              left: note.cents < 0 ? '50%' : undefined,
                              right: note.cents >= 0 ? '50%' : undefined,
                              transform: note.cents < 0 ? 'translateX(-100%)' : undefined,
                            }}
                          />
                        </div>
                      </div>

                      {/* Cents badge */}
                      <Badge variant="outline" className={cn('text-[10px] font-mono px-1.5 py-0 h-5 gap-0.5', style.bg, style.border, style.color)}>
                        <Icon className="h-2.5 w-2.5" />
                        {note.cents > 0 ? '+' : ''}{note.cents}
                      </Badge>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Bottom: accuracy bar + note count warning */}
      {notes.length > 0 && (
        <div className="flex flex-col gap-2 pt-1">
          {/* Running accuracy bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className={cn(
                  'h-full rounded-full',
                  stats.accuracy >= 80 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' :
                  stats.accuracy >= 50 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' :
                  'bg-gradient-to-r from-red-400 to-red-500'
                )}
                animate={{ width: `${stats.accuracy}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground font-mono tabular-nums w-8 text-left">
              {stats.accuracy}٪
            </span>
          </div>

          {/* Note count limit warning */}
          {nearLimit && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[10px] text-amber-500 dark:text-amber-400 text-center"
            >
              نزدیک به حداکثر
            </motion.p>
          )}
        </div>
      )}
    </div>
  );
}
