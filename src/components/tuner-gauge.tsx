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

// ── Tick mark positions ──────────────────────────────────────────────
const GAUGE_MARKS = [
  -50, -40, -30, -25, -20, -15, -10, -5,
   0,   5,  10,  25,  15,  20,  30,  40,  50,
];

// ── SVG Layout Constants ────────────────────────────────────────────
const CX = 150;
const CY = 150;
const R = 120;
const ARC_STROKE = 10;
const NEEDLE_LEN = R - ARC_STROKE / 2 - 14; // ~101px
const NUM_SEGS = 60;                          // segments for smooth gradient
const ARC_LEN = Math.PI * R;                  // semicircle arc length
const SEG_LEN = ARC_LEN / NUM_SEGS;

// ── Pure math helpers (module-level, no re-computation) ─────────────

/** Convert cents (-50…+50) → angle in degrees. 0°=right, 90°=up, 180°=left */
function centsToAngle(cents: number): number {
  const c = Math.max(-50, Math.min(50, cents));
  return 180 - ((c + 50) / 100) * 180;
}

/** Polar (angle-deg) → SVG cartesian (y flipped) */
function polar(angleDeg: number, radius: number = R) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY - radius * Math.sin(rad) };
}

/** SVG arc path from startAngle → endAngle (counter-clockwise = upper semicircle) */
function arcPath(a1: number, a2: number, r: number = R): string {
  const s = polar(a1, r);
  const e = polar(a2, r);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${Math.abs(a1 - a2) > 180 ? 1 : 0} 0 ${e.x} ${e.y}`;
}

/** Linear colour interpolation between two [r,g,b] arrays */
function lerp(a: number[], b: number[], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

/** Map a cent value to a smoothly interpolated colour */
function centsColor(c: number): string {
  const a = Math.abs(c);
  if (a <= 5)  return lerp([16, 185, 129], [234, 179, 8],  a / 5);        // emerald→yellow
  if (a <= 10) return lerp([234, 179, 8],  [249, 115, 22], (a - 5) / 5);  // yellow→orange
  if (a <= 25) return lerp([249, 115, 22], [239, 68, 68],  (a - 10) / 15); // orange→red
  return lerp([239, 68, 68], [185, 28, 28], Math.min((a - 25) / 25, 1));   // red→dark-red
}

// ── Pre-computed static data (computed once, never re-rendered) ─────

/** Full semicircle path string */
const SEMI_PATH = arcPath(180, 0);

/** Coloured arc segments using strokeDasharray / strokeDashoffset */
const ARC_SEGS = Array.from({ length: NUM_SEGS }, (_, i) => {
  const midC = -50 + ((i + 0.5) * 100) / NUM_SEGS;
  const startPx = (i / NUM_SEGS) * ARC_LEN;
  const endPx = ARC_LEN - startPx - SEG_LEN;
  return {
    color: centsColor(midC),
    dash: `0 ${startPx.toFixed(2)} ${SEG_LEN.toFixed(2)} ${Math.max(0, endPx).toFixed(2)}`,
  };
});

/** Tick mark geometry */
const TICKS = GAUGE_MARKS.map((mark) => {
  const angle = centsToAngle(mark);
  const major = mark === 0 || Math.abs(mark) === 50;
  const mid = Math.abs(mark) === 25;
  const quarter = Math.abs(mark) === 10 || Math.abs(mark) === 40;
  const len = major ? 16 : mid ? 12 : quarter ? 9 : 6;
  const sw = major ? 1.8 : mid ? 1.4 : 1;
  const outerR = R - ARC_STROKE / 2 - 3;
  return {
    mark,
    major,
    p1: polar(angle, outerR),
    p2: polar(angle, outerR - len),
    sw,
    lbl: polar(angle, outerR - len - 11),
  };
});

// ── Component ───────────────────────────────────────────────────────

export function TunerGauge({
  cents, noteName, solfege, octave, frequency,
  isAccurate, isActive, volume,
}: TunerGaugeProps) {
  const clamped = Math.max(-50, Math.min(50, cents));
  const needleAngle = centsToAngle(clamped);
  const rotation = needleAngle - 90; // needle drawn pointing up; 90° = no rotation
  const abs = Math.abs(clamped);

  // ── derived text helpers ──
  const feedbackCls = isActive
    ? abs <= 5  ? 'text-emerald-500'
    : abs <= 10 ? 'text-yellow-500'
    : abs <= 25 ? 'text-orange-500'
    :             'text-red-500'
    : 'text-muted-foreground';

  const accuracyText = abs <= 5 ? 'عالی' : abs <= 10 ? 'خوب' : abs <= 25 ? 'قابل قبول' : 'فالش';

  const directionText = !isActive ? '' : cents < -3 ? 'بم ←' : cents > 3 ? '→ زیر' : 'کوک دقیق';

  const centsLabel = clamped !== 0
    ? clamped > 0 ? `${Math.abs(clamped)} سنت زیر` : `${Math.abs(clamped)} سنت بم`
    : '';

  // ── needle polygon (tapered) ──
  const tipY = CY - NEEDLE_LEN;
  const baseY = CY - NEEDLE_LEN + 16;
  const needlePoints = `${CX},${CY} ${CX - 3.5},${baseY} ${CX},${tipY} ${CX + 3.5},${baseY}`;

  return (
    <div dir="ltr" className="flex flex-col items-center gap-2 w-full select-none">
      {/* ── Volume Bar ──────────────────────────────────────────── */}
      <div className="w-full max-w-sm px-2">
        <div className="h-1 bg-muted/50 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-rose-500/80 via-amber-400/80 to-yellow-300/80"
            style={{ width: `${Math.min(volume * 400, 100)}%` }}
            transition={{ duration: 0.05 }}
          />
        </div>
      </div>

      {/* ── SVG Gauge ───────────────────────────────────────────── */}
      <div className="relative w-full max-w-xs sm:max-w-sm md:max-w-md mx-auto">
        <svg
          viewBox="0 0 300 165"
          className="w-full h-auto"
          role="img"
          aria-label="Pitch tuner gauge"
        >
          <defs>
            {/* Pulsing glow for accurate state */}
            <filter id="arcGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            {/* Subtle needle drop-shadow */}
            <filter id="nShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="rgba(0,0,0,0.35)" />
            </filter>
          </defs>

          {/* ── Background arc track ── */}
          <path
            d={SEMI_PATH}
            fill="none"
            stroke="currentColor"
            className="text-muted-foreground/[0.07] dark:text-muted-foreground/[0.1]"
            strokeWidth={ARC_STROKE + 6}
            strokeLinecap="round"
          />

          {/* ── Coloured arc segments (strokeDasharray technique) ── */}
          <motion.g animate={{ opacity: isActive ? 0.88 : 0.2 }} transition={{ duration: 0.4 }}>
            {ARC_SEGS.map((s, i) => (
              <path
                key={i}
                d={SEMI_PATH}
                fill="none"
                stroke={s.color}
                strokeWidth={ARC_STROKE}
                strokeLinecap="butt"
                strokeDasharray={s.dash}
              />
            ))}
          </motion.g>

          {/* ── Subtle centre reference line ── */}
          <line
            x1={CX} y1={CY}
            x2={CX} y2={polar(90, R - ARC_STROKE / 2 - 3).y}
            stroke="currentColor"
            className="text-foreground/[0.05] dark:text-foreground/[0.08]"
            strokeWidth={1}
            strokeDasharray="2 4"
          />

          {/* ── Tick marks + labels ── */}
          {TICKS.map(({ mark, major, p1, p2, sw, lbl }) => (
            <g key={mark}>
              <line
                x1={p1.x} y1={p1.y}
                x2={p2.x} y2={p2.y}
                stroke="currentColor"
                className="text-foreground/20 dark:text-foreground/30"
                strokeWidth={sw}
                strokeLinecap="round"
              />
              {major && (
                <text
                  x={lbl.x}
                  y={lbl.y + 3.5}
                  textAnchor="middle"
                  className="fill-muted-foreground/50 dark:fill-muted-foreground/40"
                  fontSize="9.5"
                  fontFamily="ui-monospace, SFMono-Regular, monospace"
                >
                  {mark > 0 ? `+${mark}` : mark}
                </text>
              )}
            </g>
          ))}

          {/* ── Needle (spring-animated) ── */}
          <motion.g
            style={{ transformOrigin: `${CX}px ${CY}px` }}
            initial={{ rotate: 0 }}
            animate={{ rotate: rotation }}
            transition={{ type: 'spring', stiffness: 260, damping: 26, mass: 0.9 }}
          >
            {/* Glow pulse at needle tip when accurate */}
            {isAccurate && isActive && (
              <motion.circle
                cx={CX} cy={tipY} r={5}
                fill="#10b981"
                filter="url(#arcGlow)"
                animate={{ r: [4, 12, 4], opacity: [0.85, 0.12, 0.85] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}

            {/* Needle body */}
            <polygon
              points={needlePoints}
              className={cn(
                'fill-foreground/70 dark:fill-foreground/85',
                isAccurate && isActive && 'fill-emerald-500 dark:fill-emerald-400',
              )}
              filter="url(#nShadow)"
            />

            {/* Small bright tip */}
            <circle
              cx={CX} cy={tipY} r={2.2}
              className={cn(
                'fill-background',
                isAccurate && isActive && 'fill-emerald-200 dark:fill-emerald-300',
              )}
            />
          </motion.g>

          {/* ── Centre pivot (layered circles) ── */}
          <circle cx={CX} cy={CY} r={9}  className="fill-muted-foreground/[0.06] dark:fill-muted-foreground/[0.1]" />
          <circle cx={CX} cy={CY} r={5.5} className="fill-foreground/15 dark:fill-foreground/25" />
          <circle cx={CX} cy={CY} r={2.5} className="fill-foreground/35 dark:fill-foreground/50" />
        </svg>

        {/* ── Centre display (positioned inside semicircle) ── */}
        <div
          className="absolute inset-0 flex flex-col items-center pointer-events-none"
          style={{ paddingTop: '54%' }}
        >
          <div className="flex flex-col items-center">
            {/* Glow backdrop when accurate */}
            {abs <= 5 && isActive && (
              <motion.div
                className="absolute -inset-6 rounded-full bg-emerald-500/[0.07] blur-2xl"
                animate={{ opacity: [0.2, 0.7, 0.2] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}

            {/* Solfege name */}
            <AnimatePresence mode="wait">
              <motion.div
                className={cn(
                  'relative text-5xl sm:text-6xl lg:text-7xl font-black leading-none',
                  feedbackCls,
                )}
                key={isActive ? solfege : 'idle'}
                initial={{ scale: 0.5, opacity: 0, y: 14 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.85, opacity: 0, y: -10 }}
                transition={{ type: 'spring', stiffness: 340, damping: 24 }}
              >
                {solfege}
              </motion.div>
            </AnimatePresence>

            {/* Note name + octave · frequency */}
            <div className="flex items-center gap-2 text-muted-foreground/80 mt-1">
              <span className="text-sm font-mono font-semibold">{noteName}{octave}</span>
              <span className="w-px h-3 bg-border" />
              <span className="text-xs font-mono">{frequency.toFixed(1)} Hz</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Accuracy Feedback (below arc) ── */}
      <div className="flex flex-col items-center gap-0.5 min-h-[3.5rem]">
        {isActive ? (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                className={cn('text-xl sm:text-2xl font-bold', feedbackCls)}
                key={accuracyText}
                initial={{ y: 6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -6, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {accuracyText}
              </motion.div>
            </AnimatePresence>
            <div className={cn('text-xs font-mono', feedbackCls)}>{centsLabel}</div>
            <div className={cn('text-[11px] font-mono tracking-wider', feedbackCls)}>
              {directionText}
            </div>
          </>
        ) : (
          <div className="text-muted-foreground/50 text-sm mt-4">آماده ضبط</div>
        )}
      </div>
    </div>
  );
}
