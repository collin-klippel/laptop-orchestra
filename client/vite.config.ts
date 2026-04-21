import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** GitHub Actions sets `GITHUB_REPOSITORY=owner/repo` — project Pages is served at /{repo}/ */
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = repoName ? `/${repoName}/` : '/';

export default defineConfig({
  plugins: [react()],
  base,
  resolve: {
    preserveSymlinks: true,
  },
  server: {
    host: true,
    port: 5173,
  },
});
