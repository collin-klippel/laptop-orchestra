import * as Tone from 'tone';

/** MIDI note numbers for a standard 88-key piano (A0–C8). */
const PIANO_MIDI_LOW = 21;
const PIANO_MIDI_HIGH = 108;

/** Minimum CSS px width per white key so the full keyboard stays playable when scrolled. */
const PIANO_WHITE_KEY_MIN_PX = 14;

/**
 * Tone uses spellings like `C#4` or `Db4` for black keys; whites match `[A-G]` + octave digits only.
 */
function isWhitePianoNote(note: string): boolean {
  return /^[A-G]\d+$/.test(note);
}

interface PianoKeyArrays {
  whiteNotes: readonly string[];
  blackNotes: readonly string[];
}

/**
 * Enumerate all pitch names on an 88-key piano in MIDI order (white and black lists separately).
 */
export function buildFullPianoKeyArrays(): PianoKeyArrays {
  const whiteNotes: string[] = [];
  const blackNotes: string[] = [];
  for (let m = PIANO_MIDI_LOW; m <= PIANO_MIDI_HIGH; m++) {
    const note = Tone.Midi(m).toNote();
    if (isWhitePianoNote(note)) whiteNotes.push(note);
    else blackNotes.push(note);
  }
  return { whiteNotes, blackNotes };
}

/**
 * Index of the white key whose right edge forms the boundary under which this black key sits.
 * Same convention as the prior Marimba strip: `((whiteIdx + 1) / whiteCount) * 100` from the left.
 */
export function whiteIndexBelowBlackKey(
  blackNote: string,
  whiteNotes: readonly string[],
): number {
  let m = Tone.Frequency(blackNote).toMidi() - 1;
  while (m >= PIANO_MIDI_LOW) {
    const n = Tone.Midi(m).toNote();
    if (isWhitePianoNote(n)) {
      const idx = whiteNotes.indexOf(n);
      if (idx >= 0) return idx;
    }
    m--;
  }
  return 0;
}

/** Horizontal center line for a black key, as % from the keyboard container's left edge. */
export function blackKeyCenterPercent(
  whiteIdx: number,
  whiteCount: number,
): number {
  return ((whiteIdx + 1) / whiteCount) * 100;
}

export function blackKeyWidthPercent(whiteCount: number): number {
  return (100 / whiteCount) * 0.6;
}

/** Total width for the keyboard row: at least viewport or one pixel per white key minimum. */
export function pianoKeyboardWidthPx(whiteCount: number): number {
  return Math.max(whiteCount * PIANO_WHITE_KEY_MIN_PX, 320);
}
