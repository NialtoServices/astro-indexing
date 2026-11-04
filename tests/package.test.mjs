import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))

describe('package manifest', () => {
  it('is expected to ship the command and nothing it does not need', () => {
    expect(manifest.bin['astro-indexing']).toBe('bin/astro-indexing.mjs')
    expect(manifest.files).toEqual(['bin', 'src', 'LICENSE', 'README.md'])
    expect(manifest.dependencies).toBeUndefined()
  })
})
