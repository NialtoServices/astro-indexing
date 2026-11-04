import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findKey, isValidKey } from '../src/index.mjs'
import { createBuiltSite } from './built-site.mjs'

const KEY = '0f3c9a7e5b2d4c6e8a1b3d5f7e9c2a4b'

describe('.isValidKey', () => {
  it.each([['abcd1234'], ['0f3c9a7e-5b2d-4c6e'], ['A'.repeat(128)]])('is expected to accept %s', (candidate) => {
    expect(isValidKey(candidate)).toBe(true)
  })

  it.each([['abc1234'], ['A'.repeat(129)], ['has_underscore'], ['has space1']])(
    'is expected not to accept %s',
    (candidate) => {
      expect(isValidKey(candidate)).toBe(false)
    }
  )
})

describe('.findKey', () => {
  it('is expected to find the key whose file holds its own name', async () => {
    const clientDirectory = await createBuiltSite({ [`${KEY}.txt`]: `${KEY}\n`, 'index.html': '' })

    expect(await findKey(clientDirectory)).toBe(KEY)
  })

  it('is expected not to take a text file holding something else for a key', async () => {
    const clientDirectory = await createBuiltSite({
      [`${KEY}.txt`]: KEY,
      'robots.txt': 'User-agent: *',
      'humans-and-friends.txt': 'Team: Nialto'
    })

    expect(await findKey(clientDirectory)).toBe(KEY)
  })

  it('is expected not to look below the root of the built site', async () => {
    const clientDirectory = await createBuiltSite({ [`nested/${KEY}.txt`]: KEY })

    await expect(findKey(clientDirectory)).rejects.toThrow('No IndexNow key file found')
  })

  describe('when the built site has no key file', () => {
    it('is expected to say how to add one', async () => {
      const clientDirectory = await createBuiltSite({ 'index.html': '' })

      await expect(findKey(clientDirectory)).rejects.toThrow('Add public/<key>.txt')
    })
  })

  describe('when the built site has two key files', () => {
    it('is expected to name both', async () => {
      const otherKey = 'aaaaaaaa1111'
      const clientDirectory = await createBuiltSite({ [`${KEY}.txt`]: KEY, [`${otherKey}.txt`]: otherKey })

      await expect(findKey(clientDirectory)).rejects.toThrow(otherKey)
    })
  })

  describe('when the built site does not exist', () => {
    it('is expected to say to build first', async () => {
      const clientDirectory = join(await createBuiltSite({}), 'missing')

      await expect(findKey(clientDirectory)).rejects.toThrow('Run astro build first')
    })
  })
})
