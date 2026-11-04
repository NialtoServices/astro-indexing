# @nialto-services/astro-indexing

Tells search engines about a built Astro site's pages, so they crawl new and changed pages promptly instead of
waiting to come across them.

It currently has one command, `indexnow`, which submits URLs to [IndexNow](https://www.indexnow.org). IndexNow
is a shared protocol: a submission sent to one participating search engine is passed on to all of them, which
today includes Bing, Yandex, Naver, Seznam and Yep. Bing's index also feeds DuckDuckGo, Yahoo and Ecosia.
Google does not take part in IndexNow; for Google, keep the sitemap registered in Search Console.

## Install

```sh
pnpm add -D @nialto-services/astro-indexing
```

## Setting up a site

IndexNow has no account or API key. A site proves a submission is its own by serving a key file: a text file
named after the key, at the site's root, containing the key. Search engines fetch it from the same host as the
URLs submitted and reject the submission if it is missing or does not match.

1. **Generate a key.** Any 8 to 128 letters, digits or dashes will do; a random 32-character hex string is
   typical:

   ```sh
   node -e "console.log(crypto.randomUUID().replaceAll('-', ''))"
   ```

2. **Add the key file to `public/`**, named `<key>.txt` and containing only the key. For a key of
   `0f3c9a7e5b2d4c6e8a1b3d5f7e9c2a4b`:

   ```sh
   echo 0f3c9a7e5b2d4c6e8a1b3d5f7e9c2a4b > public/0f3c9a7e5b2d4c6e8a1b3d5f7e9c2a4b.txt
   ```

   Astro copies everything in `public/` to the root of the built site, so it is served at
   `https://example.com/0f3c9a7e5b2d4c6e8a1b3d5f7e9c2a4b.txt`. Commit it: the key is not a secret. Anyone can
   read it, and it only validates URLs on the host that serves it, so all a copied key allows is telling search
   engines about your own pages.

3. **Deploy, then check the file is live:**

   ```sh
   curl https://example.com/0f3c9a7e5b2d4c6e8a1b3d5f7e9c2a4b.txt
   ```

4. **Add a script** to the site's `package.json`:

   ```json
   "indexnow": "astro-indexing indexnow"
   ```

Use one key per host. `example.com` and `www.example.com` are different hosts to IndexNow, so submit only the
one the site's canonical URLs use. The command finds the key itself, so the key file is the only place it is
written down.

## Submitting

The command reads the key file, and with `--sitemap` the sitemap, from the built site, so run `astro build`
first. The URLs must be live: submit after the deploy has gone out, not before.

Submit the pages that are new or have changed, such as a new article and the listing pages that now link to it:

```sh
pnpm indexnow https://example.com/insights/new-article/ https://example.com/insights/
```

Or submit every page in the sitemap, which suits a site's first submission or a change that touched every page:

```sh
pnpm indexnow --sitemap
```

Add `--dry-run` to either to see what would be sent without sending it.

Submit a page when it changes, not on every deploy. Search engines treat repeated submissions of unchanged pages
as noise, and may slow down or ignore a site that sends them.

### Options

| Option             | Default                             | Purpose                                                                   |
| ------------------ | ----------------------------------- | ------------------------------------------------------------------------- |
| `--sitemap`        |                                     | Submit every URL in the built sitemap instead of the URLs given           |
| `--dir <path>`     | `dist/client`                       | The built directory holding the key file and the sitemap                  |
| `--endpoint <url>` | `https://api.indexnow.org/indexnow` | The IndexNow endpoint; the default forwards to every participating engine |
| `--dry-run`        |                                     | Print what would be submitted, and send nothing                           |

`dist/client` is where an Astro site using the Cloudflare adapter writes its pages. A static site without an
adapter writes them to `dist`, so pass `--dir dist`. `--sitemap` reads the `sitemap-index.xml` that
`@astrojs/sitemap` writes.

### Before anything is sent

The command refuses, and sends nothing, when:

- the built site has no key file, or more than one;
- a URL is not an absolute `http` or `https` URL, or the URLs span more than one host;
- the key file is not yet live on the site, which would only earn a rejection.

### Responses

It submits up to 10,000 URLs per request and reports how IndexNow answered each one:

| HTTP | Meaning                                                                                                  |
| ---- | -------------------------------------------------------------------------------------------------------- |
| 200  | Accepted.                                                                                                |
| 202  | Received; the search engine will fetch the key file to validate it. Usual for a site's first submission. |
| 400  | Malformed request.                                                                                       |
| 403  | The key file was missing or did not match the key.                                                       |
| 422  | A URL does not belong to the host, or the key does not match it.                                         |
| 429  | Too many requests. Wait before submitting again.                                                         |

Accepted means queued for crawling, not crawled or indexed. Bing Webmaster Tools lists the IndexNow submissions
it has received for a verified site.

The command exits 0 when every request was accepted, 1 when one was refused or something stopped it, and 2 for
a usage mistake.

## Programmatic use

The pieces the command uses are exported from the package root for a script of a site's own, such as a deploy
step that works out which pages changed:

```js
import { findKey, readSitemapURLs, submitURLs } from '@nialto-services/astro-indexing'

const key = await findKey('dist/client')
const results = await submitURLs({ urls: ['https://example.com/new-page/'], key })
```
