import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SDK_VERSION } from '../src/client'

// The version this SDK announces on the wire (X-SudoMock-Client) is the one a
// reader looks up in CHANGELOG.md. These checks keep the three places that
// carry it (package.json, package-lock.json, CHANGELOG.md) from drifting apart,
// and refuse a version whose release notes still hold a shipped feature under
// [Unreleased].

const read = (name: string): string =>
  readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')

const packageJson = JSON.parse(read('package.json')) as { version: string }
const packageLock = JSON.parse(read('package-lock.json')) as {
  version: string
  packages: Record<string, { version?: string }>
}
const changelog = read('CHANGELOG.md')

interface Release {
  version: string
  date: string
  body: string
}

// `## [2.6.0] - 2026-09-18` opens a released section; any other `## ` line
// (for example `## [Unreleased]`) closes the previous one without opening a
// released one, so its bullets belong to no release.
const RELEASE_HEADER = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})\s*$/

function parseReleases(text: string): Release[] {
  const releases: Release[] = []
  let current: Release | undefined
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) {
      const match = RELEASE_HEADER.exec(line)
      current = match
        ? { version: match[1] as string, date: match[2] as string, body: '' }
        : undefined
      if (current) releases.push(current)
      continue
    }
    if (current) current.body += `${line}\n`
  }
  return releases
}

const releases = parseReleases(changelog)

const tuple = (v: string): number[] => v.split('.').map(Number)

function notAfter(a: string, b: string): boolean {
  const [x, y] = [tuple(a), tuple(b)]
  for (let i = 0; i < 3; i += 1) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0)
  }
  return true
}

// Names a caller can type against in this SDK today. Each must be documented
// under a release at or below the version on the wire, not only under
// [Unreleased]; otherwise the published package ships a feature its release
// notes say has not shipped.
const SHIPPED_ON_THE_WIRE = [
  'eventNaming',
  'photo_mockup_create',
  'photo_mockup.ready',
  'photoMockups',
  'psdMockups',
  '/api/v1/photo-mockups',
  '/api/v1/psd-mockups',
] as const

describe('release consistency', () => {
  it('package-lock.json carries the package.json version at both roots', () => {
    expect(packageLock.version).toBe(packageJson.version)
    expect(packageLock.packages['']?.version).toBe(packageJson.version)
  })

  it('the version on the wire has a dated CHANGELOG entry', () => {
    expect(SDK_VERSION).toBe(packageJson.version)
    const entry = releases.find((r) => r.version === SDK_VERSION)
    expect(
      entry,
      `CHANGELOG.md has no "## [${SDK_VERSION}] - YYYY-MM-DD" section`,
    ).toBeDefined()
    expect(Number.isNaN(Date.parse(entry?.date ?? ''))).toBe(false)
  })

  it.each(SHIPPED_ON_THE_WIRE)(
    '%s is documented under a release at or below the version on the wire',
    (feature) => {
      const documentedIn = releases
        .filter((r) => notAfter(r.version, SDK_VERSION) && r.body.includes(feature))
        .map((r) => r.version)
      expect(
        documentedIn,
        `${feature} ships in ${SDK_VERSION} but no release at or below it mentions it`,
      ).not.toHaveLength(0)
    },
  )
})
