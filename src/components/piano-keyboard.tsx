'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────
interface PianoKeyboardProps {
  currentNote?: string;
  targetNote?: string;
  highlightedNotes?: string[];
  onClick?: (note: string, octave: number, frequency: number) => void;
  isRtl?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────
const A4_FREQUENCY = 440.0;
const A4_MIDI = 69;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_NOTES = ['C#', 'D#', 'F#', 'G#', 'A#'];

// Index of the white key to the LEFT of each black key (within an octave)
const BLACK_KEY_LEFT_WHITE = [0, 1, 3, 4, 5];

const PERSIAN_WHITE: Record<string, string> = {
  C: 'دو',
  D: 'رِ',
  E: 'می',
  F: 'فا',
  G: 'سل',
  A: 'لا',
  B: 'سی',
};

// ─── Helpers ──────────────────────────────────────────────────────────
function midiToFreq(midi: number): number {
  return Math.round(A4_FREQUENCY * Math.pow(2, (midi - A4_MIDI) / 12) * 100) / 100;
}

function noteToIndex(note: string): number {
  return NOTE_NAMES.indexOf(note);
}

function buildKey(
  note: string,
  octave: number,
  isBlack: boolean,
  whiteIndex: number, // absolute index among all white keys (0-13)
): PianoKey {
  const idx = noteToIndex(note);
  const midi = (octave + 1) * 12 + idx;
  return {
    note,
    octave,
    midi,
    frequency: midiToFreq(midi),
    isBlack,
    whiteIndex,
    label: isBlack ? note : PERSIAN_WHITE[note],
  };
}

// ─── Data Structures ──────────────────────────────────────────────────
interface PianoKey {
  note: string;
  octave: number;
  midi: number;
  frequency: number;
  isBlack: boolean;
  whiteIndex: number;
  label: string;
}

function generateKeys(): { white: PianoKey[]; black: PianoKey[] } {
  const white: PianoKey[] = [];
  const black: PianoKey[] = [];

  for (let oct = 4; oct <= 5; oct++) {
    const octaveOffset = (oct - 4) * 7; // 0 or 7
    WHITE_NOTES.forEach((n, i) => {
      white.push(buildKey(n, oct, false, octaveOffset + i));
    });
    BLACK_NOTES.forEach((n, i) => {
      black.push(buildKey(n, oct, true, octaveOffset + BLACK_KEY_LEFT_WHITE[i]));
    });
  }

  return { white, black };
}

const { white: WHITE_KEYS, black: BLACK_KEYS } = generateKeys();
const TOTAL_WHITE = WHITE_KEYS.length; // 14
const WHITE_KEY_PCT = 100 / TOTAL_WHITE; // ~7.14%
const BLACK_KEY_PCT = WHITE_KEY_PCT * 0.62; // ~4.43%

// ─── Sub-components ───────────────────────────────────────────────────

function WhiteKey({
  keyData,
  isCurrent,
  isTarget,
  isHighlighted,
  onClick,
  isOctaveStart,
}: {
  keyData: PianoKey;
  isCurrent: boolean;
  isTarget: boolean;
  isHighlighted: boolean;
  onClick?: (note: string, octave: number, frequency: number) => void;
  isOctaveStart: boolean;
}) {
  return (
    <motion.button
      type="button"
      className={cn(
        'relative flex flex-col items-center justify-end pb-2 pt-3',
        'bg-white dark:bg-zinc-100',
        'border-x border-zinc-200/80 dark:border-zinc-300/60',
        'rounded-b-lg',
        'h-28 sm:h-32',
        'select-none transition-all duration-150',
        'hover:bg-zinc-100 dark:hover:bg-zinc-200',
        'active:bg-zinc-200',
        'cursor-pointer',
        // Active glow
        isCurrent && 'bg-emerald-50 dark:bg-emerald-50 border-emerald-400',
        // Target pulse border
        isTarget && 'border-2 border-violet-500',
        // Highlighted tint
        isHighlighted && !isCurrent && 'bg-amber-50 dark:bg-amber-50 border-amber-300',
      )}
      style={{ width: `${WHITE_KEY_PCT}%` }}
      whileTap={{ scale: 0.97 }}
      animate={
        isCurrent
          ? { scale: 1.03, boxShadow: '0 0 20px 4px rgba(16,185,129,0.5)' }
          : isTarget
            ? { boxShadow: '0 0 12px 2px rgba(139,92,246,0.4)' }
            : { scale: 1, boxShadow: '0 0 0 0 transparent' }
      }
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={() => onClick?.(keyData.note, keyData.octave, keyData.frequency)}
    >
      {/* Persian label */}
      <span
        className={cn(
          'text-xs sm:text-sm font-bold leading-tight text-zinc-700 dark:text-zinc-800',
          isCurrent && 'text-emerald-700 dark:text-emerald-800',
        )}
      >
        {keyData.label}
      </span>

      {/* Note name (small, below Persian label) */}
      <span className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 font-medium">
        {keyData.note}
      </span>

      {/* Octave marker on C keys */}
      {isOctaveStart && (
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] sm:text-[10px] text-zinc-400/70 dark:text-zinc-500/70 font-semibold tabular-nums">
          {keyData.octave}
        </span>
      )}
    </motion.button>
  );
}

function BlackKey({
  keyData,
  isCurrent,
  isTarget,
  isHighlighted,
  onClick,
}: {
  keyData: PianoKey;
  isCurrent: boolean;
  isTarget: boolean;
  isHighlighted: boolean;
  onClick?: (note: string, octave: number, frequency: number) => void;
}) {
  // Position: centered on the boundary between the left white key and the next
  const leftPct = (keyData.whiteIndex + 1) * WHITE_KEY_PCT - BLACK_KEY_PCT / 2;

  return (
    <motion.button
      type="button"
      className={cn(
        'absolute top-0 z-10 flex flex-col items-center justify-end pb-2',
        'bg-zinc-900 dark:bg-zinc-950',
        'rounded-b-md',
        'h-[4.5rem] sm:h-20',
        'select-none transition-colors duration-150',
        'hover:bg-zinc-700 dark:hover:bg-zinc-800',
        'cursor-pointer',
        // Active glow
        isCurrent && 'bg-emerald-700 dark:bg-emerald-800',
        // Target
        isTarget && 'ring-2 ring-violet-500 ring-offset-1 ring-offset-transparent',
        // Highlighted
        isHighlighted && !isCurrent && 'bg-amber-800 dark:bg-amber-900',
      )}
      style={{
        left: `${leftPct}%`,
        width: `${BLACK_KEY_PCT}%`,
      }}
      whileTap={{ scale: 0.95 }}
      animate={
        isCurrent
          ? { scale: 1.06, boxShadow: '0 0 16px 3px rgba(16,185,129,0.6)' }
          : isTarget
            ? { boxShadow: '0 0 10px 2px rgba(139,92,246,0.5)' }
            : { scale: 1, boxShadow: '0 2px 4px 0 rgba(0,0,0,0.3)' }
      }
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(keyData.note, keyData.octave, keyData.frequency);
      }}
    >
      <span
        className={cn(
          'text-[9px] sm:text-[10px] font-semibold text-zinc-300 dark:text-zinc-400',
          isCurrent && 'text-emerald-200',
        )}
      >
        {keyData.note}
      </span>
    </motion.button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────
export function PianoKeyboard({
  currentNote,
  targetNote,
  highlightedNotes = [],
  onClick,
  isRtl = true,
}: PianoKeyboardProps) {
  const isNoteMatch = (keyData: PianoKey, noteName?: string) => {
    if (!noteName) return false;
    // Match by note name only (ignore octave for currentNote/targetNote)
    return keyData.note === noteName;
  };

  const isHighlighted = (keyData: PianoKey) => {
    return highlightedNotes.some((n) => keyData.note === n);
  };

  const wrapper = (
    <div className="w-full max-w-2xl mx-auto overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 bg-gradient-to-b from-zinc-50 to-zinc-100/80 dark:from-zinc-900/60 dark:to-zinc-900/40 shadow-sm shadow-black/[0.04] dark:shadow-black/20">
      {/* Piano container — LTR for musical convention */}
      <div dir="ltr" className="relative flex">
        {/* White keys row */}
        {WHITE_KEYS.map((k) => (
          <WhiteKey
            key={`${k.note}${k.octave}`}
            keyData={k}
            isCurrent={isNoteMatch(k, currentNote)}
            isTarget={isNoteMatch(k, targetNote)}
            isHighlighted={isHighlighted(k)}
            onClick={onClick}
            isOctaveStart={k.note === 'C'}
          />
        ))}

        {/* Black keys overlay */}
        {BLACK_KEYS.map((k) => (
          <BlackKey
            key={`${k.note}${k.octave}`}
            keyData={k}
            isCurrent={isNoteMatch(k, currentNote)}
            isTarget={isNoteMatch(k, targetNote)}
            isHighlighted={isHighlighted(k)}
            onClick={onClick}
          />
        ))}
      </div>
    </div>
  );

  // If RTL, wrap in an RTL container (the piano itself stays LTR inside)
  if (isRtl) {
    return <div dir="rtl">{wrapper}</div>;
  }

  return wrapper;
}
