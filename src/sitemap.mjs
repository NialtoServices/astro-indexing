/**
 * The URLs a built site lists in its sitemap, read from the files `@astrojs/sitemap` writes: an index at
 * `sitemap-index.xml` naming one or more `sitemap-<n>.xml` files beside it.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Where `astro build` writes the files a site serves, relative to the site's root. */
export const DEFAULT_CLIENT_DIRECTORY = 'dist/client'

/** The sitemap index `@astrojs/sitemap` writes at the root of the built site. */
export const SITEMAP_INDEX_FILE = 'sitemap-index.xml'

const LOCATION_PATTERN = /<loc>\s*([^<\s]+)\s*<\/loc>/g

const XML_ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" }

/** Every `<loc>` in a sitemap or sitemap index, with XML entities decoded. */
export function extractLocations(xml) {
  return [...xml.matchAll(LOCATION_PATTERN)].map((match) =>
    match[1].replace(/&(amp|lt|gt|quot|apos);/g, (entity) => XML_ENTITIES[entity])
  )
}

/** Every page URL the built site's sitemaps list, in sitemap order. */
export async function readSitemapURLs(clientDirectory) {
  const indexPath = join(clientDirectory, SITEMAP_INDEX_FILE)
  const index = await readFile(indexPath, 'utf-8').catch((error) => {
    throw new Error(`Failed to read "${indexPath}". The site needs @astrojs/sitemap, and astro build run first.`, {
      cause: error
    })
  })

  const urls = []
  for (const sitemapURL of extractLocations(index)) {
    const sitemapPath = join(clientDirectory, new URL(sitemapURL).pathname)
    const sitemap = await readFile(sitemapPath, 'utf-8').catch((error) => {
      throw new Error(`Failed to read "${sitemapPath}", which the sitemap index lists as "${sitemapURL}"`, {
        cause: error
      })
    })

    urls.push(...extractLocations(sitemap))
  }

  return urls
}
