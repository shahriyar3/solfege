'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { playNote, getSolfeggioScale, ensureAudioReady } from '@/lib/audio-playback';
import type { NoteInfo } from '@/lib/audio-playback';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame,
  ChevronLeft,
  Play,
  Square,
  ArrowUp,
  ArrowDown,
  Waves,
  Clock,
  Gauge,
  ArrowRightLeft,
  Music,
  Repeat,
  Zap,
  Target,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

interface StepNote {
  note: string;
  solfege: string;
  octave: number;
  frequency: number;
  duration: number;
}

type SpeedId = 'slow' | 'medium' | 'fast';

type ExerciseId =
  | 'ascending'
  | 'descending'
  | 'trill'
  | 'sustain'
  | 'octave-bridge'
  | 'arpeggio'
  | 'interval-leap'
  | 'triads'
  | 'vocal-run'
  | 'center-stability';

interface ExerciseDef {
  id: ExerciseId;
  name: string;
  icon: React.ReactNode;
  description: string;
  hasSpeedControl?: boolean;
  getSteps: (scale: NoteInfo[]) => StepNote[];
}

interface WarmupModuleProps {
  soundEnabled?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

function toPersianNum(n: number): string {
  return String(n)
    .split('')
    .map((d) => PERSIAN_DIGITS[parseInt(d)])
    .join('');
}

// ─── Note color gradients ──────────────────────────────────

const NOTE_GRADIENTS: Record<string, string> = {
  C: 'from-red-400 to-rose-500',
  D: 'from-orange-400 to-amber-500',
  E: 'from-yellow-400 to-yellow-500',
  F: 'from-green-400 to-emerald-500',
  G: 'from-teal-400 to-cyan-500',
  A: 'from-sky-400 to-blue-500',
  B: 'from-violet-400 to-purple-500',
};

// ─── Speed configs (ms per note) ───────────────────────────

const SPEED_CONFIG: Record<SpeedId, { label: string; ms: number }> = {
  slow: { label: 'آهسته', ms: 500 },
  medium: { label: 'متوسط', ms: 300 },
  fast: { label: 'سریع', ms: 150 },
};

// ─── Frequency helper ──────────────────────────────────────

const A4 = 440.0;
const A4_MIDI = 69;
const NOTE_SEMITONES: Record<string, number> = {
  C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5,
  'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
};

function noteFreq(note: string, octave: number): number {
  const midi = (octave + 1) * 12 + (NOTE_SEMITONES[note] ?? 0);
  return Math.round(A4 * Math.pow(2, (midi - A4_MIDI) / 12) * 10) / 10;
}

function makeStep(note: string, solfege: string, octave: number, duration: number): StepNote {
  return { note, solfege, octave, frequency: noteFreq(note, octave), duration };
}

// ─── Exercise Definitions ──────────────────────────────────

function getExerciseDefs(): ExerciseDef[] {
  return [
    {
      id: 'ascending',
      name: 'صعودی',
      icon: <ArrowUp className="h-4 w-4" />,
      description:
        'در این تمرین نت‌ها یکی یکی از پایین به بالا اجرا می‌شوند (دو، رِ، می، فا، سل، لا، سی و سپس دوِ اکتاو بالاتر). ' +
        'هدف این تمرین تقویت کنترل صدا در حرکت صعودی است. ' +
        'هر نت را با دقت و وضوح بخوانید و سعی کنید فواصل بین نت‌ها یکنواخت باشند. ' +
        'وقتی نت‌ها پخش می‌شوند، همزمان با صدای مرجع بخوانید.',
      getSteps: (scale) => {
        const steps: StepNote[] = scale.map((n) => makeStep(n.note, n.solfege, n.octave, 0.8));
        steps.push(makeStep('C', 'دو', 5, 1.0));
        return steps;
      },
    },
    {
      id: 'descending',
      name: 'نزولی',
      icon: <ArrowDown className="h-4 w-4" />,
      description:
        'برعکس تمرین صعودی، نت‌ها از بالا به پایین اجرا می‌شوند. ' +
        'ابتدا دوِ اکتاو ۵ پخش می‌شود و سپس سی، لا، می، سل، فا، می، رِ و دوِ اکتاو ۴. ' +
        'حرکت نزولی برای کنترل صدا موقع پایین آمدن مهم است. ' +
        'مراقب باشید صدایتان هنگام نزول افت نکند و تمیز بمانید.',
      getSteps: () => {
        const scale = getSolfeggioScale(4);
        const highC = makeStep('C', 'دو', 5, 1.0);
        const descending = [...scale].reverse().map((n) => makeStep(n.note, n.solfege, n.octave, 0.8));
        return [highC, ...descending];
      },
    },
    {
      id: 'trill',
      name: 'تریل',
      icon: <Waves className="h-4 w-4" />,
      description:
        'تریل یعنی تناوب سریع بین دو نت مجاور. در این تمرین جفت نت‌های دو-رِ، رِ-می و می-فا را چهار بار تکرار می‌کنید. ' +
        'این تمرین انعطاف حنجره و سرعت واکنش صدایتان را بالا می‌برد. ' +
        'با سرعت آهسته شروع کنید و وقتی راحت شدید، سرعت را زیاد کنید. ' +
        'سعی کنید هر دو نت با صدای واضح و مساوی اجرا شوند.',
      hasSpeedControl: true,
      getSteps: (scale) => {
        const steps: StepNote[] = [];
        const pairs: [number, number][] = [[0, 1], [1, 2], [2, 3]];
        for (const [a, b] of pairs) {
          for (let i = 0; i < 4; i++) {
            steps.push(makeStep(scale[a].note, scale[a].solfege, scale[a].octave, 0.3));
            steps.push(makeStep(scale[b].note, scale[b].solfege, scale[b].octave, 0.3));
          }
        }
        return steps;
      },
    },
    {
      id: 'sustain',
      name: 'سرج',
      icon: <Clock className="h-4 w-4" />,
      description:
        'در این تمرین هر نت به مدت ۳ ثانیه نگه داشته می‌شود (سرج). ' +
        'نت‌های دو، می و سل در اکتاو ۴ و سپس دوِ اکتاو ۵ پخش می‌شوند. ' +
        'هدف: تقویت ثبات صدا و کنترل نفس. ' +
        'سعی کنید در تمام مدت هر نت، صدایتان بدون لرزش و تغییر ارتفاع بماند. ' +
        'این تمرین برای مبتدی‌ها بسیار مهم است.',
      getSteps: () => {
        const scale = getSolfeggioScale(4);
        const indices = [0, 2, 4];
        const steps = indices.map((i) => makeStep(scale[i].note, scale[i].solfege, scale[i].octave, 3.0));
        steps.push(makeStep('C', 'دو', 5, 3.0));
        return steps;
      },
    },
    {
      id: 'octave-bridge',
      name: 'پل اکتاو',
      icon: <ArrowRightLeft className="h-4 w-4" />,
      description:
        'در این تمرین بین اکتاو‌های مختلف جابه‌جا می‌شوید. ' +
        'ابتدا نت‌ها در اکتاو ۳ (بم) اجرا می‌شوند، سپس اکتاو ۴ (میانی) و بالاخره اکتاو ۵ (زیر). ' +
        'بعد دوباره به اکتاو ۳ برمی‌گردیم. ' +
        'این تمرین به شما کمک می‌کند گستره صدایتان را بشناسید و بین ثبت‌های مختلف راحت جابه‌جا شوید. ' +
        'اگر نتوانستید اکتاو ۳ یا ۵ را بخوانید، اشکالی ندارد — هدف آشنایی با محدوده صدایتان است.',
      getSteps: () => {
        const steps: StepNote[] = [];
        // Octave 3: C D E
        for (const n of ['C', 'D', 'E'] as const) {
          const s = getSolfeggioScale(3).find((x) => x.note === n);
          if (s) steps.push(makeStep(s.note, s.solfege, s.octave, 1.0));
        }
        // Octave 4: C D E
        for (const n of ['C', 'D', 'E'] as const) {
          const s = getSolfeggioScale(4).find((x) => x.note === n);
          if (s) steps.push(makeStep(s.note, s.solfege, s.octave, 1.0));
        }
        // Octave 5: C D E
        for (const n of ['C', 'D', 'E'] as const) {
          const s = getSolfeggioScale(5).find((x) => x.note === n);
          if (s) steps.push(makeStep(s.note, s.solfege, s.octave, 1.0));
        }
        // Back down
        for (const n of ['E', 'D', 'C'] as const) {
          const s = getSolfeggioScale(4).find((x) => x.note === n);
          if (s) steps.push(makeStep(s.note, s.solfege, s.octave, 1.0));
        }
        for (const n of ['E', 'D', 'C'] as const) {
          const s = getSolfeggioScale(3).find((x) => x.note === n);
          if (s) steps.push(makeStep(s.note, s.solfege, s.octave, 1.0));
        }
        return steps;
      },
    },
    {
      id: 'arpeggio',
      name: 'آرپژ',
      icon: <Music className="h-4 w-4" />,
      description:
        'آرپژ یعنی نت‌های یک آکورد را یکی یکی (نه همزمان) بنوازید/بخوانید. ' +
        'در این تمرین آرپژ‌های گام دو ماژور (دو-می-سل-دو بالا) و لا مینور (لا-دو-می-لا بالا) تمرین می‌شوند. ' +
        'این تمرین مفهوم هارمونی و آکورد را به شما آموزش می‌دهد. ' +
        'سعی کنید فواصل بین نت‌ها دقیق باشند — مثلاً دو تا می باید یک فاصله «سوم» باشد.',
      getSteps: () => {
        const s4 = getSolfeggioScale(4);
        const steps: StepNote[] = [];
        // C major arpeggio: C-E-G-C5
        steps.push(makeStep(s4[0].note, s4[0].solfege, s4[0].octave, 0.8));
        steps.push(makeStep(s4[2].note, s4[2].solfege, s4[2].octave, 0.8));
        steps.push(makeStep(s4[4].note, s4[4].solfege, s4[4].octave, 0.8));
        steps.push(makeStep('C', 'دو', 5, 1.0));
        // A minor arpeggio: A-C-E-A
        steps.push(makeStep(s4[5].note, s4[5].solfege, s4[5].octave, 0.8));
        steps.push(makeStep(s4[0].note, s4[0].solfege, s4[0].octave, 0.8));
        steps.push(makeStep(s4[2].note, s4[2].solfege, s4[2].octave, 0.8));
        steps.push(makeStep('A', 'لا', 5, 1.0));
        // F major: F-A-C-F
        steps.push(makeStep(s4[3].note, s4[3].solfege, s4[3].octave, 0.8));
        steps.push(makeStep(s4[5].note, s4[5].solfege, s4[5].octave, 0.8));
        steps.push(makeStep(s4[0].note, s4[0].solfege, s4[0].octave, 0.8));
        steps.push(makeStep('F', 'فا', 5, 1.0));
        // G major: G-B-D-G
        steps.push(makeStep(s4[4].note, s4[4].solfege, s4[4].octave, 0.8));
        steps.push(makeStep(s4[6].note, s4[6].solfege, s4[6].octave, 0.8));
        steps.push(makeStep(s4[1].note, s4[1].solfege, s4[1].octave, 0.8));
        steps.push(makeStep('G', 'سل', 5, 1.0));
        return steps;
      },
    },
    {
      id: 'interval-leap',
      name: 'فاصله‌جویی',
      icon: <Zap className="h-4 w-4" />,
      description:
        'در این تمرین به جای نت‌های مجاور، فاصله‌های بزرگ‌تر می‌پرید. ' +
        'مثلاً از دو مستقیماً به می می‌روید، یا از فا به لا. ' +
        'این تمرین کنترل صدا در پرش‌های بزرگ را تقویت می‌کند. ' +
        'سعی کنید قبل از هر پرش، نت هدف را در ذهن خود بشنوید و سپس مستقیم به آن بروید. ' +
        'اگر اول دقت نکردید، اشکالی ندارد — با تمرین بهتر می‌شود.',
      getSteps: () => {
        const s4 = getSolfeggioScale(4);
        const steps: StepNote[] = [];
        // Thirds: C-E, D-F, E-G, F-A, G-B
        for (let i = 0; i < 5; i++) {
          steps.push(makeStep(s4[i].note, s4[i].solfege, s4[i].octave, 0.9));
          steps.push(makeStep(s4[i + 2].note, s4[i + 2].solfege, s4[i + 2].octave, 0.9));
        }
        return steps;
      },
    },
    {
      id: 'triads',
      name: 'تثلیث',
      icon: <Target className="h-4 w-4" />,
      description:
        'تثلیث (تریاد) یعنی سه نت آکورد را پشت سر هم بخوانید. ' +
        'در این تمرین تریادهای دو ماژور (دو-می-سل)، رِ مینور (رِ-فا-لا) و فا ماژور (فا-لا-دو) تمرین می‌شوند. ' +
        'هر تریاد دو بار تکرار می‌شود. ' +
        'هدف: آشنایی با ساختار آکوردها و تقویت حافظه موسیقایی. ' +
        'سعی کنید صدای هر تریاد را در ذهن نگه دارید.',
      getSteps: () => {
        const s4 = getSolfeggioScale(4);
        const steps: StepNote[] = [];
        // C major triad x2
        for (let rep = 0; rep < 2; rep++) {
          for (const i of [0, 2, 4]) {
            steps.push(makeStep(s4[i].note, s4[i].solfege, s4[i].octave, 0.7));
          }
          if (rep === 0) steps.push(makeStep('C', 'دو', 5, 1.0));
        }
        // D minor triad x2
        for (let rep = 0; rep < 2; rep++) {
          for (const i of [1, 3, 5]) {
            steps.push(makeStep(s4[i].note, s4[i].solfege, s4[i].octave, 0.7));
          }
          if (rep === 0) steps.push(makeStep('D', 'رِ', 5, 1.0));
        }
        // F major triad x2
        for (let rep = 0; rep < 2; rep++) {
          for (const i of [3, 5, 0]) {
            steps.push(makeStep(s4[i].note, s4[i].solfege, s4[i].octave, 0.7));
          }
          if (rep === 0) steps.push(makeStep('F', 'فا', 5, 1.0));
        }
        return steps;
      },
    },
    {
      id: 'vocal-run',
      name: 'گریز صوتی',
      icon: <Repeat className="h-4 w-4" />,
      description:
        'گریز صوتی یک تمرین پیشرفته‌تر است: ابتدا نت‌ها سریع بالا می‌روند و بعد سریع پایین می‌آیند. ' +
        'مثل یک موج صوتی! این تمرین سرعت و چابکی حنجره را تقویت می‌کند. ' +
        'اگر مبتدی هستید، اول با سرعت آهسته تمرین کنید. ' +
        'هدف این است که بدون مکث، نت‌ها را روان بالا و پایین بروید.',
      hasSpeedControl: true,
      getSteps: () => {
        const s4 = getSolfeggioScale(4);
        const steps: StepNote[] = [];
        // Ascending run
        for (const n of s4) {
          steps.push(makeStep(n.note, n.solfege, n.octave, 0.4));
        }
        steps.push(makeStep('C', 'دو', 5, 0.6));
        // Descending run
        for (const n of [...s4].reverse()) {
          steps.push(makeStep(n.note, n.solfege, n.octave, 0.4));
        }
        steps.push(makeStep('C', 'دو', 3, 0.6));
        // Ascending again
        for (const n of s4) {
          steps.push(makeStep(n.note, n.solfege, n.octave, 0.4));
        }
        return steps;
      },
    },
    {
      id: 'center-stability',
      name: 'ثبات مرکزی',
      icon: <Target className="h-4 w-4" />,
      description:
        'این تمرین برای تقویت ثبات صداست. یک نت مرکزی (سل) را بارها تکرار می‌کنید و بین نت‌های اطرافش جابه‌جا می‌شوید. ' +
        'الگو: سل → لا → سل → فا → سل → می → سل → رِ → سل → دو. ' +
        'هر بار به سل برمی‌گردید تا صدایتان را «لنگرگاه» نگه دارید. ' +
        'این تمرین برای مبتدی‌ها عالی است چون هم تمرین فاصله است و هم ثبات.',
      getSteps: () => {
        const s4 = getSolfeggioScale(4);
        const steps: StepNote[] = [];
        const center = s4[4]; // G4 (سل)
        const jumps = [5, 3, 2, 1, 0]; // A, F, E, D, C
        // G → A → G → F → G → E → G → D → G → C
        for (const j of jumps) {
          steps.push(makeStep(center.note, center.solfege, center.octave, 0.7));
          steps.push(makeStep(s4[j].note, s4[j].solfege, s4[j].octave, 0.7));
        }
        steps.push(makeStep(center.note, center.solfege, center.octave, 0.7));
        // Return: C → G → D → G → E → G → F → G → A → G
        const revJumps = [...jumps].reverse();
        for (const j of revJumps) {
          steps.push(makeStep(s4[j].note, s4[j].solfege, s4[j].octave, 0.7));
          steps.push(makeStep(center.note, center.solfege, center.octave, 0.7));
        }
        return steps;
      },
    },
  ];
}

// ─── Component ──────────────────────────────────────────────

export function WarmupModule({ soundEnabled = true }: WarmupModuleProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeExercise, setActiveExercise] = useState<ExerciseId>('ascending');
  const [currentStep, setCurrentStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<SpeedId>('medium');
  const [showDescription, setShowDescription] = useState(true);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const playStepRef = useRef<(idx: number) => void>(() => {});
  const scale = useMemo(() => getSolfeggioScale(4), []);
  const exercises = useMemo(() => getExerciseDefs(), []);

  const steps = useMemo(
    () => exercises.find((e) => e.id === activeExercise)?.getSteps(scale) ?? [],
    [activeExercise, exercises, scale],
  );

  const currentExerciseDef = exercises.find((e) => e.id === activeExercise)!;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (stopRef.current) stopRef.current();
    };
  }, []);

  const stopAll = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (stopRef.current) {
      stopRef.current();
      stopRef.current = null;
    }
    setIsPlaying(false);
    setCurrentStep(-1);
  }, []);

  // Play a single step: update note name INSTANTLY, then play sound after a tiny delay
  // so the visual update (note name) appears before the audio starts
  const playStepFn = useCallback(
    (stepIndex: number) => {
      if (stepIndex >= steps.length) {
        stopAll();
        return;
      }

      const step = steps[stepIndex];
      // Update note display IMMEDIATELY — before any work
      setCurrentStep(stepIndex);

      if (soundEnabled) {
        if (stopRef.current) {
          stopRef.current();
          stopRef.current = null;
        }
        // Small delay so React re-renders the note name BEFORE sound starts
        timerRef.current = setTimeout(() => {
          const handle = playNote(step.frequency, step.duration);
          stopRef.current = handle.stop;

          // Determine delay before next step
          let delay: number;
          if (currentExerciseDef.hasSpeedControl) {
            delay = SPEED_CONFIG[speed].ms;
          } else if (activeExercise === 'sustain') {
            delay = step.duration * 1000 + 400;
          } else {
            delay = step.duration * 1000 + 200;
          }

          // Subtract the 50ms we already waited
          const remainingDelay = Math.max(50, delay - 50);

          timerRef.current = setTimeout(() => {
            playStepRef.current(stepIndex + 1);
          }, remainingDelay);
        }, 50);
      } else {
        // No sound — just advance by the visual delay
        let delay: number;
        if (currentExerciseDef.hasSpeedControl) {
          delay = SPEED_CONFIG[speed].ms;
        } else if (activeExercise === 'sustain') {
          delay = step.duration * 1000 + 400;
        } else {
          delay = step.duration * 1000 + 200;
        }

        timerRef.current = setTimeout(() => {
          playStepRef.current(stepIndex + 1);
        }, delay);
      }
    },
    [steps, soundEnabled, activeExercise, speed, stopAll, currentExerciseDef.hasSpeedControl],
  );

  useEffect(() => {
    playStepRef.current = playStepFn;
  }, [playStepFn]);

  const handlePlay = useCallback(() => {
    if (isPlaying) {
      stopAll();
      return;
    }
    ensureAudioReady();
    setIsPlaying(true);
    setCurrentStep(0);
    playStepRef.current(0);
  }, [isPlaying, stopAll]);

  const handleExerciseChange = useCallback(
    (id: ExerciseId) => {
      stopAll();
      setActiveExercise(id);
      setShowDescription(true);
    },
    [stopAll],
  );

  // ─── Teaser ─────────────────────────────────────────────
  if (!expanded) {
    return (
      <Card
        className="border-dashed border-2 border-border/30 bg-gradient-to-br from-muted/10 to-muted/5 hover:border-orange-300/40 transition-all duration-300 group cursor-pointer card-hover"
        onClick={() => setExpanded(true)}
      >
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:shadow-orange-500/35 transition-all duration-300 group-hover:scale-105">
            <Flame className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold">گرم کردن صدا</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              تمرینات گرم کردن قبل از سلفژ
            </p>
            <div className="flex gap-1.5 mt-1.5">
              <Badge variant="outline" className="text-[9px] h-4">
                {toPersianNum(exercises.length)} تمرین
              </Badge>
            </div>
          </div>
          <ChevronLeft className="h-5 w-5 text-muted-foreground/50 group-hover:text-orange-500 transition-colors" />
        </CardContent>
      </Card>
    );
  }

  // ─── Active State ───────────────────────────────────────
  const currentStepData = currentStep >= 0 && currentStep < steps.length
    ? steps[currentStep]
    : null;

  return (
    <Card className="border border-border/40 bg-card/90 backdrop-blur-sm shadow-lg shadow-black/[0.04] overflow-hidden">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            گرم کردن صدا
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              stopAll();
              setExpanded(false);
            }}
            className="h-7 w-7 p-0 text-muted-foreground"
            title="بستن"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {/* Exercise selector — scrollable row */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          {exercises.map((ex) => (
            <button
              key={ex.id}
              onClick={() => handleExerciseChange(ex.id)}
              className={cn(
                'flex-shrink-0 flex items-center justify-center gap-1 h-8 rounded-lg text-[11px] font-medium transition-all duration-200 px-2.5',
                activeExercise === ex.id
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md shadow-orange-500/25'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted',
              )}
            >
              {ex.icon}
              <span>{ex.name}</span>
            </button>
          ))}
        </div>

        {/* Exercise description (collapsible) */}
        <div className="overflow-hidden">
          <button
            onClick={() => setShowDescription((p) => !p)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <Info className="h-3.5 w-3.5" />
            <span className="font-medium">راهنمای تمرین</span>
            {showDescription ? <ChevronUp className="h-3 w-3 mr-auto" /> : <ChevronDown className="h-3 w-3 mr-auto" />}
          </button>
          <AnimatePresence>
            {showDescription && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <p className="text-[11px] leading-relaxed text-muted-foreground pt-2 pr-1">
                  {currentExerciseDef.description}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Speed control for exercises that support it */}
        {currentExerciseDef.hasSpeedControl && (
          <div className="flex items-center justify-center gap-2">
            <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">سرعت:</span>
            {(Object.keys(SPEED_CONFIG) as SpeedId[]).map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={cn(
                  'h-7 px-2.5 rounded-md text-[11px] font-medium transition-all',
                  speed === s
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                )}
              >
                {SPEED_CONFIG[s].label}
              </button>
            ))}
          </div>
        )}

        {/* Current note display — circle stays, only text changes */}
        <div className="flex justify-center py-2">
          <div
            className={cn(
              'relative h-32 w-32 rounded-full flex flex-col items-center justify-center transition-all duration-150',
              'bg-gradient-to-br from-muted/80 to-muted/40 border-2',
              currentStepData && isPlaying
                ? 'border-orange-400 shadow-lg shadow-orange-500/20'
                : 'border-border/30 hover:border-border/50',
            )}
          >
            {/* Pulsing ring when playing */}
            {currentStepData && isPlaying && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-orange-400/40"
                animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}

            {currentStepData && isPlaying ? (
              <>
                {/* Note name — instant swap, no exit/enter animation */}
                <span
                  key={`n-${currentStep}`}
                  className={cn(
                    'text-3xl font-bold bg-gradient-to-br bg-clip-text text-transparent',
                    NOTE_GRADIENTS[currentStepData.note] ?? 'from-gray-400 to-gray-500',
                  )}
                >
                  {currentStepData.solfege}
                </span>
                <span
                  key={`s-${currentStep}`}
                  className="text-xs text-muted-foreground mt-0.5"
                >
                  {currentStepData.note}{toPersianNum(currentStepData.octave)}
                </span>
              </>
            ) : (
              <>
                <span className="text-2xl text-muted-foreground/40">
                  {currentExerciseDef.icon}
                </span>
                <span className="text-[11px] text-muted-foreground mt-1">
                  {currentExerciseDef.name}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Step progress dots */}
        <div className={cn(
          'flex items-center justify-center flex-wrap',
          steps.length > 15 ? 'gap-1' : 'gap-1.5',
        )}>
          {steps.map((step, i) => {
            const isCurrent = i === currentStep && isPlaying;
            const isPast = i < currentStep && isPlaying;
            return (
              <motion.div
                key={i}
                initial={false}
                animate={{
                  scale: isCurrent ? 1.4 : 1,
                  opacity: isPast ? 0.4 : isCurrent ? 1 : 0.25,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className={cn(
                  'rounded-full transition-colors duration-200',
                  steps.length > 15 ? 'h-1.5 w-1.5' : 'h-2 w-2',
                  isCurrent
                    ? cn('bg-gradient-to-br', NOTE_GRADIENTS[step.note] ?? 'from-gray-400 to-gray-500')
                    : isPast
                      ? 'bg-muted-foreground/40'
                      : 'bg-border',
                )}
              />
            );
          })}
        </div>

        {/* Play / Stop button */}
        <div className="flex justify-center">
          <Button
            onClick={handlePlay}
            className={cn(
              'h-11 px-8 rounded-full font-medium transition-all duration-300',
              isPlaying
                ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-lg shadow-red-500/25'
                : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-lg shadow-orange-500/25',
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isPlaying ? (
                <motion.span
                  key="stop"
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 90 }}
                  className="flex items-center gap-2"
                >
                  <Square className="h-4 w-4" fill="currentColor" />
                  توقف
                </motion.span>
              ) : (
                <motion.span
                  key="play"
                  initial={{ scale: 0, rotate: 90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: -90 }}
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" fill="currentColor" />
                  شروع
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </div>

        {/* Step counter */}
        {isPlaying && currentStep >= 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-[11px] text-muted-foreground"
          >
            نت {toPersianNum(currentStep + 1)} از {toPersianNum(steps.length)}
          </motion.p>
        )}
      </CardContent>
    </Card>
  );
}
