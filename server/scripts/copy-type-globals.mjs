/**
 * Post-build helper. Copies runtime-only files that the TypeScript
 * compiler doesn't emit (because they're not TypeScript source).
 *
 * Currently: `src/lib/fastify.d.js` — the JS counterpart of the
 * type-only `fastify.d.ts`. The build's `import './fastify.d.js'`
 * side effect (used to pull type augmentations into scope) needs a
 * real `.js` file at runtime, even though the contents are empty.
 */
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const copies = [
  ['src/lib/fastify.d.js', 'dist/lib/fastify.d.js'],
];

for (const [from, to] of copies) {
  const src = path.join(root, from);
  const dst = path.join(root, to);
  await mkdir(path.dirname(dst), { recursive: true });
  await copyFile(src, dst);
  // eslint-disable-next-line no-console
  console.info(`copy-type-globals: ${from} → ${to}`);
}
