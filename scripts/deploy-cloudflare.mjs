#!/usr/bin/env node
/**
 * Deploy Union to Cloudflare Pages.
 *
 *   CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… npm run deploy
 *   node scripts/deploy-cloudflare.mjs app|site|all
 *
 *   app  → union-app   (the installable PWA, dist/)
 *   site → union-site  (the marketing + docs site, dist-site/)
 *   all  → both
 *
 * The app deploy stages the signed APK and its checksum into dist/ so the same
 * host serves the installable PWA and the Android download. The site build
 * already includes the APK from release/.
 *
 * Credentials come from the environment only. Nothing here reads or writes a
 * secret, and no token is ever written into the build output.
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(new URL('.', import.meta.url)));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const branch = process.env.PAGES_BRANCH || 'main';

const targets = (() => {
  const given = process.argv[2] || process.env.DEPLOY_TARGET || 'app';
  if (given === 'all') return ['app', 'site'];
  if (given !== 'app' && given !== 'site') {
    console.error(`deploy: unknown target "${given}" — use app, site or all.`);
    process.exit(1);
  }
  return [given];
})();

if (!process.env.CLOUDFLARE_API_TOKEN && !process.env.CLOUDFLARE_API_KEY) {
  console.error('deploy: set CLOUDFLARE_API_TOKEN (and CLOUDFLARE_ACCOUNT_ID) first.');
  process.exit(1);
}
if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
  console.warn('deploy: CLOUDFLARE_ACCOUNT_ID is not set; wrangler will ask or use its saved config.');
}

function stageApk(dist) {
  const apkName = `Union-${pkg.version}.apk`;
  const apk = join(root, 'release', apkName);
  if (!existsSync(apk)) {
    console.log(`deploy: no release/${apkName}; deploying the web app only.`);
    return;
  }
  copyFileSync(apk, join(dist, apkName));
  const sum = createHash('sha256').update(readFileSync(apk)).digest('hex');
  const sums = join(dist, 'SHA256SUMS');
  const kept = existsSync(sums)
    ? readFileSync(sums, 'utf8')
        .split('\n')
        .filter((line) => line && !line.endsWith(`  ${apkName}`))
    : [];
  appendFileSync(sums, `${[...kept, `${sum}  ${apkName}`].join('\n')}\n`, { flag: 'w' });
  console.log(`deploy: staged ${apkName} (${sum.slice(0, 16)}…)`);
}

function deploy({ dist, project }) {
  if (!existsSync(join(dist, 'index.html'))) {
    console.error(`deploy: ${dist}/index.html is missing — run the matching build first.`);
    process.exit(1);
  }
  console.log(`deploy: ${project} ← ${dist}`);
  execFileSync(
    'npx',
    ['--yes', 'wrangler@4', 'pages', 'deploy', dist, '--project-name', project, '--branch', branch, '--commit-dirty=true'],
    { cwd: root, stdio: 'inherit' }
  );
}

for (const target of targets) {
  if (target === 'app') {
    const dist = join(root, 'dist');
    stageApk(dist);
    deploy({ dist, project: process.env.PAGES_PROJECT || 'union-app' });
  } else {
    deploy({ dist: join(root, 'dist-site'), project: process.env.PAGES_SITE_PROJECT || 'union-site' });
  }
}
