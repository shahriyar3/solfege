'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Music } from 'lucide-react';

const NATURAL_NOTES = [
  { note: 'C', solfege: 'دو', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-900' },
  { note: 'D', solfege: 'رِ', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 border-orange-200 dark:border-orange-900' },
  { note: 'E', solfege: 'می', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300 border-yellow-200 dark:border-yellow-900' },
  { note: 'F', solfege: 'فا', color: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 border-green-200 dark:border-green-900' },
  { note: 'G', solfege: 'سل', color: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300 border-teal-200 dark:border-teal-900' },
  { note: 'A', solfege: 'لا', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-900' },
  { note: 'B', solfege: 'سی', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-900' },
];

interface ReferenceNotesProps {
  currentNote?: string | null;
}

export function ReferenceNotes({ currentNote }: ReferenceNotesProps) {
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Music className="h-4 w-4" />
          نت‌های مرجع
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-7 gap-1.5">
          {NATURAL_NOTES.map((n) => {
            const isActive = currentNote === n.note;
            return (
              <div
                key={n.note}
                className={cn(
                  'flex flex-col items-center py-2 px-1 rounded-lg border text-center transition-all duration-200',
                  n.color,
                  isActive && 'ring-2 ring-foreground/30 scale-110 shadow-md'
                )}
              >
                <span className="text-lg font-bold leading-tight">{n.solfege}</span>
                <span className="text-[10px] opacity-70 font-mono">{n.note}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {[{ note: 'C#', solfege: 'دو#' }, { note: 'D#', solfege: 'رِ#' }, { note: 'E#', solfege: '' },
           { note: 'F#', solfege: 'فا#' }, { note: 'G#', solfege: 'سل#' }, { note: 'A#', solfege: 'لا#' }, { note: 'B#', solfege: '' }].map((n) => (
            <div
              key={n.note}
              className={cn(
                'flex flex-col items-center py-1.5 px-1 rounded-md border text-center text-[11px] text-muted-foreground transition-all duration-200',
                currentNote === n.note && 'ring-2 ring-foreground/20 bg-muted'
              )}
            >
              {n.solfege && <span className="font-medium">{n.solfege}</span>}
              <span className="font-mono text-[10px] opacity-60">{n.note}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
