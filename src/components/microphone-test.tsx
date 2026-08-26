'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  ChevronLeft,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Volume2,
  Activity,
  ShieldCheck,
  Signal,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

type TestPhase = 'idle' | 'testing' | 'done';

interface MicQualityResult {
  avgVolume: number;
  peakVolume: number;
  noiseFloor: number;
  signalToNoise: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  description: string;
}

// ─── Constants ──────────────────────────────────────────────

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

function toPersianNum(n: number): string {
  return String(n)
    .split('')
    .map((d) => PERSIAN_DIGITS[parseInt(d)] ?? d)
    .join('');
}

const QUALITY_CONFIG = {
  excellent: {
    label: 'عالی',
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800/40',
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  },
  good: {
    label: 'خوب',
    color: 'text-cyan-500',
    bg: 'bg-cyan-50 dark:bg-cyan-950/30',
    border: 'border-cyan-200 dark:border-cyan-800/40',
    icon: <CheckCircle2 className="h-5 w-5 text-cyan-500" />,
  },
  fair: {
    label: 'متوسط',
    color: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800/40',
    icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
  },
  poor: {
    label: 'ضعیف',
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800/40',
    icon: <XCircle className="h-5 w-5 text-red-500" />,
  },
};

// ─── Component ──────────────────────────────────────────────

export function MicrophoneTest() {
  const [expanded, setExpanded] = useState(false);
  const [phase, setPhase] = useState<TestPhase>('idle');
  const [currentVolume, setCurrentVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MicQualityResult | null>(null);
  const [progress, setProgress] = useState(0);

  // Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const bufferRef = useRef<Float32Array>(new Float32Array(0));
  const volumeHistoryRef = useRef<number[]>([]);
  const testStartRef = useRef<number>(0);
  const durationRef = useRef(5000); // 5 seconds test

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const analyzeQuality = useCallback((volumes: number[]): MicQualityResult => {
    if (volumes.length === 0) {
      return {
        avgVolume: 0,
        peakVolume: 0,
        noiseFloor: 0,
        signalToNoise: 0,
        quality: 'poor',
        description: 'هیچ صدایی ثبت نشد. مطمئن شوید میکروفون فعال است.',
      };
    }

    const avg = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const peak = Math.max(...volumes);

    // Noise floor: lowest 10% of readings
    const sorted = [...volumes].sort((a, b) => a - b);
    const noiseCount = Math.max(1, Math.floor(sorted.length * 0.1));
    const noiseFloor = sorted.slice(0, noiseCount).reduce((a, b) => a + b, 0) / noiseCount;

    // Signal-to-noise ratio (in dB)
    const snr = noiseFloor > 0.0001 ? 20 * Math.log10(avg / noiseFloor) : peak > 0.01 ? 40 : 0;

    let quality: MicQualityResult['quality'];
    let description: string;

    if (peak < 0.01) {
      quality = 'poor';
      description = 'میکروفون سیگنال قابل قبولی دریافت نمی‌کند. لطفاً بررسی کنید که میکروفون فعال و دسترسی داده شده باشد.';
    } else if (peak < 0.03) {
      quality = 'fair';
      description = 'سطح سیگنال پایین است. نزدیک‌تر به میکروفون بخوانید یا در تنظیمات سیستم بلندی میکروفون را افزایش دهید.';
    } else if (avg < 0.01) {
      quality = 'fair';
      description = 'میانگین سطح صدا پایین است. هنگام خواندن نزدیک‌تر به میکروفون باشید.';
    } else if (noiseFloor > 0.03) {
      quality = 'fair';
      description = 'نویز محیط بالاست. سعی کنید در محیط آرام‌تری تمرین کنید.';
    } else if (snr < 10) {
      quality = 'fair';
      description = 'نسبت سیگنال به نویز متوسط است. برای نتایج بهتر در محیط ساکت‌تری تمرین کنید.';
    } else if (peak > 0.05 && avg > 0.02 && snr > 15) {
      quality = 'excellent';
      description = 'میکروفون عالی کار می‌کند! سطح صدا و کیفیت سیگنال برای تمرین Solfege مناسب است.';
    } else {
      quality = 'good';
      description = 'میکروفون به خوبی کار می‌کند. برای بهترین نتیجه، با صدای واضح و نزدیک به میکروفون بخوانید.';
    }

    return {
      avgVolume: avg,
      peakVolume: peak,
      noiseFloor,
      signalToNoise: snr,
      quality,
      description,
    };
  }, []);

  const startTest = useCallback(async () => {
    try {
      setError(null);
      setResult(null);
      setPhase('testing');
      setProgress(0);
      volumeHistoryRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      audioCtxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      bufferRef.current = new Float32Array(analyser.fftSize);
      testStartRef.current = Date.now();

      // Analysis loop
      const analyze = () => {
        if (!analyserRef.current || !audioCtxRef.current) return;
        analyserRef.current.getFloatTimeDomainData(bufferRef.current);

        let rms = 0;
        for (let i = 0; i < bufferRef.current.length; i++) {
          rms += bufferRef.current[i] * bufferRef.current[i];
        }
        rms = Math.sqrt(rms / bufferRef.current.length);

        setCurrentVolume(rms);
        volumeHistoryRef.current.push(rms);

        // Progress
        const elapsed = Date.now() - testStartRef.current;
        const pct = Math.min(100, (elapsed / durationRef.current) * 100);
        setProgress(pct);

        if (elapsed >= durationRef.current) {
          // Test complete
          const quality = analyzeQuality(volumeHistoryRef.current);
          setResult(quality);
          setPhase('done');
          cleanup();
          return;
        }

        rafRef.current = requestAnimationFrame(analyze);
      };
      analyze();
    } catch (_err) {
      setError('دسترسی به میکروفون رد شد. لطفاً اجازه دسترسی بدهید.');
      setPhase('idle');
    }
  }, [analyzeQuality, cleanup, durationRef]);

  const handleStopTest = useCallback(() => {
    if (volumeHistoryRef.current.length > 0) {
      const quality = analyzeQuality(volumeHistoryRef.current);
      setResult(quality);
      setPhase('done');
    } else {
      setPhase('idle');
    }
    cleanup();
  }, [analyzeQuality, cleanup]);

  const handleRetest = useCallback(() => {
    setResult(null);
    setCurrentVolume(0);
    setProgress(0);
    startTest();
  }, [startTest]);

  const handleCollapsedOpen = useCallback(() => {
    setExpanded(true);
  }, []);

  // ─── Volume bar color ─────────────────────────────────────
  const volumeNorm = Math.min(1, currentVolume / 0.15);
  const volumeColor = volumeNorm < 0.1 ? 'bg-red-400' : volumeNorm < 0.3 ? 'bg-amber-400' : 'bg-emerald-400';

  // ─── Teaser ──────────────────────────────────────────────
  if (!expanded) {
    return (
      <Card
        className="border-dashed border-2 border-border/30 bg-gradient-to-br from-muted/10 to-muted/5 hover:border-violet-300/40 transition-all duration-300 group cursor-pointer card-hover"
        onClick={handleCollapsedOpen}
      >
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/35 transition-all duration-300 group-hover:scale-105">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold">تست میکروفون</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              بلندی و کیفیت میکروفون را بررسی کنید
            </p>
            <div className="flex gap-1.5 mt-1.5">
              <Badge variant="outline" className="text-[9px] h-4">
                <Volume2 className="h-2.5 w-2.5 ml-0.5" />
                بلندی
              </Badge>
              <Badge variant="outline" className="text-[9px] h-4">
                <ShieldCheck className="h-2.5 w-2.5 ml-0.5" />
                کیفیت
              </Badge>
            </div>
          </div>
          <ChevronLeft className="h-5 w-5 text-muted-foreground/50 group-hover:text-violet-500 transition-colors" />
        </CardContent>
      </Card>
    );
  }

  // ─── Expanded ────────────────────────────────────────────
  return (
    <Card className="border border-border/40 bg-card/90 backdrop-blur-sm shadow-lg shadow-black/[0.04] overflow-hidden">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Activity className="h-4 w-4 text-violet-500" />
            تست میکروفون
          </CardTitle>
          <div className="flex items-center gap-1">
            {(phase === 'done' || phase === 'testing') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRetest}
                className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                دوباره
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                cleanup();
                setPhase('idle');
                setExpanded(false);
                setCurrentVolume(0);
                setResult(null);
                setProgress(0);
              }}
              className="h-7 w-7 p-0 text-muted-foreground"
              title="بستن"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {/* Instructions */}
        {phase === 'idle' && !result && (
          <div className="text-center py-4 space-y-2">
            <div className="h-16 w-16 mx-auto rounded-full bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center">
              <Mic className="h-8 w-8 text-violet-400" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              با کلیک روی «شروع تست»، به مدت ۵ ثانیه سطح صدای میکروفون شما اندازه‌گیری می‌شود.
              <br />
              لطفاً در حین تست صدای خود را امتحان کنید.
            </p>
          </div>
        )}

        {/* Testing phase */}
        {phase === 'testing' && (
          <div className="space-y-4">
            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>در حال اندازه‌گیری...</span>
                <span>{toPersianNum(Math.round(progress))}٪</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-500"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* Volume meter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>سطح صدا</span>
                <span className="font-mono">{currentVolume.toFixed(4)}</span>
              </div>
              <div className="relative h-8 bg-muted/50 rounded-xl overflow-hidden border border-border/20">
                <motion.div
                  className={cn('absolute inset-y-0 right-0 rounded-xl transition-colors', volumeColor)}
                  animate={{ width: `${Math.max(2, volumeNorm * 100)}%` }}
                  transition={{ duration: 0.08 }}
                />
                {/* Scale markers */}
                <div className="absolute inset-0 flex items-center justify-between px-2">
                  {[...Array(20)].map((_, i) => (
                    <div key={i} className="w-px h-2 bg-background/30" />
                  ))}
                </div>
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground/60">
                <span>ساکت</span>
                <span>متوسط</span>
                <span>بلند</span>
              </div>
            </div>

            {/* Hint */}
            <p className="text-center text-[11px] text-muted-foreground animate-pulse">
              🎤 صدای خود را امتحان کنید...
            </p>

            <Button
              variant="outline"
              size="sm"
              onClick={handleStopTest}
              className="w-full text-xs"
            >
              توقف تست
            </Button>
          </div>
        )}

        {/* Results */}
        {phase === 'done' && result && (
          <div className="space-y-4">
            {/* Quality badge */}
            <div className="flex flex-col items-center py-3">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className={cn(
                  'flex flex-col items-center gap-2 px-6 py-4 rounded-2xl border',
                  QUALITY_CONFIG[result.quality].bg,
                  QUALITY_CONFIG[result.quality].border,
                )}
              >
                {QUALITY_CONFIG[result.quality].icon}
                <span className={cn('text-xl font-bold', QUALITY_CONFIG[result.quality].color)}>
                  {QUALITY_CONFIG[result.quality].label}
                </span>
              </motion.div>
              <p className="text-[11px] text-muted-foreground mt-3 text-center leading-relaxed max-w-xs">
                {result.description}
              </p>
            </div>

            {/* Detailed metrics */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/20 rounded-xl p-3 border border-border/10 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">میانگین سطح صدا</span>
                </div>
                <span className={cn(
                  'text-lg font-bold font-mono tabular-nums',
                  result.avgVolume > 0.02 ? 'text-emerald-500' : result.avgVolume > 0.005 ? 'text-amber-500' : 'text-red-500',
                )}>
                  {result.avgVolume.toFixed(4)}
                </span>
              </div>

              <div className="bg-muted/20 rounded-xl p-3 border border-border/10 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Signal className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">بیشترین سطح</span>
                </div>
                <span className={cn(
                  'text-lg font-bold font-mono tabular-nums',
                  result.peakVolume > 0.03 ? 'text-emerald-500' : result.peakVolume > 0.01 ? 'text-amber-500' : 'text-red-500',
                )}>
                  {result.peakVolume.toFixed(4)}
                </span>
              </div>

              <div className="bg-muted/20 rounded-xl p-3 border border-border/10 space-y-1">
                <div className="flex items-center gap-1.5">
                  <MicOff className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">کف نویز</span>
                </div>
                <span className={cn(
                  'text-lg font-bold font-mono tabular-nums',
                  result.noiseFloor < 0.01 ? 'text-emerald-500' : result.noiseFloor < 0.03 ? 'text-amber-500' : 'text-red-500',
                )}>
                  {result.noiseFloor.toFixed(4)}
                </span>
              </div>

              <div className="bg-muted/20 rounded-xl p-3 border border-border/10 space-y-1">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">نسبت سیگنال به نویز</span>
                </div>
                <span className={cn(
                  'text-lg font-bold font-mono tabular-nums',
                  result.signalToNoise > 15 ? 'text-emerald-500' : result.signalToNoise > 10 ? 'text-amber-500' : 'text-red-500',
                )}>
                  {result.signalToNoise.toFixed(1)} dB
                </span>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-muted/10 rounded-xl p-3 border border-border/10 space-y-1.5">
              <span className="text-[10px] font-bold text-muted-foreground">نکات:</span>
              <ul className="text-[10px] text-muted-foreground space-y-1 list-disc list-inside">
                <li>فاصله مناسب با میکروفون: {toPersianNum(15)} تا {toPersianNum(30)} سانتی‌متر</li>
                <li>در محیط ساکت تمرین کنید تا نویز کمتر باشد</li>
                <li>در تنظیمات سیستم، بلندی میکروفون را بررسی کنید</li>
                {result.noiseFloor > 0.03 && (
                  <li className="text-amber-500">⚠️ نویز محیط بالاست - محیط آرام‌تری پیدا کنید</li>
                )}
                {result.peakVolume < 0.01 && (
                  <li className="text-red-500">⚠️ سیگنال خیلی ضعیف است - نزدیک‌تر بخوانید</li>
                )}
              </ul>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRetest}
              className="w-full text-xs"
            >
              آزمایش مجدد
            </Button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
            <XCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Start button */}
        {phase === 'idle' && !result && (
          <Button
            onClick={startTest}
            className="w-full h-10 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/25 text-white gap-2"
          >
            <Mic className="h-4 w-4" />
            شروع تست
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
