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
  // No source maps in the published package. A map's sourcesContent carries
  // every source file whole, comments and all, so the tarball would publish
  // the TypeScript sources as a side effect of every release. The bundle is
  // not minified, so a stack trace stays readable without one.
  sourcemap: false,
  minify: false,
  target: 'node20',
  outDir: 'dist',
  define: {
    __SDK_VERSION__: JSON.stringify(version),
  },
})
