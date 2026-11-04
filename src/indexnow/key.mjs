/**
 * The site's IndexNow key, found in the built site rather than configured. The key file the site serves is
 * then the only place the key is written down, so the key submitted can never disagree with the one live.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const KEY_PATTERN = /^[A-Za-z0-9-]{8,128}$/

/** Whether a string meets IndexNow's key format: 8 to 128 letters, digits or dashes. */
export function isValidKey(candidate) {
  return KEY_PATTERN.test(candidate)
}

/**
 * The key whose file sits at the root of the built site: a `<key>.txt` holding exactly `<key>`. Requiring the
 * contents to match the name keeps an ordinary text file, such as `robots.txt`, from being taken for a key.
 */
export async function findKey(clientDirectory) {
  const entries = await readdir(clientDirectory, { withFileTypes: true }).catch((error) => {
    throw new Error(`Failed to read the built site at "${clientDirectory}". Run astro build first.`, { cause: error })
  })

  const candidates = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.txt'))
    .map((entry) => entry.name.slice(0, -'.txt'.length))
    .filter(isValidKey)

  const keys = []
  for (const candidate of candidates) {
    const contents = await readFile(join(clientDirectory, `${candidate}.txt`), 'utf-8')
    if (contents.trim() === candidate) keys.push(candidate)
  }

  if (keys.length === 0) {
    throw new Error(
      `No IndexNow key file found in "${clientDirectory}". Add public/<key>.txt containing the key, then rebuild.`
    )
  }

  if (keys.length > 1) {
    const names = keys.map((key) => `"${key}.txt"`).join(', ')
    throw new Error(`Found more than one IndexNow key file in "${clientDirectory}": ${names}. Keep one.`)
  }

  return keys[0]
}
