#!/usr/bin/env node
/**
 * Generate Union's icon system.
 *
 * The mark is a single geometric "U" — two equal arms joined in one body —
 * holding a small champagne keystone. It is drawn as a signed-distance field
 * so the same geometry produces the SVG, the PWA icons, the maskable icons,
 * the Apple touch icon and the Android launcher foreground without any
 * external image library.
 *
 *   node scripts/gen-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(new URL('.', import.meta.url)));
const webDir = join(root, 'public/icons');
const androidDir = join(root, 'android/app/src/main/res');
const toolDir = join(root, 'site/assets/brand');
mkdirSync(webDir, { recursive: true });
mkdirSync(toolDir, { recursive: true });

/* ------------------------------------------------------------------ mark */

const MARK = {
  left: 20,
  right: 44,
  top: 14.25,
  base: 37.75,
  radius: 12,
  stroke: 7.6,
  diamond: 5.2,
  diamondY: 39.75
};

const INK = '#17181D';
const PORCELAIN = '#F6F4EF';
const GOLD = '#B07A24';
const GOLD_LIGHT = '#E2BC7B';

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const smooth = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const hex = (value) => [
  parseInt(value.slice(1, 3), 16),
  parseInt(value.slice(3, 5), 16),
  parseInt(value.slice(5, 7), 16)
];

function segment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : clamp01(((px - x1) * dx + (py - y1) * dy) / length);
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

/** Distance to the centre line of the U, minus half its weight. */
function uDistance(x, y) {
  const left = segment(x, y, MARK.left, MARK.top, MARK.left, MARK.base);
  const right = segment(x, y, MARK.right, MARK.top, MARK.right, MARK.base);
  let arc = Infinity;
  if (y >= MARK.base) arc = Math.abs(Math.hypot(x - 32, y - MARK.base) - MARK.radius);
  return Math.min(left, right, arc) - MARK.stroke / 2;
}

function coverage(distance, aa = 0.55) {
  return 1 - smooth(-aa, aa, distance);
}

/** Rotated square: |x| + |y| <= r. */
function diamondDistance(x, y) {
  return Math.abs(x - 32) + Math.abs(y - MARK.diamondY) - MARK.diamond;
}

function roundedBox(x, y, hw, hh, radius) {
  const qx = Math.abs(x - 32) - (hw - radius);
  const qy = Math.abs(y - 32) - (hh - radius);
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - radius;
}

/* --------------------------------------------------------------- raster */

function renderIcon(size, { maskable = false, fullBleed = false } = {}) {
  const ss = 4;
  const pixels = Buffer.alloc(size * size * 4);
  const markScale = maskable ? 0.72 : 0.88;
  const radius = fullBleed ? 0 : 14;

  const bgA = hex('#1B1E34');
  const bgB = hex('#07080D');
  const uColor = hex(PORCELAIN);
  const gemColor = hex(GOLD_LIGHT);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = ((px + (sx + 0.5) / ss) / size) * 64;
          const y = ((py + (sy + 0.5) / ss) / size) * 64;

          // The field: a deep lacquer with a slow lift toward the top-left.
          const t = clamp01((x * 0.5 + y * 0.5) / 64);
          let col = mix(bgA, bgB, t);
          const lift = clamp01(1 - Math.hypot(x - 22, y - 16) / 48) * 0.16;
          col = mix(col, [36, 40, 70], lift);

          let alpha = 1;
          if (radius > 0) alpha = coverage(roundedBox(x, y, 32, 32, radius), 0.6);

          // A single hairline catches the edge of the lacquer.
          if (radius > 0) {
            const edge = Math.abs(roundedBox(x, y, 32, 32, radius) + 0.35);
            const rim = coverage(edge - 0.18, 0.3) * 0.14;
            col = mix(col, [255, 255, 255], rim);
          }

          // Mark coordinates, scaled around the centre.
          const mx = (x - 32) / markScale + 32;
          const my = (y - 32) / markScale + 32;
          const aa = 0.55 / markScale;

          const u = coverage(uDistance(mx, my), aa);
          col = mix(col, uColor, u);

          const gem = coverage(diamondDistance(mx, my), aa);
          col = mix(col, gemColor, gem);

          r += col[0];
          g += col[1];
          b += col[2];
          a += alpha;
        }
      }

      const n = ss * ss;
      const i = (py * size + px) * 4;
      pixels[i] = Math.round(r / n);
      pixels[i + 1] = Math.round(g / n);
      pixels[i + 2] = Math.round(b / n);
      pixels[i + 3] = Math.round((a / n) * 255);
    }
  }
  return pixels;
}

/* ---------------------------------------------------------------- PNG */

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}
function png(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------------------------------------------------------------- SVG */

const uPath = `M${MARK.left} ${MARK.top}V${MARK.base}A${MARK.radius} ${MARK.radius} 0 0 0 ${MARK.right} ${MARK.base}V${MARK.top}`;
const gemPath = `M32 ${MARK.diamondY - MARK.diamond}L${32 + MARK.diamond} ${MARK.diamondY}L32 ${MARK.diamondY + MARK.diamond}L${32 - MARK.diamond} ${MARK.diamondY}Z`;

function markSvg(stroke = INK, gem = GOLD, scale = 1, extra = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Union">
  <g transform="translate(32 32) scale(${scale}) translate(-32 -32)"${extra}>
    <path d="${uPath}" fill="none" stroke="${stroke}" stroke-width="${MARK.stroke}" stroke-linecap="butt"/>
    <path d="${gemPath}" fill="${gem}"/>
  </g>
</svg>`;
}

function tileSvg({ scale = 0.88, maskable = false } = {}) {
  const radius = maskable ? 0 : 14;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Union">
  <defs>
    <linearGradient id="field" x1="8" y1="5" x2="57" y2="61" gradientUnits="userSpaceOnUse">
      <stop stop-color="#1B1E34"/><stop offset="1" stop-color="#07080D"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="${radius}" fill="url(#field)"/>
  ${radius ? `<rect x=".5" y=".5" width="63" height="63" rx="13.75" fill="none" stroke="#fff" stroke-opacity=".1"/>` : ''}
  <g transform="translate(32 32) scale(${scale}) translate(-32 -32)">
    <path d="${uPath}" fill="none" stroke="#F6F4EF" stroke-width="${MARK.stroke}" stroke-linecap="butt"/>
    <path d="${gemPath}" fill="#E2BC7B"/>
  </g>
</svg>`;
}

/* --------------------------------------------------------------- write */

const icons = [
  [192, 'icon-192.png', {}],
  [512, 'icon-512.png', {}],
  [192, 'icon-maskable-192.png', { maskable: true }],
  [512, 'icon-maskable-512.png', { maskable: true }],
  [180, 'apple-touch-icon.png', { fullBleed: true, maskable: false }],
  [32, 'favicon-32.png', {}],
  [48, 'favicon-48.png', {}]
];
for (const [size, name, options] of icons) {
  writeFileSync(join(webDir, name), png(size, renderIcon(size, options)));
  console.log(`icons: wrote ${name} (${size}×${size})`);
}

writeFileSync(join(webDir, 'favicon.svg'), `${tileSvg()}\n`);
writeFileSync(join(webDir, 'icon-maskable.svg'), `${tileSvg({ maskable: true, scale: 0.72 })}\n`);
writeFileSync(join(webDir, 'union-mark.svg'), `${markSvg(INK, GOLD)}\n`);
writeFileSync(join(webDir, 'union-mark-porcelain.svg'), `${markSvg(PORCELAIN, GOLD_LIGHT)}\n`);
writeFileSync(join(toolDir, 'union-mark.svg'), `${markSvg(INK, GOLD)}\n`);
writeFileSync(join(toolDir, 'union-mark-porcelain.svg'), `${markSvg(PORCELAIN, GOLD_LIGHT)}\n`);
writeFileSync(join(toolDir, 'union-tile.svg'), `${tileSvg()}\n`);
console.log('icons: wrote favicon.svg, union-mark.svg and maskable variants');

/* ----------------------------------------------------------- Android */

// Adaptive icon foreground: 108 × 108, centred in the 66 dp safe circle.
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:pathData="M41,35.5 V59.5 A13,13 0 0 0 67,59.5 V35.5"
        android:strokeColor="#F6F4EF"
        android:strokeWidth="6.4"
        android:strokeLineCap="butt"
        android:fillColor="#00000000" />
    <path
        android:pathData="M54,54.5 L58.8,59.3 L54,64.1 L49.2,59.3 Z"
        android:fillColor="#E2BC7B" />
</vector>
`;
writeFileSync(join(androidDir, 'drawable/ic_launcher_foreground.xml'), adaptive);
console.log('icons: wrote Android adaptive foreground');

const adaptiveRound = adaptive;
writeFileSync(join(androidDir, 'drawable/ic_launcher_foreground_round.xml'), adaptiveRound);

// Legacy launcher rasters for the xxxhdpi bucket (432 px).
const legacy = png(432, renderIcon(432, {}));
writeFileSync(join(androidDir, 'mipmap-xxxhdpi/ic_launcher.png'), legacy);
writeFileSync(join(androidDir, 'mipmap-xxxhdpi/ic_launcher_round.png'), legacy);
console.log('icons: wrote Android launcher rasters (432×432)');

const colors = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="union_bg">#F4F1EA</color>
    <color name="union_panel">#FBFAF6</color>
    <color name="union_accent">#4A3AFF</color>
    <color name="union_icon_bg">#101116</color>
</resources>
`;
writeFileSync(join(androidDir, 'values/colors.xml'), colors);
const colorsNight = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="union_bg">#101116</color>
    <color name="union_panel">#191A21</color>
    <color name="union_accent">#9790FF</color>
    <color name="union_icon_bg">#101116</color>
</resources>
`;
writeFileSync(join(androidDir, 'values-night/colors.xml'), colorsNight);
console.log('icons: wrote Android icon colours');
