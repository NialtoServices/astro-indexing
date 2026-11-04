import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createBuiltSite, sitemapIndexOf, sitemapOf } from './built-site.mjs'

const run = promisify(execFile)
const COMMAND = fileURLToPath(new URL('../bin/astro-indexing.mjs', import.meta.url))
const KEY = '0f3c9a7e5b2d4c6e8a1b3d5f7e9c2a4b'

async function runCommand(argumentsList, cwd = tmpdir()) {
  try {
    const { stdout, stderr } = await run('node', [COMMAND, ...argumentsList], { cwd })
    return { code: 0, output: stdout + stderr }
  } catch (error) {
    return { code: error.code, output: error.stdout + error.stderr }
  }
}

/**
 * A local stand-in for both the live site and IndexNow: it serves the key file when `keyIsLive` is set, and
 * records each submission to `/indexnow`.
 */
function createSiteAndEndpoint() {
  const state = { keyIsLive: true, status: 200, submissions: [] }
  const server = createServer((request, response) => {
    if (request.method === 'GET' && request.url === `/${KEY}.txt` && state.keyIsLive) {
      response.end(KEY)
      return
    }

    if (request.method === 'POST' && request.url === '/indexnow') {
      let body = ''
      request.on('data', (chunk) => (body += chunk))
      request.on('end', () => {
        state.submissions.push(JSON.parse(body))
        response.statusCode = state.status
        response.end()
      })
      return
    }

    response.statusCode = 404
    response.end()
  })

  return { server, state }
}

describe('astro-indexing', () => {
  describe('with no command', () => {
    it('is expected to exit 2 with the usage', async () => {
      const result = await runCommand([])

      expect(result).toMatchObject({ code: 2, output: expect.stringContaining('Usage') })
    })
  })

  describe('with an unknown command', () => {
    it('is expected to exit 2 with the usage', async () => {
      const result = await runCommand(['google'])

      expect(result).toMatchObject({ code: 2, output: expect.stringContaining('Usage') })
    })
  })

  describe('--help', () => {
    it('is expected to exit 0 with the usage', async () => {
      const result = await runCommand(['--help'])

      expect(result).toMatchObject({ code: 0, output: expect.stringContaining('indexnow --sitemap') })
    })
  })
})

describe('astro-indexing indexnow', () => {
  let origin
  let site

  beforeEach(async () => {
    site = createSiteAndEndpoint()
    await new Promise((resolve) => site.server.listen(0, '127.0.0.1', resolve))
    origin = `http://127.0.0.1:${site.server.address().port}`
  })

  afterEach(async () => {
    await new Promise((resolve) => site.server.close(resolve))
  })

  async function createSite() {
    return createBuiltSite({
      [`${KEY}.txt`]: KEY,
      'sitemap-index.xml': sitemapIndexOf([`${origin}/sitemap-0.xml`]),
      'sitemap-0.xml': sitemapOf([`${origin}/`, `${origin}/about/`])
    })
  }

  it('is expected to submit the URLs given and exit 0', async () => {
    const clientDirectory = await createSite()

    const result = await runCommand([
      'indexnow',
      `${origin}/about/`,
      '--dir',
      clientDirectory,
      '--endpoint',
      `${origin}/indexnow`
    ])

    expect(result.code).toBe(0)
    expect(site.state.submissions).toEqual([{ host: new URL(origin).host, key: KEY, urlList: [`${origin}/about/`] }])
  })

  it('is expected to read dist/client from the working directory by default', async () => {
    const siteDirectory = await createBuiltSite({ [`dist/client/${KEY}.txt`]: KEY })

    const result = await runCommand(['indexnow', `${origin}/`, '--endpoint', `${origin}/indexnow`], siteDirectory)

    expect(result.code).toBe(0)
  })

  describe('--sitemap', () => {
    it("is expected to submit every URL in the built site's sitemap", async () => {
      const clientDirectory = await createSite()

      await runCommand(['indexnow', '--sitemap', '--dir', clientDirectory, '--endpoint', `${origin}/indexnow`])

      expect(site.state.submissions[0].urlList).toEqual([`${origin}/`, `${origin}/about/`])
    })

    describe('with URLs given as well', () => {
      it('is expected to exit 2 with the usage', async () => {
        const result = await runCommand(['indexnow', '--sitemap', `${origin}/`])

        expect(result).toMatchObject({ code: 2, output: expect.stringContaining('Usage') })
      })
    })
  })

  describe('--dry-run', () => {
    it('is expected to list the URLs and send nothing', async () => {
      const clientDirectory = await createSite()

      const result = await runCommand([
        'indexnow',
        '--sitemap',
        '--dry-run',
        '--dir',
        clientDirectory,
        '--endpoint',
        `${origin}/indexnow`
      ])

      expect(result).toMatchObject({ code: 0, output: expect.stringContaining(`${origin}/about/`) })
      expect(site.state.submissions).toEqual([])
    })
  })

  describe('with no URLs', () => {
    it('is expected to exit 2 with the usage', async () => {
      const result = await runCommand(['indexnow'])

      expect(result).toMatchObject({ code: 2, output: expect.stringContaining('Usage') })
    })
  })

  describe('with an unknown option', () => {
    it('is expected to exit 2 naming it', async () => {
      const result = await runCommand(['indexnow', '--sitmap'])

      expect(result).toMatchObject({ code: 2, output: expect.stringContaining('--sitmap') })
    })
  })

  describe('when the key file is not live yet', () => {
    it('is expected to exit 1, say so, and send nothing', async () => {
      site.state.keyIsLive = false
      const clientDirectory = await createSite()

      const result = await runCommand([
        'indexnow',
        `${origin}/`,
        '--dir',
        clientDirectory,
        '--endpoint',
        `${origin}/indexnow`
      ])

      expect(result).toMatchObject({ code: 1, output: expect.stringContaining('not live') })
      expect(site.state.submissions).toEqual([])
    })
  })

  describe('when IndexNow refuses the submission', () => {
    it('is expected to exit 1 with the reason', async () => {
      site.state.status = 429
      const clientDirectory = await createSite()

      const result = await runCommand([
        'indexnow',
        `${origin}/`,
        '--dir',
        clientDirectory,
        '--endpoint',
        `${origin}/indexnow`
      ])

      expect(result).toMatchObject({ code: 1, output: expect.stringContaining('too many requests') })
    })
  })

  describe('when the built site has no key file', () => {
    it('is expected to exit 1 with the message, not a stack trace', async () => {
      const clientDirectory = await createBuiltSite({ 'index.html': '' })

      const result = await runCommand(['indexnow', `${origin}/`, '--dir', clientDirectory])

      expect(result).toMatchObject({ code: 1, output: expect.stringContaining('No IndexNow key file found') })
      expect(result.output).not.toMatch(/^\s+at /m)
    })
  })
})
