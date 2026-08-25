'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PitchResult } from '@/lib/pitch-detection';
import { motion, AnimatePresence } from 'framer-motion';
import { AudioLines, ChevronLeft, Music, Sparkles } from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────
const RANGE_MIN_MIDI = 36; // C2
const RANGE_MAX_MIDI = 84; // C6
const RANGE_SPAN = RANGE_MAX_MIDI - RANGE_MIN_MIDI; // 48 semitones

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

// ─── Helpers ─────────────────────────────────────────────────
function toPersianNum(n: number): string {
  return String(n)
    .split('')
    .map((d) => PERSIAN_DIGITS[parseInt(d)])
    .join('');
}

function solfegeLabel(pr: PitchResult): string {
  return `${pr.solfege}${toPersianNum(pr.octave)}`;
}

function midiToPercent(midi: number): number {
  return ((midi - RANGE_MIN_MIDI) / RANGE_SPAN) * 100;
}

// ─── Voice Classification ───────────────────────────────────
interface VoiceType {
  name: string;
  description: string;
 bg: string;
  text: string;
}

function classifyVoice(lowestMidi: number): VoiceType {
  if (lowestMidi >= 60)
    return {
      name: 'سوپرانو',
      description: 'صدای زیر زنانه',
      bg: 'bg-rose-100 dark:bg-rose-950/40',
      text: 'text-rose-600 dark:text-rose-300',
    };
  if (lowestMidi >= 55)
    return {
      name: 'آلتو',
      description: 'صدای متوسط زنانه',
      bg: 'bg-violet-100 dark:bg-violet-950/40',
      text: 'text-violet-600 dark:text-violet-300',
    };
  if (lowestMidi >= 48)
    return {
      name: 'تنور',
      description: 'صدای بالا مردانه',
      bg: 'bg-blue-100 dark:bg-blue-950/40',
      text: 'text-blue-600 dark:text-blue-300',
    };
  return {
    name: 'باس',
    description: 'صدای بم مردانه',
    bg: 'bg-emerald-100 dark:bg-emerald-950/40',
    text: 'text-emerald-600 dark:text-emerald-300',
  };
}

// ─── Note color gradients (per natural note) ────────────────
const NOTE_GRADIENTS: Record<string, string> = {
  C: 'from-red-400 to-rose-500',
  'C#': 'from-red-300 to-rose-400',
  D: 'from-orange-400 to-amber-500',
  'D#': 'from-orange-300 to-amber-400',
  E: 'from-yellow-400 to-yellow-500',
  F: 'from-green-400 to-emerald-500',
  'F#': 'from-green-300 to-emerald-400',
  G: 'from-teal-400 to-cyan-500',
  'G#': 'from-teal-300 to-cyan-400',
  A: 'from-sky-400 to-blue-500',
  'A#': 'from-sky-300 to-blue-400',
  B: 'from-violet-400 to-purple-500',
};

// ─── Types ──────────────────────────────────────────────────
interface VoiceRangeProps {
  currentPitch: PitchResult | null;
  isActive: boolean;
  noteHistory: PitchResult[];
}

interface RangeData {
  lowest: PitchResult;
  highest: PitchResult;
  uniqueNotes: PitchResult[];
  span: number;
}

// ─── Component ──────────────────────────────────────────────
export function VoiceRange({
  currentPitch,
  isActive,
  noteHistory,
}: VoiceRangeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Compute range data from the full note history (single pass)
  const rangeData = useMemo<RangeData | null>(() => {
    if (noteHistory.length === 0) return null;

    let lowest = noteHistory[0];
    let highest = noteHistory[0];
    const uniqueMap = new Map<number, PitchResult>();

    for (const pr of noteHistory) {
      if (pr.midiNumber < lowest.midiNumber) lowest = pr;
      if (pr.midiNumber > highest.midiNumber) highest = pr;
      uniqueMap.set(pr.midiNumber, pr);
    }

    const uniqueNotes = Array.from(uniqueMap.values()).sort(
      (a, b) => a.midiNumber - b.midiNumber,
    );

    return { lowest, highest, uniqueNotes, span: highest.midiNumber - lowest.midiNumber };
  }, [noteHistory]);

  const voiceType = rangeData
    ? classifyVoice(rangeData.lowest.midiNumber)
    : null;

  // ── Collapsed teaser card ────────────────────────────────
  if (!isExpanded) {
    return (
      <Card
        className="border-dashed border-2 border-border/25 bg-gradient-to-br from-muted/10 to-muted/5 hover:border-violet-300/40 transition-all duration-300 group cursor-pointer card-hover"
        onClick={() => setIsExpanded(true)}
      >
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/35 transition-all duration-300 group-hover:scale-105">
            <AudioLines className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold">گستره صدای شما</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              بالاترین و پایین‌ترین نت صدایتان را کشف کنید
            </p>
          </div>
          <ChevronLeft className="h-5 w-5 text-muted-foreground/50 group-hover:text-violet-500 transition-colors" />
        </CardContent>
      </Card>
    );
  }

  // ── Expanded card ────────────────────────────────────────
  return (
    <Card className="border border-border/40 shadow-lg shadow-black/[0.04] overflow-hidden">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <AudioLines className="h-4 w-4 text-violet-500" />
            گستره صدا
            {isActive && (
              <span className="flex items-center gap-1 mr-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                </span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  در حال ضبط
                </span>
              </span>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(false)}
            className="h-7 text-xs text-muted-foreground"
          >
            بستن
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        <AnimatePresence mode="wait">
          {!rangeData ? (
            /* ── Empty state ──────────────────────────────── */
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center justify-center py-8 text-center"
            >
              <div className="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center mb-3">
                <Music className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">
                میکروفون را روشن کنید و شروع به خواندن کنید
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                پایین‌ترین و بالاترین نت‌های شما تشخیص داده می‌شود
              </p>
            </motion.div>
          ) : (
            /* ── Range display ───────────────────────────── */
            <motion.div
              key="range"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* ── Visual range bar ──────────────────── */}
              <div className="space-y-1.5">
                <div className="relative h-10 bg-muted/30 rounded-xl overflow-hidden">
                  {/* Octave grid lines */}
                  {[0, 1, 2, 3].map((i) => {
                    const pos = midiToPercent(RANGE_MIN_MIDI + i * 12);
                    return (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 w-px bg-border/20"
                        style={{ left: `${pos}%` }}
                      />
                    );
                  })}

                  {/* Detected range highlight */}
                  <motion.div
                    className="absolute top-1.5 bottom-1.5 rounded-lg bg-gradient-to-r from-rose-500/70 via-violet-500/70 to-indigo-500/70"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    style={{
                      left: `${midiToPercent(rangeData.lowest.midiNumber)}%`,
                      width: `${Math.max(
                        midiToPercent(rangeData.highest.midiNumber) -
                          midiToPercent(rangeData.lowest.midiNumber),
                        1.5,
                      )}%`,
                    }}
                  />

                  {/* Detected note markers */}
                  {rangeData.uniqueNotes.map((note) => {
                    const isSharp = note.note.includes('#');
                    return (
                      <div
                        key={note.midiNumber}
                        className={cn(
                          'absolute top-1/2 rounded-full',
                          isSharp
                            ? 'w-1.5 h-1.5 bg-white/40'
                            : 'w-2.5 h-2.5 bg-white/90 shadow-[0_0_4px_rgba(255,255,255,0.5)]',
                        )}
                        style={{
                          left: `${midiToPercent(note.midiNumber)}%`,
                          transform: 'translate(-50%, -50%)',
                        }}
                        title={`${note.solfege}${note.octave}`}
                      />
                    );
                  })}

                  {/* Real-time current pitch indicator */}
                  {currentPitch && (
                    <motion.div
                      className="absolute top-0 bottom-0 w-0.5 bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.6)] rounded-full"
                      style={{
                        left: `${midiToPercent(currentPitch.midiNumber)}%`,
                        transform: 'translateX(-50%)',
                      }}
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                </div>

                {/* Octave reference labels */}
                <div className="relative h-3.5">
                  {[2, 3, 4, 5].map((oct) => {
                    const midi = 12 * (oct + 1); // C{oct}
                    return (
                      <span
                        key={oct}
                        className="absolute text-[10px] text-muted-foreground/50 -translate-x-1/2 font-mono"
                        style={{ left: `${midiToPercent(midi)}%` }}
                      >
                        C{oct}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* ── Lowest ↔ Highest labels ────────────── */}
              <div className="flex items-center justify-between">
                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground mb-0.5">
                    پایین‌ترین
                  </div>
                  <div
                    className={cn(
                      'text-lg font-bold bg-gradient-to-br bg-clip-text text-transparent',
                      NOTE_GRADIENTS[rangeData.lowest.note] ||
                        'from-gray-400 to-gray-500',
                    )}
                  >
                    {solfegeLabel(rangeData.lowest)}
                  </div>
                  <div className="text-[10px] text-muted-foreground/50 font-mono">
                    {rangeData.lowest.note}
                    {rangeData.lowest.octave}
                  </div>
                </div>

                <div className="flex-1 px-3">
                  <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                </div>

                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground mb-0.5">
                    بالاترین
                  </div>
                  <div
                    className={cn(
                      'text-lg font-bold bg-gradient-to-br bg-clip-text text-transparent',
                      NOTE_GRADIENTS[rangeData.highest.note] ||
                        'from-gray-400 to-gray-500',
                    )}
                  >
                    {solfegeLabel(rangeData.highest)}
                  </div>
                  <div className="text-[10px] text-muted-foreground/50 font-mono">
                    {rangeData.highest.note}
                    {rangeData.highest.octave}
                  </div>
                </div>
              </div>

              {/* ── Voice type badge ────────────────────── */}
              {voiceType && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className={cn(
                    'flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl',
                    voiceType.bg,
                  )}
                >
                  <Sparkles className={cn('h-4 w-4', voiceType.text)} />
                  <span className={cn('text-sm font-bold', voiceType.text)}>
                    {voiceType.name}
                  </span>
                  <span
                    className={cn(
                      'text-xs opacity-70',
                      voiceType.text,
                    )}
                  >
                    — {voiceType.description}
                  </span>
                </motion.div>
              )}

              {/* ── Stats row ───────────────────────────── */}
              <div className="grid grid-cols-2 gap-2 bg-muted/30 rounded-xl p-3">
                <div className="text-center">
                  <div className="text-lg font-bold tabular-nums">
                    {toPersianNum(rangeData.span)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    نیم‌پرده گستره
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold tabular-nums">
                    {toPersianNum(rangeData.uniqueNotes.length)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    نت منحصربه‌فرد
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
