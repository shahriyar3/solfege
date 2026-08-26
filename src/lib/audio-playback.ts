/**
 * Audio playback utilities using Web Audio API.
 * Generates reference tones for musical notes.
 *
 * All play functions are SYNCHRONOUS — they schedule audio immediately
 * during the user-gesture call stack, avoiding async gaps that can
 * break AudioContext in iframes / sandboxed environments.
 * Callers that previously awaited the return value can still do so
 * (the PlayHandle is returned directly, not wrapped in a Promise).
 */

const A4_FREQUENCY = 440.0;
const A4_MIDI_NUMBER = 69;

export interface NoteInfo {
  note: string;
  solfege: string;
  octave: number;
  frequency: number;
}

export interface PlayHandle {
  stop: () => void;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SOLFEGE_NAMES: Record<string, string> = {
  'C': 'دو', 'C#': 'دو#', 'D': 'رِ', 'D#': 'رِ#',
  'E': 'می', 'F': 'فا', 'F#': 'فا#',
  'G': 'سل', 'G#': 'سل#', 'A': 'لا', 'A#': 'لا#', 'B': 'سی',
};

function midiToFrequency(midi: number): number {
  return A4_FREQUENCY * Math.pow(2, (midi - A4_MIDI_NUMBER) / 12);
}

/** Get all natural notes for a given octave range */
export function getNotesInRange(octaveMin: number = 3, octaveMax: number = 6): NoteInfo[] {
  const notes: NoteInfo[] = [];
  for (let octave = octaveMin; octave <= octaveMax; octave++) {
    for (let i = 0; i < 12; i++) {
      const midi = (octave + 1) * 12 + i;
      notes.push({
        note: NOTE_NAMES[i],
        solfege: SOLFEGE_NAMES[NOTE_NAMES[i]],
        octave,
        frequency: Math.round(midiToFrequency(midi) * 100) / 100,
      });
    }
  }
  return notes;
}

/** Get natural (non-sharp) notes for a given octave */
export function getNaturalNotes(octave: number = 4): NoteInfo[] {
  const natural = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  return natural.map((n, i) => {
    const midi = (octave + 1) * 12 + [0, 2, 4, 5, 7, 9, 11][i];
    return {
      note: n,
      solfege: SOLFEGE_NAMES[n],
      octave,
      frequency: Math.round(midiToFrequency(midi) * 100) / 100,
    };
  });
}

/** Get solfège scale notes (Do Re Mi Fa Sol La Si) */
export function getSolfeggioScale(baseOctave: number = 4): NoteInfo[] {
  const intervals = [0, 2, 4, 5, 7, 9, 11];
  const names = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  return names.map((n, i) => {
    const midi = (baseOctave + 1) * 12 + intervals[i];
    return {
      note: n,
      solfege: SOLFEGE_NAMES[n],
      octave: baseOctave,
      frequency: Math.round(midiToFrequency(midi) * 100) / 100,
    };
  });
}

// ─── Robust Synchronous AudioContext Management ──────────────────
//
// AudioContext may start in 'suspended' state (autoplay policy, iframes,
// after HMR).  We use a SYNCHRONOUS create‑then‑resume pattern so that
// oscillators are scheduled while the user gesture is still active.
// resume() is fire‑and‑forget — scheduled nodes will play the moment
// the context transitions to 'running'.

let sharedCtx: AudioContext | null = null;

function getSharedContext(): AudioContext {
  // Fast path: context exists and is running
  if (sharedCtx && sharedCtx.state === 'running') {
    return sharedCtx;
  }

  // Context exists but is not running — try to resume (fire‑and‑forget)
  if (sharedCtx && sharedCtx.state !== 'closed') {
    try { sharedCtx.resume(); } catch { /* */ }
    // Return it even if suspended; scheduled nodes will play on resume
    return sharedCtx;
  }

  // Close any stale context
  if (sharedCtx) {
    try { sharedCtx.close(); } catch { /* */ }
    sharedCtx = null;
  }

  // Create fresh context
  try {
    sharedCtx = new AudioContext();
  } catch (e) {
    console.error('[audio-playback] Failed to create AudioContext:', e);
    // Return a dummy‑like object so callers degrade gracefully
    return null as unknown as AudioContext;
  }

  if (sharedCtx!.state === 'suspended') {
    // Fire‑and‑forget resume — preserves user‑gesture context
    sharedCtx!.resume().catch(() => {
      console.warn('[audio-playback] sharedCtx resume() rejected');
    });
  }
  return sharedCtx!;
}

let feedbackCtx: AudioContext | null = null;

function getFeedbackContext(): AudioContext {
  if (feedbackCtx && feedbackCtx.state === 'running') {
    return feedbackCtx;
  }
  if (feedbackCtx && feedbackCtx.state !== 'closed') {
    try { feedbackCtx.resume(); } catch { /* */ }
    return feedbackCtx;
  }
  if (feedbackCtx) {
    try { feedbackCtx.close(); } catch { /* */ }
    feedbackCtx = null;
  }
  try {
    feedbackCtx = new AudioContext();
  } catch (e) {
    console.error('[audio-playback] Failed to create feedback AudioContext:', e);
    return null as unknown as AudioContext;
  }
  if (feedbackCtx!.state === 'suspended') {
    feedbackCtx!.resume().catch(() => {
      console.warn('[audio-playback] feedbackCtx resume() rejected');
    });
  }
  return feedbackCtx!;
}

/** Force-reset all audio contexts (useful for recovery) */
export function resetAudioContexts(): void {
  if (sharedCtx) {
    try { sharedCtx.close(); } catch { /* */ }
    sharedCtx = null;
  }
  if (feedbackCtx) {
    try { feedbackCtx.close(); } catch { /* */ }
    feedbackCtx = null;
  }
}

/** Ensure the shared AudioContext is running.
 *  Call this from a user-gesture handler (click/tap) BEFORE
 *  scheduling any audio that will play later via setTimeout/setInterval.
 *  Returns true if the context is (or will be) running. */
export function ensureAudioReady(): boolean {
  try {
    const ctx = getSharedContext();
    return ctx.state === 'running' || ctx.state === 'suspended';
  } catch {
    return false;
  }
}

// ─── Sound Playback Functions ──────────────────────────────────

/** Play a note using Web Audio oscillator */
export function playNote(frequency: number, duration: number = 1.0): PlayHandle {
  try {
    const ctx = getSharedContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, now);

    const safeDuration = Math.max(duration, 0.1);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.1);
    gain.gain.setValueAtTime(0.2, now + safeDuration - 0.15);
    gain.gain.linearRampToValueAtTime(0, now + safeDuration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + safeDuration);

    return {
      stop: () => {
        try {
          const t = ctx.currentTime;
          gain.gain.cancelScheduledValues(t);
          gain.gain.setValueAtTime(gain.gain.value, t);
          gain.gain.linearRampToValueAtTime(0, t + 0.02);
          osc.stop(t + 0.02);
        } catch (_e) { /* already stopped */ }
      },
    };
  } catch (_e) {
    return { stop: () => {} };
  }
}

/** Play a metronome click */
export function playClick(frequency: number = 1000, duration: number = 0.05): PlayHandle {
  try {
    const ctx = getSharedContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, now);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);

    return {
      stop: () => {
        try { osc.stop(); } catch (_e) { /* */ }
      },
    };
  } catch (_e) {
    return { stop: () => {} };
  }
}

/** Play a pleasant chime sound for correct answer feedback */
export function playCorrectChime(): PlayHandle {
  try {
    const ctx = getSharedContext();
    const now = ctx.currentTime;

    const freqs = [523.25, 659.25];
    const oscs = freqs.map((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      return osc;
    });

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.2, now + 0.02);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    oscs.forEach((osc) => {
      osc.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.6);
    });
    masterGain.connect(ctx.destination);

    return {
      stop: () => {
        oscs.forEach((o) => { try { o.stop(); } catch (_e) { /* */ } });
      },
    };
  } catch (_e) {
    return { stop: () => {} };
  }
}

/** Play a pleasant ascending two-note chime for correct answer */
export function playCorrectSound(): PlayHandle {
  try {
    const ctx = getFeedbackContext();
    const now = ctx.currentTime;
    const freqs = [523.25, 659.25];
    const noteDuration = 0.2;
    const gap = 0.15;
    const oscs: OscillatorNode[] = [];

    freqs.forEach((freq, i) => {
      const start = now + i * (noteDuration + gap);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.3, start + 0.03);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.08);
      gain.gain.setValueAtTime(0.18, start + noteDuration - 0.05);
      gain.gain.linearRampToValueAtTime(0, start + noteDuration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + noteDuration);
      oscs.push(osc);
    });

    return {
      stop: () => {
        oscs.forEach((o) => { try { o.stop(); } catch (_e) { /* */ } });
      },
    };
  } catch (_e) {
    return { stop: () => {} };
  }
}

/** Play a short low buzzy sound for wrong answer feedback */
export function playWrongSound(): PlayHandle {
  try {
    const ctx = getFeedbackContext();
    const now = ctx.currentTime;
    const duration = 0.3;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
    gain.gain.setValueAtTime(0.12, now + duration - 0.15);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);

    return {
      stop: () => { try { osc.stop(); } catch (_e) { /* */ } },
    };
  } catch (_e) {
    return { stop: () => {} };
  }
}

/** Play a subtle buzz for wrong answer feedback */
export function playWrongBuzz(): PlayHandle {
  try {
    const ctx = getSharedContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);

    return {
      stop: () => { try { osc.stop(); } catch (_e) { /* */ } },
    };
  } catch (_e) {
    return { stop: () => {} };
  }
}

/** Get chromatic scale (all 12 notes) for a given octave */
export function getChromaticScale(baseOctave: number = 4): NoteInfo[] {
  const CHROMATIC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const CHROMATIC_SOLFEGE = ['دو', 'دو#', 'رِ', 'رِ#', 'می', 'فا', 'فا#', 'سل', 'سل#', 'لا', 'لا#', 'سی'];
  return CHROMATIC_NAMES.map((n, i) => {
    const midi = (baseOctave + 1) * 12 + i;
    return {
      note: n,
      solfege: CHROMATIC_SOLFEGE[i],
      octave: baseOctave,
      frequency: Math.round(midiToFrequency(midi) * 100) / 100,
    };
  });
}
