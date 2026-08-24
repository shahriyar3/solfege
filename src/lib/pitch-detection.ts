/**
 * Real-time pitch detection using autocorrelation algorithm.
 * Designed for monophonic audio (singing/voice).
 */

// Standard note names
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Persian solfège names
const SOLFEGE_NAMES: Record<string, string> = {
  'C': 'دو',
  'C#': 'دو#',
  'D': 'رِ',
  'D#': 'رِ#',
  'E': 'می',
  'F': 'فا',
  'F#': 'فا#',
  'G': 'سل',
  'G#': 'سل#',
  'A': 'لا',
  'A#': 'لا#',
  'B': 'سی',
};

// A4 = 440Hz
const A4_FREQUENCY = 440.0;
const A4_MIDI_NUMBER = 69;

export interface PitchResult {
  frequency: number;
  note: string;
  solfege: string;
  octave: number;
  cents: number; // -50 to +50 (negative = flat, positive = sharp)
  midiNumber: number;
  isAccurate: boolean; // within ±10 cents
}

export interface AudioAnalysisConfig {
  fftSize?: number;
  minFrequency?: number;
  maxFrequency?: number;
  accuracyThreshold?: number; // cents threshold for "accurate"
}

const DEFAULT_CONFIG: Required<AudioAnalysisConfig> = {
  fftSize: 4096,
  minFrequency: 60, // ~B1
  maxFrequency: 1500, // ~F#6
  accuracyThreshold: 10,
};

/**
 * Convert frequency to MIDI note number (fractional)
 */
function frequencyToMidi(freq: number): number {
  return 12 * Math.log2(freq / A4_FREQUENCY) + A4_MIDI_NUMBER;
}

/**
 * Convert frequency to the nearest musical note with cent deviation
 */
function frequencyToNote(freq: number, accuracyThreshold: number): PitchResult {
  const midiNumber = Math.round(frequencyToMidi(freq));
  const exactMidi = frequencyToMidi(freq);
  const cents = Math.round((exactMidi - midiNumber) * 100);
  
  // Clamp cents to -50..+50 range
  const clampedCents = Math.max(-50, Math.min(50, cents));
  
  const noteIndex = ((midiNumber % 12) + 12) % 12;
  const octave = Math.floor(midiNumber / 12) - 1;
  const noteName = NOTE_NAMES[noteIndex];
  
  return {
    frequency: Math.round(freq * 10) / 10,
    note: noteName,
    solfege: SOLFEGE_NAMES[noteName],
    octave,
    cents: clampedCents,
    midiNumber,
    isAccurate: Math.abs(clampedCents) <= accuracyThreshold,
  };
}

/**
 * Autocorrelation-based pitch detection algorithm.
 * Works well for monophonic signals like singing.
 */
function autoCorrelate(buf: Float32Array, sampleRate: number, minFreq: number, maxFreq: number): number | null {
  const SIZE = buf.length;
  let rms = 0;

  // Calculate RMS (volume level) to detect silence
  for (let i = 0; i < SIZE; i++) {
    rms += buf[i] * buf[i];
  }
  rms = Math.sqrt(rms / SIZE);

  // Not enough signal - return null (silence)
  if (rms < 0.01) return null;

  // Determine the range of periods to check
  const minPeriod = Math.floor(sampleRate / maxFreq);
  const maxPeriod = Math.ceil(sampleRate / minFreq);

  let bestOffset = -1;
  let bestCorrelation = 0;
  let foundGoodCorrelation = false;
  const correlations = new Float32Array(maxPeriod + 1);

  // Compute autocorrelation for each possible period
  for (let offset = minPeriod; offset <= Math.min(maxPeriod, Math.floor(SIZE / 2)); offset++) {
    let correlation = 0;
    for (let i = 0; i < SIZE - offset; i++) {
      correlation += Math.abs(buf[i] - buf[i + offset]);
    }
    correlation = 1 - (correlation / (SIZE - offset));
    correlations[offset] = correlation;

    if (correlation > 0.9 && correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
      foundGoodCorrelation = true;
    } else if (foundGoodCorrelation) {
 // Found a good correlation then it dropped - stop searching
      const shortAvg = (correlations[bestOffset - 1] + correlations[bestOffset] + correlations[bestOffset + 1]) / 3;
      if (correlation < shortAvg) break;
    }
  }

  if (bestCorrelation > 0.01 && bestOffset > 0) {
    // Parabolic interpolation for better precision
    let shift = 0;
    if (bestOffset > 0 && bestOffset < SIZE - 1) {
      const prev = correlations[bestOffset - 1] || 0;
      const next = correlations[bestOffset + 1] || 0;
      shift = (next - prev) / (2 * (2 * bestCorrelation - prev - next));
      if (isNaN(shift)) shift = 0;
    }
    return sampleRate / (bestOffset + shift);
  }

  return null;
}

/**
 * PitchDetector class for real-time audio pitch detection.
 * Uses Web Audio API's AnalyserNode + autocorrelation.
 */
export class PitchDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private buffer: Float32Array = new Float32Array(0);
  private config: Required<AudioAnalysisConfig>;
  private animationFrameId: number | null = null;
  private onPitchDetected: ((result: PitchResult | null) => void) | null = null;
  private onVolumeChange: ((volume: number) => void) | null = null;
  private isRunning = false;

  constructor(config?: AudioAnalysisConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get the analyser node for visualization (e.g., waveform)
   */
  getAnalyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  /**
   * Start listening to the microphone and detecting pitch
   */
  async start(
    onPitch: (result: PitchResult | null) => void,
    onVolume?: (volume: number) => void
  ): Promise<void> {
    if (this.isRunning) return;

    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          // Prefer low latency for real-time feedback
          latencyHint: 'interactive',
        },
      });

      // Set up Web Audio API
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.config.fftSize;
      this.analyser.smoothingTimeConstant = 0;

      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.source.connect(this.analyser);

      this.buffer = new Float32Array(this.analyser.fftSize);
      this.onPitchDetected = onPitch;
      this.onVolumeChange = onVolume || null;
      this.isRunning = true;

      // Start the analysis loop
      this.analyze();
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  /**
   * Main analysis loop - runs continuously via requestAnimationFrame
   */
  private analyze = (): void => {
    if (!this.isRunning || !this.analyser) return;

    this.analyser.getFloatTimeDomainData(this.buffer);

    // Calculate volume for visualization
    let rms = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      rms += this.buffer[i] * this.buffer[i];
    }
    rms = Math.sqrt(rms / this.buffer.length);

    this.onVolumeChange?.(rms);

    // Detect pitch using autocorrelation
    const frequency = autoCorrelate(
      this.buffer,
      this.audioContext!.sampleRate,
      this.config.minFrequency,
      this.config.maxFrequency
    );

    if (frequency !== null) {
      const result = frequencyToNote(frequency, this.config.accuracyThreshold);
      this.onPitchDetected?.(result);
    } else {
      this.onPitchDetected?.(null);
    }

    this.animationFrameId = requestAnimationFrame(this.analyze);
  };

  /**
   * Stop listening and release resources
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.cleanup();
  }

  /**
   * Clean up audio resources
   */
  private cleanup(): void {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  /**
   * Check if the detector is currently running
   */
  get running(): boolean {
    return this.isRunning;
  }
}

/**
 * Utility: Format frequency for display
 */
export function formatFrequency(freq: number): string {
  return freq.toFixed(1);
}

/**
 * Utility: Get color based on cents accuracy
 */
export function getAccuracyColor(cents: number, threshold: number = 10): string {
  const absCents = Math.abs(cents);
  if (absCents <= 5) return 'text-emerald-500';
  if (absCents <= threshold) return 'text-yellow-500';
  if (absCents <= 25) return 'text-orange-500';
  return 'text-red-500';
}

/**
 * Utility: Get background color class based on cents accuracy
 */
export function getAccuracyBgColor(cents: number, threshold: number = 10): string {
  const absCents = Math.abs(cents);
  if (absCents <= 5) return 'bg-emerald-500';
  if (absCents <= threshold) return 'bg-yellow-500';
  if (absCents <= 25) return 'bg-orange-500';
  return 'bg-red-500';
}

/**
 * Utility: Get the Persian description for pitch accuracy
 */
export function getAccuracyPersianText(cents: number): string {
  const absCents = Math.abs(cents);
  if (absCents <= 5) return 'عالی! 🎯';
  if (absCents <= 10) return 'خوب ✓';
  if (absCents <= 20) return 'قابل قبول';
  return 'فالش ✗';
}

/**
 * Get all solfège note names for reference
 */
export function getSolfeggNotes(): Array<{ note: string; solfege: string; frequency: number }> {
  const notes: Array<{ note: string; solfege: string; frequency: number }> = [];
  for (let octave = 3; octave <= 6; octave++) {
    for (let i = 0; i < 12; i++) {
      const midi = (octave + 1) * 12 + i;
      const freq = A4_FREQUENCY * Math.pow(2, (midi - A4_MIDI_NUMBER) / 12);
      notes.push({
        note: `${NOTE_NAMES[i]}${octave}`,
        solfege: SOLFEGE_NAMES[NOTE_NAMES[i]],
        frequency: Math.round(freq * 10) / 10,
      });
    }
  }
  return notes;
}