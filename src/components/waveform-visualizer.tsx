'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface WaveformVisualizerProps {
  isActive: boolean;
  analyserNode: AnalyserNode | null;
  className?: string;
}

const BAR_COUNT = 40;

type DrawState = {
  isActive: boolean;
  analyserNode: AnalyserNode | null;
};

function isDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

export function WaveformVisualizer({ isActive, analyserNode, className }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const stateRef = useRef<DrawState>({ isActive: false, analyserNode: null });

  useEffect(() => {
    stateRef.current.isActive = isActive;
    stateRef.current.analyserNode = analyserNode;
  }, [isActive, analyserNode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const waveDataArray = new Float32Array(2048);
    const freqDataArray = new Uint8Array(1024);

    const draw = () => {
      const dark = isDark();
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;

      // Layout zones
      const waveZoneH = height * 0.55;
      const freqZoneY = waveZoneH;
      const freqZoneH = height - waveZoneH;
      const waveMidY = waveZoneH * 0.5;

      ctx.clearRect(0, 0, width, height);

      // Divider line between zones
      ctx.strokeStyle = dark
        ? 'rgba(255, 255, 255, 0.06)'
        : 'rgba(0, 0, 0, 0.06)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(8, waveZoneH);
      ctx.lineTo(width - 8, waveZoneH);
      ctx.stroke();

      // --- Center reference line (dashed, subtle) ---
      ctx.strokeStyle = dark
        ? 'rgba(255, 255, 255, 0.1)'
        : 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, waveMidY);
      ctx.lineTo(width, waveMidY);
      ctx.stroke();
      ctx.setLineDash([]);

      const currentActive = stateRef.current.isActive;
      const currentAnalyser = stateRef.current.analyserNode;

      if (!currentActive || !currentAnalyser) {
        // Inactive: flat line
        ctx.strokeStyle = dark
          ? 'rgba(255, 255, 255, 0.08)'
          : 'rgba(0, 0, 0, 0.08)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, waveMidY);
        ctx.lineTo(width, waveMidY);
        ctx.stroke();

        // Inactive: empty bars at ~5% height
        drawInactiveBars(ctx, width, freqZoneY, freqZoneH, dark);

        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      // --- WAVEFORM SECTION ---
      const bufferLength = Math.min(currentAnalyser.fftSize, waveDataArray.length);
      currentAnalyser.getFloatTimeDomainData(waveDataArray);
      const sliceWidth = width / bufferLength;

      // Build wave points
      const points: [number, number][] = [];
      for (let i = 0; i < bufferLength; i++) {
        const v = waveDataArray[i];
        const x = i * sliceWidth;
        const y = waveMidY + v * waveMidY * 0.85;
        points.push([x, y]);
      }

      // Gradient fill below the waveform line
      const fillGrad = ctx.createLinearGradient(0, 0, width, 0);
      if (dark) {
        fillGrad.addColorStop(0, 'rgba(244, 63, 94, 0.06)');
        fillGrad.addColorStop(0.5, 'rgba(244, 63, 94, 0.03)');
        fillGrad.addColorStop(1, 'rgba(244, 63, 94, 0.06)');
      } else {
        fillGrad.addColorStop(0, 'rgba(244, 63, 94, 0.10)');
        fillGrad.addColorStop(0.5, 'rgba(244, 63, 94, 0.05)');
        fillGrad.addColorStop(1, 'rgba(244, 63, 94, 0.10)');
      }
      ctx.fillStyle = fillGrad;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
      }
      ctx.lineTo(width, waveZoneH);
      ctx.lineTo(0, waveZoneH);
      ctx.closePath();
      ctx.fill();

      // Mirror reflection below center line at 30% opacity
      ctx.globalAlpha = 0.3;
      const mirrorGrad = ctx.createLinearGradient(0, 0, width, 0);
      if (dark) {
        mirrorGrad.addColorStop(0, 'rgba(244, 63, 94, 0.3)');
        mirrorGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.3)');
        mirrorGrad.addColorStop(1, 'rgba(244, 63, 94, 0.3)');
      } else {
        mirrorGrad.addColorStop(0, 'rgba(251, 113, 133, 0.5)');
        mirrorGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.5)');
        mirrorGrad.addColorStop(1, 'rgba(251, 113, 133, 0.5)');
      }
      ctx.strokeStyle = mirrorGrad;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const mirroredY = waveMidY + (waveMidY - points[i][1]);
        if (i === 0) ctx.moveTo(points[i][0], mirroredY);
        else ctx.lineTo(points[i][0], mirroredY);
      }
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      // Waveform glow
      ctx.strokeStyle = dark
        ? 'rgba(244, 63, 94, 0.08)'
        : 'rgba(251, 113, 133, 0.12)';
      ctx.lineWidth = 8;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        if (i === 0) ctx.moveTo(points[i][0], points[i][1]);
        else ctx.lineTo(points[i][0], points[i][1]);
      }
      ctx.stroke();

      // Main waveform line
      const lineGrad = ctx.createLinearGradient(0, 0, width, 0);
      if (dark) {
        lineGrad.addColorStop(0, 'rgba(244, 63, 94, 0.7)');
        lineGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.7)');
        lineGrad.addColorStop(1, 'rgba(244, 63, 94, 0.7)');
      } else {
        lineGrad.addColorStop(0, 'hsl(348, 83%, 60%)');
        lineGrad.addColorStop(0.5, 'hsl(43, 96%, 56%)');
        lineGrad.addColorStop(1, 'hsl(348, 83%, 60%)');
      }
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        if (i === 0) ctx.moveTo(points[i][0], points[i][1]);
        else ctx.lineTo(points[i][0], points[i][1]);
      }
      ctx.stroke();

      // --- FREQUENCY SPECTRUM SECTION ---
      const freqLength = Math.min(currentAnalyser.frequencyBinCount, freqDataArray.length);
      currentAnalyser.getByteFrequencyData(freqDataArray);

      drawBars(ctx, freqDataArray, freqLength, width, freqZoneY, freqZoneH, dark);

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div className={cn('rounded-xl overflow-hidden bg-muted/20', className)}>
      <canvas
        ref={canvasRef}
        className="w-full h-24 sm:h-28 block"
        aria-hidden="true"
      />
    </div>
  );
}

/* ---------- helpers (module-level, no re-creation per render) ---------- */

/** Draw frequency bars (active data) */
function drawBars(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  dataLength: number,
  width: number,
  zoneY: number,
  zoneH: number,
  dark: boolean,
) {
  const gap = 2;
  const totalGaps = (BAR_COUNT - 1) * gap;
  const barW = Math.max(1, (width - 16 - totalGaps) / BAR_COUNT);
  const startX = 8;
  const maxBarH = zoneH - 6;
  const baseY = zoneY + zoneH - 3;
  const radius = Math.min(barW / 2, 3);

  for (let i = 0; i < BAR_COUNT; i++) {
    // Map bar index to frequency bin (skip very low bins)
    const binIndex = Math.floor((i / BAR_COUNT) * dataLength * 0.75) + 2;
    const value = binIndex < dataLength ? data[binIndex] : 0;

    // Logarithmic height mapping for better visual distribution
    const normalized = value / 255;
    const logH = normalized > 0.001
      ? Math.log(1 + normalized * 9) / Math.log(10) * maxBarH
      : 0;
    const barH = Math.max(0, Math.min(maxBarH, logH));

    const x = startX + i * (barW + gap);

    // Bar color: emerald (low) → amber (mid) → rose (high)
    const t = i / (BAR_COUNT - 1);
    let r: number, g: number, b: number;
    if (t < 0.5) {
      const s = t / 0.5;
      r = lerp(16, 251, s);
      g = lerp(185, 191, s);
      b = lerp(129, 36, s);
    } else {
      const s = (t - 0.5) / 0.5;
      r = lerp(251, 244, s);
      g = lerp(191, 63, s);
      b = lerp(36, 94, s);
    }
    const alpha = dark ? 0.6 : 0.85;
    const glowAlpha = dark ? 0.06 : 0.12;

    if (barH < 1) continue;

    const barTop = baseY - barH;

    // Glow pass (wider, low opacity)
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${glowAlpha})`;
    roundedBar(ctx, x - 1, barTop, barW + 2, barH, radius + 1);
    ctx.fill();

    // Main bar
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    roundedBar(ctx, x, barTop, barW, barH, radius);
    ctx.fill();
  }
}

/** Draw inactive placeholder bars at ~5% height */
function drawInactiveBars(
  ctx: CanvasRenderingContext2D,
  width: number,
  zoneY: number,
  zoneH: number,
  dark: boolean,
) {
  const gap = 2;
  const totalGaps = (BAR_COUNT - 1) * gap;
  const barW = Math.max(1, (width - 16 - totalGaps) / BAR_COUNT);
  const startX = 8;
  const barH = (zoneH - 6) * 0.05;
  const baseY = zoneY + zoneH - 3;
  const barTop = baseY - barH;
  const radius = Math.min(barW / 2, 3);
  const alpha = dark ? 0.08 : 0.12;

  ctx.fillStyle = `rgba(148, 163, 184, ${alpha})`;
  for (let i = 0; i < BAR_COUNT; i++) {
    const x = startX + i * (barW + gap);
    roundedBar(ctx, x, barTop, barW, barH, radius);
    ctx.fill();
  }
}

/** Draw a rectangle with rounded top corners */
function roundedBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const safeR = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x, y + h);                   // bottom-left
  ctx.lineTo(x, y + safeR);                // left side up
  ctx.arcTo(x, y, x + safeR, y, safeR);    // top-left corner
  ctx.lineTo(x + w - safeR, y);            // top side
  ctx.arcTo(x + w, y, x + w, y + safeR, safeR); // top-right corner
  ctx.lineTo(x + w, y + h);                // right side down
  ctx.closePath();
}

/** Linear interpolation */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
