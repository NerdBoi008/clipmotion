import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./cli/index.ts'],
  outDir: 'build',
  format: ['cjs'],
  dts: true, // Generate TypeScript declaration files
  clean: true, // Clean output directory before build
  target: "node18"
});