#!/usr/bin/env node
/**
 * Build the Union site: union.cculture.net
 *
 * The marketing page is hand-written in site/. The documentation is rendered
 * from docs/*.md so the repository and the published site cannot drift apart.
 *
 *   npm run build:site
 *
 * Output: dist-site/ (static, no runtime dependencies, no network fetches).
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import qrcode from 'qrcode-generator';
import { marked } from 'marked';

const root = dirname(fileURLToPath(new URL('.', import.meta.url)));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const out = join(root, 'dist-site');
const site = join(root, 'site');
const docsDir = join(root, 'docs');

const SITE_URL = process.env.SITE_URL || 'https://union.cculture.net/';
const APP_URL = process.env.APP_URL || 'https://union-app.cculture.net/';
const REPO = 'https://github.com/OriginLabs1/Union';
const RELEASE_URL = `${REPO}/releases/tag/v${version}`;
const YEAR = String(new Date().getFullYear());
const BUILT_AT = new Date();
const BUILD_DATE = BUILT_AT.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const BUILD_SHORT = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return 'dev';
  }
})();

/* ------------------------------------------------------------ markdown */

marked.setOptions({ gfm: true, breaks: false });

const slug = (text) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 70) || 'section';

function renderMarkdown(markdown) {
  const html = marked.parse(markdown);
  return html
    .replace(/<(h[234])>(.*?)<\/\1>/g, (_, tag, inner) => `<${tag} id="${slug(inner)}">${inner}</${tag}>`)
    .replace(/<a href="([^"]+)">/g, (match, href) => {
      let target = href;
      if (/^\.\.\/docs\/[^/]+\.md(?:#.*)?$/.test(target)) {
        target = target.replace(/^\.\.\/docs\//, '').replace(/\.md/, '');
      } else if (/^\.\.\//.test(target)) {
        const path = target.replace(/^\.\.\//, '');
        const kind = path.endsWith('/') ? 'tree' : 'blob';
        target = `${REPO}/${kind}/main/${path}`;
      } else if (/^[^/]+\.md(?:#.*)?$/.test(target)) {
        target = target.replace(/\.md/, '');
      }
      if (target === 'release-notes-0.1.0') target = 'release-notes';
      if (/^[^/]+\.html(?:#.*)?$/.test(target)) target = target.replace(/\.html/, '');
      const external = /^https?:\/\//.test(target);
      return external
        ? `<a href="${target}" target="_blank" rel="noopener noreferrer">`
        : `<a href="${target}">`;
    });
}

/** Pull the leading H1 out of a document so the page can own its heading. */
function extractTitle(markdown, fallback) {
  const match = markdown.match(/^#\s+(.+?)\s*$/m);
  if (!match) return { title: fallback, body: markdown };
  return {
    title: match[1].trim(),
    body: markdown.replace(match[0], '').replace(/^\s*\n/, '')
  };
}

/* --------------------------------------------------------------- pages */

const DOCS = [
  {
    slug: 'architecture',
    file: 'architecture.md',
    title: 'Architecture',
    desc: 'How the Svelte app, Rust core, Android shell and optional relay fit together.'
  },
  {
    slug: 'privacy',
    file: 'privacy.md',
    title: 'Privacy',
    desc: 'Keys, sealed envelopes, encrypted backups and the threat model, without euphemism.'
  },
  {
    slug: 'economy',
    file: 'economy.md',
    title: 'Economy',
    desc: 'Activation, reactivation, Joy/Giving and what test mode actually means.'
  },
  {
    slug: 'relay',
    file: 'relay.md',
    title: 'Relay',
    desc: 'Run the optional Cloudflare Worker and D1 database yourself.'
  },
  {
    slug: 'build',
    file: 'build.md',
    title: 'Build',
    desc: 'The web build, the Android toolchain and the signed package.'
  },
  {
    slug: 'design',
    file: 'design.md',
    title: 'Design',
    desc: 'Lumen: type, colour, surfaces, motion and the reasons behind them.'
  },
  {
    slug: 'distribution',
    file: 'distribution.md',
    title: 'Distribution',
    desc: 'Pages, releases, domains and the checks that come before a deploy.'
  },
  {
    slug: 'release-notes',
    file: 'release-notes.md',
    title: 'Release notes',
    desc: `What changed in ${version}, and what did not.`
  },
  {
    slug: 'release-notes-0.0.1',
    file: 'release-notes-0.0.1.md',
    title: 'Union v0.0.1',
    desc: 'The first usable release, kept for the record.'
  },
  {
    slug: 'security',
    file: join(root, 'SECURITY.md'),
    title: 'Security',
    desc: 'How to report a vulnerability, and what is in scope.'
  }
];

const NAV_DOCS = DOCS.filter((doc) => doc.slug !== 'release-notes-0.0.1');

const esc = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const header = (prefix) => `
<header class="site-head" id="site-head">
  <div class="wrap head-inner">
    <a class="brand" href="${prefix || './'}" aria-label="Union home">
      <svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M20 14.25V37.75A12 12 0 0 0 44 37.75V14.25" fill="none" stroke="currentColor" stroke-width="7.6"/>
        <path d="M32 34.55 37.2 39.75 32 44.95 26.8 39.75Z" fill="var(--gold)"/>
      </svg>
      <span class="brand-word">Union</span>
    </a>
    <nav class="nav" id="nav" aria-label="Primary">
      <a href="${prefix}#what">What it is</a>
      <a href="${prefix}#practice">Practice</a>
      <a href="${prefix}#inside">Inside</a>
      <a href="${prefix}#privacy">Privacy</a>
      <a href="${prefix}#install">Install</a>
      <a href="${prefix}docs/">Documentation</a>
    </nav>
    <div class="head-actions">
      <button class="iconbtn" id="theme-toggle" type="button" aria-label="Switch colour theme" title="Switch colour theme">
        <svg class="icon theme-sun" aria-hidden="true"><use href="#i-sun"/></svg>
        <svg class="icon theme-moon" aria-hidden="true"><use href="#i-moon"/></svg>
      </button>
      <a class="btn primary sm" href="${APP_URL}">Open Union <svg class="icon" aria-hidden="true"><use href="#i-arrow-right"/></svg></a>
      <button class="iconbtn menu-btn" id="menu-btn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="nav">
        <svg class="icon" aria-hidden="true"><use href="#i-menu"/></svg>
      </button>
    </div>
  </div>
</header>`;

const footer = (prefix) => `
<footer class="site-foot">
  <div class="wrap foot-grid">
    <div class="foot-brand">
      <a class="brand" href="${prefix || './'}" aria-label="Union home">
        <svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
          <path d="M20 14.25V37.75A12 12 0 0 0 44 37.75V14.25" fill="none" stroke="currentColor" stroke-width="7.6"/>
          <path d="M32 34.55 37.2 39.75 32 44.95 26.8 39.75Z" fill="var(--gold)"/>
        </svg>
        <span class="brand-word">Union</span>
      </a>
      <p>A local-first app for the ordinary parts of a life. Built by Origin Labs. Licensed AGPL-3.0-only.</p>
    </div>
    <div class="foot-col">
      <h2>App</h2>
      <a href="${APP_URL}">Open Union</a>
      <a href="${prefix}#install">Android APK</a>
      <a href="${prefix}docs/build">Build from source</a>
      <a href="${prefix}docs/release-notes">Release notes</a>
    </div>
    <div class="foot-col">
      <h2>Documentation</h2>
      <a href="${prefix}docs/architecture">Architecture</a>
      <a href="${prefix}docs/privacy">Privacy</a>
      <a href="${prefix}docs/economy">Economy</a>
      <a href="${prefix}docs/relay">Relay</a>
      <a href="${prefix}docs/">All documentation</a>
    </div>
    <div class="foot-col">
      <h2>Project</h2>
      <a href="${REPO}">GitHub <svg class="icon" aria-hidden="true"><use href="#i-external"/></svg></a>
      <a href="${REPO}/releases">Releases <svg class="icon" aria-hidden="true"><use href="#i-external"/></svg></a>
      <a href="${prefix}docs/security">Security</a>
      <a href="${REPO}/blob/main/LICENSE">License <svg class="icon" aria-hidden="true"><use href="#i-external"/></svg></a>
    </div>
  </div>
  <div class="wrap foot-base">
    <span>© ${YEAR} Origin Labs</span>
    <span class="foot-mark"><svg class="icon" aria-hidden="true"><use href="#i-hash"/></svg> ${BUILD_SHORT} · built ${BUILD_DATE}</span>
  </div>
</footer>`;

/* The icon sprite is duplicated into generated pages by reading it once from
   the hand-written home page, so there is exactly one source of truth. */
const homeSource = readFileSync(join(site, 'index.html'), 'utf8');
const spriteMatch = homeSource.match(/<svg class="sprite"[\s\S]*?<\/svg>/);
const sprite = spriteMatch ? spriteMatch[0] : '';

function page({ title, desc, canonical, prefix, body, bodyClass = '', scripts = true }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="theme-color" content="#f4f1ea" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#101116" media="(prefers-color-scheme: dark)">
  <meta name="color-scheme" content="light dark">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="${bodyClass === 'doc' ? 'article' : 'website'}">
  <meta property="og:site_name" content="Union">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${SITE_URL}assets/og.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${SITE_URL}assets/og.jpg">
  <link rel="icon" href="${prefix}icons/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="${prefix}icons/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="${prefix}icons/apple-touch-icon.png">
  <link rel="manifest" href="${prefix}manifest.webmanifest">
  <link rel="stylesheet" href="${prefix}styles.css">
  <script>
    try {
      const saved = localStorage.getItem('union-theme');
      if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
    } catch {}
  </script>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
<a class="skip" href="#main">Skip to content</a>
${sprite}
${header(prefix)}
${body}
${footer(prefix)}
${scripts ? `<script src="${prefix}app.js" defer></script>` : ''}
</body>
</html>
`;
}

function docNavigation(current) {
  return NAV_DOCS.map(
    (doc) =>
      `<a href="${doc.slug}"${doc.slug === current ? ' aria-current="page"' : ''}>${esc(doc.title)}</a>`
  ).join('\n        ');
}

function docPage(doc, markdown) {
  const { title, body: markdownBody } = extractTitle(markdown, doc.title);
  const html = renderMarkdown(markdownBody);
  const headings = [...html.matchAll(/<h2 id="([^"]+)">(.*?)<\/h2>/g)].map((match) => ({
    id: match[1],
    text: match[2].replace(/<[^>]+>/g, '')
  }));
  const onThisPage = headings.length
    ? `<nav aria-label="On this page"><h2>On this page</h2>${headings
        .map((heading) => `<a href="#${heading.id}">${esc(heading.text)}</a>`)
        .join('')}</nav>`
    : '';
  const index = DOCS.findIndex((item) => item.slug === doc.slug);
  const previous = DOCS[index - 1];
  const next = DOCS[index + 1];

  const body = `<main id="main">
  <div class="wrap doc-shell">
    <aside class="doc-side">
      <nav aria-label="Documentation">
        <h2>Documentation</h2>
        ${docNavigation(doc.slug)}
      </nav>
      ${onThisPage}
      <div class="side-cta">
        <p>Union ${version} is local-first, and the relay is optional.</p>
        <a class="text-link" href="${APP_URL}">Open the app <svg class="icon" aria-hidden="true"><use href="#i-arrow-right"/></svg></a>
      </div>
    </aside>
    <article class="doc-main">
      <div class="breadcrumb"><a href="../">Union</a> <svg class="icon" aria-hidden="true"><use href="#i-chevron-right"/></svg> <a href="./">Documentation</a></div>
      <h1>${esc(title)}</h1>
      <p class="doc-dek">${esc(doc.desc)}</p>
      <div class="doc-meta"><span>Union ${version}</span><span>Updated ${BUILD_DATE}</span><span>AGPL-3.0-only</span></div>
      <div class="prose">
        ${html}
      </div>
      <div class="doc-foot">
        ${previous ? `<a href="${previous.slug}"><svg class="icon" aria-hidden="true"><use href="#i-arrow-left"/></svg> ${esc(previous.title)}</a>` : '<span></span>'}
        ${next ? `<a href="${next.slug}">${esc(next.title)} <svg class="icon" aria-hidden="true"><use href="#i-arrow-right"/></svg></a>` : '<span></span>'}
      </div>
    </article>
  </div>
</main>`;

  return page({
    title: `${title} — Union`,
    desc: doc.desc,
    canonical: `${SITE_URL}docs/${doc.slug}`,
    prefix: '../',
    body,
    bodyClass: 'doc'
  });
}

function docsIndexPage() {
  const cards = NAV_DOCS.map(
    (doc) => `<a class="doc-index-card" href="${doc.slug}">
      <h2>${esc(doc.title)}</h2>
      <p>${esc(doc.desc)}</p>
      <span class="meta">docs/${doc.slug}</span>
    </a>`
  ).join('\n    ');

  const body = `<main id="main">
  <section class="docs-hero">
    <div class="wrap">
      <p class="eyebrow"><span class="dot"></span> Documentation</p>
      <h1>The parts that should be written down.</h1>
      <p>Architecture, privacy, the economy, the optional relay and the build. Written for someone who wants to check the claims, not just repeat them.</p>
    </div>
  </section>
  <div class="wrap">
    <div class="docs-index">
      ${cards}
    </div>
  </div>
</main>`;

  return page({
    title: 'Documentation — Union',
    desc: 'Architecture, privacy, economy, relay, build and distribution notes for Union.',
    canonical: `${SITE_URL}docs/`,
    prefix: '../',
    body,
    bodyClass: 'doc'
  });
}

/* -------------------------------------------------------------- assets */

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
mkdirSync(join(out, 'docs'), { recursive: true });
mkdirSync(join(out, 'icons'), { recursive: true });
mkdirSync(join(out, 'assets'), { recursive: true });
mkdirSync(join(out, 'downloads'), { recursive: true });

for (const file of ['styles.css', 'app.js']) {
  copyFileSync(join(site, file), join(out, file));
}

cpSync(join(root, 'public/icons'), join(out, 'icons'), { recursive: true });
cpSync(join(root, 'src/assets/fonts'), join(out, 'assets/fonts'), { recursive: true });
cpSync(join(site, 'assets'), join(out, 'assets'), { recursive: true });

/* ------------------------------------------------------------- the APK */

const apkName = `Union-${version}.apk`;
const apkSource = join(root, 'release', apkName);
let apkSha = '';
let apkSize = 'check the release page';
let apkUrl = RELEASE_URL;

if (existsSync(apkSource)) {
  const bytes = readFileSync(apkSource);
  apkSha = createHash('sha256').update(bytes).digest('hex');
  const kb = bytes.length / 1024;
  apkSize = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
  copyFileSync(apkSource, join(out, 'downloads', apkName));
  apkUrl = `downloads/${apkName}`;
  writeFileSync(join(out, 'SHA256SUMS'), `${apkSha}  ${apkName}\n`);
  console.log(`site: staged ${apkName} (${apkSize}, ${apkSha.slice(0, 16)}…)`);
} else {
  apkSha = 'Not built in this tree — see the release page.';
  console.warn(`site: release/${apkName} not found; download points to GitHub.`);
}

/* ---------------------------------------------------------------- QR */

const qr = qrcode(0, 'M');
qr.addData(APP_URL);
qr.make();
const qrSvg = qr
  .createSvgTag({ cellSize: 4, margin: 0, scalable: true })
  .replace('<svg ', '<svg role="img" aria-label="QR code for Union" shape-rendering="crispEdges" ')
  .replace('fill="white"', 'fill="#ffffff"')
  .replace('fill="black"', 'fill="#17181d"');
mkdirSync(join(out, 'assets/brand'), { recursive: true });
writeFileSync(join(out, 'assets/brand/qr-app.svg'), `${qrSvg}\n`);

/* ------------------------------------------------------------- tokens */

const tokens = {
  '{{VERSION}}': version,
  '{{SITE_URL}}': SITE_URL,
  '{{APP_URL}}': APP_URL,
  '{{REPO}}': REPO,
  '{{RELEASE_URL}}': RELEASE_URL,
  '{{APK_SIZE}}': apkSize,
  '{{APK_SHA}}': apkSha,
  '{{APK_URL}}': apkUrl,
  '{{BUILD_SHORT}}': BUILD_SHORT,
  '{{BUILD_DATE}}': BUILD_DATE,
  '{{YEAR}}': YEAR
};

const stamp = (text) => {
  let result = text;
  for (const [token, value] of Object.entries(tokens)) result = result.replaceAll(token, value);
  const left = result.match(/\{\{[A-Z_]+\}\}/g);
  if (left) console.warn(`site: unreplaced tokens: ${[...new Set(left)].join(', ')}`);
  return result;
};

/* ---------------------------------------------------------------- home */

let home = homeSource;
home = home.replace(
  'content="Union is a local-first app for messages, rooms, learning, plans and records. Your identity and keys stay on your device. The network is optional."',
  'content="Union is a local-first app for messages, rooms, learning, plans and records. Your identity and keys stay on your device. The network is optional."'
);
writeFileSync(join(out, 'index.html'), stamp(home));

/* ---------------------------------------------------------------- docs */

for (const doc of DOCS) {
  const file = doc.file.startsWith('/') ? doc.file : join(docsDir, doc.file);
  if (!existsSync(file)) {
    console.warn(`site: missing docs source ${relative(root, file)}`);
    continue;
  }
  const markdown = readFileSync(file, 'utf8');
  writeFileSync(join(out, 'docs', `${doc.slug}.html`), stamp(docPage(doc, markdown)));
  console.log(`site: docs/${doc.slug}.html`);
}

writeFileSync(join(out, 'docs', 'index.html'), stamp(docsIndexPage()));

/* ----------------------------------------------------------- manifest */

const manifest = {
  name: 'Union',
  short_name: 'Union',
  description: 'A local-first app for messages, rooms, learning, plans and records.',
  id: '/',
  start_url: '/',
  scope: '/',
  display: 'browser',
  background_color: '#f4f1ea',
  theme_color: '#101116',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
};
writeFileSync(join(out, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);

/* -------------------------------------------------------------- 404 */

const notFound = `<main id="main" class="wrap notfound">
  <div>
    <p class="eyebrow"><span class="dot"></span> 404</p>
    <h1>This page is not here.</h1>
    <p>The link may be old, or the page may have moved. The app and the documentation are still where they should be.</p>
    <div class="hero-actions" style="justify-content:center">
      <a class="btn primary" href="./">Return home <svg class="icon" aria-hidden="true"><use href="#i-arrow-right"/></svg></a>
      <a class="btn soft" href="docs/">Read the documentation</a>
    </div>
  </div>
</main>`;

writeFileSync(
  join(out, '404.html'),
  page({
    title: 'Page not found — Union',
    desc: 'This page is not here.',
    canonical: `${SITE_URL}404.html`,
    prefix: './',
    body: notFound
  })
);

/* ------------------------------------------------------------ metadata */

const pages = ['index.html', '404.html', 'docs/index.html', ...DOCS.filter((doc) => existsSync(doc.file.startsWith('/') ? doc.file : join(docsDir, doc.file))).map((doc) => `docs/${doc.slug}.html`)];
const buildInfo = {
  surface: 'union-site',
  version,
  commit: BUILD_SHORT,
  builtAt: BUILT_AT.toISOString(),
  pages,
  apk: existsSync(apkSource) ? { name: apkName, sha256: apkSha, bytes: statSync(apkSource).size } : null
};
writeFileSync(join(out, 'build.json'), `${JSON.stringify(buildInfo, null, 2)}\n`);

const today = BUILT_AT.toISOString().slice(0, 10);
const urls = [
  SITE_URL,
  `${SITE_URL}docs/`,
  ...pages.filter((p) => p.startsWith('docs/') && p !== 'docs/index.html').map((p) => `${SITE_URL}${p.replace(/\.html$/, '')}`)
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`;
writeFileSync(join(out, 'sitemap.xml'), sitemap);
writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}sitemap.xml\n`);

/* --------------------------------------------------------------- report */

function size(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    total += entry.isDirectory() ? size(path) : statSync(path).size;
  }
  return total;
}

console.log(`\nunion-site ${version} → dist-site/ (${(size(out) / 1024 / 1024).toFixed(1)} MB, ${pages.length + 1} pages)`);
console.log(`home: ${SITE_URL}`);
console.log(`app:  ${APP_URL}`);
