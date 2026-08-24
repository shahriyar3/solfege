'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TunerGaugeProps {
  cents: number;
  noteName: string;
  solfege: string;
  octave: number;
  frequency: number;
  isAccurate: boolean;
  isActive: boolean;
  volume: number;
}

// Musical convention: left=flat(-), right=sharp(+)
// Even in RTL, musicians expect this direction
const GAUGE_MARKS = [-50, -40, -30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30, 40, 50];

export function TunerGauge({
  cents,
  noteName,
  solfege,
  octave,
  frequency,
  isAccurate,
  isActive,
  volume,
}: TunerGaugeProps) {
  // Musical convention: -50 = left (flat), +50 = right (sharp)
  const position = ((cents + 50) / 100) * 100;

  const absCents = Math.abs(cents);

  const getColor = () => {
    if (!isActive) return 'bg-muted-foreground/30';
    if (absCents <= 5) return 'bg-emerald-500';
    if (absCents <= 10) return 'bg-yellow-500';
    if (absCents <= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getGlowColor = () => {
    if (!isActive) return '';
    if (absCents <= 5) return 'shadow-emerald-500/60 shadow-xl';
    if (absCents <= 10) return 'shadow-yellow-500/50 shadow-xl';
    if (absCents <= 25) return 'shadow-orange-500/50 shadow-xl';
    return 'shadow-red-500/50 shadow-xl';
  };

  const getTextColor = () => {
    if (!isActive) return 'text-muted-foreground';
    if (absCents <= 5) return 'text-emerald-500';
    if (absCents <= 10) return 'text-yellow-500';
    if (absCents <= 25) return 'text-orange-500';
    return 'text-red-500';
  };

  const getAccurateText = () => {
    if (absCents <= 5) return 'عالی!';
    if (absCents <= 10) return 'خوب';
    if (absCents <= 20) return 'قابل قبول';
    return 'فالش';
  };

  const getDirectionText = () => {
    if (!isActive) return '';
    if (cents < -3) return 'بم ←';
    if (cents > 3) return '→ زیر';
    return 'کوک دقیق';
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full select-none">
      {/* Volume / waveform indicator bar */}
      <div className="w-full max-w-lg">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-rose-400 to-amber-400 rounded-full"
            style={{ width: `${Math.min(volume * 400, 100)}%` }}
            transition={{ duration: 0.05 }}
          />
        </div>
      </div>

      {/* Main note display */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="relative">
          {absCents <= 5 && isActive && (
            <motion.div
              className="absolute inset-0 rounded-3xl bg-emerald-500/20 blur-xl"
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <AnimatePresence mode="wait">
            <motion.div
              className={cn(
                'relative text-8xl sm:text-9xl font-black tabular-nums leading-none select-none',
                getTextColor()
              )}
              key={isActive ? solfege : 'idle'}
              initial={{ scale: 0.6, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: -10 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            >
              {solfege}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground mt-1">
          <span className="text-base font-mono font-medium">{noteName}{octave}</span>
          <span className="w-px h-3 bg-border" />
          <span className="text-sm font-mono">{frequency.toFixed(1)} Hz</span>
        </div>
      </div>

      {/* Cents gauge - the main visual element */}
      <div className="w-full max-w-lg px-1">
        <div className="relative h-20 sm:h-24">
          {/* Background track */}
          <div
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-4 rounded-full overflow-hidden"
            style={{
              background: 'linear-gradient(to left, rgba(239,68,68,0.25) 0%, rgba(239,68,68,0.15) 20%, rgba(234,179,8,0.12) 35%, rgba(16,185,129,0.15) 50%, rgba(234,179,8,0.12) 65%, rgba(239,68,68,0.15) 80%, rgba(239,68,68,0.25) 100%)',
            }}
          />

          {/* Scale marks - force LTR direction for musical convention */}
          <div className="absolute inset-0" dir="ltr">
            {GAUGE_MARKS.map((mark) => {
              const pos = ((mark + 50) / 100) * 100;
              const isMain = mark === 0 || Math.abs(mark) === 50;
              const isMid = Math.abs(mark) === 25;
              const isQuarter = Math.abs(mark) === 10 || Math.abs(mark) === 40;
              return (
                <div
                  key={mark}
                  className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center"
                  style={{ left: `${pos}%`, transform: `translateX(-50%) translateY(-50%)` }}
                >
                  <div
                    className={cn(
                      'w-px',
                      isMain ? 'h-6 bg-foreground/25' :
                      isMid ? 'h-4 bg-foreground/15' :
                      isQuarter ? 'h-3 bg-foreground/10' :
                      'h-2 bg-foreground/5'
                    )}
                  />
                  {isMain && (
                    <span className="text-[10px] text-muted-foreground/70 mt-1 font-mono">
                      {mark > 0 ? `+${mark}` : mark}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Center line */}
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-px w-0.5 bg-foreground/10" />

            {/* Needle / indicator */}
            <motion.div
              className={cn(
                'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.2)] transition-colors duration-150 z-10',
                getColor(),
                getGlowColor(),
              )}
              style={{ left: `${position}%` }}
              animate={{ left: `${position}%` }}
              transition={{ type: 'spring', stiffness: 500, damping: 35, mass: 0.5 }}
            >
              <div className="absolute inset-[3px] rounded-full bg-white/90" />
              {absCents <= 5 && isActive && (
                <motion.div
                  className="absolute inset-[-4px] rounded-full border-2 border-emerald-400/50"
                  initial={{ scale: 1, opacity: 1 }}
                  animate={{ scale: 1.4, opacity: 0 }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
            </motion.div>
          </div>
        </div>

        {/* Cents labels below gauge - force LTR for musical convention */}
        <div className="flex justify-between mt-3 px-2" dir="ltr">
          <span className="text-[11px] text-red-400/70 font-mono">-50</span>
          <span className="text-[11px] text-orange-400/70 font-mono">-25</span>
          <span className="text-[11px] text-emerald-500 font-mono font-medium">0</span>
          <span className="text-[11px] text-orange-400/70 font-mono">+25</span>
          <span className="text-[11px] text-red-400/70 font-mono">+50</span>
        </div>
      </div>

      {/* Accuracy feedback */}
      <div className="flex flex-col items-center gap-1.5">
        {isActive ? (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                className={cn('text-2xl font-bold', getTextColor())}
                key={getAccurateText()}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {getAccurateText()}
              </motion.div>
            </AnimatePresence>
            <div className={cn('text-sm font-mono', getTextColor())}>
              {cents !== 0
                ? cents > 0
                  ? `${cents} سنت زیر`
                  : `${Math.abs(cents)} سنت بم`
                : ''}
            </div>
            <div className={cn(
              'text-xs font-mono tracking-wider',
              isActive ? getTextColor() : 'text-muted-foreground'
            )}>
              {getDirectionText()}
            </div>
          </>
        ) : (
          <div className="text-muted-foreground/50 text-sm mt-4">
            آماده ضبط
          </div>
        )}
      </div>
    </div>
  );
}
