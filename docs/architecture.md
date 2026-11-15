# Architecture

Union is four pieces that share one source tree: a Svelte app, a small Rust core compiled to WebAssembly, an Android shell that serves the same web build from loopback, and an optional Cloudflare relay. Nothing in the app requires the relay.

## The shape of a build

```
src/                  Svelte 5 screens, state and crypto
src/lib/crypto.ts     Ed25519, X25519, HKDF, AES-GCM, cards, backups
src/lib/store.svelte.ts  records, economy, sync, outbox, audit
rust/union-core/      hashing and byte helpers, compiled to WASM
public/               manifest, icons, service worker, union_core.wasm
android/              Java WebView shell, resources, build scripts
server/               Cloudflare Worker relay, D1 schema, tests
site/                 this marketing and documentation site
```

`npm run build` produces a static `dist/`. Vite is configured with `base: './'`, so the same output works at a domain root, under a path, and from the APK's loopback origin without a second build.

## What runs where

| Layer | Runs on | Responsibility |
| --- | --- | --- |
| Svelte app | Browser or Android WebView | Screens, routing, local state, orchestration |
| Rust core (WASM) | Same thread as the app | Hashing and byte operations; optional accelerator |
| IndexedDB | Device | Identity, contacts, messages, records, outbox, ledger |
| Android shell | Device | Asset server on loopback, Keystore-wrapped secrets, share, file picker |
| Relay | Cloudflare Worker + D1 | Signed card directory, sealed envelope queue, public rooms, link resolution |

The app is deliberately boring about storage. A record is written to IndexedDB, then the UI reads it back. There is no in-memory source of truth that can drift from what is on the device.

## Identity

An identity is an Ed25519 signing key pair and an X25519 message key pair, generated locally. The identity id is derived from the signing public key and written as `did:union:<base58>`. There is no registration step and no server-side account.

A **card** is a small signed document: id, handle, display name, signing public key, message public key, and a timestamp. Anyone holding the card can verify it without asking Union. That is the whole point of publishing a card rather than a profile row.

Handle uniqueness, when a relay is used, is a convenience. The relay stores the latest signed card for a handle. A card that does not verify is rejected; a card cannot be edited by the relay without breaking its signature.

## Sealing a message

1. The sender derives a shared secret with X25519 using their message private key and the recipient's message public key.
2. HKDF-SHA256 expands that secret into a message key.
3. The body and attachments are encrypted with AES-256-GCM.
4. The envelope carries routing fields, a nonce and ciphertext.
5. If a relay is configured, the envelope is queued. If not, it stays in the local outbox.

The relay sees sender, recipient, timestamp and ciphertext size. It does not see the body. It can drop or delay an envelope; it cannot read or forge one. This is stated in the app and in [privacy](privacy.html) rather than softened into a slogan.

Delivery states are literal:

- **Queued** — written here, not yet handed over.
- **Sent** — the relay accepted the sealed envelope.
- **Delivered** — the recipient's device acknowledged it.
- **Failed** — retry, or check the relay configuration.

## Consent and contact

A connection request carries the scopes one person is asking for. Accepting writes a consent record; revoking a scope writes another. Scopes are checked when the app composes or reads the relevant kind of record. Contact is not permission, and the UI does not pretend otherwise.

The practice contact, Echo, has no device and no private keys. It exists so a person can walk through the consent flow without involving anyone else.

## Local records

The app keeps:

- messages and attachments,
- contacts and consent scopes,
- rooms and posts,
- courses, lessons and practice answers,
- experiences and mentorship commitments,
- economic plans and a hash-chained ledger,
- audit entries and outbox state,
- an encrypted backup envelope.

Records are local by default. Public room posts, signed cards and sealed messages are the only things the app sends, and each has an explicit action behind it.

## Economy

The ledger is a local hash chain. Each entry includes the previous hash, the entry body and a timestamp, so a later edit breaks the chain and is visible. In v0.1.0 the economy is **test mode**: plans and records are real, funds are not. The app labels this on every economic screen.

Activation requests package a proof — an image or text receipt — hash it with SHA-256, and open the Union Assistant with the package ready to send. Verification is a human step, not an automatic one.

## Relay

The relay is a Cloudflare Worker with a D1 database. Every write is signed by the caller over the method, path, timestamp and body hash with Ed25519. The Worker verifies the signature, verifies the card, checks that the identity id is derived from the signing key, and only then writes.

It provides:

- handle lookup by signed card,
- store-and-forward queues for sealed envelopes,
- public room posts,
- resolvable `/l/<id>` links.

It is optional and self-hostable. [Relay](relay.html) has the deployment steps.

## Android shell

The shell is a small Java WebView, built without Gradle.

- It serves the packaged web build from `http://127.0.0.1:<ephemeral port>`, bound to loopback only.
- It exposes a narrow JavaScript bridge: secret storage, share/copy, `https` external links, theme colour, exit, and save-to-Downloads.
- Secrets are wrapped with an AES-256-GCM key held by the Android Keystore, so a copied preferences file is useless on another device.
- `allowFileAccess=false`, no universal file URL access, no mixed content.
- `allowBackup=false`; backups are Union's own encrypted files.
- One permission: `INTERNET`. It is used by the loopback asset server and the optional relay.

`file://` would give an opaque origin with no IndexedDB and no service worker. The loopback server exists to give the app a real origin without putting assets on a network.

## Service worker

The service worker caches the shell, icons, fonts and WASM core. It does not cache relay responses or user records; those live in IndexedDB. A new build changes the cache name, so an old shell cannot quietly serve a new page with stale assets.

## What is intentionally missing

- Multi-device key sync. Encrypted backups are the bridge.
- Real-time push. Delivery is store-and-forward; the app syncs when opened or when you tap Sync.
- A production economy. Test mode is labelled.
- A Play Store listing. The APK is signed, checksummed and published on GitHub.

These are limits, not roadmap promises.

## Reading order

If you are evaluating the security model, read [privacy](privacy.html) and `src/lib/crypto.ts`. If you are running it, read [build](build.html) and [relay](relay.html). If you are changing the interface, read [design](design.html).
