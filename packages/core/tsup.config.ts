import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  dts: true,
  minify: true,
  clean: true,
  outExtension() {
    return {
      js: '.cjs',
    }
  },
  sourcemap: false,
});
