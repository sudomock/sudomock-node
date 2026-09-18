import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

// package.json is the single source of the SDK version. It is injected here at
// build time (and by vitest.config.ts at test time) so the constant can never
// drift from the published version again.
const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as {
  version: string
}

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  target: 'node20',
  outDir: 'dist',
  define: {
    __SDK_VERSION__: JSON.stringify(version),
  },
})
