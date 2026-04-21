import type { KeySetting, PerformancePreset } from '@laptop-orchestra/shared';

const PRESETS_STORAGE_KEY = 'laptop-orchestra:presets';

export function getPresets(): PerformancePreset[] {
  try {
    const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!stored) return [];
    const presets = JSON.parse(stored) as PerformancePreset[];
    return Array.isArray(presets) ? presets : [];
  } catch {
    return [];
  }
}

export function savePreset(
  name: string,
  bpm: number,
  key: KeySetting,
  metronomeEnabled: boolean,
  countInBeats: number,
): PerformancePreset {
  const presets = getPresets();
  const preset: PerformancePreset = {
    id: crypto.randomUUID(),
    name,
    bpm,
    key,
    metronomeEnabled,
    countInBeats,
    createdAt: Date.now(),
  };
  presets.push(preset);
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  return preset;
}

export function updatePreset(
  id: string,
  name: string,
  bpm: number,
  key: KeySetting,
  metronomeEnabled: boolean,
  countInBeats: number,
): PerformancePreset | null {
  const presets = getPresets();
  const index = presets.findIndex((p) => p.id === id);
  if (index === -1) return null;

  presets[index] = {
    ...presets[index],
    name,
    bpm,
    key,
    metronomeEnabled,
    countInBeats,
  };
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  return presets[index];
}

export function deletePreset(id: string): boolean {
  const presets = getPresets();
  const filtered = presets.filter((p) => p.id !== id);
  if (filtered.length === presets.length) return false;
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(filtered));
  return true;
}
