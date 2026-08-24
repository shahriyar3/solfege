'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface WaveformVisualizerProps {
  isActive: boolean;
  analyserNode: AnalyserNode | null;
  className?: string;
}

export function WaveformVisualizer({ isActive, analyserNode, className }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const stateRef = useRef({ isActive: false, analyserNode: null as AnalyserNode | null });

  // Sync props to ref inside effect (not during render)
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
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;
      const midY = height / 2;

      ctx.clearRect(0, 0, width, height);

      ctx.strokeStyle = 'hsl(var(--border) / 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(width, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      const currentActive = stateRef.current.isActive;
      const currentAnalyser = stateRef.current.analyserNode;

      if (!currentActive || !currentAnalyser) {
        ctx.strokeStyle = 'hsl(var(--muted-foreground) / 0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(width, midY);
        ctx.stroke();
        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      const bufferLength = currentAnalyser.fftSize;
      const dataArray = new Float32Array(bufferLength);
      currentAnalyser.getFloatTimeDomainData(dataArray);

      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, 'hsl(340, 70%, 55%)');
      gradient.addColorStop(0.5, 'hsl(45, 90%, 55%)');
      gradient.addColorStop(1, 'hsl(340, 70%, 55%)');

      // Glow
      ctx.strokeStyle = 'hsl(340, 70%, 55% / 0.12)';
      ctx.lineWidth = 8;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      const sliceWidth = width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i];
        const y = midY + v * midY * 0.9;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();

      // Main line
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.beginPath();
      x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i];
        const y = midY + v * midY * 0.9;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={cn('w-full h-16 sm:h-20 rounded-xl bg-muted/20', className)}
    />
  );
}
