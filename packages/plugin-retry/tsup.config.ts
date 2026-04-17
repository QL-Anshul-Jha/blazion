import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  dts: false,
  minify: true,
  clean: false, // Don't clean to preserve tsc build metadata
  outExtension() {
    return {
      js: '.cjs',
    }
  },
  sourcemap: false,
});
