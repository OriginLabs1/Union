# Distribution

Union ships from one source to four places:

1. **https://union.cculture.net** — the project site: what Union is, install links, and the documentation.
2. **https://union-app.cculture.net** — the installable PWA (Cloudflare Pages project `union-app`).
3. **Signed APK** — GitHub Releases and the project site's `downloads/` folder.
4. **Cloudflare Worker + D1** — the optional relay.

The site and the app are separate Pages projects on purpose. A documentation deploy should not risk the installable app, and the app should not carry a sales page.

## Surfaces

| Surface | Where it lives | Project |
| --- | --- | --- |
| Project site + docs | <https://union.cculture.net> | `union-site` |
| PWA | <https://union-app.cculture.net> | `union-app` |
| PWA fallback | <https://union-app-9ni.pages.dev> | `union-app` |
| Signed APK | <https://union.cculture.net/downloads/Union-0.1.0.apk> | `union-site` |
| Checksums | <https://union.cculture.net/SHA256SUMS> | `union-site` |
| GitHub release | <https://github.com/OriginLabs1/Union/releases/tag/v0.1.0> | GitHub |
| Relay | <https://union-relay.cculture.net> | Worker `union-relay` |

## Build and deploy

```sh
npm ci
npm run check
npm test
npm run test:relay

npm run build        # dist/       — the app
npm run build:site   # dist-site/  — the site and documentation

CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… npm run deploy
```

`npm run deploy` deploys the app by default. Explicit targets:

```sh
node scripts/deploy-cloudflare.mjs app    # union-app  ← dist/
node scripts/deploy-cloudflare.mjs site   # union-site ← dist-site/
node scripts/deploy-cloudflare.mjs all
```

The app deploy stages `release/Union-<version>.apk` and appends its SHA-256 to `dist/SHA256SUMS` before upload. The site build stages the same APK into `dist-site/downloads/` and writes `dist-site/SHA256SUMS`.

Override project names with `PAGES_PROJECT` (app) and `PAGES_SITE_PROJECT` (site). Override the branch with `PAGES_BRANCH`.

## Cloudflare Pages

Both projects are static. Vite uses `base: './'`, so `dist/` works at a domain root, under a path, and inside the APK's loopback server.

**union-app** has these custom hostnames:

- **https://union-app.cculture.net** — canonical app address
- **https://union-app-9ni.pages.dev** — always present, useful as a fallback

**union-site** has:

- **https://union.cculture.net** — canonical site address
- **https://union-site-ng4.pages.dev** — always present

DNS for both is a proxied CNAME in the `cculture.net` zone. The target is the project's `pages.dev` hostname. If a hostname serves a stale deployment, check the Pages custom-domain mapping first, then the DNS record.

### Moving `union.cculture.net` from the app to the site

The app project owned this hostname before the split. To move it without a gap:

1. Deploy `union-site` and confirm `union-site-ng4.pages.dev` serves the new pages.
2. Add `union.cculture.net` as a custom domain on `union-site`.
3. Remove `union.cculture.net` from `union-app` only after the new hostname is active.
4. Confirm the DNS CNAME points at `union-site-ng4.pages.dev`.

Do not delete the zone record. Re-point it. The certificate is issued per hostname by Cloudflare; a short pending state is normal.

## Signed APK

```sh
sh scripts/build-apk.sh
cd release
sha256sum -c SHA256SUMS
```

Current build:

- `Union-0.1.0.apk`
- 494,348 bytes
- SHA-256 `d5b2c3e4f9119d7b8ccf918fd5eb2d33560a1d4ec7ffb4bdb7f5f5ec3b387f07`
- `versionCode 2`, `minSdk 28`, `targetSdk 34`
- one permission: `android.permission.INTERNET`

The APK is signed with the Union release key. Certificate SHA-256:

```
35:58:51:C9:DB:74:76:8F:8C:2B:E7:F3:79:38:0B:7B:F9:68:AB:9C:F5:F3:6A:91:3E:F5:FA:CB:DB:81:F9:42
```

Publish that fingerprint with every release. Keep `android/keys/` backed up offline; losing it ends updates for anyone who installed the app.

### GitHub release

Tag `v0.1.0`, attach `Union-0.1.0.apk` and `SHA256SUMS`, and copy the notes from [release-notes.md](release-notes.html). Use one build for the site and the release: do not re-sign between uploads.

### Install honesty

Android warns about installing an app from outside a store. That warning is expected. Union asks for `INTERNET` only, and the download page says why. Never ask people to disable Play Protect.

## Other channels

GitHub Releases and this site are the channels that exist today. Here is the honest state of the rest.

| Channel | State | What it still needs |
| --- | --- | --- |
| F-Droid | Not submitted | A reproducible build from the tagged source, `metadata/` with description, categories, screenshots and licences, no proprietary blobs (there are none), and the release key kept stable across versions. |
| Google Play | Not submitted | A Play Console account, an app bundle signed with the upload key, the data-safety form (no collection, no ads, no analytics), a privacy policy URL, and listing graphics. |
| Obtainium | Works today | Nothing to publish: add `https://github.com/OriginLabs1/Union` and it follows GitHub releases. Useful for people who want updates without a store account. |
| Direct APK | Live | Keep `versionCode` increasing and the certificate unchanged. |

The rules are the same everywhere: one build per version signed by the same key, the certificate fingerprint published beside it, never a request to disable Play Protect, and the site download byte-identical to the release asset.

## Cloudflare relay

See [relay.md](relay.html). Short version:

```sh
cd server
npx wrangler@4 d1 create union-relay
npx wrangler@4 d1 execute union-relay --remote --file schema.sql
npx wrangler@4 deploy
```

`server/wrangler.toml` holds the D1 binding and the `union-relay.cculture.net` custom domain. Set `ALLOWED_ORIGINS` to the app origins before a production deploy.

## Pre-release checklist

- [ ] `npm run check` — 0 errors, 0 warnings
- [ ] `npm test` — 10/10
- [ ] `npm run test:relay` — 9/9
- [ ] `npm run build` — `dist/` complete, `SHA256SUMS` written
- [ ] `npm run build:site` — `dist-site/` complete, pages and links resolve
- [ ] Deploy the site, then the app
- [ ] `union.cculture.net` serves the site; `union-app.cculture.net` serves the app
- [ ] Preview both on a phone viewport
- [ ] Fresh install: onboarding → backup step → Home
- [ ] Activation request → trial → proof → verified (test mode)
- [ ] APK: signature verifies, one permission, `minSdk 28`, installs on a real device
- [ ] Screens: no horizontal overflow at 320 px
- [ ] Fonts load offline; no runtime font fetch
- [ ] Relay health, handle lookup, message send/ack (if deployed)
- [ ] No secrets, keystores, tokens, phone numbers or proofs in git
- [ ] `release/SHA256SUMS` and the certificate fingerprint are published
- [ ] GitHub release assets match the site download byte-for-byte

## Versioning

`package.json` and `android/app/src/main/AndroidManifest.xml` carry the version. `scripts/build-apk.sh` reads the version name from `package.json` and the version code from the manifest. For a new release, change both, then:

```sh
sh scripts/build-apk.sh
```

Android requires `versionCode` to increase for updates.
