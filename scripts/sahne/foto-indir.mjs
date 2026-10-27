// =============================================================================
// SAHNE — kategori basina acik lisansli fotograf indirme (Wikimedia Commons)
//   node scripts/sahne/foto-indir.mjs                 -> tum kategoriler (docs/sahne/foto-plan.json'daki arama terimleri)
//   node scripts/sahne/foto-indir.mjs dj fotografci   -> yalniz adi gecen kategoriler (yeniden)
//   secenekler: --adet 30 (kategori basina en fazla), --min 1200 (en kucuk kenar px)
// Cikti: docs/sahne/foto/<kategori>/NN.jpg (1600px, JPEG q82), docs/sahne/foto/lisans.json (kaynak + lisans),
//        docs/sahne/foto/onizleme-<kategori>.jpg (kontak sayfasi; kalite kontrolu icin)
// Lisans filtresi: CC0, CC BY, CC BY-SA, kamu mali. NC / ND / belirsiz lisans ALINMAZ. Atif lisans.json'da ve
// portfoy altyazisinda ("Foto: <sanatci> — <lisans>, Wikimedia Commons") tasinir.
// Yalniz Guven'in makinesinde kosar (konteyner/cihaz VM'inden Commons'a erisim yok). Bagimlilik: sharp (repoda var).
// =============================================================================
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PLAN = JSON.parse(readFileSync(join(KOK, 'docs', 'sahne', 'foto-plan.json'), 'utf8'));
const FOTO = join(KOK, 'docs', 'sahne', 'foto');
const LISANS_DOSYA = join(FOTO, 'lisans.json');
const UA = 'KasheSahne/0.1 (test ortami fotograf hazirligi; https://kashe.net)';

const args = process.argv.slice(2);
const opt = (ad, vars) => { const i = args.indexOf(ad); return i >= 0 ? args[i + 1] : vars; };
const ADET = Number(opt('--adet', 30));
const MIN = Number(opt('--min', 1200));
const secilen = args.filter((a) => !a.startsWith('--') && !/^\d+$/.test(a));
const kategoriler = Object.keys(PLAN.kategoriler).filter((k) => secilen.length === 0 || secilen.includes(k));

const IZINLI = /^(CC0|CC BY(-SA)?( \d\.\d)?|Public domain|CC-BY(-SA)?-\d\.\d|CC BY \d\.\d|CC BY-SA \d\.\d)/i;
const YASAK = /(NC|ND|GFDL only|Fair use|Non-free)/i;

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
const temizle = (html) => (html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function getJson(url, deneme = 0) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (r.status === 429 && deneme < 3) { await bekle(2000 * (deneme + 1)); return getJson(url, deneme + 1); }
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

async function ara(terim, limit) {
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  u.search = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrsearch: `${terim} filetype:bitmap`, gsrnamespace: '6',
    gsrlimit: String(limit), prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: '1600', origin: '*',
  }).toString();
  const j = await getJson(u.toString());
  const sayfalar = Object.values(j?.query?.pages || {});
  const out = [];
  for (const s of sayfalar) {
    const ii = s.imageinfo?.[0];
    if (!ii) continue;
    const md = ii.extmetadata || {};
    const lisans = temizle(md.LicenseShortName?.value);
    const lisansUrl = temizle(md.LicenseUrl?.value);
    if (!IZINLI.test(lisans) || YASAK.test(lisans)) continue;
    if (!/^image\/(jpeg|png)$/.test(ii.mime || '')) continue;
    if (Math.min(ii.width || 0, ii.height || 0) < MIN) continue;
    out.push({
      title: s.title, sayfa: ii.descriptionurl, indir: ii.thumburl || ii.url, genislik: ii.width, yukseklik: ii.height,
      sanatci: temizle(md.Artist?.value) || 'Bilinmiyor', lisans, lisansUrl, kredi: temizle(md.Credit?.value),
    });
  }
  return out;
}

async function indir(url, deneme = 0) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (r.status === 429 && deneme < 3) { await bekle(3000 * (deneme + 1)); return indir(url, deneme + 1); }
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

async function kontakSayfasi(kat, dosyalar) {
  const sutun = 6, w = 220, h = 160, pad = 6;
  const satir = Math.ceil(dosyalar.length / sutun);
  const parcalar = [];
  for (let i = 0; i < dosyalar.length; i++) {
    const buf = await sharp(dosyalar[i]).resize(w, h, { fit: 'cover' }).toBuffer();
    parcalar.push({ input: buf, left: pad + (i % sutun) * (w + pad), top: pad + Math.floor(i / sutun) * (h + pad) });
  }
  const etiket = Buffer.from(`<svg width="${sutun * (w + pad) + pad}" height="${satir * (h + pad) + pad}">${dosyalar.map((_, i) =>
    `<text x="${pad + (i % sutun) * (w + pad) + 6}" y="${pad + Math.floor(i / sutun) * (h + pad) + 18}" font-size="16" font-family="sans-serif" fill="#fff" stroke="#000" stroke-width="0.6">${String(i + 1).padStart(2, '0')}</text>`).join('')}</svg>`);
  await sharp({ create: { width: sutun * (w + pad) + pad, height: satir * (h + pad) + pad, channels: 3, background: '#222' } })
    .composite([...parcalar, { input: etiket, left: 0, top: 0 }]).jpeg({ quality: 80 }).toFile(join(FOTO, `onizleme-${kat}.jpg`));
}

async function main() {
  mkdirSync(FOTO, { recursive: true });
  const lisans = existsSync(LISANS_DOSYA) ? JSON.parse(readFileSync(LISANS_DOSYA, 'utf8')) : {};
  for (const kat of kategoriler) {
    const { arama } = PLAN.kategoriler[kat];
    const gorulen = new Set();
    const adaylar = [];
    for (const terim of arama) {
      try {
        const sonuc = await ara(terim, 25);
        for (const s of sonuc) { if (!gorulen.has(s.title)) { gorulen.add(s.title); adaylar.push(s); } }
      } catch (e) { console.warn(`  ${kat} / "${terim}": ${e.message}`); }
      await bekle(400);
      if (adaylar.length >= ADET * 2) break;
    }
    // yatay/dikey karisik ama cok uzun ya da cok dar gorseller elenir
    const uygun = adaylar.filter((a) => { const o = a.genislik / a.yukseklik; return o > 0.5 && o < 2.2; }).slice(0, ADET);
    const klasor = join(FOTO, kat);
    mkdirSync(klasor, { recursive: true });
    const kayitlar = [];
    const dosyalar = [];
    let n = 0;
    for (const a of uygun) {
      try {
        const ham = await indir(a.indir);
        n += 1;
        const ad = `${String(n).padStart(2, '0')}.jpg`;
        const yol = join(klasor, ad);
        await sharp(ham).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(yol);
        kayitlar.push({ dosya: `${kat}/${ad}`, title: a.title, sayfa: a.sayfa, sanatci: a.sanatci, lisans: a.lisans, lisansUrl: a.lisansUrl, kredi: a.kredi });
        dosyalar.push(yol);
        await bekle(250);
      } catch (e) { console.warn(`  ${kat} / ${a.title}: ${e.message}`); }
    }
    lisans[kat] = kayitlar;
    writeFileSync(LISANS_DOSYA, JSON.stringify(lisans, null, 1), 'utf8');
    if (dosyalar.length) await kontakSayfasi(kat, dosyalar);
    console.log(`${kat}: ${adaylar.length} aday, ${kayitlar.length} indirildi -> docs/sahne/foto/${kat}/ (onizleme-${kat}.jpg)`);
  }
  const toplam = Object.values(lisans).reduce((s, l) => s + l.length, 0);
  console.log(`toplam ${toplam} gorsel; lisans kaydi: docs/sahne/foto/lisans.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
