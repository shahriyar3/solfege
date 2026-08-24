'use client';

import { useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { playNote } from '@/lib/audio-playback';
import { getSolfeggioScale } from '@/lib/audio-playback';
import { Music, Volume2 } from 'lucide-react';
import { motion } from 'framer-motion';

const NOTE_COLORS: Record<string, string> = {
  'C': 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200/60 dark:border-red-800/30',
  'D': 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200/60 dark:border-orange-800/30',
  'E': 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/30',
  'F': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/30',
  'G': 'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border-teal-200/60 dark:border-teal-800/30',
  'A': 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200/60 dark:border-sky-800/30',
  'B': 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border-violet-200/60 dark:border-violet-800/30',
};

const SHARP_COLORS: Record<string, string> = {
  'C#': 'bg-red-50 text-red-500 dark:bg-red-950/20 dark:text-red-400',
  'D#': 'bg-orange-50 text-orange-500 dark:bg-orange-950/20 dark:text-orange-400',
  'F#': 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/20 dark:text-emerald-400',
  'G#': 'bg-teal-50 text-teal-500 dark:bg-teal-950/20 dark:text-teal-400',
  'A#': 'bg-sky-50 text-sky-500 dark:bg-sky-950/20 dark:text-sky-400',
};

interface ReferenceNotesProps {
  currentNote?: string | null;
}

export function ReferenceNotes({ currentNote }: ReferenceNotesProps) {
  const scale = getSolfeggioScale(4);

  const handlePlay = useCallback((freq: number) => {
    playNote(freq, 1.0);
  }, []);

  return (
    <Card className="border border-border/40 shadow-lg shadow-black/[0.03] bg-card/90 backdrop-blur-sm">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Music className="h-4 w-4 text-muted-foreground" />
            نت‌های مرجع
          </div>
          <span className="text-[10px] text-muted-foreground font-normal flex items-center gap-1">
            <Volume2 className="h-3 w-3" />
            برای شنیدن بزنید
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {/* Natural notes */}
        <div className="grid grid-cols-7 gap-2">
          {scale.map((n) => {
            const isActive = currentNote === n.note;
            return (
              <motion.button
                key={n.note}
                onClick={() => handlePlay(n.frequency)}
                className={cn(
                  'flex flex-col items-center py-2.5 px-1 rounded-xl border text-center transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95',
                  NOTE_COLORS[n.note],
                  isActive && 'ring-2 ring-foreground/30 scale-110 shadow-lg'
                )}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-lg font-extrabold leading-tight">{n.solfege}</span>
                <span className="text-[10px] opacity-60 font-mono">{n.note}4</span>
              </motion.button>
            );
          })}
        </div>
        {/* Sharp notes */}
        <div className="grid grid-cols-7 gap-2 mt-2">
          {[
            { note: 'C#', solfege: 'دو#', freq: scale[0].frequency * Math.pow(2, 1/12) },
            { note: 'D#', solfege: 'رِ#', freq: scale[1].frequency * Math.pow(2, 1/12) },
            { note: null, solfege: '', freq: 0 },
            { note: 'F#', solfege: 'فا#', freq: scale[3].frequency * Math.pow(2, 1/12) },
            { note: 'G#', solfege: 'سل#', freq: scale[4].frequency * Math.pow(2, 1/12) },
            { note: 'A#', solfege: 'لا#', freq: scale[5].frequency * Math.pow(2, 1/12) },
            { note: null, solfege: '', freq: 0 },
          ].map((n, i) => (
            <motion.div
              key={n.note || `empty-${i}`}
              className={cn(
                'flex flex-col items-center py-1.5 px-1 rounded-lg text-center text-[11px] transition-all duration-200',
                n.note
                  ? cn(
                      SHARP_COLORS[n.note] || 'bg-muted/30 text-muted-foreground',
                      'cursor-pointer hover:scale-105 active:scale-95 border border-transparent',
                      currentNote === n.note && 'ring-2 ring-foreground/20 bg-muted'
                    )
                  : 'opacity-0 pointer-events-none'
              )}
              onClick={() => n.note && handlePlay(n.freq)}
              whileHover={n.note ? { scale: 1.05 } : undefined}
              whileTap={n.note ? { scale: 0.95 } : undefined}
            >
              {n.solfege && <span className="font-medium">{n.solfege}</span>}
              {n.note && <span className="font-mono text-[10px] opacity-60">{n.note}</span>}
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
