import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {defineConfig} from 'vite';

function gitOutput(args: string[]) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

export default defineConfig(({ mode }) => {
  const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
  const build = {
    version,
    commit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA ||
      process.env.COMMIT_REF || gitOutput(['rev-parse', 'HEAD']) || 'indisponível',
    builtAt: new Date().toISOString(),
    mode,
    dirty: gitOutput(['status', '--porcelain'])?.length ? true : false,
  };
  return {
    plugins: [react(), tailwindcss()],
    define: { __HAGENDA_BUILD__: JSON.stringify(build) },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
