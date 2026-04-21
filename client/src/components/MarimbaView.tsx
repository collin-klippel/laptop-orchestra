import { CHANCE_METHODS } from 'aleatoric';
import type React from 'react';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Draw, Frequency, type Waveform } from 'tone';
import { PerformanceContext } from '../App';
import { useChanceSequence } from '../hooks/useChanceSequence';
import {
  MARIMBA_EFFECTS_DEFAULTS,
  MARIMBA_MAX_POLYPHONY,
  MARIMBA_VOICE_DEFAULTS,
  type MarimbaDelayTime,
  type MarimbaEffects,
  type MarimbaVoicePatch,
  useMarimba,
} from '../hooks/useMarimba';
import {
  CHANCE_SEQUENCE_STORAGE_KEY,
  type ChanceSequenceConfig,
  parseStoredChanceSequenceConfig,
  sanitizeChanceSequenceConfig,
} from '../lib/chanceSequenceConfig';
import type { ScheduledMarimbaNoteEvent } from '../lib/chanceSequencePlayback';
import { cloneMarimbaVoice } from '../lib/marimbaVoiceUi';
import {
  blackKeyCenterPercent,
  blackKeyWidthPercent,
  buildFullPianoKeyArrays,
  pianoKeyboardWidthPx,
  whiteIndexBelowBlackKey,
} from '../lib/pianoLayout';
import { MarimbaEnvelopePanel } from './MarimbaEnvelopePanel';
import { OscilloscopeView } from './OscilloscopeView';

type KeyType = 'white' | 'black';

const FULL_PIANO_KEYS = buildFullPianoKeyArrays();

interface KeyDef {
  note: string;
  type: KeyType;
  /** Computer-keyboard binding (lowercase, single char). Omitted when the key is reserved. */
  kbd?: string;
}

// Base layout: C3–C5. Z and X are reserved for octave shift (down/up).
// Keyboard layout mirrors a piano: home row = white keys, top row interleaved = black keys.
//   Top:  [ ] [w] [e] [ ] [t] [y] [u] [ ] [o] [p]  ← black keys
//   Home: [a] [s] [d] [f] [g] [h] [j] [k] [l] [;]  ← white keys (C3–E4)
//   Upper extension (A4–C5): c v b (white), i r q (black)
const KEYS: KeyDef[] = [
  { note: 'C3', type: 'white', kbd: 'a' },
  { note: 'C#3', type: 'black', kbd: 'w' },
  { note: 'D3', type: 'white', kbd: 's' },
  { note: 'D#3', type: 'black', kbd: 'e' },
  { note: 'E3', type: 'white', kbd: 'd' },
  { note: 'F3', type: 'white', kbd: 'f' },
  { note: 'F#3', type: 'black', kbd: 't' },
  { note: 'G3', type: 'white', kbd: 'g' },
  { note: 'G#3', type: 'black', kbd: 'y' },
  { note: 'A3', type: 'white', kbd: 'h' },
  { note: 'A#3', type: 'black', kbd: 'u' },
  { note: 'B3', type: 'white', kbd: 'j' },
  { note: 'C4', type: 'white', kbd: 'k' },
  { note: 'C#4', type: 'black', kbd: 'o' },
  { note: 'D4', type: 'white', kbd: 'l' },
  { note: 'D#4', type: 'black', kbd: 'p' },
  { note: 'E4', type: 'white', kbd: ';' },
  { note: 'F4', type: 'white' }, // z → octave down
  { note: 'F#4', type: 'black', kbd: 'i' },
  { note: 'G4', type: 'white' }, // x → octave up
  { note: 'G#4', type: 'black', kbd: 'r' },
  { note: 'A4', type: 'white', kbd: 'c' },
  { note: 'A#4', type: 'black', kbd: 'q' },
  { note: 'B4', type: 'white', kbd: 'v' },
  { note: 'C5', type: 'white', kbd: 'b' },
];

const MIN_OFFSET = -2;
const MAX_OFFSET = 2;

/** Shift a note string (e.g. "C#3") by `offset` octaves. */
function transposeNote(note: string, offset: number): string {
  const octave = parseInt(note.slice(-1), 10);
  return note.slice(0, -1) + (octave + offset);
}

const FLASH_MS = 150;

function noteToMidi(note: string): number {
  return Frequency(note).toMidi();
}

const QUANTIZE_PRESETS: { label: string; beats: number }[] = [
  { label: '¼ beat grid', beats: 0.25 },
  { label: '⅛ beat', beats: 0.125 },
  { label: '1/16 beat', beats: 0.0625 },
  { label: '1/32 beat', beats: 0.03125 },
];

const DELAY_TIME_OPTIONS: { value: MarimbaDelayTime; label: string }[] = [
  { value: '4n', label: 'Quarter note (4n)' },
  { value: '8n', label: 'Eighth note (8n)' },
  { value: '16n', label: 'Sixteenth note (16n)' },
];

export function MarimbaView() {
  const performance = useContext(PerformanceContext);
  const [marimbaPolyphonic, setMarimbaPolyphonic] = useState(false);
  const marimba = useMarimba(marimbaPolyphonic);
  const {
    triggerNote,
    ensureMarimbaRig,
    getRig,
    applyMarimbaEffects,
    applyMarimbaVoice,
  } = marimba;
  /** Bumped by Start sequence (start or new roll); reset on Stop or when performance ends. */
  const [launchGeneration, setLaunchGeneration] = useState(0);
  const [chanceCfg, setChanceCfg] = useState<ChanceSequenceConfig>(() =>
    parseStoredChanceSequenceConfig(
      typeof window !== 'undefined'
        ? window.localStorage.getItem(CHANCE_SEQUENCE_STORAGE_KEY)
        : null,
    ),
  );

  const [marimbaEffects, setMarimbaEffects] = useState<MarimbaEffects>(() => ({
    ...MARIMBA_EFFECTS_DEFAULTS,
  }));
  const [marimbaVoice, setMarimbaVoice] = useState(() =>
    cloneMarimbaVoice(MARIMBA_VOICE_DEFAULTS),
  );
  const [marimbaWaveform, setMarimbaWaveform] = useState<Waveform | null>(null);

  const patchMarimbaEffects = useCallback(
    (partial: Partial<MarimbaEffects>) => {
      setMarimbaEffects((prev) => ({ ...prev, ...partial }));
    },
    [],
  );

  const patchMarimbaVoice = useCallback((partial: MarimbaVoicePatch) => {
    setMarimbaVoice((prev) => ({
      ...prev,
      envelope: partial.envelope
        ? { ...prev.envelope, ...partial.envelope }
        : prev.envelope,
    }));
  }, []);

  const patchChance = useCallback((partial: Partial<ChanceSequenceConfig>) => {
    setChanceCfg((prev) =>
      sanitizeChanceSequenceConfig({ ...prev, ...partial }),
    );
  }, []);

  const [lit, setLit] = useState<Record<number, boolean>>({});
  const flashTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const launchGenerationRef = useRef(launchGeneration);
  useEffect(() => {
    launchGenerationRef.current = launchGeneration;
  }, [launchGeneration]);

  const flashMidi = useCallback((midi: number) => {
    const existing = flashTimers.current[midi];
    if (existing) clearTimeout(existing);
    setLit((prev) => ({ ...prev, [midi]: true }));
    flashTimers.current[midi] = setTimeout(() => {
      setLit((prev) => ({ ...prev, [midi]: false }));
      delete flashTimers.current[midi];
    }, FLASH_MS);
  }, []);

  const previewMarimbaVoice = useCallback(() => {
    void triggerNote('C4', '8n');
    flashMidi(noteToMidi('C4'));
  }, [triggerNote, flashMidi]);

  const onScheduledNote = useCallback(
    (e: ScheduledMarimbaNoteEvent) => {
      const genAtSchedule = launchGenerationRef.current;
      if (genAtSchedule === 0) return;
      Draw.schedule(() => {
        if (launchGenerationRef.current !== genAtSchedule) return;
        flashMidi(e.midi);
      }, e.startTimeSec);
    },
    [flashMidi],
  );

  useChanceSequence(launchGeneration, { ensureMarimbaRig, getRig }, chanceCfg, {
    onScheduledNote,
  });

  useEffect(() => {
    void ensureMarimbaRig().then((rig) => {
      applyMarimbaEffects(marimbaEffects);
      applyMarimbaVoice(marimbaVoice);
      setMarimbaWaveform((prev) => prev ?? rig.waveform);
    });
  }, [
    marimbaEffects,
    marimbaVoice,
    ensureMarimbaRig,
    applyMarimbaEffects,
    applyMarimbaVoice,
  ]);

  useEffect(() => {
    if (!performance.performanceState.active) {
      setLaunchGeneration(0);
    }
  }, [performance.performanceState.active]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          CHANCE_SEQUENCE_STORAGE_KEY,
          JSON.stringify(chanceCfg),
        );
      } catch {
        /* storage full */
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [chanceCfg]);

  const [octaveOffset, setOctaveOffset] = useState(0);
  // Notes currently held via keyboard — prevents auto-repeat retriggers.
  const heldRef = useRef<Set<string>>(new Set());

  const playNote = useCallback(
    (note: string) => {
      void triggerNote(note);
      flashMidi(noteToMidi(note));
    },
    [triggerNote, flashMidi],
  );

  useEffect(() => {
    function onSpaceCapture(e: KeyboardEvent) {
      if (e.code !== 'Space') return;
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (
        t instanceof Element &&
        t.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }
      if (!performance.performanceState.active) return;
      e.preventDefault();
      setLaunchGeneration((g) => (g === 0 ? 1 : 0));
    }
    document.addEventListener('keydown', onSpaceCapture, { capture: true });
    return () => {
      document.removeEventListener('keydown', onSpaceCapture, {
        capture: true,
      });
    };
  }, [performance.performanceState.active]);

  useEffect(() => {
    const byKbd = new Map<string, string>();
    for (const k of KEYS) {
      if (k.kbd) byKbd.set(k.kbd, k.note);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (key === 'z') {
        setOctaveOffset((prev) => Math.max(MIN_OFFSET, prev - 1));
        return;
      }
      if (key === 'x') {
        setOctaveOffset((prev) => Math.min(MAX_OFFSET, prev + 1));
        return;
      }

      const rawNote = byKbd.get(key);
      if (!rawNote) return;
      const note = transposeNote(rawNote, octaveOffset);
      if (heldRef.current.has(note)) return;
      heldRef.current.add(note);
      playNote(note);
    }

    function onKeyUp(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (key === 'z' || key === 'x') return;
      const rawNote = byKbd.get(key);
      if (rawNote) heldRef.current.delete(transposeNote(rawNote, octaveOffset));
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [playNote, octaveOffset]);

  useEffect(() => {
    return () => {
      for (const t of Object.values(flashTimers.current)) clearTimeout(t);
      flashTimers.current = {};
    };
  }, []);

  const wc = FULL_PIANO_KEYS.whiteNotes.length;
  const bwPct = blackKeyWidthPercent(wc);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.chancePlaybackRow}>
          <button
            type="button"
            disabled={!performance.performanceState.active}
            onClick={() => setLaunchGeneration((g) => (g === 0 ? 1 : g + 1))}
            style={{
              ...styles.seqBtn,
              ...styles.seqBtnPrimary,
              ...(!performance.performanceState.active
                ? styles.seqBtnDisabled
                : {}),
            }}
          >
            Start sequence
          </button>
          <button
            type="button"
            disabled={launchGeneration === 0}
            onClick={() => setLaunchGeneration(0)}
            style={{
              ...styles.seqBtn,
              ...styles.seqBtnDanger,
              ...(launchGeneration === 0 ? styles.seqBtnDisabled : {}),
            }}
          >
            Stop sequence
          </button>
          {launchGeneration > 0 && performance.performanceState.active ? (
            <span style={styles.sequencePlayingBadge} aria-live="polite">
              <span
                className="marimba-sequence-playing-indicator"
                aria-hidden
              />
              Sequence playing
            </span>
          ) : null}
        </div>
        <section
          style={styles.chanceDetails}
          aria-labelledby="marimba-sequence-options-heading"
        >
          <p
            id="marimba-sequence-options-heading"
            style={styles.chanceSectionTitle}
          >
            Sequence options
          </p>
          <div style={styles.chanceGrid}>
            <label style={styles.chanceField}>
              <span style={styles.chanceLabel}>Chance method</span>
              <select
                style={styles.chanceSelect}
                value={chanceCfg.method}
                onChange={(e) =>
                  patchChance({
                    method: e.target.value as ChanceSequenceConfig['method'],
                  })
                }
              >
                {CHANCE_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m === 'iching'
                      ? 'I Ching'
                      : m.charAt(0).toUpperCase() + m.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label style={styles.chanceField}>
              <span style={styles.chanceLabel}>
                Events ({chanceCfg.eventCount})
              </span>
              <input
                style={styles.chanceRange}
                type="range"
                min={8}
                max={96}
                step={4}
                value={chanceCfg.eventCount}
                onChange={(e) =>
                  patchChance({ eventCount: Number(e.target.value) })
                }
              />
            </label>
            <label style={styles.chanceField}>
              <span style={styles.chanceLabel}>
                Rest probability ({Math.round(chanceCfg.restProbability * 100)}
                %)
              </span>
              <input
                style={styles.chanceRange}
                type="range"
                min={0}
                max={0.6}
                step={0.02}
                value={chanceCfg.restProbability}
                onChange={(e) =>
                  patchChance({ restProbability: Number(e.target.value) })
                }
              />
            </label>
            <label style={styles.chanceField}>
              <span style={styles.chanceLabel}>Quantize grid</span>
              <select
                style={styles.chanceSelect}
                value={String(chanceCfg.quantizeGridBeats)}
                onChange={(e) =>
                  patchChance({ quantizeGridBeats: Number(e.target.value) })
                }
              >
                {QUANTIZE_PRESETS.map((p) => (
                  <option key={p.beats} value={p.beats}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <div style={styles.chanceDual}>
              <span style={styles.chanceDualLabel}>
                MIDI pitch range ({chanceCfg.rangeMidi[0]}–
                {chanceCfg.rangeMidi[1]})
              </span>
              <div style={styles.chanceDualRanges}>
                <input
                  style={styles.chanceDualRangeInput}
                  type="range"
                  min={24}
                  max={120}
                  value={chanceCfg.rangeMidi[0]}
                  onChange={(e) =>
                    patchChance({
                      rangeMidi: [
                        Number(e.target.value),
                        chanceCfg.rangeMidi[1],
                      ] as ChanceSequenceConfig['rangeMidi'],
                    })
                  }
                />
                <input
                  style={styles.chanceDualRangeInput}
                  type="range"
                  min={36}
                  max={127}
                  value={chanceCfg.rangeMidi[1]}
                  onChange={(e) =>
                    patchChance({
                      rangeMidi: [
                        chanceCfg.rangeMidi[0],
                        Number(e.target.value),
                      ] as ChanceSequenceConfig['rangeMidi'],
                    })
                  }
                />
              </div>
            </div>
          </div>
        </section>
        <section
          style={styles.chanceDetails}
          aria-labelledby="marimba-sound-heading"
        >
          <p id="marimba-sound-heading" style={styles.chanceSectionTitle}>
            Sound
          </p>
          <div style={styles.chanceGrid}>
            <div style={styles.voiceToolbar}>
              <button
                type="button"
                style={styles.voiceToolbarGhostBtn}
                onClick={() =>
                  setMarimbaVoice(cloneMarimbaVoice(MARIMBA_VOICE_DEFAULTS))
                }
              >
                Reset voice
              </button>
              <button
                type="button"
                style={styles.voicePreviewBtn}
                onClick={previewMarimbaVoice}
              >
                Preview note
              </button>
              <div
                style={styles.voicePolyMode}
                role="radiogroup"
                aria-label="Marimba mono or poly voicing"
              >
                <span style={styles.voicePolyModeLegend}>Voicing</span>
                <label style={styles.voicePolyRadio}>
                  <input
                    type="radio"
                    name="marimba-voicing"
                    checked={!marimbaPolyphonic}
                    onChange={() => setMarimbaPolyphonic(false)}
                  />
                  Mono
                </label>
                <label style={styles.voicePolyRadio}>
                  <input
                    type="radio"
                    name="marimba-voicing"
                    checked={marimbaPolyphonic}
                    onChange={() => setMarimbaPolyphonic(true)}
                  />
                  Poly
                </label>
              </div>
            </div>
            <p style={styles.voicePolyHint}>
              {marimbaPolyphonic
                ? `Poly allows up to ${MARIMBA_MAX_POLYPHONY} overlapping notes (dense chance rolls or fast playing). Switching voicing stops any notes still ringing.`
                : 'Mono uses one voice; new notes replace the previous note. Switching voicing stops any notes still ringing.'}
            </p>
            <MarimbaEnvelopePanel
              envelope={marimbaVoice.envelope}
              onPatch={patchMarimbaVoice}
            />
            <div style={styles.effectsVoiceGroupHeader}>
              <p style={styles.chanceVoiceGroupTitle}>Effects</p>
              <p style={styles.chanceVoiceHint}>
                Delay and reverb in the marimba signal chain.
              </p>
            </div>
            <label style={styles.chanceField}>
              <span style={styles.chanceLabel}>
                Delay time (synced to tempo)
              </span>
              <select
                style={styles.chanceSelect}
                value={marimbaEffects.delayTime}
                onChange={(e) =>
                  patchMarimbaEffects({
                    delayTime: e.target.value as MarimbaDelayTime,
                  })
                }
              >
                {DELAY_TIME_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={styles.chanceField}>
              <span style={styles.chanceLabel}>
                Delay feedback ({Math.round(marimbaEffects.delayFeedback * 100)}
                %)
              </span>
              <input
                style={styles.chanceRange}
                type="range"
                min={0}
                max={0.55}
                step={0.01}
                value={marimbaEffects.delayFeedback}
                onChange={(e) =>
                  patchMarimbaEffects({
                    delayFeedback: Number(e.target.value),
                  })
                }
              />
            </label>
            <label style={styles.chanceField}>
              <span style={styles.chanceLabel}>
                Delay mix ({Math.round(marimbaEffects.delayWet * 100)}%)
              </span>
              <input
                style={styles.chanceRange}
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={marimbaEffects.delayWet}
                onChange={(e) =>
                  patchMarimbaEffects({ delayWet: Number(e.target.value) })
                }
              />
            </label>
            <label style={styles.chanceField}>
              <span style={styles.chanceLabel}>
                Reverb decay ({marimbaEffects.reverbDecay.toFixed(2)}s)
              </span>
              <input
                style={styles.chanceRange}
                type="range"
                min={0.1}
                max={5}
                step={0.05}
                value={marimbaEffects.reverbDecay}
                onChange={(e) =>
                  patchMarimbaEffects({ reverbDecay: Number(e.target.value) })
                }
              />
            </label>
            <label style={styles.chanceField}>
              <span style={styles.chanceLabel}>
                Reverb mix ({Math.round(marimbaEffects.reverbWet * 100)}%)
              </span>
              <input
                style={styles.chanceRange}
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={marimbaEffects.reverbWet}
                onChange={(e) =>
                  patchMarimbaEffects({ reverbWet: Number(e.target.value) })
                }
              />
            </label>
          </div>
        </section>
        <section
          style={styles.scopeSection}
          aria-labelledby="marimba-scope-heading"
        >
          <p id="marimba-scope-heading" style={styles.chanceSectionTitle}>
            Oscilloscope
          </p>
          <div style={styles.scopeMeterWrap}>
            <OscilloscopeView waveform={marimbaWaveform} showHeading={false} />
          </div>
        </section>
      </div>

      <div style={styles.keyboardWrap}>
        <div
          style={{
            ...styles.keyboard,
            width: `max(100%, ${pianoKeyboardWidthPx(wc)}px)`,
          }}
        >
          <div style={styles.whiteRow}>
            {FULL_PIANO_KEYS.whiteNotes.map((note) => {
              const midi = noteToMidi(note);
              const showLabel = /^C\d+$/.test(note);
              return (
                <button
                  key={note}
                  type="button"
                  aria-label={note}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    playNote(note);
                  }}
                  style={{
                    ...styles.whiteKey,
                    ...(lit[midi] ? styles.whiteKeyLit : {}),
                  }}
                >
                  <span style={styles.whiteLabel}>{showLabel ? note : ''}</span>
                </button>
              );
            })}
          </div>
          {FULL_PIANO_KEYS.blackNotes.map((note) => {
            const midi = noteToMidi(note);
            const wIdx = whiteIndexBelowBlackKey(
              note,
              FULL_PIANO_KEYS.whiteNotes,
            );
            const centerPct = blackKeyCenterPercent(wIdx, wc);
            return (
              <button
                key={note}
                type="button"
                aria-label={note}
                onPointerDown={(e) => {
                  e.preventDefault();
                  playNote(note);
                }}
                style={{
                  ...styles.blackKey,
                  width: `${bwPct}%`,
                  left: `calc(${centerPct}% - ${bwPct / 2}%)`,
                  ...(lit[midi] ? styles.blackKeyLit : {}),
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  header: {
    padding: '1.5rem 2rem 0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  headerTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  eyebrow: {
    margin: 0,
    fontSize: '1.4rem',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: 'var(--text)',
  },
  chancePlaybackRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginTop: '0.35rem',
    alignItems: 'center',
  },
  sequencePlayingBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    marginLeft: '0.15rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'rgba(34, 197, 94, 0.95)',
  },
  seqBtn: {
    padding: '0.45rem 0.85rem',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid',
    transition:
      'background 120ms ease, border-color 120ms ease, color 120ms ease, opacity 120ms ease',
  },
  seqBtnPrimary: {
    background: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.45)',
    color: 'rgba(34, 197, 94, 0.95)',
  },
  seqBtnDanger: {
    background: 'rgba(237, 100, 100, 0.1)',
    borderColor: 'rgba(237, 100, 100, 0.45)',
    color: 'rgba(252, 165, 165, 0.95)',
  },
  seqBtnDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
  },
  chanceInactiveHint: {
    margin: 0,
    fontSize: '0.78rem',
    color: 'var(--accent-strong)',
    lineHeight: 1.4,
  },
  chanceDetails: {
    marginTop: '0.5rem',
    padding: '0.85rem',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: 'rgba(17,26,46,0.55)',
    maxWidth: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
  },
  scopeSection: {
    marginTop: '0.5rem',
    padding: '0.85rem',
    paddingBottom: '1rem',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: 'rgba(17,26,46,0.55)',
    maxWidth: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    minHeight: 0,
  },
  scopeMeterWrap: {
    width: '100%',
    height: 168,
    minHeight: 140,
    display: 'flex',
    flexDirection: 'column',
  },
  chanceSectionTitle: {
    margin: 0,
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text)',
  },
  voiceToolbar: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
    alignItems: 'center',
  },
  voicePolyMode: {
    display: 'inline-flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.45rem',
    marginLeft: '0.15rem',
    padding: '0.25rem 0.5rem',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'rgba(17,26,46,0.35)',
  },
  voicePolyModeLegend: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--muted)',
    marginRight: '0.1rem',
  },
  voicePolyRadio: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text)',
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  voicePolyHint: {
    gridColumn: '1 / -1',
    margin: '0.1rem 0 0',
    fontSize: '0.72rem',
    color: 'var(--muted)',
    lineHeight: 1.35,
  },
  voiceToolbarGhostBtn: {
    padding: '0.35rem 0.65rem',
    borderRadius: '8px',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px dashed var(--border)',
    background: 'transparent',
    color: 'var(--muted)',
    transition:
      'background 120ms ease, border-color 120ms ease, color 120ms ease',
  },
  voicePreviewBtn: {
    padding: '0.35rem 0.65rem',
    borderRadius: '8px',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid rgba(96, 165, 250, 0.45)',
    background: 'rgba(96, 165, 250, 0.12)',
    color: 'rgba(147, 197, 253, 0.98)',
    transition:
      'background 120ms ease, border-color 120ms ease, color 120ms ease',
  },
  effectsVoiceGroupHeader: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    marginTop: '0.25rem',
    paddingTop: '0.65rem',
    borderTop: '1px solid var(--border)',
  },
  chanceVoiceGroupTitle: {
    margin: 0,
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text)',
  },
  chanceVoiceHint: {
    margin: 0,
    fontSize: '0.72rem',
    color: 'var(--muted)',
    lineHeight: 1.35,
  },
  chanceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(10.75rem, 1fr))',
    gap: '0.65rem 1rem',
    alignItems: 'start',
  },
  chanceField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    minWidth: 0,
  },
  chanceDual: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    minWidth: 0,
  },
  chanceDualLabel: {
    fontSize: '0.72rem',
    color: 'var(--muted)',
    fontWeight: 600,
  },
  chanceDualRanges: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: '0.5rem',
    width: '100%',
  },
  chanceLabel: {
    fontSize: '0.72rem',
    color: 'var(--muted)',
    fontWeight: 600,
  },
  chanceSelect: {
    width: '100%',
    padding: '0.45rem 0.55rem',
    fontSize: '0.85rem',
    color: 'var(--text)',
    background: 'var(--bg-elev)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
  },
  chanceRange: {
    width: '100%',
    accentColor: 'var(--accent)',
  },
  chanceDualRangeInput: {
    flex: '1 1 6rem',
    minWidth: '6rem',
    width: 'auto',
    accentColor: 'var(--accent)',
  },
  hint: {
    margin: 0,
    fontSize: '0.8rem',
    color: 'var(--muted)',
    lineHeight: 1.5,
  },
  octaveRow: {
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.8rem',
    lineHeight: 1.5,
  },
  octaveLabel: {
    fontWeight: 600,
    color: 'var(--text)',
    fontVariantNumeric: 'tabular-nums',
  },
  octaveDivider: {
    color: 'var(--muted)',
  },
  octaveHint: {
    color: 'var(--muted)',
  },
  keyboardWrap: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    overflowX: 'auto',
    overflowY: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: '1.5rem 2rem 2.5rem',
  },
  keyboard: {
    position: 'relative',
    flexShrink: 0,
    height: 'min(60vh, 240px)',
    minHeight: 200,
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'none',
  },
  whiteRow: {
    display: 'flex',
    width: '100%',
    height: '100%',
    gap: 0,
  },
  whiteKey: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    background: 'var(--bg-elev)',
    border: '1px solid var(--border)',
    borderRadius: '0 0 8px 8px',
    padding: 0,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: '0.6rem',
    cursor: 'pointer',
    transition: 'background 80ms ease, box-shadow 80ms ease',
  },
  whiteKeyLit: {
    background: 'rgba(237, 180, 54, 0.18)',
    boxShadow:
      'inset 0 0 24px 0 rgba(237, 180, 54, 0.22), 0 0 24px 2px rgba(237, 180, 54, 0.45)',
  },
  whiteLabel: {
    fontSize: '0.55rem',
    color: 'var(--muted)',
    letterSpacing: '0.04em',
    pointerEvents: 'none',
  },
  blackKey: {
    position: 'absolute',
    top: 0,
    height: '62%',
    background: '#0a1020',
    border: '1px solid #000',
    borderTop: 'none',
    borderRadius: '0 0 6px 6px',
    cursor: 'pointer',
    padding: 0,
    transition: 'background 80ms ease, box-shadow 80ms ease',
    zIndex: 1,
  },
  blackKeyLit: {
    background: 'rgba(237, 180, 54, 0.55)',
    boxShadow:
      'inset 0 0 16px 0 rgba(237, 180, 54, 0.5), 0 0 24px 2px rgba(237, 180, 54, 0.55)',
  },
};
