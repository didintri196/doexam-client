import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Two entries, two bundles (DOCS/PLAN/09-FRONTEND.md §3). ENTRY=exam|panel builds only one
// of them, which is what each Docker image does; without ENTRY both are built.
const entries = {
  exam: resolve(__dirname, 'exam/index.html'),
  panel: resolve(__dirname, 'app/index.html'),
};
const only = process.env.ENTRY as keyof typeof entries | undefined;
if (only && !entries[only]) {
  throw new Error(`ENTRY must be exam or panel, got "${only}"`);
}

// Shown in the footer. Docker builds pass APP_VERSION (e.g. `git describe --tags`); otherwise package.json.
const version = (process.env.APP_VERSION || JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')).version).replace(/^v/, '');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  build: {
    outDir: only ? `dist/${only}` : 'dist/all',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: { input: only ? { [only]: entries[only] } : entries },
  },
  server: {
    port: 5173,
    // The API has no CORS: the dev server proxies it, nginx does the same in Docker.
    proxy: { '/api': process.env.API_URL ?? 'http://localhost:8080' },
  },
  preview: { proxy: { '/api': process.env.API_URL ?? 'http://localhost:8080' } },
});
