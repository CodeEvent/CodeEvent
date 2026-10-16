import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/index.js',
  platform: 'browser',
  jsx: 'automatic',
  external: ['react', 'react-dom'],
  target: 'es2019',
});

copyFileSync('src/styles.css', 'dist/styles.css');

console.log('build complete: dist/index.js, dist/styles.css');
