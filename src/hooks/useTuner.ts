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
  analyserNode: AnalyserNode | null;
  stats: {
    totalNotes: number;
    accurateNotes: number;
    accuracy: number;
  };
}

interface UseTunerOptions {
  a4Frequency?: number;
}

export function useTuner(options?: UseTunerOptions) {
  const [state, setState] = useState<TunerState>({
    isActive: false,
    currentPitch: null,
    volume: 0,
    error: null,
    noteHistory: [],
    analyserNode: null,
    stats: { totalNotes: 0, accurateNotes: 0, accuracy: 0 },
  });

  const detectorRef = useRef<PitchDetector | null>(null);
  const lastNoteRef = useRef<string | null>(null);
  const lastNoteTimeRef = useRef<number>(0);
  const noteDebounceMs = 300;

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

        const newHistory = [...prev.noteHistory, result].slice(-100);
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

  const a4Freq = options?.a4Frequency ?? 440;

  const start = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, error: null }));
      detectorRef.current = new PitchDetector({
        fftSize: 4096,
        minFrequency: 60,
        maxFrequency: 1500,
        accuracyThreshold: 10,
        a4Frequency: a4Freq,
      });

      await detectorRef.current.start(handlePitch, handleVolume);

      // Expose analyser node after start
      const analyserNode = detectorRef.current.getAnalyserNode() ?? null;

      setState((prev) => ({ ...prev, isActive: true, analyserNode }));
    } catch (err) {
      console.error('Microphone error:', err);
      setState((prev) => ({
        ...prev,
        error: 'دسترسی به میکروفون رد شد. لطفاً اجازه دسترسی بدهید.',
        isActive: false,
        analyserNode: null,
      }));
    }
  }, [handlePitch, handleVolume, a4Freq]);

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
      analyserNode: null,
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
