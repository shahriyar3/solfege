'use client';

import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getSolfeggioScale, playNote, playCorrectSound, playWrongSound, ensureAudioResumed } from '@/lib/audio-playback';
import type { NoteInfo } from '@/lib/audio-playback';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music,
  Play,
  X,
  ChevronLeft,
  RotateCcw,
  Check,
  Zap,
  VolumeX,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NOTE_COLORS: Record<string, string> = {
  C: 'from-red-400 to-rose-500',
  D: 'from-orange-400 to-amber-500',
  E: 'from-yellow-400 to-yellow-500',
  F: 'from-green-400 to-emerald-500',
  G: 'from-teal-400 to-cyan-500',
  A: 'from-sky-400 to-blue-500',
  B: 'from-violet-400 to-purple-500',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Choice {
  note: NoteInfo;
  isCorrect: boolean;
}

function generateChoices(scale: NoteInfo[], correctNote: NoteInfo): Choice[] {
  const wrongs = scale.filter((n) => n.note !== correctNote.note);
  const shuffledWrongs = shuffleArray(wrongs).slice(0, 3);
  const choices: Choice[] = [
    { note: correctNote, isCorrect: true },
    ...shuffledWrongs.map((n) => ({ note: n, isCorrect: false })),
  ];
  return shuffleArray(choices);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NoteQuizProps {
  soundEnabled?: boolean;
}

export function NoteQuiz({ soundEnabled = true }: NoteQuizProps) {
  const [expanded, setExpanded] = useState(false);
  const [quizOctave, setQuizOctave] = useState(4);
  const [currentNote, setCurrentNote] = useState<NoteInfo | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [selected, setSelected] = useState<Choice | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  const scale = useMemo(() => getSolfeggioScale(quizOctave), [quizOctave]);

  const accuracy = attempts > 0 ? Math.round((score / attempts) * 100) : 0;

  const pickNewNote = useCallback(() => {
    const randomNote = scale[Math.floor(Math.random() * scale.length)];
    setCurrentNote(randomNote);
    setChoices(generateChoices(scale, randomNote));
    setHasPlayed(false);
    setSelected(null);
  }, [scale]);

  const handlePlay = useCallback(async () => {
    if (!soundEnabled || !currentNote) return;
    try { await ensureAudioResumed(); } catch { /* */ }
    const handle = playNote(currentNote.frequency, 1.5);
    setIsPlaying(true);
    setHasPlayed(true);
    setTimeout(() => {
      setIsPlaying(false);
      handle.stop();
    }, 1600);
  }, [currentNote, soundEnabled]);

  const handleChoice = useCallback(
    async (choice: Choice) => {
      if (selected || !hasPlayed) return;
      try { await ensureAudioResumed(); } catch { /* */ }
      setSelected(choice);
      setAttempts((a) => a + 1);
      if (choice.isCorrect) {
        if (soundEnabled) playCorrectSound();
        setScore((s) => s + 1);
        setStreak((s) => {
          const next = s + 1;
          setBestStreak((b) => Math.max(b, next));
          return next;
        });
      } else {
        if (soundEnabled) playWrongSound();
        setStreak(0);
      }
    },
    [selected, hasPlayed, soundEnabled]
  );

  const handleNext = useCallback(() => {
    pickNewNote();
  }, [pickNewNote]);

  const handleReset = useCallback(() => {
    setScore(0);
    setAttempts(0);
    setStreak(0);
    setBestStreak(0);
    setCurrentNote(null);
    setChoices([]);
    setHasPlayed(false);
    setSelected(null);
  }, []);

  const handleActivate = useCallback(() => {
    setExpanded(true);
    handleReset();
    // Pick first note after a tick so scale is ready
    setTimeout(() => pickNewNote(), 0);
  }, [handleReset, pickNewNote]);

  const handleOctaveChange = useCallback(
    (oct: number) => {
      setQuizOctave(oct);
      setScore(0);
      setAttempts(0);
      setStreak(0);
      setBestStreak(0);
      setCurrentNote(null);
      setChoices([]);
      setHasPlayed(false);
      setSelected(null);
      // Pick note after state update
      setTimeout(() => {
        const newScale = getSolfeggioScale(oct);
        const randomNote = newScale[Math.floor(Math.random() * newScale.length)];
        setCurrentNote(randomNote);
        setChoices(generateChoices(newScale, randomNote));
        setHasPlayed(false);
        setSelected(null);
      }, 0);
    },
    []
  );

  // ----------------------------------------------------------------------
  // Teaser
  // ----------------------------------------------------------------------
  if (!expanded) {
    return (
      <Card
        className="border-dashed border-2 border-border/30 bg-gradient-to-br from-muted/10 to-muted/5 hover:border-cyan-300/40 transition-all duration-300 group cursor-pointer card-hover"
        onClick={handleActivate}
      >
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/35 transition-all duration-300 group-hover:scale-105">
            <Music className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold">آزمون شنوایی نت‌ها</h3>
            <p className="text-xs text-muted-foreground mt-0.5">نت را بشنوید و نام آن را انتخاب کنید</p>
            <div className="flex gap-1.5 mt-1.5">
              <Badge variant="outline" className="text-[9px] h-4">
                <Zap className="h-2.5 w-2.5 ml-0.5" />
                ۴ گزینه‌ای
              </Badge>
            </div>
          </div>
          <ChevronLeft className="h-5 w-5 text-muted-foreground/50 group-hover:text-cyan-500 transition-colors" />
        </CardContent>
      </Card>
    );
  }

  // ----------------------------------------------------------------------
  // Expanded quiz
  // ----------------------------------------------------------------------
  return (
    <Card className="border border-border/40 bg-card/90 backdrop-blur-sm shadow-lg shadow-black/[0.04] overflow-hidden">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Music className="h-4 w-4 text-cyan-500" />
            آزمون شنوایی نت‌ها
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-7 w-7 p-0 text-muted-foreground"
              title="بازنشانی"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setExpanded(false); handleReset(); }}
              className="h-7 w-7 p-0 text-muted-foreground"
              title="بستن"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {/* Octave selector */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs text-muted-foreground">اکتاو:</span>
          <div className="flex gap-1">
            {[3, 4, 5].map((oct) => (
              <button
                key={oct}
                onClick={() => handleOctaveChange(oct)}
                className={cn(
                  'h-7 w-9 rounded-md text-xs font-medium transition-all',
                  quizOctave === oct
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                {oct}
              </button>
            ))}
          </div>
        </div>

        {/* Play button — large circular card */}
        <div className="flex justify-center py-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentNote ? `${currentNote.note}-${currentNote.octave}` : 'empty'}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="relative"
            >
              <button
                onClick={handlePlay}
                disabled={!currentNote}
                className={cn(
                  'relative h-36 w-36 rounded-full flex flex-col items-center justify-center transition-all duration-300',
                  'bg-gradient-to-br from-muted/80 to-muted/40 border-2 border-border/30',
                  'hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10',
                  'active:scale-95 cursor-pointer',
                  isPlaying && 'border-cyan-400 shadow-lg shadow-cyan-500/20',
                  !soundEnabled && 'opacity-60 cursor-not-allowed'
                )}
              >
                {selected ? (
                  <motion.div
                    initial={{ rotateY: 90 }}
                    animate={{ rotateY: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center"
                  >
                    <span
                      className={cn(
                        'text-4xl font-black bg-gradient-to-br bg-clip-text text-transparent',
                        NOTE_COLORS[currentNote?.note ?? 'C'] || 'from-gray-400 to-gray-500'
                      )}
                    >
                      {currentNote?.solfege}
                    </span>
                    {selected.isCorrect ? (
                      <Check className="h-5 w-5 text-emerald-500 mt-1" />
                    ) : (
                      <X className="h-5 w-5 text-red-500 mt-1" />
                    )}
                  </motion.div>
                ) : (
                  <>
                    <span className="text-5xl font-bold text-muted-foreground/40 select-none">?</span>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                      {soundEnabled ? (
                        <Play
                          className={cn(
                            'h-6 w-6 transition-colors',
                            isPlaying ? 'text-cyan-500' : 'text-muted-foreground/60'
                          )}
                        />
                      ) : (
                        <VolumeX className="h-6 w-6 text-muted-foreground/40" />
                      )}
                    </div>
                  </>
                )}
              </button>

              {/* Ripple ring while playing */}
              {isPlaying && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-cyan-400/50"
                  initial={{ scale: 1, opacity: 0.8 }}
                  animate={{ scale: 1.3, opacity: 0 }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Instruction text */}
        {!hasPlayed && !selected && (
          <p className="text-xs text-center text-muted-foreground">
            برای شنیدن نت، دکمه بالا را بزنید
          </p>
        )}

        {/* Multiple choice buttons */}
        <div className="grid grid-cols-2 gap-2">
          <AnimatePresence mode="wait">
            {choices.map((choice, idx) => {
              const isSelected = selected?.note.note === choice.note.note;
              const isCorrectReveal = selected && choice.isCorrect;
              const isWrongReveal = isSelected && !choice.isCorrect;

              return (
                <motion.button
                  key={`${currentNote?.note}-${choice.note.note}-${idx}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => handleChoice(choice)}
                  disabled={!!selected || !hasPlayed}
                  className={cn(
                    'relative rounded-xl py-3 text-sm font-bold transition-all duration-200 border',
                    !selected && hasPlayed && 'hover:border-cyan-400/50 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/20 cursor-pointer active:scale-95',
                    !hasPlayed && 'opacity-50 cursor-not-allowed',
                    selected && 'cursor-default',
                    isCorrectReveal &&
                      'bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-700/40 dark:text-emerald-400',
                    isWrongReveal &&
                      'bg-red-100 border-red-300 text-red-700 dark:bg-red-950/40 dark:border-red-700/40 dark:text-red-400',
                    selected && !isCorrectReveal && !isWrongReveal &&
                      'bg-muted/30 border-border/20 text-muted-foreground'
                  )}
                >
                  {choice.note.solfege}
                  {isCorrectReveal && (
                    <Check className="absolute top-1 left-1 h-3.5 w-3.5 text-emerald-500" />
                  )}
                  {isWrongReveal && (
                    <X className="absolute top-1 left-1 h-3.5 w-3.5 text-red-500" />
                  )}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Next button */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Button
                onClick={handleNext}
                className="w-full h-9 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white gap-1.5"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="text-sm font-medium">بعدی</span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 bg-gradient-to-b from-muted/30 to-muted/15 rounded-xl p-3 border border-border/10">
          <div className="text-center">
            <div className="flex items-center justify-center gap-0.5">
              <Check className="h-3 w-3 text-emerald-500" />
              <span className="text-base font-bold tabular-nums">{score}</span>
            </div>
            <div className="text-[9px] text-muted-foreground">درست</div>
          </div>
          <div className="text-center">
            <div className="text-base font-bold tabular-nums">{attempts}</div>
            <div className="text-[9px] text-muted-foreground">کل</div>
          </div>
          <div className="text-center">
            <div className="text-base font-bold tabular-nums text-cyan-500">{accuracy}%</div>
            <div className="text-[9px] text-muted-foreground">دقت</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-0.5">
              <Zap className="h-3 w-3 text-amber-500" />
              <span className="text-base font-bold tabular-nums text-amber-500">{streak}</span>
            </div>
            <div className="text-[9px] text-muted-foreground">پاس متوالی</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
