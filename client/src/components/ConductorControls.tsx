import type { KeySetting, PerformanceState } from '@laptop-orchestra/shared';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import {
  fontSize,
  letterSpacing,
  radius,
  shadows,
  spacing,
  zIndex,
} from '../theme';

const ROOT_NOTES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;
const SCALE_TYPES: { value: string; label: string }[] = [
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: 'pentatonic', label: 'Pentatonic' },
];

interface ConductorControlsProps {
  performanceState: PerformanceState;
  conductorBpm: number | null;
  conductorKey: KeySetting | null;
  onSetTempo: (bpm: number) => void;
  onSetKey: (key: KeySetting) => void;
  onStartPerformance: () => void;
  onStopPerformance: () => void;
}

const DEFAULT_BPM = 100;
const DEBOUNCE_MS = 80;
const CONFIG_REGION_ID = 'conductor-config-region';

export function ConductorControls({
  performanceState,
  conductorBpm,
  conductorKey,
  onSetTempo,
  onSetKey,
  onStartPerformance,
  onStopPerformance,
}: ConductorControlsProps) {
  const [localBpm, setLocalBpm] = useState(conductorBpm ?? DEFAULT_BPM);
  const [localRoot, setLocalRoot] = useState(conductorKey?.root ?? 'C');
  const [localScaleType, setLocalScaleType] = useState(
    conductorKey?.scaleType ?? 'minor',
  );
  const [configOpen, setConfigOpen] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scaleLabel =
    SCALE_TYPES.find((s) => s.value === localScaleType)?.label ??
    localScaleType;

  const handleBpmChange = useCallback(
    (value: number) => {
      setLocalBpm(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSetTempo(value);
      }, DEBOUNCE_MS);
    },
    [onSetTempo],
  );

  const handleKeyChange = useCallback(
    (root: string, scaleType: string) => {
      onSetKey({ root, scaleType });
    },
    [onSetKey],
  );

  const isActive = performanceState.active;

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.badge}>Conductor</span>
        {!configOpen && (
          <span style={styles.headerSummary}>
            {localBpm} BPM · {localRoot} {scaleLabel}
          </span>
        )}
        <button
          type="button"
          aria-expanded={configOpen}
          aria-controls={CONFIG_REGION_ID}
          aria-label={
            configOpen
              ? 'Collapse conductor configuration'
              : 'Expand conductor configuration'
          }
          onClick={() => setConfigOpen((v) => !v)}
          style={styles.headerToggle}
        >
          <span aria-hidden style={styles.headerChevron}>
            {configOpen ? '▼' : '▶'}
          </span>
        </button>
      </div>

      <div id={CONFIG_REGION_ID} hidden={!configOpen}>
        <div style={styles.collapsibleInner}>
          <div style={styles.tempoRow}>
            <label style={styles.label} htmlFor="conductor-bpm">
              Tempo
            </label>
            <input
              id="conductor-bpm"
              type="range"
              min={40}
              max={200}
              value={localBpm}
              onChange={(e) => handleBpmChange(Number(e.target.value))}
              style={styles.slider}
            />
            <span style={styles.bpmValue}>{localBpm} BPM</span>
          </div>

          <div style={styles.keyRow}>
            <span style={styles.label}>Key</span>
            <div style={styles.rootGrid}>
              {ROOT_NOTES.map((note) => (
                <button
                  key={note}
                  type="button"
                  onClick={() => {
                    setLocalRoot(note);
                    handleKeyChange(note, localScaleType);
                  }}
                  style={{
                    ...styles.noteBtn,
                    ...(localRoot === note ? styles.noteBtnActive : {}),
                  }}
                >
                  {note}
                </button>
              ))}
            </div>
            <div style={styles.scaleRow}>
              {SCALE_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setLocalScaleType(value);
                    handleKeyChange(localRoot, value);
                  }}
                  style={{
                    ...styles.scaleBtn,
                    ...(localScaleType === value ? styles.scaleBtnActive : {}),
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {isActive && (
            <p style={styles.hint}>
              Performers are live — shared tempo and key apply to everyone; each
              player starts their own part when they are ready.
            </p>
          )}
          {!isActive && (
            <p style={styles.hint}>
              Set tempo and key, then start the performance. That arms the
              session clock and conductor controls; it does not start
              anyone&apos;s generated parts.
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={isActive ? onStopPerformance : onStartPerformance}
        style={{
          ...styles.performanceBtn,
          background: isActive
            ? 'rgba(237, 100, 100, 0.15)'
            : 'rgba(34, 197, 94, 0.15)',
          borderColor: isActive
            ? 'rgba(237, 100, 100, 0.5)'
            : 'rgba(34, 197, 94, 0.5)',
          color: isActive
            ? 'rgba(237, 100, 100, 0.9)'
            : 'rgba(34, 197, 94, 0.9)',
        }}
      >
        {isActive ? 'Stop Performance' : 'Start Performance'}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    position: 'fixed',
    bottom: spacing['6xl'],
    right: spacing['6xl'],
    zIndex: zIndex.overlay,
    background: 'var(--bg-elev)',
    border: '1px solid var(--border)',
    borderRadius: radius['2xl'],
    padding: `${spacing['5xl']} ${spacing['6xl']}`,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing['3xl'],
    width: 'min(340px, calc(100vw - 3rem))',
    boxShadow: shadows.lg,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.lg,
    minWidth: 0,
  },
  headerSummary: {
    flex: 1,
    minWidth: 0,
    fontSize: fontSize.xl,
    color: 'var(--muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textAlign: 'center',
  },
  headerToggle: {
    flexShrink: 0,
    marginLeft: 'auto',
    padding: `${spacing.sm} ${spacing.lg}`,
    border: '1px solid var(--border)',
    borderRadius: radius.md,
    background: 'transparent',
    color: 'var(--muted)',
    cursor: 'pointer',
    fontSize: fontSize.sm,
    lineHeight: 1,
    transition: 'background 120ms ease, border-color 120ms ease',
  },
  headerChevron: {
    display: 'inline-block',
    width: '1em',
    textAlign: 'center',
  },
  collapsibleInner: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing['3xl'],
  },
  badge: {
    fontSize: fontSize.sm,
    fontWeight: 700,
    letterSpacing: letterSpacing.widest,
    textTransform: 'uppercase' as const,
    color: 'rgba(251, 191, 36, 0.9)',
    background: 'rgba(251, 191, 36, 0.12)',
    border: '1px solid rgba(251, 191, 36, 0.3)',
    borderRadius: radius.sm,
    padding: `${spacing.sm} ${spacing.lg}`,
  },
  tempoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xl,
  },
  label: {
    fontSize: fontSize.md,
    letterSpacing: letterSpacing.wider,
    textTransform: 'uppercase' as const,
    color: 'var(--muted)',
    flexShrink: 0,
  },
  slider: {
    flex: 1,
    accentColor: 'rgba(251, 191, 36, 0.8)',
    cursor: 'pointer',
  },
  bpmValue: {
    fontSize: fontSize['2xl'],
    color: 'var(--text)',
    minWidth: '4.5rem',
    textAlign: 'right' as const,
    flexShrink: 0,
  },
  performanceBtn: {
    padding: `${spacing.lg} ${spacing['5xl']}`,
    border: '1px solid',
    borderRadius: radius.lg,
    fontSize: fontSize['3xl'],
    fontWeight: 600,
    cursor: 'pointer',
    transition:
      'background 150ms ease, border-color 150ms ease, color 150ms ease',
    width: '100%',
  },
  hint: {
    margin: 0,
    fontSize: fontSize.md,
    color: 'var(--muted)',
    lineHeight: 1.4,
  },
  keyRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing.lg,
  },
  rootGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: spacing.lg,
  },
  noteBtn: {
    padding: `${spacing.sm} 0`,
    borderRadius: radius.sm,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--muted)',
    cursor: 'pointer',
    fontSize: fontSize.md,
    fontWeight: 500,
    transition: 'background 0.12s, color 0.12s, border-color 0.12s',
  },
  noteBtnActive: {
    background: 'rgba(251, 191, 36, 0.2)',
    color: 'rgba(251, 191, 36, 0.95)',
    borderColor: 'rgba(251, 191, 36, 0.5)',
  },
  scaleRow: {
    display: 'flex',
    gap: spacing.lg,
  },
  scaleBtn: {
    flex: 1,
    padding: `${spacing.sm} 0`,
    borderRadius: radius.sm,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--muted)',
    cursor: 'pointer',
    fontSize: fontSize.md,
    fontWeight: 500,
    transition: 'background 0.12s, color 0.12s, border-color 0.12s',
  },
  scaleBtnActive: {
    background: 'rgba(251, 191, 36, 0.2)',
    color: 'rgba(251, 191, 36, 0.95)',
    borderColor: 'rgba(251, 191, 36, 0.5)',
  },
};
