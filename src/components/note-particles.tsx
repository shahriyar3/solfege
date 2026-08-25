'use client';

import { useEffect, useReducer, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type Particle = {
  id: number;
  text: string;
  x: number;
  delay: number;
};

type State = {
  particles: Particle[];
  visible: boolean;
};

type Action =
  | { type: 'BURST'; particles: Particle[] }
  | { type: 'HIDE' }
  | { type: 'RESET' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'BURST':
      return { particles: action.particles, visible: true };
    case 'HIDE':
      return { ...state, visible: false };
    case 'RESET':
      return { particles: [], visible: false };
  }
}

const SOLFEGE_SYMBOLS = ['دو', 'رِ', 'می', 'فا', 'سل', 'لا', 'سی'];
const MUSIC_SYMBOLS = ['♪', '♫', '♬'];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function createParticles(solfege: string): Particle[] {
  const count = 8 + Math.floor(Math.random() * 5); // 8-12
  const particles: Particle[] = [];
  const seed = pickRandom(SOLFEGE_SYMBOLS);

  for (let i = 0; i < count; i++) {
    const isSyllable = Math.random() < 0.55;
    const text = isSyllable
      ? (solfege && SOLFEGE_SYMBOLS.includes(solfege) ? solfege : seed)
      : pickRandom(MUSIC_SYMBOLS);

    particles.push({
      id: Date.now() + i,
      text,
      x: (Math.random() - 0.5) * 220,
      delay: Math.random() * 0.25,
    });
  }
  return particles;
}

interface NoteParticlesProps {
  isActive: boolean;
  isAccurate: boolean;
  solfege: string;
}

export function NoteParticles({ isActive, isAccurate, solfege }: NoteParticlesProps) {
  const [state, dispatch] = useReducer(reducer, { particles: [], visible: false });
  const prevAccurate = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isActive) {
      prevAccurate.current = false;
      dispatch({ type: 'RESET' });
      return;
    }

    // Trigger only on false→true transition
    if (isAccurate && !prevAccurate.current) {
      if (timerRef.current) clearTimeout(timerRef.current);
      const newParticles = createParticles(solfege);
      dispatch({ type: 'BURST', particles: newParticles });
      timerRef.current = setTimeout(() => {
        dispatch({ type: 'HIDE' });
      }, 1600);

      prevAccurate.current = true;
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }

    prevAccurate.current = isAccurate;
  }, [isActive, isAccurate, solfege]);

  return (
    <div className="absolute inset-x-0 -top-8 pointer-events-none flex justify-center overflow-visible" aria-hidden>
      <AnimatePresence>
        {state.visible &&
          state.particles.map((p) => (
            <motion.span
              key={p.id}
              className="absolute select-none font-bold whitespace-nowrap"
              style={{
                left: `calc(50% + ${p.x}px)`,
                fontSize: '1.25rem',
              }}
              initial={{
                opacity: 0,
                y: 0,
                scale: 0.8,
              }}
              animate={{
                opacity: [0, 1, 1, 0],
                y: [0, -40, -90, -140],
                scale: [0.8, 1.2, 1.1, 0.5],
                x: [0, p.x * 0.15, -p.x * 0.1, p.x * 0.05],
              }}
              exit={{
                opacity: 0,
                scale: 0.3,
              }}
              transition={{
                duration: 1.5,
                delay: p.delay,
                ease: 'easeOut',
              }}
            >
              <span className="text-teal-400 dark:text-emerald-400 drop-shadow-[0_0_6px_rgba(45,212,191,0.5)]">
                {p.text}
              </span>
            </motion.span>
          ))}
      </AnimatePresence>
    </div>
  );
}
