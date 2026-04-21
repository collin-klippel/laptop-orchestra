import type { KeySetting } from '@laptop-orchestra/shared';
import { Scale } from 'aleatoric';

const DEFAULT_ROOT = 'C';
const DEFAULT_TYPE = 'minor';

/** Map conductor UI scale names to aleatoric `Scale` factories. */
function scaleFromKey(key: KeySetting): Scale {
  const root = key.root || DEFAULT_ROOT;
  const t = key.scaleType || DEFAULT_TYPE;
  switch (t) {
    case 'major':
      return Scale.major(root);
    case 'minor':
      return Scale.minor(root);
    case 'pentatonic':
      return Scale.pentatonic(root);
    default:
      return Scale.create(root, t);
  }
}

/** Conductor key or safe defaults (matches ConductorControls fallbacks). */
export function keySettingToScale(key: KeySetting | null): Scale {
  return scaleFromKey(
    key ?? {
      root: DEFAULT_ROOT,
      scaleType: DEFAULT_TYPE,
    },
  );
}
