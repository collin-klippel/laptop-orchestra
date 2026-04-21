import type { KeySetting, PerformancePreset } from '@laptop-orchestra/shared';
import { useCallback, useEffect, useState } from 'react';
import {
  deletePreset as deletePresetFromStorage,
  getPresets,
  savePreset as savePresetToStorage,
  updatePreset as updatePresetInStorage,
} from '../lib/presets';

export function usePresets() {
  const [presets, setPresets] = useState<PerformancePreset[]>([]);

  useEffect(() => {
    setPresets(getPresets());
  }, []);

  const savePreset = useCallback(
    (
      name: string,
      bpm: number,
      key: KeySetting,
      metronomeEnabled: boolean,
      countInBeats: number,
    ) => {
      const preset = savePresetToStorage(
        name,
        bpm,
        key,
        metronomeEnabled,
        countInBeats,
      );
      setPresets((prev) => [...prev, preset]);
      return preset;
    },
    [],
  );

  const updatePreset = useCallback(
    (
      id: string,
      name: string,
      bpm: number,
      key: KeySetting,
      metronomeEnabled: boolean,
      countInBeats: number,
    ) => {
      const updated = updatePresetInStorage(
        id,
        name,
        bpm,
        key,
        metronomeEnabled,
        countInBeats,
      );
      if (updated) {
        setPresets((prev) => prev.map((p) => (p.id === id ? updated : p)));
      }
      return updated;
    },
    [],
  );

  const deletePreset = useCallback((id: string) => {
    const deleted = deletePresetFromStorage(id);
    if (deleted) {
      setPresets((prev) => prev.filter((p) => p.id !== id));
    }
    return deleted;
  }, []);

  return {
    presets,
    savePreset,
    updatePreset,
    deletePreset,
  };
}
