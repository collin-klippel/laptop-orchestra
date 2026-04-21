import type { KeySetting, PerformancePreset } from '@laptop-orchestra/shared';
import type React from 'react';
import { useState } from 'react';
import { usePresets } from '../hooks/usePresets';

interface PresetsPanelProps {
  currentBpm: number | null;
  currentKey: KeySetting | null;
  metronomeEnabled: boolean;
  countInBeats: number;
  onLoadPreset: (
    bpm: number,
    key: KeySetting,
    metronomeEnabled: boolean,
    countInBeats: number,
  ) => void;
  disabled?: boolean;
}

export function PresetsPanel({
  currentBpm,
  currentKey,
  metronomeEnabled,
  countInBeats,
  onLoadPreset,
  disabled = false,
}: PresetsPanelProps) {
  const { presets, savePreset, deletePreset } = usePresets();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);

  const handleSavePreset = () => {
    if (!presetName.trim() || !currentBpm || !currentKey) {
      alert('Please set tempo and key before saving a preset.');
      return;
    }
    savePreset(
      presetName,
      currentBpm,
      currentKey,
      metronomeEnabled,
      countInBeats,
    );
    setPresetName('');
    setShowSaveDialog(false);
  };

  const handleLoadPreset = (preset: PerformancePreset) => {
    onLoadPreset(
      preset.bpm,
      preset.key,
      preset.metronomeEnabled,
      preset.countInBeats,
    );
  };

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          aria-expanded={panelOpen}
          aria-label={panelOpen ? 'Collapse presets' : 'Expand presets'}
          style={styles.headerBtn}
        >
          <span style={styles.badge}>Presets</span>
          <span aria-hidden style={styles.chevron}>
            {panelOpen ? '▼' : '▶'}
          </span>
        </button>
      </div>

      <div hidden={!panelOpen} style={styles.collapsible}>
        {presets.length === 0 ? (
          <p style={styles.emptyText}>No presets saved yet</p>
        ) : (
          <div style={styles.presetsList}>
            {presets.map((preset) => (
              <div key={preset.id} style={styles.presetItem}>
                <button
                  type="button"
                  onClick={() => handleLoadPreset(preset)}
                  disabled={disabled}
                  style={{
                    ...styles.presetLoadBtn,
                    ...(disabled ? styles.presetLoadBtnDisabled : {}),
                  }}
                >
                  <span style={styles.presetName}>{preset.name}</span>
                  <span style={styles.presetMeta}>
                    {preset.bpm} BPM • {preset.key.root} {preset.key.scaleType}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => deletePreset(preset.id)}
                  disabled={disabled}
                  style={{
                    ...styles.deleteBtn,
                    ...(disabled ? styles.deleteBtnDisabled : {}),
                  }}
                  title="Delete preset"
                  aria-label={`Delete ${preset.name} preset`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowSaveDialog(true)}
          disabled={disabled || !currentBpm || !currentKey}
          style={{
            ...styles.saveBtn,
            ...(disabled || !currentBpm || !currentKey
              ? styles.saveBtnDisabled
              : {}),
          }}
        >
          Save Current as Preset
        </button>

        {showSaveDialog && (
          <div style={styles.dialog}>
            <input
              type="text"
              placeholder="Preset name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSavePreset();
              }}
              style={styles.input}
              autoFocus
            />
            <div style={styles.dialogBtns}>
              <button
                type="button"
                onClick={handleSavePreset}
                style={styles.dialogSaveBtn}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSaveDialog(false);
                  setPresetName('');
                }}
                style={styles.dialogCancelBtn}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    background: 'var(--bg-elev)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '0.75rem',
    marginTop: '0.75rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  headerBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  badge: {
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--accent-soft-fg)',
    background: 'var(--accent-soft-bg)',
    border: '1px solid var(--accent-soft-border)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.2rem 0.4rem',
  },
  chevron: {
    fontSize: '0.65rem',
    color: 'var(--muted)',
  },
  collapsible: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
    marginTop: '0.75rem',
  },
  presetsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.4rem',
    maxHeight: '200px',
    overflowY: 'auto' as const,
  },
  presetItem: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'stretch',
  },
  presetLoadBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '0.4rem 0.6rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    textAlign: 'left' as const,
    transition: 'background 120ms ease, border-color 120ms ease',
  },
  presetLoadBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  presetName: {
    fontWeight: 600,
    fontSize: '0.8rem',
  },
  presetMeta: {
    fontSize: '0.7rem',
    color: 'var(--muted)',
  },
  deleteBtn: {
    padding: '0.4rem 0.5rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'rgba(248, 113, 113, 0.75)',
    cursor: 'pointer',
    fontSize: '0.7rem',
    transition:
      'background 120ms ease, border-color 120ms ease, color 120ms ease',
  },
  deleteBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  saveBtn: {
    padding: '0.4rem 0.6rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    background: 'var(--accent-soft-bg)',
    color: 'var(--accent-strong)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 500,
    transition:
      'background 120ms ease, border-color 120ms ease, color 120ms ease',
  },
  saveBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  dialog: {
    display: 'flex',
    gap: '0.4rem',
    padding: '0.5rem',
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 'var(--radius-sm)',
    flexDirection: 'column' as const,
  },
  input: {
    padding: '0.4rem 0.6rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.8rem',
    fontFamily: 'inherit',
  },
  dialogBtns: {
    display: 'flex',
    gap: '0.4rem',
  },
  dialogSaveBtn: {
    flex: 1,
    padding: '0.3rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--accent-soft-border)',
    background: 'var(--accent-soft-bg-strong)',
    color: 'var(--accent-soft-fg)',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: 600,
    transition: 'background 120ms ease, border-color 120ms ease',
  },
  dialogCancelBtn: {
    flex: 1,
    padding: '0.3rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--muted)',
    cursor: 'pointer',
    fontSize: '0.75rem',
    transition:
      'background 120ms ease, border-color 120ms ease, color 120ms ease',
  },
  emptyText: {
    margin: 0,
    fontSize: '0.8rem',
    color: 'var(--muted)',
  },
};
