import { describe, expect, it } from 'vitest'
import { batchURLs, describeStatus, hostOf, isKeyLive, submitURLs } from '../src/index.mjs'

const KEY = '0f3c9a7e5b2d4c6e8a1b3d5f7e9c2a4b'

/** A stand-in for IndexNow that records each submission and answers with the given status. */
function createEndpoint(status = 200) {
  const submissions = []
  const fetch = async (_, init) => {
    submissions.push(JSON.parse(init.body))
    return new Response(null, { status })
  }

  return { fetch, submissions }
}

describe('.hostOf', () => {
  it('is expected to return the host the URLs share', () => {
    expect(hostOf(['https://example.com/', 'https://example.com/about/'])).toBe('example.com')
  })

  it('is expected to keep a non-default port as part of the host', () => {
    expect(hostOf(['http://127.0.0.1:8080/'])).toBe('127.0.0.1:8080')
  })

  describe('with URLs on more than one host', () => {
    it('is expected to name every host', () => {
      expect(() => hostOf(['https://example.com/', 'https://www.example.com/'])).toThrow(
        '"example.com", "www.example.com"'
      )
    })
  })

  describe('with a relative URL', () => {
    it('is expected to name it', () => {
      expect(() => hostOf(['/about/'])).toThrow('"/about/" is not an absolute URL')
    })
  })

  describe('with a URL that is not http or https', () => {
    it('is expected to name it', () => {
      expect(() => hostOf(['mailto:hello@example.com'])).toThrow('is not an http or https URL')
    })
  })

  describe('with no URLs', () => {
    it('is expected to say there is nothing to submit', () => {
      expect(() => hostOf([])).toThrow('There are no URLs to submit')
    })
  })
})

describe('.batchURLs', () => {
  it('is expected to split the URLs into lists no longer than the size', () => {
    const urls = Array.from({ length: 5 }, (_, index) => `https://example.com/${index}/`)

    expect(batchURLs(urls, 2).map((batch) => batch.length)).toEqual([2, 2, 1])
  })

  it('is expected to drop duplicates', () => {
    expect(batchURLs(['https://example.com/', 'https://example.com/'])).toEqual([['https://example.com/']])
  })
})

describe('.describeStatus', () => {
  it.each([
    [200, 'accepted'],
    [202, 'validate the key file'],
    [403, 'key file was missing'],
    [422, 'does not belong to the host'],
    [429, 'too many requests'],
    [500, 'unexpected HTTP 500']
  ])('is expected to describe HTTP %i', (status, description) => {
    expect(describeStatus(status)).toContain(description)
  })
})

describe('.isKeyLive', () => {
  it('is expected to be true when the site serves the key file', async () => {
    const fetch = async () => new Response(`${KEY}\n`)

    expect(await isKeyLive({ origin: 'https://example.com', key: KEY, fetch })).toBe(true)
  })

  describe('when the site does not serve the key file', () => {
    it('is expected to be false', async () => {
      const fetch = async () => new Response('Not found', { status: 404 })

      expect(await isKeyLive({ origin: 'https://example.com', key: KEY, fetch })).toBe(false)
    })
  })

  describe('when the file holds a different key', () => {
    it('is expected to be false', async () => {
      const fetch = async () => new Response('another-key-entirely')

      expect(await isKeyLive({ origin: 'https://example.com', key: KEY, fetch })).toBe(false)
    })
  })

  describe('when the site cannot be reached', () => {
    it('is expected to be false', async () => {
      const fetch = async () => {
        throw new TypeError('fetch failed')
      }

      expect(await isKeyLive({ origin: 'https://example.com', key: KEY, fetch })).toBe(false)
    })
  })
})

describe('.submitURLs', () => {
  it('is expected to send the host, key and URLs IndexNow needs', async () => {
    const endpoint = createEndpoint()

    await submitURLs({ urls: ['https://example.com/', 'https://example.com/about/'], key: KEY, fetch: endpoint.fetch })

    expect(endpoint.submissions).toEqual([
      { host: 'example.com', key: KEY, urlList: ['https://example.com/', 'https://example.com/about/'] }
    ])
  })

  it('is expected to split more than 10,000 URLs across requests', async () => {
    const endpoint = createEndpoint()
    const urls = Array.from({ length: 10_001 }, (_, index) => `https://example.com/${index}/`)

    await submitURLs({ urls, key: KEY, fetch: endpoint.fetch })

    expect(endpoint.submissions.map((submission) => submission.urlList.length)).toEqual([10_000, 1])
  })

  it.each([[200], [202]])('is expected to count HTTP %i as accepted', async (status) => {
    const endpoint = createEndpoint(status)

    const [result] = await submitURLs({ urls: ['https://example.com/'], key: KEY, fetch: endpoint.fetch })

    expect(result).toMatchObject({ count: 1, status, accepted: true })
  })

  describe('when IndexNow refuses the request', () => {
    it('is expected to report it as not accepted, with the reason', async () => {
      const endpoint = createEndpoint(403)

      const [result] = await submitURLs({ urls: ['https://example.com/'], key: KEY, fetch: endpoint.fetch })

      expect(result).toMatchObject({ accepted: false, description: expect.stringContaining('key file') })
    })
  })

  describe('when IndexNow cannot be reached', () => {
    it('is expected to name the endpoint', async () => {
      const fetch = async () => {
        throw new TypeError('fetch failed')
      }

      await expect(
        submitURLs({ urls: ['https://example.com/'], key: KEY, endpoint: 'https://indexnow.invalid/', fetch })
      ).rejects.toThrow('https://indexnow.invalid/')
    })
  })
})
