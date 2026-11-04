import { describe, expect, it } from 'vitest'
import { extractLocations, readSitemapURLs } from '../src/index.mjs'
import { createBuiltSite, sitemapIndexOf, sitemapOf } from './built-site.mjs'

describe('.extractLocations', () => {
  it('is expected to return every location in order', () => {
    const xml = sitemapOf(['https://example.com/', 'https://example.com/about/'])

    expect(extractLocations(xml)).toEqual(['https://example.com/', 'https://example.com/about/'])
  })

  it('is expected to decode XML entities', () => {
    expect(extractLocations('<loc>https://example.com/?a=1&amp;b=2</loc>')).toEqual(['https://example.com/?a=1&b=2'])
  })

  it('is expected to ignore whitespace around a location', () => {
    expect(extractLocations('<loc>\n  https://example.com/\n</loc>')).toEqual(['https://example.com/'])
  })
})

describe('.readSitemapURLs', () => {
  it('is expected to return the pages of every sitemap the index names', async () => {
    const clientDirectory = await createBuiltSite({
      'sitemap-index.xml': sitemapIndexOf(['https://example.com/sitemap-0.xml', 'https://example.com/sitemap-1.xml']),
      'sitemap-0.xml': sitemapOf(['https://example.com/', 'https://example.com/about/']),
      'sitemap-1.xml': sitemapOf(['https://example.com/contact/'])
    })

    expect(await readSitemapURLs(clientDirectory)).toEqual([
      'https://example.com/',
      'https://example.com/about/',
      'https://example.com/contact/'
    ])
  })

  describe('when the built site has no sitemap index', () => {
    it('is expected to say the site needs @astrojs/sitemap', async () => {
      const clientDirectory = await createBuiltSite({ 'index.html': '' })

      await expect(readSitemapURLs(clientDirectory)).rejects.toThrow('@astrojs/sitemap')
    })
  })

  describe('when the index names a sitemap the build does not hold', () => {
    it('is expected to name the missing sitemap', async () => {
      const clientDirectory = await createBuiltSite({
        'sitemap-index.xml': sitemapIndexOf(['https://example.com/sitemap-0.xml'])
      })

      await expect(readSitemapURLs(clientDirectory)).rejects.toThrow('https://example.com/sitemap-0.xml')
    })
  })
})
