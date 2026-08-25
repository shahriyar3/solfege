'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTuner } from '@/hooks/useTuner';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { TunerGauge } from '@/components/tuner-gauge';
import { NoteHistory } from '@/components/note-history';
import { SessionHistory } from '@/components/session-history';
import { ReferenceNotes } from '@/components/reference-notes';
import { WaveformVisualizer } from '@/components/waveform-visualizer';
import { PracticeMode } from '@/components/practice-mode';
import { IntervalTrainer } from '@/components/interval-trainer';
import { VoiceRange } from '@/components/voice-range';
import { PerformanceChart } from '@/components/performance-chart';
import { Metronome } from '@/components/metronome';
import { PianoKeyboard } from '@/components/piano-keyboard';
import { ThemeToggle } from '@/components/theme-toggle';
import { PitchStability } from '@/components/pitch-stability';
import { SettingsDrawer } from '@/components/settings-drawer';
import { KeyboardShortcutsPanel } from '@/components/keyboard-shortcuts-panel';
import { NoteQuiz } from '@/components/note-quiz';
import { WarmupModule } from '@/components/warmup-module';
import { ScoreSummary } from '@/components/score-summary';
import { ScalePatterns } from '@/components/scale-patterns';
import { BreathingExercise } from '@/components/breathing-exercise';
import { TunerControls, useA4Freq, useSoundEnabled, useAccuracyThreshold } from '@/components/tuner-controls';
import { SessionTimer } from '@/components/session-timer';
import { Achievements } from '@/components/achievements';
import { NoteParticles } from '@/components/note-particles';
import { DailyStreak, type DailyStreakHandle } from '@/components/daily-streak';
import { cn } from '@/lib/utils';
import {
  Mic,
  MicOff,
  Save,
  History,
  RotateCcw,
  Music2,
  TrendingUp,
  Keyboard,
  Settings2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function toPersianNum(n: number): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/\d/g, (d) => persianDigits[parseInt(d)]);
}

export default function Home() {
  const [a4Freq] = useA4Freq();
  const [soundEnabled] = useSoundEnabled();
  const [accuracyThreshold] = useAccuracyThreshold();

  const {
    isActive,
    currentPitch,
    volume,
    error,
    noteHistory,
    stats,
    analyserNode,
    start,
    stop,
    resetHistory,
  } = useTuner({ a4Frequency: a4Freq, accuracyThreshold });

  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [practiceTarget, setPracticeTarget] = useState<string | null>(null);
  const [practiceBestStreak, setPracticeBestStreak] = useState(0);
  const [practiceSeconds, setPracticeSeconds] = useState(0);
  const practiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [showScoreSummary, setShowScoreSummary] = useState(false);
  const streakRef = useRef<DailyStreakHandle>(null);

  // Practice seconds tracker
  useEffect(() => {
    if (!isActive) {
      if (practiceTimerRef.current) {
        clearInterval(practiceTimerRef.current);
        practiceTimerRef.current = null;
      }
      return;
    }
    practiceTimerRef.current = setInterval(() => {
      setPracticeSeconds((s) => s + 1);
    }, 1000);
    return () => {
      if (practiceTimerRef.current) {
        clearInterval(practiceTimerRef.current);
        practiceTimerRef.current = null;
      }
    };
  }, [isActive]);

  // Keyboard shortcuts
  const handleStop = useCallback(() => {
    if (noteHistory.length > 0) {
      setShowScoreSummary(true);
    }
    stop();
  }, [stop, noteHistory.length]);

  const handleToggleMic = useCallback(() => {
    if (isActive) {
      handleStop();
    } else {
      start();
    }
  }, [isActive, start, handleStop]);

  useKeyboardShortcuts({
    onToggleMic: handleToggleMic,
  });

  // Unique highlighted notes for piano
  const highlightedNotes = useMemo(
    () => [...new Set(noteHistory.slice(-20).map((n) => n.note))],
    [noteHistory],
  );

  const handleStart = useCallback(async () => {
    try {
      const res = await fetch('/api/solfeggio/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `جلسه ${new Date().toLocaleDateString('fa-IR')}` }),
      });
      if (res.ok) {
        const session = await res.json();
        sessionIdRef.current = session.id;
      }
    } catch (err) {
      console.error('Error creating session:', err);
    }
    start();
    streakRef.current?.recordPractice();
  }, [start]);

  const handleSave = useCallback(async () => {
    if (!sessionIdRef.current || noteHistory.length === 0) return;
    setSaving(true);
    try {
      for (const note of noteHistory) {
        await fetch('/api/solfeggio/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            noteName: note.note,
            solfege: note.solfege,
            octave: note.octave,
            frequency: note.frequency,
            cents: note.cents,
            isAccurate: note.isAccurate,
          }),
        });
      }
      setSavedMessage('ذخیره شد');
      setTimeout(() => setSavedMessage(null), 3000);
    } catch (err) {
      console.error('Error saving notes:', err);
    } finally {
      setSaving(false);
    }
  }, [noteHistory]);

  useEffect(() => {
    if (!isActive || !sessionIdRef.current) return;
    const interval = setInterval(() => {
      if (noteHistory.length > 0) {
        const lastNote = noteHistory[noteHistory.length - 1];
        fetch('/api/solfeggio/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            noteName: lastNote.note,
            solfege: lastNote.solfege,
            octave: lastNote.octave,
            frequency: lastNote.frequency,
            cents: lastNote.cents,
            isAccurate: lastNote.isAccurate,
          }),
        });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isActive, noteHistory]);

  const handleTargetChange = useCallback((note: string | null) => {
    setPracticeTarget(note);
  }, []);

  const handleStreakChange = useCallback((best: number) => {
    setPracticeBestStreak(best);
  }, []);

  return (
    <div className="noise-bg min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-muted/20" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border/30 shadow-sm shadow-black/[0.02] dark:shadow-none">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="h-10 w-10 rounded-2xl bg-gradient-to-br from-rose-500 via-pink-500 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-500/25 ring-1 ring-white/20 dark:ring-white/10 btn-shimmer"
              whileHover={{ scale: 1.05, rotate: -3 }}
              whileTap={{ scale: 0.95 }}
            >
              <Music2 className="h-5 w-5 text-white" />
            </motion.div>
            <div>
              <h1 className="text-lg font-extrabold leading-tight tracking-tight gradient-text">سلفژ آنلاین</h1>
              <p className="text-[11px] text-muted-foreground leading-tight">تنظیم صدا و تمرین سلفژ</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setSettingsOpen(true)}
              aria-label="تنظیمات"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground/70 hover:text-foreground"
              onClick={() => setShortcutsOpen(true)}
              aria-label="میانبرهای کیبورد"
            >
              <span className="font-mono text-xs font-bold leading-none">?</span>
            </Button>
            <ThemeToggle />
            {isActive && noteHistory.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 text-xs h-8 border-border/50">
                <Save className="h-3.5 w-3.5" />
                {saving ? 'در حال ذخیره...' : 'ذخیره'}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowHistory(true)} className="gap-1.5 text-xs h-8 border-border/50">
              <History className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">تاریخچه</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 pt-6 pb-8">
        {/* Ambient glow */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-rose-500/5 dark:bg-rose-500/[0.03] rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-violet-500/5 dark:bg-violet-500/[0.03] rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-amber-500/3 dark:bg-amber-500/[0.02] rounded-full blur-3xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* Left column: Tuner */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-5 animate-fade-up">
            {/* Main tuner card */}
            <Card className={cn(
              'overflow-hidden border bg-card/95 backdrop-blur-sm card-hover transition-all duration-500 tuner-card-glow',
              isActive
                ? 'border-rose-500/30 shadow-2xl shadow-rose-500/[0.07] is-active gradient-border'
                : 'border-border/40 shadow-xl shadow-black/[0.03]'
            )}>
              <CardContent className="p-5 sm:p-7 lg:p-8">
                {/* Top controls row: timer + tuner controls + keyboard hint */}
                <div className="flex items-center justify-between mb-4">
                  <SessionTimer isActive={isActive} />
                  <div className="hidden sm:block">
                    <TunerControls centsHistory={noteHistory.map(n => n.cents)} />
                  </div>
                  <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                    <Keyboard className="h-3 w-3" />
                    <span>Space = میکروفون</span>
                  </div>
                </div>

                <div className="relative">
                  <TunerGauge
                    cents={currentPitch?.cents ?? 0}
                    noteName={currentPitch?.note ?? '—'}
                    solfege={currentPitch?.solfege ?? '—'}
                    octave={currentPitch?.octave ?? 4}
                    frequency={currentPitch?.frequency ?? 0}
                    isAccurate={currentPitch?.isAccurate ?? false}
                    isActive={isActive}
                    volume={volume}
                  />
                  <NoteParticles
                    isActive={isActive}
                    isAccurate={currentPitch?.isAccurate ?? false}
                    solfege={currentPitch?.solfege ?? ''}
                  />
                </div>

                {/* Pitch stability meter */}
                <div className="my-3">
                  <PitchStability isActive={isActive} noteHistory={noteHistory} />
                </div>

                {/* Waveform visualizer */}
                <div className="my-5">
                  <WaveformVisualizer isActive={isActive} analyserNode={analyserNode} />
                </div>

                {/* Piano keyboard */}
                <div dir="ltr" className="my-2">
                  <PianoKeyboard
                    currentNote={currentPitch?.note}
                    targetNote={practiceTarget ?? undefined}
                    highlightedNotes={highlightedNotes}
                  />
                </div>

                <div className="border-t border-border/20 my-5" />

                {/* Mic button and controls */}
                <div className="flex flex-col items-center gap-4">
                  <div className={cn("relative", isActive && "glow-pulse")}>
                    {isActive && (
                      <>
                        <motion.div
                          className="absolute inset-0 rounded-full bg-red-500/20"
                          animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                        />
                        <motion.div
                          className="absolute inset-0 rounded-full bg-red-500/12"
                          animate={{ scale: [1, 1.35], opacity: [0.35, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
                        />
                      </>
                    )}
                    <Button
                      size="lg"
                      className={cn(
                        'relative h-[72px] w-[72px] rounded-full text-2xl shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95',
                        isActive
                          ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30'
                          : 'bg-gradient-to-br from-rose-500 via-pink-500 to-amber-500 hover:from-rose-600 hover:via-pink-600 hover:to-amber-600 shadow-rose-500/30 btn-shimmer'
                      )}
                      onClick={isActive ? stop : handleStart}
                    >
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={isActive ? 'off' : 'on'}
                          initial={{ scale: 0, rotate: -90 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0, rotate: 90 }}
                          transition={{ duration: 0.2 }}
                        >
                          {isActive ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
                        </motion.div>
                      </AnimatePresence>
                    </Button>
                  </div>

                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-sm font-medium text-foreground/80">
                      {isActive ? 'در حال ضبط... برای توقف بزنید' : 'برای شروع سلفژ بزنید'}
                    </span>
                    {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-1 rounded-full">{error}</p>}
                    <AnimatePresence>
                      {savedMessage && (
                        <motion.p
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 rounded-full"
                        >
                          {savedMessage}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {noteHistory.length > 0 && (
                    <div className="flex items-center gap-3 mt-1">
                      <Button variant="ghost" size="sm" onClick={resetHistory} className="gap-1.5 text-xs text-muted-foreground h-7">
                        <RotateCcw className="h-3 w-3" />
                        پاک کردن
                      </Button>
                      <div className="text-xs text-muted-foreground">
                        {toPersianNum(noteHistory.length)} نت شناسایی شده
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Practice mode */}
            <PracticeMode
              currentPitch={currentPitch}
              isActive={isActive}
              soundEnabled={soundEnabled}
              onTargetChange={handleTargetChange}
              onStreakChange={handleStreakChange}
            />

            {/* Reference notes */}
            <ReferenceNotes currentNote={currentPitch?.note} />

            {/* Interval trainer */}
            <IntervalTrainer currentPitch={currentPitch} isActive={isActive} soundEnabled={soundEnabled} />
          </div>

          {/* Right column: Stats, Timer, Achievements, Metronome, History */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-5 animate-fade-up animation-delay-200">
            {/* Daily streak */}
            <DailyStreak ref={streakRef} />

            {/* Stats card */}
            <Card className="border border-border/40 shadow-lg shadow-black/[0.03] bg-card/90 backdrop-blur-sm card-hover overflow-hidden">
              <div className="h-0.5 w-full bg-gradient-to-l from-violet-500 via-fuchsia-500 to-rose-500" />
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-sm shadow-violet-500/25">
                    <TrendingUp className="h-3.5 w-3.5 text-white" />
                  </div>
                  <h3 className="text-sm font-bold">آمار جلسه</h3>
                  <div className="flex-1" />
                  {stats.totalNotes > 0 && (
                    <span className="text-[10px] text-muted-foreground/60 font-mono tabular-nums">{toPersianNum(stats.totalNotes)} نت</span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="bg-gradient-to-b from-muted/40 to-muted/10 rounded-xl p-3 text-center border border-border/15 shadow-sm shadow-black/[0.01]">
                    <div className="text-2xl font-bold tabular-nums">{toPersianNum(stats.totalNotes)}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">کل نت‌ها</div>
                  </div>
                  <div className="bg-gradient-to-b from-emerald-50/50 to-emerald-100/10 dark:from-emerald-950/20 dark:to-emerald-950/5 rounded-xl p-3 text-center border border-emerald-200/20 dark:border-emerald-800/20 shadow-sm shadow-emerald-500/[0.03]">
                    <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{toPersianNum(stats.accurateNotes)}</div>
                    <div className="text-[10px] text-emerald-600/60 dark:text-emerald-400/60 mt-0.5">نت‌های تمیز</div>
                  </div>
                  <div className={cn('rounded-xl p-3 text-center border',
                    stats.accuracy >= 80 ? 'bg-gradient-to-b from-emerald-50/50 to-emerald-100/10 dark:from-emerald-950/20 dark:to-emerald-950/5 border-emerald-200/20 dark:border-emerald-800/20' :
                    stats.accuracy >= 50 ? 'bg-gradient-to-b from-yellow-50/50 to-yellow-100/10 dark:from-yellow-950/20 dark:to-yellow-950/5 border-yellow-200/20 dark:border-yellow-800/20' :
                    'bg-gradient-to-b from-muted/50 to-muted/20 border-border/20'
                  )}>
                    <div className={cn(
                      'text-2xl font-bold tabular-nums',
                      stats.accuracy >= 80 ? 'text-emerald-600 dark:text-emerald-400' : stats.accuracy >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500'
                    )}>
                      {toPersianNum(stats.accuracy)}٪
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">دقت</div>
                  </div>
                </div>
                {stats.totalNotes > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>دقت کلی</span>
                      <span>{toPersianNum(stats.accuracy)}٪</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className={cn(
                          'h-full rounded-full',
                          stats.accuracy >= 80 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : stats.accuracy >= 50 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' : 'bg-gradient-to-r from-red-400 to-red-500'
                        )}
                        animate={{ width: `${stats.accuracy}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Achievements */}
            <Achievements
              totalNotes={stats.totalNotes}
              accurateNotes={stats.accurateNotes}
              accuracy={stats.accuracy}
              bestStreak={practiceBestStreak}
              practiceSeconds={practiceSeconds}
            />

            {/* Voice range */}
            <VoiceRange currentPitch={currentPitch} isActive={isActive} noteHistory={noteHistory} />

            {/* Metronome */}
            <Metronome isTunerActive={isActive} />

            {/* Note Quiz */}
            <NoteQuiz soundEnabled={soundEnabled} />

            {/* Scale Patterns */}
            <ScalePatterns soundEnabled={soundEnabled} />

            {/* Warmup Module */}
            <WarmupModule soundEnabled={soundEnabled} />

            {/* Breathing Exercise */}
            <BreathingExercise soundEnabled={soundEnabled} />

            {/* Note history */}
            <Card className="flex-1 border border-border/40 shadow-lg shadow-black/[0.03] bg-card/90 backdrop-blur-sm min-h-[300px] card-hover overflow-hidden">
              <CardContent className="p-4 h-full flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center shadow-sm shadow-sky-500/25">
                      <Music2 className="h-3.5 w-3.5 text-white" />
                    </div>
                    <h3 className="text-sm font-bold">نت‌های شناسایی شده</h3>
                  </div>
                  {noteHistory.length > 0 && (
                    <Badge variant="outline" className="text-[10px] font-mono h-5">
                      {toPersianNum(noteHistory.length)}
                    </Badge>
                  )}
                </div>
                <div className="flex-1 min-h-0">
                  <NoteHistory notes={noteHistory} stats={stats} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mb-5">
          <PerformanceChart />
        </div>

        <div className="mt-10 mb-2 animate-fade-up animation-delay-400">
          <Card className="border border-dashed border-border/25 bg-muted/[0.03] card-hover">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-5 w-5 rounded-md bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm shadow-amber-500/20">
                  <span className="text-xs">💡</span>
                </div>
                <h3 className="text-sm font-bold">راهنمای استفاده</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { icon: '🎤', text: 'روی دکمه میکروفون بزنید و نت‌های سلفژ را بخوانید' },
                  { icon: '🎯', text: 'حالت تمرین طبیعی یا کروماتیک با حالت تصادفی' },
                  { icon: '🎵', text: 'تمرین فاصله‌ها: سکوند، تیرس، کوارت، کوینت و...' },
                  { icon: '🧠', text: 'آزمون شنوایی: نت را بشنوید و نامش را انتخاب کنید' },
                  { icon: '🔥', text: 'گرم کردن صدا: تمرینات صعودی، نزولی، تریل و سرج' },
                  { icon: '📊', text: 'نمودار عملکرد و خروجی CSV از تاریخچه تمرین' },
                  { icon: '🔔', text: 'شناسایی گستره صدا و خلاصه عملکرد جلسه' },
                  { icon: '⌨️', text: 'میانبر: Space = میکروفون' },
                  { icon: '🎼', text: 'آزمون گام‌ها: ماژور، مینور، پنتاتونیک و...' },
                  { icon: '🌬️', text: 'تمرین تنفس: سه الگوی تنفسی برای خوانندگی' },
                ].map((tip, idx) => (
                  <div key={idx} className="flex gap-2.5 text-xs text-muted-foreground leading-relaxed py-1">
                    <span className="text-base shrink-0 mt-px">{tip.icon}</span>
                    <p>{tip.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/20 glass">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between text-xs text-muted-foreground/70">
          <div className="flex items-center gap-2">
            <Music2 className="h-3.5 w-3.5 text-rose-400/50" />
            <span className="font-medium">سلفژ آنلاین</span>
            <span className="text-muted-foreground/30">|</span>
            <span>تنظیم صدا و ارزیابی دقت سلفژ</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">تحلیل صدا به صورت ریل‌تایم</span>
            <span className="text-muted-foreground/30">|</span>
            <span className="font-mono text-[10px]">v3.1</span>
          </div>
        </div>
      </footer>

      {/* Session history modal */}
      <SessionHistory isOpen={showHistory} onClose={() => setShowHistory(false)} />

      {/* Score summary modal */}
      <ScoreSummary
        open={showScoreSummary}
        onClose={() => setShowScoreSummary(false)}
        noteHistory={noteHistory}
        bestStreak={practiceBestStreak}
        practiceSeconds={practiceSeconds}
        onRetry={() => { setShowScoreSummary(false); resetHistory(); setPracticeSeconds(0); }}
      />

      {/* Settings drawer */}
      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Keyboard shortcuts panel */}
      <KeyboardShortcutsPanel open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}