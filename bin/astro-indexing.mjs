#!/usr/bin/env node
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import {
  DEFAULT_CLIENT_DIRECTORY,
  DEFAULT_ENDPOINT,
  findKey,
  hostOf,
  isKeyLive,
  readSitemapURLs,
  submitURLs
} from '../src/index.mjs'

const USAGE = `Usage: astro-indexing indexnow <url>... [options]
       astro-indexing indexnow --sitemap [options]

Submits URLs to IndexNow, using the key file in the built site (default: ${DEFAULT_CLIENT_DIRECTORY}).

Options:
  --sitemap          Submit every URL in the built site's sitemap instead of the URLs given
  --dir <path>       The built client directory holding the key file and sitemap
  --endpoint <url>   The IndexNow endpoint (default: ${DEFAULT_ENDPOINT})
  --dry-run          Print what would be submitted, and send nothing`

const [command, ...commandArguments] = process.argv.slice(2)

if (command === '--help' || command === '-h') {
  console.log(USAGE)
  process.exit(0)
}

if (command !== 'indexnow') {
  console.error(USAGE)
  process.exit(2)
}

let parsed
try {
  parsed = parseArgs({
    args: commandArguments,
    allowPositionals: true,
    options: {
      sitemap: { type: 'boolean', default: false },
      dir: { type: 'string', default: DEFAULT_CLIENT_DIRECTORY },
      endpoint: { type: 'string', default: DEFAULT_ENDPOINT },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false }
    }
  })
} catch (error) {
  console.error(`${error.message}\n\n${USAGE}`)
  process.exit(2)
}

const { values: options, positionals: givenURLs } = parsed

if (options.help) {
  console.log(USAGE)
  process.exit(0)
}

if (options.sitemap === givenURLs.length > 0) {
  console.error(USAGE)
  process.exit(2)
}

// A problem with the site or the URLs is reported as its message: a stack trace would read as a fault in this
// package.
try {
  const clientDirectory = resolve(options.dir)
  const key = await findKey(clientDirectory)
  const urls = options.sitemap ? await readSitemapURLs(clientDirectory) : givenURLs
  const host = hostOf(urls)

  if (options['dry-run']) {
    console.log(`Would submit ${urls.length} URL(s) for ${host} to ${options.endpoint}, with key ${key}:`)
    for (const url of urls) console.log(`  ${url}`)
    process.exit(0)
  }

  const origin = new URL(urls[0]).origin
  if (!(await isKeyLive({ origin, key }))) {
    console.error(`The key file is not live at ${origin}/${key}.txt yet. Deploy the site with it, then submit again.`)
    process.exit(1)
  }

  const results = await submitURLs({ urls, key, endpoint: options.endpoint })
  for (const result of results) {
    console.log(`${result.count} URL(s) for ${host}: ${result.description} (HTTP ${result.status})`)
  }

  process.exit(results.every((result) => result.accepted) ? 0 : 1)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
