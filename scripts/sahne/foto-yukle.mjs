// =============================================================================
// SAHNE — avatar + portfoy yukleme (dal projesi Storage) ve portfolio_items / profiles.avatar_url yazimi
//   $env:SAHNE_SERVICE_ROLE_KEY = Read-Host "Sahne secret"   (dal projesinin secret anahtari `sahne_betikleri`, sb_secret_...;
//   eski service_role da kabul edilir; PowerShell'de anahtar gecmise ve dosyaya YAZILMAZ)
//   node scripts/sahne/foto-yukle.mjs            -> yukle (idempotan: ayni yollara upsert, portfoy satirlari yenilenir; hata alan hesap icin tekrar calistir)
//   node scripts/sahne/foto-yukle.mjs --sil      -> Storage nesneleri + portfoy satirlari + avatar_url temizlenir
//   secenek: --yalniz-avatar  (portfoy atlanir)
//   node scripts/sahne/foto-yukle.mjs --cikar="<altyazi metni>" -> altyazisinda bu metin gecen Sahne portfoy gorsellerini
//            (portfolio_items satiri + Storage nesnesi) kaldirir; diger gorseller ve avatar dokunulmaz. Ornek (10 Kas,
//            uygunsuz oyuncu/19-22): --cikar=baratta. Ilk portfoy gorseli kaldirilirsa avatar o gorselin kopyasi
//            olabilir: betik uyarir (avatar_url temizlenip --saglayici-avatar ile yenilenir).
//   node scripts/sahne/foto-yukle.mjs --saglayici-avatar -> Sahne v3 / bulgu 70: avatar_url'i BOS saglayicilara (pro/ajans) ilk
//            portfoy gorseli avatar olur (avatars/<id>/avatar.jpg). Portfoya ve dolu avatara dokunmaz; tekrar calistirmak guvenli.
// Girdi: docs/sahne/foto-plan.json (uret.py), docs/sahne/foto/lisans.json + gorseller (foto-indir.mjs)
// Avatar: saglayicida (pro/ajans) ilk portfoy gorseli (en fazla 1200 px JPG; Kesfet / ana sayfa kapagi zaten bu gorsel, degismez);
//         portfoysuz hesaplarda bas harfler + renk (gercek yuz YOK), 256px PNG. Portfoy: kategori havuzundan 4-8 gorsel,
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
const SAGLAYICI_AVATAR = args.includes('--saglayici-avatar');
const CIKAR = (args.find((a) => a.startsWith('--cikar=')) || '').slice('--cikar='.length).trim();

const URL_ = process.env.SAHNE_SUPABASE_URL || PLAN.proje_url;
const KEY = process.env.SAHNE_SERVICE_ROLE_KEY;
if (!/ukqhgspaallzjscjodbb/.test(URL_)) { console.error('URETIM KORUMASI: yalniz dal projesi (ukqhgspaallzjscjodbb) kabul edilir: ' + URL_); process.exit(2); }
if (!KEY) { console.error('SAHNE_SERVICE_ROLE_KEY ortam degiskeni gerekli (PowerShell: $env:SAHNE_SERVICE_ROLE_KEY = Read-Host "Sahne secret")'); process.exit(2); }
// Publishable anahtar satir guvenligini asamaz; betik secret anahtar ister.
if (KEY.startsWith('sb_publishable_')) { console.error('ANAHTAR KORUMASI: bu publishable anahtar; dal projesinin SECRET anahtari (sb_secret_...) gerekir.'); process.exit(2); }
// ANAHTAR KORUMASI (10 Kas): eski bicim (JWT) anahtarin hangi projeye ait oldugu icinde yazar; dal disi anahtar
// hicbir istek atilmadan reddedilir (uretim anahtari yanlislikla girilirse ag cagrisi yapilmaz). Anahtar YAZDIRILMAZ.
if (KEY.startsWith('eyJ')) {
  let ref = null, rol = null;
  try { const y = JSON.parse(Buffer.from(KEY.split('.')[1], 'base64url').toString('utf8')); ref = y.ref; rol = y.role; } catch { /* asagida */ }
  if (ref !== 'ukqhgspaallzjscjodbb' || rol !== 'service_role') {
    console.error(`ANAHTAR KORUMASI: bu anahtar dal projesinin service_role anahtari degil (proje: ${ref ?? 'okunamadi'}, rol: ${rol ?? 'okunamadi'}). Dal (Sahne) projesinin anahtarini girin.`);
    process.exit(2);
  }
}
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

// Saglayici avatari: portfoy gorselinden en fazla 1200 px JPG (profil yuvarlagi ve kart kapagi object-cover ile kirpar)
async function avatarJpg(buf) {
  return sharp(buf).rotate().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
}

async function avatarYaz(uid, jpg) {
  await dene('avatar', () => sb.storage.from('avatars').upload(`${uid}/avatar.jpg`, jpg, { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' }));
  return `${PLAN.storage}/avatars/${uid}/avatar.jpg?t=${Date.now()}`;
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
    await sb.from('portfolio_items').delete().eq('provider_id', u.id).like('media_url', '%/sahne-%');
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
        // portfoy kaynaklari (deterministik); saglayici avatari ilk portfoy gorseli olur (Sahne v3 / bulgu 70: avatarsiz profil
        // "Yayinla" tamlik kontrolune takiliyordu). Kesfet / ana sayfa kapagi = avatar || ilk portfoy gorseli -> ayni gorsel.
        const saglayici = u.tip === 'pro' || u.tip === 'ajans';
        const kaynaklar = [];
        const havuz = (u.adet && u.kat) ? (lisans[u.kat] || []) : [];
        const havuz2 = (u.adet && u.kat2) ? (lisans[u.kat2] || []) : [];
        if (havuz.length) {
          const sec = sira(u.id, havuz.length);
          const ana = Math.max(1, u.adet - (havuz2.length ? 2 : 0));
          const kullanilan = new Set();
          for (let i = 0; i < ana; i++) { const k = sec(i); if (!kullanilan.has(k)) { kullanilan.add(k); kaynaklar.push(havuz[k]); } }
          if (havuz2.length) { const sec2 = sira(u.id + 'b', havuz2.length); kaynaklar.push(havuz2[sec2(0)]); if (havuz2.length > 1) kaynaklar.push(havuz2[sec2(1)]); }
        }
        const ilkYol = kaynaklar.length ? join(FOTO, kaynaklar[0].dosya) : null;
        // avatar
        let avatarUrl;
        if (saglayici && ilkYol && existsSync(ilkYol)) {
          await havuzSil('avatars', u.id);
          avatarUrl = await avatarYaz(u.id, await avatarJpg(readFileSync(ilkYol)));
        } else {
          const png = await avatarPng(u.harf, u.renk);
          await dene('avatar', () => sb.storage.from('avatars').upload(`${u.id}/avatar.png`, png, { contentType: 'image/png', upsert: true, cacheControl: '3600' }));
          avatarUrl = `${PLAN.storage}/avatars/${u.id}/avatar.png?t=${Date.now()}`;
        }
        await dene('profiles', () => sb.from('profiles').update({ avatar_url: avatarUrl }).eq('id', u.id));
        avatarN += 1;
        // portfoy
        if (YALNIZ_AVATAR || !u.adet || !u.kat) continue;
        if (!havuz.length) { gorselYok += 1; console.warn(`  ${u.ad}: ${u.kat} icin gorsel yok (foto-indir.mjs?)`); continue; }
        await dene('portfolio_items sil', () => sb.from('portfolio_items').delete().eq('provider_id', u.id).like('media_url', '%/sahne-%'));
        await havuzSil('portfolio', u.id);
        const satirlar = [];
        for (let i = 0; i < kaynaklar.length; i++) {
          const k = kaynaklar[i];
          const yol = join(FOTO, k.dosya);
          if (!existsSync(yol)) continue;
          const buf = readFileSync(yol);
          const ad = `sahne-${String(i + 1).padStart(2, '0')}.jpg`;
          await dene('portfolio ' + ad, () => sb.storage.from('portfolio').upload(`${u.id}/${ad}`, buf, { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' }));
          satirlar.push({ provider_id: u.id, media_url: `${PLAN.storage}/portfolio/${u.id}/${ad}`, media_type: 'image',
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

// --saglayici-avatar: avatar_url BOS saglayicilara ilk portfoy gorseli (dal verisinden; portfoy ve dolu avatar degismez)
async function saglayiciAvatar() {
  let yazildi = 0, dolu = 0, portfoysuz = 0, hata = 0; const hatalar = [];
  const kuyruk = kullanicilar.filter((u) => u.tip === 'pro' || u.tip === 'ajans');
  const toplam = kuyruk.length;
  const isci = async () => {
    while (kuyruk.length) {
      const u = kuyruk.shift();
      try {
        const { data: p } = await dene('profiles oku', () => sb.from('profiles').select('avatar_url').eq('id', u.id).maybeSingle());
        if (!p) { hata += 1; hatalar.push(`${u.ad} (${u.id}): profil yok`); continue; }
        if (p.avatar_url) { dolu += 1; continue; }
        const { data: ilk } = await dene('portfoy oku', () => sb.from('portfolio_items').select('media_url')
          .eq('provider_id', u.id).eq('media_type', 'image')
          .order('sort_order', { ascending: true }).order('created_at', { ascending: true }).limit(1));
        const m = (ilk && ilk[0] && ilk[0].media_url || '').match(/\/object\/public\/portfolio\/([^?]+)/);
        if (!m) { portfoysuz += 1; continue; }
        const { data: blob } = await dene('portfoy indir', () => sb.storage.from('portfolio').download(decodeURIComponent(m[1])));
        const url = await avatarYaz(u.id, await avatarJpg(Buffer.from(await blob.arrayBuffer())));
        await dene('profiles', () => sb.from('profiles').update({ avatar_url: url }).eq('id', u.id).is('avatar_url', null));
        yazildi += 1;
      } catch (e) { hata += 1; hatalar.push(`${u.ad} (${u.id}): ${e.message}`); console.warn(`  HATA ${u.ad} (${u.id}): ${e.message}`); }
    }
  };
  await Promise.all([isci(), isci()]);
  console.log(`saglayici avatari: ${yazildi} yazildi, ${dolu} zaten dolu, ${portfoysuz} portfoysuz (dokunulmadi), hata ${hata} (${toplam} saglayici)`);
  if (hatalar.length) { console.log('--- hatali hesaplar (betigi yeniden calistirmak yeterli):'); for (const h of hatalar) console.log('  ' + h); }
}

// --cikar: altyazisinda metin gecen Sahne portfoy gorselleri (satir + Storage nesnesi). Yalniz `sahne-NN.jpg` yollari
// (uretecin yukledikleri); kullanicinin kendi yukledigi gorsele dokunulmaz.
async function cikar(metin) {
  if (metin.length < 4) { console.error('--cikar en az 4 karakterlik bir altyazi metni ister'); process.exit(2); }
  const { data } = await dene('portfoy ara', () => sb.from('portfolio_items').select('id, provider_id, media_url, sort_order')
    .ilike('caption', `%${metin}%`).like('media_url', '%/portfolio/%/sahne-%'));
  let n = 0;
  for (const r of data || []) {
    const m = (r.media_url || '').match(/\/object\/public\/portfolio\/([^?]+)/);
    if (m) await dene('storage sil', () => sb.storage.from('portfolio').remove([decodeURIComponent(m[1])]));
    await dene('portfoy satiri sil', () => sb.from('portfolio_items').delete().eq('id', r.id));
    n += 1;
    console.log(`  kaldirildi: ${r.provider_id} ${m ? m[1] : r.media_url}`);
    if (r.sort_order === 0) console.warn(`  UYARI ${r.provider_id}: ilk portfoy gorseliydi; avatar bu gorselin kopyasi olabilir (avatar_url temizlenip --saglayici-avatar)`);
  }
  console.log(`${n} Sahne portfoy gorseli kaldirildi (altyazi: "${metin}")`);
}

(CIKAR ? cikar(CIKAR) : SIL ? sil() : SAGLAYICI_AVATAR ? saglayiciAvatar() : yukle()).catch((e) => { console.error(e); process.exit(1); });
