// Hero görsel optimizasyonu — public/images/*.jpg → public/images/hero/*.webp
// Orijinallere DOKUNMAZ. Tekrar çalıştırılabilir (idempotent).
//
// Çalıştır: node scripts/optimize-hero.mjs
//
// Ayarlar: max 700px genişlik, WEBP q80, hedef <120KB.

import sharp from 'sharp';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, '..', 'public', 'images');
const OUT_DIR = path.join(SRC_DIR, 'hero');

const MAX_WIDTH = 700;
const QUALITY = 80;
const SIZE_CAP = 120 * 1024; // 120KB — aşılırsa kalite kademeli düşürülür
const MIN_QUALITY = 62;

// Optimize edilecek 17 görsel (uzantısız temel adlar)
const FILES = [
  'dj-mertkan', 'ece-yildiz', 'hero-event', 'selin-aksoy', 'vibes-band',
  'dans-01', 'dj-02', 'dugun-01', 'dugun-02', 'isik-01', 'konser-01',
  'konser-02', 'parti-01', 'parti-02', 'parti-03', 'sahne-01', 'sahne-02',
];

function fmtKB(bytes) {
  return (bytes / 1024).toFixed(1) + ' KB';
}
function fmtMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

async function main() {
  if (!existsSync(OUT_DIR)) {
    await mkdir(OUT_DIR, { recursive: true });
    console.log(`Klasör oluşturuldu: ${OUT_DIR}\n`);
  }

  const rows = [];
  let totalOld = 0;
  let totalNew = 0;

  for (const base of FILES) {
    const srcPath = path.join(SRC_DIR, `${base}.jpg`);
    const outPath = path.join(OUT_DIR, `${base}.webp`);

    if (!existsSync(srcPath)) {
      console.warn(`⚠ ATLANDI (kaynak yok): ${base}.jpg`);
      continue;
    }

    const oldSize = (await stat(srcPath)).size;

    // 120KB cap aşılırsa kaliteyi kademeli düşür (q80 → q62)
    let q = QUALITY;
    let newSize = 0;
    for (;;) {
      await sharp(srcPath)
        .rotate() // EXIF oryantasyonunu uygula
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: q })
        .toFile(outPath);
      newSize = (await stat(outPath)).size;
      if (newSize <= SIZE_CAP || q <= MIN_QUALITY) break;
      q -= 6;
    }

    const meta = await sharp(outPath).metadata();

    totalOld += oldSize;
    totalNew += newSize;

    const flag =
      newSize > SIZE_CAP ? ' ⚠ >120KB' : q < QUALITY ? ` (q${q})` : '';
    rows.push({
      base,
      px: `${meta.width}×${meta.height}`,
      old: fmtMB(oldSize),
      neu: fmtKB(newSize),
      pct: ((1 - newSize / oldSize) * 100).toFixed(1) + '%',
      flag,
    });
  }

  // Rapor tablosu
  console.log('\n=== OPTİMİZASYON RAPORU ===\n');
  console.log(
    'Dosya'.padEnd(16) +
      'Boyut(px)'.padEnd(12) +
      'Eski'.padEnd(11) +
      'Yeni'.padEnd(11) +
      'Kazanç'.padEnd(9) +
      'Not'
  );
  console.log('-'.repeat(64));
  for (const r of rows) {
    console.log(
      r.base.padEnd(16) +
        r.px.padEnd(12) +
        r.old.padEnd(11) +
        r.neu.padEnd(11) +
        r.pct.padEnd(9) +
        r.flag
    );
  }
  console.log('-'.repeat(64));
  console.log(
    `TOPLAM: ${rows.length} dosya  |  ${fmtMB(totalOld)} → ${fmtMB(totalNew)}  ` +
      `(${((1 - totalNew / totalOld) * 100).toFixed(1)}% küçülme)`
  );
  console.log(`Çıktı: public/images/hero/\n`);
}

main().catch((err) => {
  console.error('HATA:', err);
  process.exit(1);
});
