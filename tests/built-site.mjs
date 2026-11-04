import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/** A built client directory holding the given files, keyed by their path relative to it. */
export async function createBuiltSite(files) {
  const clientDirectory = await mkdtemp(join(tmpdir(), 'astro-indexing-'))
  for (const [path, contents] of Object.entries(files)) {
    await mkdir(dirname(join(clientDirectory, path)), { recursive: true })
    await writeFile(join(clientDirectory, path), contents)
  }

  return clientDirectory
}

/** A sitemap index naming the given sitemap URLs, as `@astrojs/sitemap` writes one. */
export function sitemapIndexOf(sitemapURLs) {
  const entries = sitemapURLs.map((url) => `<sitemap><loc>${url}</loc></sitemap>`).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</sitemapindex>`
}

/** A sitemap listing the given page URLs. */
export function sitemapOf(pageURLs) {
  const entries = pageURLs.map((url) => `<url><loc>${url}</loc></url>`).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`
}
