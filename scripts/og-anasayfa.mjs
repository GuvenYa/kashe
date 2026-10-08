// ============================================================================
// OG GORSELI — public/og-anasayfa.png (1200x630)
// ============================================================================
// Ana sayfanin paylasim karti. Marka laciverti zemin + ortada beyaz lockup +
// altinda tek satir aciklama. Tek seferlik uretilir; dosya repoya girer, uygulama
// calisma zamaninda sharp CAGIRMAZ.
//
// Calistir: node scripts/og-anasayfa.mjs
//
// Zemin rengi DESIGN.md → Marka renkleri tablosundaki brand-ink degeridir
// (#040D26). Palet degisirse burasi ve layout.tsx viewport.themeColor birlikte
// guncellenir.
//
// LOCKUP SECIMI: brief `kashe-lockup-white.png` diyordu; o varlik duz beyaz bir
// SILUET (play ucgeni kaybolmus, dolu daire) — koyu zeminde marka isareti hic
// gorunmuyordu. `kashe-lockup-dark.png` deponun gercek koyu-zemin kilidi: beyaz
// plaka + gradyanli play ucgeni + beyaz wordmark. Olculdu, bu kullanilir.
//
// Alt satir yazisi sistem sans'i ile basilir; Gilroy woff2'leri sharp'in
// (librsvg/fontconfig) yazi hattina verilemiyor. Marka yazisi lockup PNG'sinden
// gelir, bu satir yalnizca aciklamadir.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KOK = join(__dirname, '..');

const W = 1200;
const H = 630;
const ZEMIN = '#040D26'; // brand-ink
const LOCKUP_GENISLIK = 560;
const ALT_SATIR = "Türkiye'nin etkinlik ve yetenek pazaryeri";

async function main() {
  // Lockup'i hedef genislige olcekle (oran korunur).
  const lockup = await sharp(join(KOK, 'public', 'kashe-lockup-dark.png'))
    .resize({ width: LOCKUP_GENISLIK, fit: 'inside' })
    .png()
    .toBuffer();
  const lockupMeta = await sharp(lockup).metadata();

  // Dikey yerlesim: lockup biraz merkezin ustunde, alt satir onun altinda.
  const blokYuksekligi = lockupMeta.height + 64;
  const lockupUst = Math.round((H - blokYuksekligi) / 2);
  const metinTaban = lockupUst + lockupMeta.height + 58;

  const metinSvg = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <text x="${W / 2}" y="${metinTaban}" text-anchor="middle"
            font-family="Inter, 'Segoe UI', Arial, sans-serif"
            font-size="30" letter-spacing="0.5"
            fill="#FFFFFF" fill-opacity="0.82">${ALT_SATIR}</text>
    </svg>`
  );

  const cikti = join(KOK, 'public', 'og-anasayfa.png');
  await sharp({
    create: { width: W, height: H, channels: 4, background: ZEMIN },
  })
    .composite([
      {
        input: lockup,
        left: Math.round((W - lockupMeta.width) / 2),
        top: lockupUst,
      },
      { input: metinSvg, left: 0, top: 0 },
    ])
    .png()
    .toFile(cikti);

  console.log('yazıldı: public/og-anasayfa.png (' + W + 'x' + H + ')');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
