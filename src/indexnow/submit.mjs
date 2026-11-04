/**
 * Sending URLs to IndexNow. Every participating search engine shares what it receives with the others, so one
 * endpoint reaches them all.
 */

/** The search-engine-neutral endpoint, which forwards to every participating engine. */
export const DEFAULT_ENDPOINT = 'https://api.indexnow.org/indexnow'

/** The most URLs IndexNow accepts in one request. */
export const MAX_URLS_PER_REQUEST = 10_000

const STATUS_DESCRIPTIONS = {
  200: 'accepted',
  202: 'received; the search engine will validate the key file before acting on it',
  400: 'rejected as malformed',
  403: 'rejected because the key file was missing or did not match the key',
  422: 'rejected because a URL does not belong to the host, or the key does not match it',
  429: 'rejected as too many requests; wait before submitting again'
}

/** A plain account of what an IndexNow response status means. */
export function describeStatus(status) {
  return STATUS_DESCRIPTIONS[status] ?? `answered with an unexpected HTTP ${status}`
}

/**
 * The one host every URL belongs to. IndexNow validates a request against a single host's key file, so a list
 * spanning hosts, or anything that isn't an http(s) URL, is refused before anything is sent.
 */
export function hostOf(urls) {
  if (urls.length === 0) throw new Error('There are no URLs to submit')

  const hosts = new Set()
  for (const url of urls) {
    let parsed
    try {
      parsed = new URL(url)
    } catch (error) {
      throw new Error(`"${url}" is not an absolute URL`, { cause: error })
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(`"${url}" is not an http or https URL`)
    }

    hosts.add(parsed.host)
  }

  if (hosts.size > 1) {
    const names = [...hosts].map((host) => `"${host}"`).join(', ')
    throw new Error(`The URLs span more than one host (${names}); submit each host's URLs separately`)
  }

  return [...hosts][0]
}

/** The URLs split into request-sized lists, duplicates dropped. */
export function batchURLs(urls, size = MAX_URLS_PER_REQUEST) {
  const unique = [...new Set(urls)]
  const batches = []
  for (let start = 0; start < unique.length; start += size) {
    batches.push(unique.slice(start, start + size))
  }

  return batches
}

/**
 * Whether the key file is live on the site. Search engines fetch it from there to validate a submission, so a
 * key file that is built but not yet deployed would only earn a 403.
 */
export async function isKeyLive({ origin, key, fetch = globalThis.fetch }) {
  const response = await fetch(new URL(`/${key}.txt`, origin)).catch(() => null)
  if (!response?.ok) return false

  return (await response.text()).trim() === key
}

/** Submits the URLs, one request per batch, and reports how each batch was answered. */
export async function submitURLs({ urls, key, endpoint = DEFAULT_ENDPOINT, fetch = globalThis.fetch }) {
  const host = hostOf(urls)

  const results = []
  for (const urlList of batchURLs(urls)) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, urlList })
    }).catch((error) => {
      throw new Error(`Failed to reach IndexNow at "${endpoint}"`, { cause: error })
    })

    const accepted = response.status === 200 || response.status === 202
    results.push({
      count: urlList.length,
      status: response.status,
      accepted,
      description: describeStatus(response.status)
    })
  }

  return results
}
