import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

try {
  const installJs = require.resolve('esbuild/install.js');
  const cwd = path.dirname(installJs);
  const r = spawnSync(process.execPath, ['install.js'], {
    cwd,
    stdio: 'inherit',
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
} catch {
  // Hoisted esbuild not present (e.g. production-only install).
}
