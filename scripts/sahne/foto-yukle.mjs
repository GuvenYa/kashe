// =============================================================================
// SAHNE — avatar + portfoy yukleme (dal projesi Storage) ve portfolio_items / profiles.avatar_url yazimi
//   $env:SAHNE_SERVICE_ROLE_KEY = "<dal projesinin service_role anahtari>"   (PowerShell; dosyaya YAZILMAZ)
//   node scripts/sahne/foto-yukle.mjs            -> yukle (idempotan: ayni yollara upsert, portfoy satirlari yenilenir; hata alan hesap icin tekrar calistir)
//   node scripts/sahne/foto-yukle.mjs --sil      -> Storage nesneleri + portfoy satirlari + avatar_url temizlenir
//   secenek: --yalniz-avatar  (portfoy atlanir)
// Girdi: docs/sahne/foto-plan.json (uret.py), docs/sahne/foto/lisans.json + gorseller (foto-indir.mjs)
// Avatar: bas harfler + renk (gercek yuz YOK), 256px PNG — yalniz portfoysuz hesaplara yazilir (saglayicida kapak = portfoy). Portfoy: kategori havuzundan 4-8 gorsel,
//         altyazi "Foto: <sanatci> — <lisans>, Wikimedia Commons". Yalniz dal projesi (ukqhgspaallzjscjodbb) kabul edilir.
// =============================================================================
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PLAN = JSON.parse(readFileSync(join(KOK, 'docs', 'sahne', 'foto-plan.json'), 'utf8'));
const FOTO = join(KOK, 'docs', 'sahne', 'foto');
const args = process.argv.slice(2);
const SIL = args.includes('--sil');
const YALNIZ_AVATAR = args.includes('--yalniz-avatar');

const URL_ = process.env.SAHNE_SUPABASE_URL || PLAN.proje_url;
const KEY = process.env.SAHNE_SERVICE_ROLE_KEY;
if (!/ukqhgspaallzjscjodbb/.test(URL_)) { console.error('URETIM KORUMASI: yalniz dal projesi (ukqhgspaallzjscjodbb) kabul edilir: ' + URL_); process.exit(2); }
if (!KEY) { console.error('SAHNE_SERVICE_ROLE_KEY ortam degiskeni gerekli (PowerShell: $env:SAHNE_SERVICE_ROLE_KEY = "...")'); process.exit(2); }
const sb = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const kullanicilar = PLAN.kullanicilar;
const lisans = existsSync(join(FOTO, 'lisans.json')) ? JSON.parse(readFileSync(join(FOTO, 'lisans.json'), 'utf8')) : {};

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
// Storage/PostgREST gecici hatalarinda (429, 5xx, ag) 4 deneme: 1.5 s, 3 s, 6 s, 12 s
async function dene(ad, fn) {
  let son;
  for (let i = 0; i < 5; i++) {
    try { const r = await fn(); if (r && r.error) throw new Error(ad + ': ' + (r.error.message || JSON.stringify(r.error))); return r; }
    catch (e) { son = e; if (i < 4) await bekle(1500 * Math.pow(2, i)); }
  }
  throw son;
}

function sira(uid, n) { // deterministik secim: uid hash -> baslangic
  const h = parseInt(createHash('md5').update(uid).digest('hex').slice(0, 8), 16);
  return (i) => (h + i * 7) % n;
}

async function avatarPng(harf, renk) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" rx="48" fill="${renk}"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="112" font-weight="700" fill="#fff">${harf}</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function havuzSil(bucket, uid) {
  const { data } = await sb.storage.from(bucket).list(uid, { limit: 200 });
  const yollar = (data || []).map((f) => `${uid}/${f.name}`);
  if (yollar.length) await sb.storage.from(bucket).remove(yollar);
  return yollar.length;
}

async function sil() {
  let n = 0;
  for (const u of kullanicilar) {
    n += await havuzSil('avatars', u.id);
    n += await havuzSil('portfolio', u.id);
    await sb.from('portfolio_items').delete().eq('profile_id', u.id).like('media_url', '%/sahne-%');
    await sb.from('profiles').update({ avatar_url: null }).eq('id', u.id).like('avatar_url', '%/avatars/' + u.id + '/%');
  }
  console.log(`silindi: ${n} storage nesnesi; portfoy satirlari ve avatar_url temizlendi (${kullanicilar.length} hesap)`);
}

async function yukle() {
  let avatarN = 0, fotoN = 0, hata = 0, gorselYok = 0; const hatalar = [];
  const kuyruk = [...kullanicilar];
  const isci = async () => {
    while (kuyruk.length) {
      const u = kuyruk.shift();
      try {
        // avatar
        const png = await avatarPng(u.harf, u.renk);
        await dene('avatar', () => sb.storage.from('avatars').upload(`${u.id}/avatar.png`, png, { contentType: 'image/png', upsert: true, cacheControl: '3600' }));
        // Saglayicilarda (pro/ajans) profiles.avatar_url BOS kalir: Kesfet karti kapak olarak avatar'i kullanir, bos olunca
        // portfoyun ilk gorseline duser (etkinlik fotografi); profil sayfasi bas harf karesini kendisi cizer. Harf PNG'si
        // musteri/kurum/yonetici hesaplarina (portfoysuz) yazilir. Guven puaninda "avatar" bileseni (+2) saglayicilarda 0 kalir.
        const saglayici = u.tip === 'pro' || u.tip === 'ajans';
        const avatarUrl = saglayici ? null : `${PLAN.storage}/avatars/${u.id}/avatar.png?t=${Date.now()}`;
        await dene('profiles', () => sb.from('profiles').update({ avatar_url: avatarUrl }).eq('id', u.id));
        avatarN += 1;
        // portfoy
        if (YALNIZ_AVATAR || !u.adet || !u.kat) continue;
        const kaynaklar = [];
        const havuz = lisans[u.kat] || [];
        const havuz2 = u.kat2 ? (lisans[u.kat2] || []) : [];
        if (!havuz.length) { gorselYok += 1; console.warn(`  ${u.ad}: ${u.kat} icin gorsel yok (foto-indir.mjs?)`); continue; }
        const sec = sira(u.id, havuz.length);
        const ana = Math.max(1, u.adet - (havuz2.length ? 2 : 0));
        const kullanilan = new Set();
        for (let i = 0; i < ana; i++) { const k = sec(i); if (!kullanilan.has(k)) { kullanilan.add(k); kaynaklar.push(havuz[k]); } }
        if (havuz2.length) { const sec2 = sira(u.id + 'b', havuz2.length); kaynaklar.push(havuz2[sec2(0)]); if (havuz2.length > 1) kaynaklar.push(havuz2[sec2(1)]); }
        await dene('portfolio_items sil', () => sb.from('portfolio_items').delete().eq('profile_id', u.id).like('media_url', '%/sahne-%'));
        await havuzSil('portfolio', u.id);
        const satirlar = [];
        for (let i = 0; i < kaynaklar.length; i++) {
          const k = kaynaklar[i];
          const yol = join(FOTO, k.dosya);
          if (!existsSync(yol)) continue;
          const buf = readFileSync(yol);
          const ad = `sahne-${String(i + 1).padStart(2, '0')}.jpg`;
          await dene('portfolio ' + ad, () => sb.storage.from('portfolio').upload(`${u.id}/${ad}`, buf, { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' }));
          satirlar.push({ profile_id: u.id, media_url: `${PLAN.storage}/portfolio/${u.id}/${ad}`, media_type: 'image',
            caption: `Foto: ${k.sanatci} — ${k.lisans}, Wikimedia Commons`, sort_order: i });
          fotoN += 1;
        }
        if (satirlar.length) await dene('portfolio_items', () => sb.from('portfolio_items').insert(satirlar));
      } catch (e) { hata += 1; hatalar.push(`${u.ad} (${u.id}): ${e.message}`); console.warn(`  HATA ${u.ad} (${u.id}): ${e.message}`); }
    }
  };
  await Promise.all([isci(), isci()]);
  console.log(`avatar ${avatarN}, portfoy gorseli ${fotoN}, gorsel-yok ${gorselYok}, hata ${hata} (${kullanicilar.length} hesap)`);
  if (hatalar.length) { console.log('--- hatali hesaplar (betigi yeniden calistirmak yeterli; idempotan):'); for (const h of hatalar) console.log('  ' + h); }
}

(SIL ? sil() : yukle()).catch((e) => { console.error(e); process.exit(1); });
