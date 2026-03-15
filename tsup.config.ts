import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ['firebase', 'firebase/firestore', 'firebase/auth', 'firebase/database', 'firebase/storage', 'react'],
    treeshake: true,
  },
]);
