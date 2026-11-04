# CLAUDE.md

A public npm package that tells search engines about a built Astro site's pages. Its README ships to npm as the
package's documentation, including the setup each site needs.

## Hard rules

- **Tests never reach a real search engine.** A submission is an outward action on a real site's behalf, so tests
  stub `fetch` or point `--endpoint` at a local server.
- **Each service is its own subcommand with its own folder under `src/`**, such as `src/indexnow/`. What every
  service needs, such as reading the built sitemap, stays at the top of `src/`.

## Releasing

- **The owner cuts releases.** Don't tag or publish unless asked.
- **Releases publish from CI, never from a workstation.** Bump `version` in `package.json`, commit it as
  `Release <version>`, tag that commit `v<version>` and push the tag. The `publish` job in `.github/workflows/ci.yml`
  stages it on npm once `verify` passes, and it is installable only after the owner approves it.

## Verify before finishing

```bash
pnpm format:check
pnpm test
```
