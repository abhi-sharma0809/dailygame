/// <reference types="vitest" />
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Dev-only endpoint for the board editor: writes a category's board file. */
function boardEditor(): Plugin {
  const dir = path.resolve(__dirname, 'src/data/atlas/boards');
  return {
    name: 'kinship-board-editor',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__kinship/save-board', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return; }
        let body = '';
        req.on('data', (c) => { body += c; if (body.length > 2_000_000) req.destroy(); });
        req.on('end', () => {
          try {
            const { category, content } = JSON.parse(body) as { category: string; content: string };
            if (!/^[a-z]+$/.test(category)) throw new Error('bad category');
            const file = path.join(dir, `${category}.txt`);
            if (!fs.existsSync(file)) throw new Error('unknown board file');
            if (!content.startsWith(`@category ${category}`)) throw new Error('content does not match category');
            fs.writeFileSync(file, content);
            res.end('ok');
          } catch (e) {
            res.statusCode = 400;
            res.end(String((e as Error).message));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), boardEditor()],
  build: { chunkSizeWarningLimit: 1200 },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
  },
});
