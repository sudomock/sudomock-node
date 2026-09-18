import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

// Same injection as tsup.config.ts: tests run against the unbundled source, so
// the version constant has to be supplied here too.
const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as {
  version: string
}

export default defineConfig({
  define: {
    __SDK_VERSION__: JSON.stringify(version),
  },
  test: {
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    environment: 'node',
    testTimeout: 10_000,
  },
})
