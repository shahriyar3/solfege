/**
 * Audio playback utilities using Web Audio API.
 * Generates reference tones for musical notes.
 */

const A4_FREQUENCY = 440.0;
const A4_MIDI_NUMBER = 69;

export interface NoteInfo {
  note: string;
  solfege: string;
  octave: number;
  frequency: number;
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

/** Play a note using Web Audio oscillator */
export function playNote(frequency: number, duration: number = 1.0): { stop: () => void } {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);

  // ADSR-like envelope for a pleasant tone
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.3, now + 0.05); // attack
  gain.gain.linearRampToValueAtTime(0.2, now + 0.1); // decay to sustain
  gain.gain.setValueAtTime(0.2, now + duration - 0.15); // sustain
  gain.gain.linearRampToValueAtTime(0, now + duration); // release

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration);

  return {
    stop: () => {
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.linearRampToValueAtTime(0, now + 0.02);
        osc.stop(now + 0.02);
      } catch (e) {
        // already stopped
      }
    },
  };
}

/** Play a metronome click */
export function playClick(frequency: number = 1000, duration: number = 0.05): { stop: () => void } {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);

  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration);

  return {
    stop: () => {
      try { osc.stop(); } catch (e) { /* */ }
    },
  };
}
