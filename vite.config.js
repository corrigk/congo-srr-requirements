import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

export default defineConfig({
  base: './',
  plugins: [
    // Dev server = the local editor: mount the SQLite-backed API.
    {
      name: 'requirements-api',
      apply: 'serve',
      async configureServer(server) {
        const { apiMiddleware } = await import('./server/api.mjs');
        server.middlewares.use(apiMiddleware(root));
      },
    },
    // Build = the static, read-only site: ship the finalized baseline(s) next to the page.
    {
      name: 'publish-data',
      apply: 'build',
      closeBundle() {
        const out = path.join(root, 'dist', 'data');
        fs.mkdirSync(path.join(out, 'baselines'), { recursive: true });
        const src = path.join(root, 'data');
        const published = fs.existsSync(path.join(src, 'published.json')) ? 'published.json' : 'working.json';
        fs.copyFileSync(path.join(src, published), path.join(out, 'published.json'));
        for (const f of fs.existsSync(path.join(src, 'baselines')) ? fs.readdirSync(path.join(src, 'baselines')) : []) {
          if (f.endsWith('.json')) fs.copyFileSync(path.join(src, 'baselines', f), path.join(out, 'baselines', f));
        }
        console.log(`published data: ${published}`);
      },
    },
  ],
  build: { target: 'es2022' },
  server: { port: 5180, watch: { ignored: ['**/data/**'] } },
});
