'use client';

import { useEffect } from 'react';

interface KeyboardShortcutHandlers {
  onToggleMic?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

function isInputFocused(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement;
  if (!target) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  );
}

export function useKeyboardShortcuts({ onToggleMic, onPrev, onNext }: KeyboardShortcutHandlers) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in an input field
      if (isInputFocused(e)) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          onToggleMic?.();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onPrev?.();
          break;
        case 'ArrowRight':
          e.preventDefault();
          onNext?.();
          break;
        // Escape is reserved for modals — do nothing
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleMic, onPrev, onNext]);
}
