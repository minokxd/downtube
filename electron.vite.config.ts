import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import type { Plugin } from 'vite';

const alias = { '@shared': resolve('src/shared') };

// The production CSP is strict. In dev, Vite needs inline scripts (React refresh)
// and a websocket for HMR, so the dev server loosens it.
function devCsp(): Plugin {
  return {
    name: 'downtube-dev-csp',
    apply: 'serve',
    transformIndexHtml(html) {
      return html
        .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
        .replace("connect-src 'self'", "connect-src 'self' ws://localhost:* http://localhost:*");
    },
  };
}

export default defineConfig({
  main: { resolve: { alias } },
  preload: { resolve: { alias } },
  renderer: { resolve: { alias }, plugins: [react(), devCsp()] },
});
