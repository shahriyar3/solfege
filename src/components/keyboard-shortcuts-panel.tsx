'use client';

import { motion } from 'framer-motion';
import { Keyboard } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

interface KeyboardShortcutsPanelProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const shortcuts = [
  { key: 'Space', label: 'Space', description: 'شروع/توقف میکروفون' },
  { key: 'Esc', label: 'Esc', description: 'توقف میکروفون' },
  { key: '1', label: '1', description: 'نت دو (C)' },
  { key: '2', label: '2', description: 'نت ر (D)' },
  { key: '3', label: '3', description: 'نت می (E)' },
  { key: '4', label: '4', description: 'نت فا (F)' },
  { key: '5', label: '5', description: 'نت سل (G)' },
  { key: '6', label: '6', description: 'نت لا (A)' },
  { key: '7', label: '7', description: 'نت سی (B)' },
  { key: 'S', label: 'S', description: 'ذخیره نت‌ها' },
  { key: 'R', label: 'R', description: 'پاک کردن تاریخچه' },
  { key: 'M', label: 'M', description: 'باز/بستن مترونوم' },
  { key: '?', label: '?', description: 'نمایش این راهنما' },
] as const;

export function KeyboardShortcutsPanel({
  open,
  onOpenChange,
}: KeyboardShortcutsPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[60vh] overflow-y-auto rounded-t-2xl border-t border-border/40 bg-card/95 backdrop-blur-xl"
      >
        <SheetHeader className="text-center pb-0">
          <SheetTitle className="flex items-center justify-center gap-2 text-base">
            <Keyboard className="h-4 w-4 text-muted-foreground" />
            میانبرهای کیبورد
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground/60">
            برای استفاده سریع‌تر از کلیدهای میانبر استفاده کنید
          </SheetDescription>
        </SheetHeader>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="grid grid-cols-2 md:grid-cols-3 gap-2.5 px-4 pb-5 pt-2"
        >
          {shortcuts.map((shortcut) => (
            <motion.div
              key={shortcut.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.05 }}
              className="flex items-center gap-3 rounded-xl bg-secondary/50 border border-border/30 px-3 py-2.5 shadow-sm"
            >
              <kbd className="inline-flex h-7 min-w-[2rem] items-center justify-center rounded-lg border border-border/60 bg-background px-2 font-mono text-xs font-semibold text-foreground shadow-sm ring-1 ring-inset ring-black/[0.04]">
                {shortcut.label}
              </kbd>
              <span className="text-sm text-muted-foreground leading-tight">
                {shortcut.description}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </SheetContent>
    </Sheet>
  );
}
