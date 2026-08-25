'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { Minus, Plus, Volume2, VolumeX } from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Persian numeral helper ─────────────────────────────────────────

function toPersianNum(n: number): string {
  const d = ['\u06F0','\u06F1','\u06F2','\u06F3','\u06F4','\u06F5','\u06F6','\u06F7','\u06F8','\u06F9'];
  return String(n).replace(/\d/g, c => d[parseInt(c)]);
}

// ─── Hooks ───────────────────────────────────────────────────────────

export function useA4Freq(): [number, (v: number | ((prev: number) => number)) => void] {
  return usePersistedState<number>('solfeggio-a4-freq', 440);
}

export function useSoundEnabled(): [boolean, (v: boolean | ((prev: boolean) => boolean)) => void] {
  return usePersistedState<boolean>('solfeggio-sound-on', true);
}

export function useAccuracyThreshold(): [number, (v: number | ((prev: number) => number)) => void] {
  return usePersistedState<number>('solfeggio-accuracy-threshold', 10);
}

// ─── Sparkline internals ─────────────────────────────────────────────

const SPARK_W = 80;
const SPARK_H = 24;
const SPARK_PAD = 2;
const MAX_CENTS = 50;

interface SparkPoints {
  linePath: string;
  fillPath: string;
  dotX: number;
  dotY: number;
  avgAbs: number;
}

function computeSparkPoints(centsHistory: number[]): SparkPoints | null {
  if (centsHistory.length < 2) return null;

  const recent = centsHistory.slice(-20);
  const pts = recent.map((c, i) => {
    const x = SPARK_PAD + (i / (recent.length - 1)) * (SPARK_W - 2 * SPARK_PAD);
    const clamped = Math.max(-MAX_CENTS, Math.min(MAX_CENTS, c));
    const y = SPARK_H / 2 - (clamped / MAX_CENTS) * (SPARK_H / 2 - SPARK_PAD);
    return { x, y };
  });

  let linePath = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) linePath += ` L${pts[i].x},${pts[i].y}`;

  const fillPath = `${linePath} L${pts[pts.length - 1].x},${SPARK_H / 2} L${pts[0].x},${SPARK_H / 2} Z`;

  const last = pts[pts.length - 1];
  const avgAbs = recent.reduce((s, c) => s + Math.abs(c), 0) / recent.length;

  return { linePath, fillPath, dotX: last.x, dotY: last.y, avgAbs };
}

function accuracyColor(avgAbs: number): { stroke: string; fill: string } {
  if (avgAbs <= 8) return { stroke: 'stroke-emerald-500', fill: 'fill-emerald-500' };
  if (avgAbs <= 20) return { stroke: 'stroke-yellow-500', fill: 'fill-yellow-500' };
  return { stroke: 'stroke-red-500', fill: 'fill-red-500' };
}

// ─── Sparkline component ─────────────────────────────────────────────

function CentSparkline({ centsHistory }: { centsHistory: number[] }) {
  const computed = useMemo(() => computeSparkPoints(centsHistory), [centsHistory]);
  const muted = !computed;

  const colors = computed ? accuracyColor(computed.avgAbs) : null;

  return (
    <svg
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      className="shrink-0"
      aria-hidden="true"
    >
      {/* Center reference line */}
      <line
        x1={SPARK_PAD}
        y1={SPARK_H / 2}
        x2={SPARK_W - SPARK_PAD}
        y2={SPARK_H / 2}
        className="stroke-muted-foreground/10"
        strokeWidth={0.5}
      />

      {computed && colors && (
        <>
          {/* Fill below line */}
          <motion.path
            d={computed.fillPath}
            className={colors.fill}
            fillOpacity={0.1}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          />
          {/* Line */}
          <motion.path
            d={computed.linePath}
            className={colors.stroke}
            fill="none"
            strokeWidth={1.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
          {/* Latest value dot */}
          <motion.circle
            cx={computed.dotX}
            cy={computed.dotY}
            r={1.5}
            className={colors.fill}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.2 }}
          />
        </>
      )}

      {/* Muted flat line when not enough data */}
      {muted && (
        <line
          x1={SPARK_PAD}
          y1={SPARK_H / 2}
          x2={SPARK_W - SPARK_PAD}
          y2={SPARK_H / 2}
          className="stroke-muted-foreground/30"
          strokeWidth={1}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

// ─── TunerControls ───────────────────────────────────────────────────

interface TunerControlsProps {
  centsHistory: number[];
}

export function TunerControls({ centsHistory }: TunerControlsProps) {
  const [a4Freq, setA4Freq] = useA4Freq();
  const [soundEnabled, setSoundEnabled] = useSoundEnabled();

  const isDefaultA4 = a4Freq === 440;

  const handleA4Change = (delta: number) => {
    setA4Freq((prev) => Math.max(420, Math.min(460, prev + delta)));
  };

  return (
    <div className="flex items-center gap-3 text-xs">
      {/* A4 Calibration — RTL for Persian text */}
      <div className="flex items-center gap-1.5" dir="rtl">
        <span className="text-muted-foreground whitespace-nowrap">
          A4 ={' '}
          <span className={cn(
            isDefaultA4 ? 'text-foreground' : 'text-amber-500 dark:text-amber-400'
          )}>
            {toPersianNum(a4Freq)}
          </span>
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => handleA4Change(-1)}
          disabled={a4Freq <= 420}
          aria-label="کاهش فرکانس A4"
        >
          <Minus className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => handleA4Change(1)}
          disabled={a4Freq >= 460}
          aria-label="افزایش فرکانس A4"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <div className="w-px h-4 bg-border/50" />

      {/* Sound Toggle */}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-7 w-7 p-0',
          !soundEnabled && 'text-muted-foreground'
        )}
        onClick={() => setSoundEnabled((prev) => !prev)}
        aria-label={soundEnabled ? 'قطع صدا' : 'وصل صدا'}
      >
        {soundEnabled
          ? <Volume2 className="h-3.5 w-3.5" />
          : <VolumeX className="h-3.5 w-3.5" />}
      </Button>

      <div className="w-px h-4 bg-border/50" />

      {/* Mini Sparkline */}
      <CentSparkline centsHistory={centsHistory} />
    </div>
  );
}
