# Union v0.1.0 — the first release with a name and a place

**Version 0.1.0** is the first release meant to be installed and used, rather than demonstrated. It is the same local-first app as 0.0.1, with a new identity, a real download page, and a cleaner split between the product and its documentation.

## What changed

### A new mark

The old logo is gone. The new mark is a single geometric **U** — two equal arms joined into one body — holding a small champagne keystone. It is drawn from one set of coordinates, so the same shape appears in the website, the PWA icons, the maskable icons, the Apple touch icon, the Android adaptive icon and the Android legacy launcher icon.

The palette stays close to Lumen: deep lacquer, porcelain, one ultramarine signal, and champagne for value. No gradients were added just to look expensive; the depth is in the material, not in the ornament.

### Two addresses, two jobs

- **https://union.cculture.net** — what Union is, how to install it, and the documentation.
- **https://union-app.cculture.net** — the installable web app.

Both serve the same version. The marketing site does not pretend to be the app, and the app does not carry a sales page.

### Android package

- Version `0.1.0`, `versionCode 2`.
- New adaptive icon foreground and legacy launcher icons.
- Still one permission: `INTERNET`.
- Still signed with the Union release key. The certificate fingerprint is printed on the download page and in `SHA256SUMS`.

### Documentation

The site now renders the documentation from `docs/`:

- [Architecture](architecture.html)
- [Privacy and threat model](privacy.html)
- [Activation and the economy](economy.html)
- [The optional relay](relay.html)
- [Build](build.html)
- [Design](design.html)
- [Distribution](distribution.html)
- [Security policy](security.html)

## What did not change

- Identity keys are still generated on the device and never sent to a server.
- Messages are still sealed before they reach a relay.
- Backups are still encrypted with PBKDF2-SHA256 at 310,000 iterations and AES-256-GCM.
- The economic layer is still **test mode**. No real funds move inside the app, and no withdrawable value is promised.
- Delivery is still store-and-forward, not push.
- There is still no multi-device key sync. Encrypted backups are the bridge.

## Install

### Android

Download `Union-0.1.0.apk`, check its SHA-256 against the release checksum, and install it. Android 9 or newer. Android will warn about installing from outside a store; that warning is expected.

### Web

Open **https://union-app.cculture.net** and choose **Add to Home screen**. The shell, fonts and WASM core are cached after the first load.

## Verify

```sh
sha256sum Union-0.1.0.apk
apksigner verify --print-certs Union-0.1.0.apk
```

Signing certificate (SHA-256):

```
35:58:51:C9:DB:74:76:8F:8C:2B:E7:F3:79:38:0B:7B:F9:68:AB:9C:F5:F3:6A:91:3E:F5:FA:CB:DB:81:F9:42
```

If the checksum or certificate does not match, stop.

## Known limits

- One identity, one device. Multi-device sync is not implemented.
- Relay delivery waits until the app is opened or Sync is tapped.
- The economy is test mode.
- The Android app is sideloaded; there is no Play Store listing.
- The local assistant works without a provider. Remote inference is optional and configured by you.
- Activation proof review is partly manual: the app packages the proof, and a person reviews it.

## Thanks

To everyone who used 0.0.1 and said which parts were unclear. The honesty in this release — about metadata, test mode, and what is missing — came from those conversations.

Historical notes for the previous build: [v0.0.1](release-notes-0.0.1.html).
