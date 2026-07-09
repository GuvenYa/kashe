// Kashe ikon üretimi — Design V2 APP-İKON varyantından (yuvarlak-kare zemin + solid
// k şekilleri; koordinatlar Design dökümü item 3) tüm PWA/favicon setini üretir.
// Not: ana işaret (kashe-mark.tsx) mask'lı GERÇEK oyuk kullanır; ikonlar ise
// self-contained olsun diye SOLID şekil kullanır (tarayıcı sekmesi/launcher zemini
// belirsiz — oyuk uygun değil). Çalıştır: node scripts/generate-icons.mjs
//
// Üretilenler (public/):
//   icon-192.png, icon-512.png   → PWA "any" (yuvarlak-kare, mercan nokta VAR)
//   apple-touch-icon.png (180)   → iOS (tam-kare opak zemin; iOS köşeyi kendi yuvarlar)
//   icon-maskable-512.png        → PWA "maskable" (güvenli-alan padding + tam zümrüt)
//   favicon.ico (16/32/48)       → tarayıcı sekmesi (NOKTASIZ + KALIN k varyantı —
//                                   item 3 16px; küçük boyutta daha okunaklı)
//
// Eski PNG'ler üzerine yazmadan önce *_legacy.png olarak yedeklenir (silinmez).
import sharp from 'sharp';
import { writeFile, copyFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUB = join(__dirname, '..', 'public');

const BG = '#1F5C4A'; // zümrüt zemin
const K = '#F3EEE3'; // krem k
const DOT = '#E2674A'; // mercan nokta
const EMERALD = { r: 0x1f, g: 0x5c, b: 0x4a }; // maskable composite zemini

// App-ikon varyantı (viewBox 96×96). radius = zemin köşe yarıçapı (0 = tam kare).
// bold=true → item 3 16px varyantı (noktasız, kalın k). bold=false → item 3 32px (noktalı).
function appIconSvg({ bold = false, radius = 22 }) {
  const bg = `<rect width="96" height="96" rx="${radius}" fill="${BG}"/>`;
  const k = bold
    ? `<g fill="${K}">
    <rect x="29" y="18" width="14" height="60"/>
    <polygon points="47,44 61,14 84,27 55,52"/>
    <polygon points="47,50 79,72 68,85 47,62"/>
  </g>`
    : `<g fill="${K}">
    <rect x="31" y="20" width="12" height="56" rx="2"/>
    <polygon points="47,44 60,16 82,28 54,52"/>
    <polygon points="47,49 76,71 67,83 47,61"/>
  </g>
  <circle cx="72" cy="21" r="5" fill="${DOT}"/>`;
  return `<svg width="512" height="512" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
  ${bg}
  ${k}
</svg>`;
}

const render = (svg, size) =>
  sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();

// Maskable: tam zümrüt zemin + app-ikonu güvenli alana (~%80) ortalayarak yerleştir.
async function renderMaskable(size) {
  const inner = Math.round(size * 0.8);
  const icon = await render(appIconSvg({ radius: 0 }), inner);
  return sharp({
    create: { width: size, height: size, channels: 4, background: { ...EMERALD, alpha: 1 } },
  })
    .composite([{ input: icon, gravity: 'center' }])
    .png()
    .toBuffer();
}

// Tek/çok boyutlu PNG buffer'larından ICO (PNG-embedded — harici encoder bağımlılığı yok).
function buildIco(pngs) {
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  const body = [];
  pngs.forEach((p, i) => {
    const b = 16 * i;
    dir.writeUInt8(p.size >= 256 ? 0 : p.size, b + 0);
    dir.writeUInt8(p.size >= 256 ? 0 : p.size, b + 1);
    dir.writeUInt8(0, b + 2);
    dir.writeUInt8(0, b + 3);
    dir.writeUInt16LE(1, b + 4);
    dir.writeUInt16LE(32, b + 6);
    dir.writeUInt32LE(p.data.length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += p.data.length;
    body.push(p.data);
  });
  return Buffer.concat([header, dir, ...body]);
}

async function backup(name) {
  const src = join(PUB, name);
  const legacy = join(PUB, name.replace(/\.png$/, '_legacy.png'));
  try {
    await access(src, constants.F_OK);
  } catch {
    return;
  }
  try {
    await access(legacy, constants.F_OK);
    console.log(`  · yedek zaten var, atlandı: ${name.replace(/\.png$/, '_legacy.png')}`);
  } catch {
    await copyFile(src, legacy);
    console.log(`  · yedeklendi: ${name} → ${name.replace(/\.png$/, '_legacy.png')}`);
  }
}

async function main() {
  console.log('Eski ikonlar yedekleniyor (_legacy)…');
  for (const n of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'icon-maskable-512.png']) {
    await backup(n);
  }

  console.log('Yeni ikonlar üretiliyor (Design V2 app-ikon geometrisi)…');
  // "any": yuvarlak-kare, noktalı
  await writeFile(join(PUB, 'icon-192.png'), await render(appIconSvg({ radius: 22 }), 192));
  await writeFile(join(PUB, 'icon-512.png'), await render(appIconSvg({ radius: 22 }), 512));
  // apple-touch: tam-kare opak (iOS köşeyi kendi yuvarlar) — şeffaflık yok
  await writeFile(join(PUB, 'apple-touch-icon.png'), await render(appIconSvg({ radius: 0 }), 180));
  // maskable: güvenli-alan padding + tam zümrüt zemin
  await writeFile(join(PUB, 'icon-maskable-512.png'), await renderMaskable(512));
  // favicon: noktasız + kalın varyant (item 3 16px), yuvarlak-kare
  const ico = buildIco([
    { size: 16, data: await render(appIconSvg({ bold: true, radius: 22 }), 16) },
    { size: 32, data: await render(appIconSvg({ bold: true, radius: 22 }), 32) },
    { size: 48, data: await render(appIconSvg({ bold: true, radius: 22 }), 48) },
  ]);
  await writeFile(join(PUB, 'favicon.ico'), ico);

  console.log('Tamam:');
  console.log('  public/icon-192.png, icon-512.png (yuvarlak-kare, mercan noktalı)');
  console.log('  public/apple-touch-icon.png (180, tam-kare opak)');
  console.log('  public/icon-maskable-512.png (güvenli alan + zümrüt zemin)');
  console.log('  public/favicon.ico (16/32/48, noktasız kalın varyant)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
