'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/theme-toggle';
import { useA4Freq, useSoundEnabled } from '@/components/tuner-controls';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  Minus,
  Plus,
  Volume2,
  VolumeX,
  RotateCcw,
  Keyboard,
  Target,
  Waves,
} from 'lucide-react';

function toPersianNum(n: number): string {
  const d = ['\u06F0','\u06F1','\u06F2','\u06F3','\u06F4','\u06F5','\u06F6','\u06F7','\u06F8','\u06F9'];
  return String(n).replace(/\d/g, c => d[parseInt(c)]);
}

const ACCURACY_OPTIONS = [5, 10, 15, 20];

interface SettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDrawer({ open, onOpenChange }: SettingsDrawerProps) {
  const [a4Freq, setA4Freq] = useA4Freq();
  const [soundEnabled, setSoundEnabled] = useSoundEnabled();
  const [accuracyThreshold, setAccuracyThreshold] = usePersistedState<number>('solfeggio-accuracy-threshold', 10);

  const isDefaultA4 = a4Freq === 440;

  const handleA4Change = useCallback((delta: number) => {
    setA4Freq((prev) => Math.max(420, Math.min(460, prev + delta)));
  }, [setA4Freq]);

  const handleResetAll = useCallback(() => {
    setA4Freq(440);
    setSoundEnabled(true);
    setAccuracyThreshold(10);
  }, [setA4Freq, setSoundEnabled, setAccuracyThreshold]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} dir="rtl">
      <SheetContent
        side="left"
        className="w-full sm:max-w-md bg-background/80 backdrop-blur-2xl border-border/30"
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base font-bold flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-sm shadow-violet-500/25">
              <Waves className="h-4 w-4 text-white" />
            </div>
            تنظیمات
          </SheetTitle>
          <SheetDescription className="text-xs">
            تنظیمات برنامه سلفژ آنلاین
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <SettingsSection
              title="فرکانس A4"
              description="فرکانس مرجع نت لای چهارم"
              icon={<Waves className="h-3.5 w-3.5" />}
            >
              <div className="flex items-center justify-center gap-4 py-2">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-10 w-10 rounded-xl p-0 border-border/50"
                  onClick={() => handleA4Change(-1)}
                  disabled={a4Freq <= 420}
                  aria-label="کاهش فرکانس"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="text-center min-w-[80px]">
                  <motion.div
                    key={a4Freq}
                    initial={{ scale: 0.9, opacity: 0.5 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                      'text-3xl font-black tabular-nums',
                      isDefaultA4
                        ? 'text-foreground'
                        : 'text-amber-500 dark:text-amber-400'
                    )}
                  >
                    {toPersianNum(a4Freq)}
                  </motion.div>
                  <span className="text-[10px] text-muted-foreground">هرتز</span>
                </div>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-10 w-10 rounded-xl p-0 border-border/50"
                  onClick={() => handleA4Change(1)}
                  disabled={a4Freq >= 460}
                  aria-label="افزایش فرکانس"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {!isDefaultA4 && (
                <p className="text-[10px] text-amber-500/70 dark:text-amber-400/70 text-center mt-1">
                  مقدار استاندارد: {toPersianNum(440)} هرتز
                </p>
              )}
            </SettingsSection>
          </motion.div>

          <Separator className="bg-border/20" />

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <SettingsSection
              title="صدا"
              description="پخش صدای نت‌های مرجع و بازخورد"
              icon={soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            >
              <div className="flex items-center justify-between py-1">
                <span className="text-sm">صدای نت‌ها</span>
                <Switch
                  checked={soundEnabled}
                  onCheckedChange={setSoundEnabled}
                  aria-label="خاموش/روشن صدا"
                />
              </div>
            </SettingsSection>
          </motion.div>

          <Separator className="bg-border/20" />

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <SettingsSection
              title="آستانه دقت"
              description="حد مجاز انحراف برای نت تمیز (سانت)"
              icon={<Target className="h-3.5 w-3.5" />}
            >
              <div className="grid grid-cols-4 gap-2 py-2">
                {ACCURACY_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setAccuracyThreshold(opt)}
                    className={cn(
                      'py-2 rounded-lg text-sm font-medium border transition-all duration-200',
                      accuracyThreshold === opt
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-muted/30 border-border/30 text-muted-foreground hover:bg-muted/50 hover:border-border/50'
                    )}
                  >
                    ±{toPersianNum(opt)}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/60 text-center mt-1">
                نت در انحراف کمتر از ±{toPersianNum(accuracyThreshold)} سنت «تمیز» شناخته می‌شود
              </p>
            </SettingsSection>
          </motion.div>

          <Separator className="bg-border/20" />

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <SettingsSection
              title="پوسته"
              description="تغییر حالت روز و شب"
              icon={<div className="h-3.5 w-3.5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500" />}
            >
              <div className="flex items-center justify-between py-1">
                <span className="text-sm">تم تاریک/روشن</span>
                <ThemeToggle />
              </div>
            </SettingsSection>
          </motion.div>

          <Separator className="bg-border/20" />

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <SettingsSection
              title="میانبرهای کیبورد"
              description="کلیدهای میانبر برای استفاده سریع‌تر"
              icon={<Keyboard className="h-3.5 w-3.5" />}
            >
              <div className="space-y-2 py-2">
                {[
                  { key: 'Space', desc: 'روشن/خاموش میکروفون' },
                  { key: 'S', desc: 'شروع/توقف میکروفون' },
                ].map((shortcut) => (
                  <div key={shortcut.key} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{shortcut.desc}</span>
                    <kbd className="h-6 px-2 rounded-md bg-muted/80 border border-border/40 text-[11px] font-mono text-foreground/80">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </SettingsSection>
          </motion.div>

          <Separator className="bg-border/20" />

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              variant="outline"
              className="w-full gap-2 text-sm border-red-200 dark:border-red-800/40 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
              onClick={handleResetAll}
            >
              <RotateCcw className="h-4 w-4" />
              بازنشانی همه تنظیمات
            </Button>
          </motion.div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SettingsSection({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div dir="rtl">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-6 w-6 rounded-lg bg-muted/80 flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
        <div>
          <h4 className="text-sm font-bold leading-tight">{title}</h4>
          <p className="text-[10px] text-muted-foreground/70 leading-tight mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
