'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PitchDetector,
  PitchResult,
} from '@/lib/pitch-detection';

interface TunerState {
  isActive: boolean;
  currentPitch: PitchResult | null;
  volume: number;
  error: string | null;
  noteHistory: PitchResult[];
  stats: {
    totalNotes: number;
    accurateNotes: number;
    accuracy: number;
  };
}

export function useTuner() {
  const [state, setState] = useState<TunerState>({
    isActive: false,
    currentPitch: null,
    volume: 0,
    error: null,
    noteHistory: [],
    stats: { totalNotes: 0, accurateNotes: 0, accuracy: 0 },
  });

  const detectorRef = useRef<PitchDetector | null>(null);
  const lastNoteRef = useRef<string | null>(null);
  const lastNoteTimeRef = useRef<number>(0);
  const noteDebounceMs = 300; // minimum time between same-note entries

  const handlePitch = useCallback((result: PitchResult | null) => {
    setState((prev) => {
      if (!result) {
        return { ...prev, currentPitch: null };
      }

      const now = Date.now();
      const noteKey = `${result.note}${result.octave}`;
      const isNewNote = noteKey !== lastNoteRef.current ||
        (now - lastNoteTimeRef.current) > noteDebounceMs;

      if (isNewNote) {
        lastNoteRef.current = noteKey;
        lastNoteTimeRef.current = now;

        const newHistory = [...prev.noteHistory, result].slice(-100); // keep last 100
        const totalNotes = newHistory.length;
        const accurateNotes = newHistory.filter((n) => n.isAccurate).length;

        return {
          ...prev,
          currentPitch: result,
          noteHistory: newHistory,
          stats: {
            totalNotes,
            accurateNotes,
            accuracy: totalNotes > 0 ? Math.round((accurateNotes / totalNotes) * 100) : 0,
          },
        };
      }

      return { ...prev, currentPitch: result };
    });
  }, []);

  const handleVolume = useCallback((volume: number) => {
    setState((prev) => ({ ...prev, volume }));
  }, []);

  const start = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, error: null }));
      detectorRef.current = new PitchDetector({
        fftSize: 4096,
        minFrequency: 60,
        maxFrequency: 1500,
        accuracyThreshold: 10,
      });

      await detectorRef.current.start(handlePitch, handleVolume);
      setState((prev) => ({ ...prev, isActive: true }));
    } catch (err) {
      console.error('Microphone error:', err);
      setState((prev) => ({
        ...prev,
        error: 'دسترسی به میکروفون رد شد. لطفاً اجازه دسترسی بدهید.',
        isActive: false,
      }));
    }
  }, [handlePitch, handleVolume]);

  const stop = useCallback(() => {
    if (detectorRef.current) {
      detectorRef.current.stop();
      detectorRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      isActive: false,
      currentPitch: null,
      volume: 0,
    }));
  }, []);

  const resetHistory = useCallback(() => {
    lastNoteRef.current = null;
    lastNoteTimeRef.current = 0;
    setState((prev) => ({
      ...prev,
      noteHistory: [],
      stats: { totalNotes: 0, accurateNotes: 0, accuracy: 0 },
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (detectorRef.current) {
        detectorRef.current.stop();
      }
    };
  }, []);

  return {
    ...state,
    start,
    stop,
    resetHistory,
  };
}