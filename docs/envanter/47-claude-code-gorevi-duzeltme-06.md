# 47 - Claude Code gorevi: Duzeltme 06 - girissiz Kashe AI hakki + tek AI girisi (bulgu 64, 65)

Hazirlayan: Claude (Cowork), 5 Kasim 2026. Kaynak: `docs/sahne/bulgular.md` 64, 65 (Fahri'nin Sahne sheet'i satir 2, 3).
Urun kararlari (Guven, 5 Kasim): girissiz kullaniciya IP basina gunde 3 yapay zeka analizi + gunluk toplam ust sinir (300; maliyet
artarsa degisir); Kashe AI tek kutu - niyete gore etkinlik plani ya da profesyonel onerisi; `/etkinlik-planla` ve `/pro-bul` tek girise
katilir.
On kosul: `supabase/migrations/20261105140000_duzeltme_06_girissiz_ai_hakki.sql` dalda (RPC `ai_girissiz_hak_kullan`). Ortam
degiskeni `AI_GIRISSIZ_ANAHTAR` `.env.local`'da hazir (Vercel'e Guven ekler); degeri koda, loga ya da rapora YAZILMAZ.
`main`'den acilan `duzeltme-06` dalinda.
Kullanim: Claude Code'a "`docs/envanter/47-claude-code-gorevi-duzeltme-06.md` dosyasini oku, "---" cizgisinin altindaki gorevi
uygula" denir.

---

## Gorev

Alti bolum. Turkce arayuz metinleri, ASCII kod yorumlari, yeni dosyalarda sapkali harf (inceltme isareti) yok. Commit ATMA.
`analyzeEventNeeds` prompt metni, model ve surum sabitleri (`app/lib/eventspec.ts`) DEGISMEZ (EventSpec altin kumesi).

### Veritabani (hazir, dokunma)

RPC `ai_girissiz_hak_kullan(p_anahtar text, p_ip_ozeti text) -> jsonb` (`anon` ve `authenticated` cagirir):
`{"izin": boolean, "kalan": integer, "neden": null | "ip" | "toplam" | "kapali"}`. Yanlis / bos anahtar 42501, `p_ip_ozeti`
64 haneli kucuk harf hex degilse 22023. Sayac atomik; IP ya da toplam doluysa hicbir sayac artmaz. Gun = Europe/Istanbul.

### A) Girissiz hak kapisi - `app/lib/girissiz-ai.ts` (yeni, `server-only`)

`girissizHakKullan(supabase): Promise<{ izin: true; kalan: number } | { izin: false; neden: 'ip' | 'toplam' | 'kapali' }>`
- Anahtar `process.env.AI_GIRISSIZ_ANAHTAR`; yoksa `{ izin: false, neden: 'kapali' }` (KAPALI baslar, acik degil).
- IP: `headers()` -> `x-forwarded-for` ilk deger, yoksa `x-real-ip`, yoksa `'bilinmiyor'` (Vercel bu basliklari kendisi yazar).
- Ozet: `sha256(anahtar + ':' + gun + ':' + ip)` hex (Node `crypto`); gun = Europe/Istanbul `YYYY-MM-DD`. Ham IP hicbir yere
  yazilmaz / loglanmaz.
- RPC hatasi (ag, 42501, 22023) -> `console.error` (kod + mesaj, anahtar ve IP YOK) + `{ izin: false, neden: 'kapali' }`.
- Ayni dosyada Turkce mesaj esleme (tek kaynak):
  - `ip`: "Bugünlük ücretsiz Kashe AI hakkın doldu (günde 3). Ücretsiz üye olup devam edebilirsin."
  - `toplam`: "Kashe AI şu an çok yoğun. Giriş yaparak hemen devam edebilirsin."
  - `kapali`: "Girişsiz Kashe AI şu an kullanılamıyor. Giriş yaparak devam edebilirsin."

### B) `analyzeEventNeeds` girissiz calisir - `app/lib/ai-actions.ts`

- `user` yoksa: model cagrisindan ONCE `girissizHakKullan`; izin yoksa `{ success: false, error: <mesaj>, girisGerekli: true }`.
  Uzunluk / bos metin dogrulamasi haktan ONCE yapilir (gecersiz girdi hak yemez).
- Girissizde `event_briefs` / `event_spec_versions` YAZILMAZ (RLS zaten izin vermez; hata logu da olmasin): `briefId` /
  `specVersionId` donmez, `spec` ve `provenance` doner.
- Donus tipleri: basarida istege bagli `kalanHak?: number` (yalniz girissiz), hatada istege bagli `girisGerekli?: boolean`.
- Diger AI eylemleri (`generateListingDescription`, `generateProfileBio`, `generateServiceDescription`) girisli kalir.
- `recommendProfessionals` ve yalniz onun kullandigi tip / sabitler (`ProMatch`, `ProMatchResult`, `MATCH_POOL_LIMIT`,
  `BIO_SNIPPET_LEN` - baska kullanan yoksa) SILINIR (E'den sonra cagiran kalmaz).

### C) Tek giris `/kashe-ai` - `app/kashe-ai/` (iki kartli sayfa yerine)

1. Sayfa (sunucu): aktif kategoriler (`id, slug, name_tr`), sehirler, etkinlik turleri (`etkinlikTurleri()`), oturum var mi.
   Baslik ve aciklama tek kutuyu anlatir: "Etkinliğini ya da aradığın profesyoneli anlat." (yer tutucu ornek: "Eylül'de
   İstanbul'da 150 kişilik bahçe düğünü; fotoğrafçı ve DJ arıyoruz.").
2. Istemci: tek `textarea` (1000 karakter, en az 10) + "Kashe AI'a sor" dugmesi -> `analyzeEventNeeds`. URL'de `?metin=` kutuyu
   doldurur; `?metin=...&otomatik=1` analizi bir kez kendiliginden baslatir (sihirbazdaki EK-3 kalibi; ikinci kez tetiklemez).
3. Sonuc ekrani (tek AI cagrisi; profesyonel listesi VERITABANINDAN, ikinci model cagrisi YOK):
   - "Anladıklarım" satiri: tur, sehir, tarih, kisi sayisi (spec'te olanlar; olmayan gosterilmez).
   - Niyet `spec.suggested_roles` sayisindan: **tek rol** -> "Aradığın: <rol>" + o rolden en fazla 6 aday + "Keşfet'te tümünü
     gör"; ikincil dugme "Etkinlik olarak planla". **Birden cok rol** -> "Etkinliğin için önerdiklerimiz": her rol (en fazla 5)
     gerekce + en fazla 3 aday + "Tümü"; birincil dugme "Etkinliği oluştur ve teklif topla". Rol yoksa bugunku "uygun oneri
     bulunamadi" metni.
   - Ipucu kutusu (`tip`) ve bugunku yapay zeka uyarisi satiri.
   - Adaylar: yeni sunucu eylemi `app/kashe-ai/actions.ts` `kasheAiAdaylar({ rolSluglari, sehirId, etkinlikTuru })` - her rol
     icin `v_providers_public`, gorunurluk Kesfet ile ayni (`applyDiscoverBase`), `primary_category_id` = rolun kategorisi; sehir
     verildiyse once sehirle, sonuc yoksa sehirsiz (o rolde "<sehir>'da bulunamadı, Türkiye geneli" notu). Siralama Kesfet'in
     varsayilan siralamasiyla ayni yardimci varsa o, yoksa `trust_score` azalan + `created_at` azalan. Kart = Kesfet karti
     (`app/kesfet/profile-card.tsx`; yeni kart tasarimi YOK); ad gosterimi Duzeltme 05 kurali (`kamuAdi` / `gosterilecekAd`;
     tam ad tarayiciya gitmez). Girisi gerektirmez, hak yemez.
   - "Keşfet'te tümünü gör" / "Tümü": `/kesfet?kategori=<id>&sehir=<id>&etkinlik=<tur>` (olanlar).
   - "Etkinliği oluştur..." / "Etkinlik olarak planla": D'deki ortak yardimciyla spec'ten sihirbaz URL'si (ikinci analiz YOK).
4. Girissiz: basarili sonucun altinda kucuk not "Girişsiz kullanım: bugün {kalan} hakkın kaldı."; `girisGerekli` hatasinda mesaj +
   iki baglanti "Ücretsiz üye ol" (`/uye-ol`) ve "Giriş yap" (`/giris?redirect=` + metinli `/kashe-ai` donusu). Girisli
   kullanicida not yok.

### D) Sihirbaz - `app/etkinlik-sihirbazi/`

1. Ortak saf yardimci `app/lib/sihirbaz-url.ts`: `spectenSihirbazParametreleri(spec, kategoriler, metin)` -> `URLSearchParams`.
   `sihirbaz-client.tsx` `analizEt` icindeki yama kurma mantigi (tur, sehir, ilce, tarih, bitis, esnek, katilimci, butce, mekan,
   baslik, kategoriler / adet / opsiyonel, tarih_notu / sehir_notu, dolu adimlari atlama `adim` + `atlanan`) BIREBIR buraya tasinir;
   sihirbaz ve `/kashe-ai` ayni fonksiyonu kullanir. `brief` / `surum` yalniz verildiyse eklenir.
2. "Anlat" adiminda girissiz analiz serbest: `analizEt` icindeki giris duvari kalkar; `girisGerekli` hatasinda C4'teki mesaj ve
   baglantilar. "Onayla" adimindaki giris duvari AYNEN kalir (giris donusu URL durumu korunur; `confirmEventFromWizard` brief yoksa
   form ozetiyle acar - degismez).
3. Girissizde basarili analiz sonrasi kucuk "bugün {kalan} hakkın kaldı" notu (C4 ile ayni metin).

### E) Eski girisler tek girise

- `next.config.ts` `redirects()`: `/etkinlik-planla` ve `/pro-bul` -> `/kashe-ai` (kalici). `app/etkinlik-planla/` ve
  `app/pro-bul/` silinir.
- Ana sayfa hero aramasi (`app/components/sections/hero-ai-search.tsx`) `/kashe-ai?metin=...&otomatik=1`'e gider (bugun sihirbaz).
- Kashe AI bolumu (`app/components/sections/kashe-ai-section.tsx`): iki ornek kart kalir; ikisi de `/kashe-ai?metin=<ornek girdi>`
  (otomatik YOK - hak yemesin); bag metinleri "Kashe AI'a sor →".
- `app/hakkimizda/page.tsx` ("Etkinliğini planla") ve `app/kategori/[slug]/page.tsx` (`/pro-bul`) -> `/kashe-ai`;
  `app/sitemap.ts`'ten `/pro-bul` cikar, `/kashe-ai` yoksa eklenir.
- Kesfet yakin sonuclar baglantisi "Kashe AI'a anlat" (Duzeltme 05) arama metnini tasir: `/kashe-ai?metin=<q>`.
- `/etkinlik-sihirbazi` dogrudan baglantilari (kurumsal RFP, Kashe AI bolumundeki eski kart) degismez / kalkar - sihirbaz yerinde
  kalir.

### F) Ortam

`AI_GIRISSIZ_ANAHTAR` icin `.env.example` (varsa) satiri (deger bos). Baska ortam degiskeni yok.

### Kabul olcutleri

- `npx tsc --noEmit`, degisen dosyalarda `npx eslint`, `npm run build` temiz.
- `grep -rn "pro-bul\|etkinlik-planla\|recommendProfessionals" app` yalniz `next.config.ts` yonlendirmesinde kalir (komutu
  raporda goster).
- Rapor: bolum bazinda degisen / silinen dosyalar; `analyzeEventNeeds` girissiz akisinin once / sonra ozeti; C3 niyet kurali
  ornekleri (tek rol / cok rol / rol yok). Smoke icin acik sunucu birakma; `.env.local` degerini yazdirma.

### Onizleme turu (Claude yapacak)

Anonim: `/kashe-ai` "İstanbul'da düğün fotoğrafçısı" -> tek rol, 6 aday "Ad S.", kalan 2; cok rollu etkinlik metni -> roller +
adaylar + "Etkinliği oluştur" -> sihirbaz dolu adimda (ikinci analiz yok), "Onayla" giris ister; 4. analiz -> hak doldu mesaji +
uye ol / giris; hero aramasi -> `/kashe-ai` otomatik; `/pro-bul` ve `/etkinlik-planla` -> `/kashe-ai`. Girisli: hak notu yok,
sihirbaz brief kaydi bugunku gibi.
