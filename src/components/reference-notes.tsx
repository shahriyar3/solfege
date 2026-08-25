'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { playNote, getSolfeggioScale } from '@/lib/audio-playback';
import { Music, Volume2 } from 'lucide-react';
import { motion, LayoutGroup } from 'framer-motion';

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

const SHARP_SOLFEGE: Record<string, string> = {
  'C': 'دو#', 'D': 'رِ#', 'F': 'فا#', 'G': 'سل#', 'A': 'لا#',
};

const SHARP_NOTE_MAP = ['C', 'D', null, 'F', 'G', 'A', null] as const;

interface ReferenceNotesProps {
  currentNote?: string | null;
}

export function ReferenceNotes({ currentNote }: ReferenceNotesProps) {
  const [refOctave, setRefOctave] = useState(4);
  const [playingNote, setPlayingNote] = useState<string | null>(null);

  const scale = getSolfeggioScale(refOctave);

  const handlePlay = useCallback((freq: number, noteKey: string) => {
    playNote(freq, 1.0);
    setPlayingNote(noteKey);
    setTimeout(() => setPlayingNote(null), 600);
  }, []);

  return (
    <Card className="border border-border/40 shadow-lg shadow-black/[0.03] bg-card/90 backdrop-blur-sm card-hover">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold">
            <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
              <Music className="h-3.5 w-3.5 text-white" />
            </div>
            نت‌های مرجع
          </div>
          <span className="text-[10px] text-muted-foreground font-normal flex items-center gap-1">
            <Volume2 className="h-3 w-3" />
            برای شنیدن بزنید
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <LayoutGroup>
          {/* Natural notes */}
          <div className="grid grid-cols-7 gap-2">
            {scale.map((n) => {
              const isActive = currentNote === n.note;
              const isPlaying = playingNote === `${n.note}-${refOctave}`;
              return (
                <motion.button
                  key={n.note}
                  layoutId={isActive ? 'active-note-highlight' : undefined}
                  onClick={() => handlePlay(n.frequency, `${n.note}-${refOctave}`)}
                  className={cn(
                    'relative flex flex-col items-center py-2.5 px-1 rounded-xl border text-center transition-all duration-200 cursor-pointer',
                    NOTE_COLORS[n.note],
                    isActive && 'ring-2 ring-foreground/30 scale-110 shadow-lg'
                  )}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isPlaying && (
                    <motion.span
                      className="absolute inset-0 rounded-xl ring-2 ring-current opacity-60"
                      initial={{ scale: 0.9, opacity: 0.8 }}
                      animate={{ scale: 1.1, opacity: 0 }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  )}
                  <span className="text-lg font-extrabold leading-tight">{n.solfege}</span>
                  <span className="text-[10px] opacity-60 font-mono">{n.note}{refOctave}</span>
                </motion.button>
              );
            })}
          </div>
          {/* Sharp notes */}
          <div className="grid grid-cols-7 gap-2 mt-2">
            {SHARP_NOTE_MAP.map((base, i) => {
              if (!base) {
                return <div key={`empty-${i}`} className="opacity-0 pointer-events-none" />;
              }
              const sharpNote = `${base}#`;
              const scaleIdx = scale.findIndex(s => s.note === base);
              const freq = scaleIdx >= 0 ? scale[scaleIdx].frequency * Math.pow(2, 1 / 12) : 0;
              const isActive = currentNote === sharpNote;
              const isPlaying = playingNote === `${sharpNote}-${refOctave}`;
              return (
                <motion.button
                  key={sharpNote}
                  layoutId={isActive ? 'active-sharp-highlight' : undefined}
                  onClick={() => handlePlay(freq, `${sharpNote}-${refOctave}`)}
                  className={cn(
                    'relative flex flex-col items-center py-1.5 px-1 rounded-lg text-center text-[11px] transition-all duration-200 cursor-pointer border border-transparent',
                    SHARP_COLORS[sharpNote] || 'bg-muted/30 text-muted-foreground',
                    isActive && 'ring-2 ring-foreground/20 bg-muted'
                  )}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isPlaying && (
                    <motion.span
                      className="absolute inset-0 rounded-lg ring-2 ring-current opacity-60"
                      initial={{ scale: 0.9, opacity: 0.8 }}
                      animate={{ scale: 1.1, opacity: 0 }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  )}
                  <span className="font-medium">{SHARP_SOLFEGE[base]}</span>
                  <span className="font-mono text-[10px] opacity-60">{sharpNote}</span>
                </motion.button>
              );
            })}
          </div>
        </LayoutGroup>

        {/* Octave selector */}
        <div className="flex items-center justify-center gap-2 mt-3">
          <span className="text-xs text-muted-foreground">اکتاو:</span>
          <div className="flex gap-1">
            {[3, 4, 5].map((oct) => (
              <button
                key={oct}
                onClick={() => setRefOctave(oct)}
                className={cn(
                  'h-7 w-9 rounded-md text-xs font-medium transition-all',
                  refOctave === oct
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                {oct}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
