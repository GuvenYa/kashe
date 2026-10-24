# Claude Code gorevi — FAZ 9b / P1: Fiyat kiyasi yuzeyleri (sihirbaz butce kutusu, Kesfet ipucu, teklif editoru ipucu, pro profil pazar karti, admin zeka blogu)

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: `docs/envanter/34-faz9-zeka-katmani.md` bolum 3 (9b; kararlar 4, 8) +
`supabase/migrations/20261026120000_faz9b_01_fiyat_kiyaslari.sql` (DB dalda ve uretimde). Dal: `faz9b/p1` (Guven acar). **Migration/RPC
YOK; `price_benchmarks` tablosu HICBIR yerden dogrudan okunmaz** — tek okuma yolu RPC: `price_benchmark_lookup(p_role_id, p_city_id,
p_event_type)` ve `price_benchmark_lookup_many(p_role_ids int[], p_city_id, p_event_type)` (anon + authenticated; yalniz YAYINLI satir doner,
yoksa BOS) ve admin icin `price_benchmarks_summary()` (42501 admin degilse). Yayinli hucre yoksa yuzeyde HICBIR SEY cizilmez — "veri yok"
yazisi bile yok (karar: esik alti gorunmez).

---

Kashe reposundasin. Once `git status` (temiz; dal `faz9b/p1`). Oku: `CLAUDE.md`, `DESIGN.md` bolum 9, migration dosyasi (RPC imzalari ve donus
alanlari asagida), `app/lib/para.ts` (`formatTL`, `formatTLAralik`, `sayiMetni`), `app/etkinlik-sihirbazi/page.tsx` + `sihirbaz-client.tsx`
(URL durumu: `tur`, `sehir`, `kategoriler`, `adet` haritasi; `kategoriler` = `service_categories` — rol slug'i kategori slug'iyla BIREBIR,
FAZ 3a) + `anladim-ozeti.tsx`, `app/kesfet/page.tsx` (tek kategori secimi, `cityId`, kategori -> rol koprusu satir ~226), `app/ajans/teklifler/[id]/page.tsx`
(`etkinlikOzeti`, `TeklifEditoru` prop'lari) + `teklif-editoru.tsx` + `teklif-kalem-tablosu.tsx` (`KalemSatiri.role_id`, `duzenlenebilir`,
fiyat girdisi) + `teklif-data.ts`, `app/profil/page.tsx` (kendi profili; `isPro`, `profile.city_id`, `primary_category_id`),
`app/admin/zeka/page.tsx` + `app/lib/zeka.ts` + `app/lib/grafik-tema.ts` (9a-P1 deseni: `Promise.all` RPC, `PanelKart`, `KpiSatir`, `VeriTablosu`,
recharts), `app/components/panel/*`.

**Kirmizi cizgi:** migration/RPC YOK; `from('price_benchmarks')` HICBIR dosyada gecmez; fiyat UYDURULMAZ — yalniz RPC'nin dondurdugu p25/medyan/
p75 gosterilir; tek turetme sihirbazda `adet x medyan` toplami (gosterim; "~" ile); ipuclari teklif fiyatini, liste fiyatini, hicbir alani
DEGISTIRMEZ; tutar `formatTL`/`formatTLAralik`; sapkali harf yok, yorumlar ASCII, UI Turkce. Commit ATMA.

## 0) RPC donus sekli

`price_benchmark_lookup(p_role_id integer, p_city_id integer default null, p_event_type text default null)` → 0 ya da 1 satir:
`{ median, p25, p75, sample_size, period_end, granularity }`; `granularity` ∈ `role_city_type` (rol + sehir + tur) · `role_city` (rol + sehir)
· `role` (rol, Turkiye geneli). En dar yayinli satir doner; sehir/tur verilmezse ya da o hucre yayinli degilse daha kaba satira duser.
`price_benchmark_lookup_many(p_role_ids integer[], ...)` → rol basina 0/1 satir, `role_id` sutunu ekli. Yayinli olmayan rol satir DONDURMEZ.
`price_benchmarks_summary()` → `{ period_end, period_start, threshold (15), cells_total, cells_published, observations_total,
by_granularity: { role_city_type: {total, published}, role_city: {...}, role: {...} }, published_cells: [{ role_id, role_name, city_id,
city_name, event_type, event_type_name, granularity, sample_size, p25, median, p75, average }] (<= 50), near_threshold: [{ ... sample_size,
missing }] (<= 20) }`; hic hesap yoksa `period_end: null`, sayilar 0, diziler bos.

## 1) Ortak katman

- **`app/lib/fiyat-kiyas.ts`** (istemci/sunucu ortak; React ve DB yok): `type PazarKiyasi = { roleId: number; median: number; p25: number;
  p75: number; sampleSize: number; periodEnd: string; granularity: 'role_city_type' | 'role_city' | 'role' }`; `GRANULARITY_ETIKETI` =
  { role_city_type: 'bu şehir ve etkinlik türünde', role_city: 'bu şehirde', role: 'Türkiye genelinde' }; `kiyasSatirindan(row)` (RPC
  satiri -> `PazarKiyasi`, sayilar `Number(...)`); `pazarAraligi(k)` → `formatTLAralik(p25, p75)`; `konum(fiyat, k)` → `'altinda' | 'icinde'
  | 'ustunde'` (fiyat < p25 / p25..p75 / > p75; fiyat null -> null). Metin sablonu: "son 90 gün · N işlem" (`sampleSize` `sayiMetni`).
- **`app/lib/fiyat-kiyas-data.ts`** (SUNUCU; `import 'server-only'` deseni projede nasilsa oyle): `pazarKiyaslari(roleIds: number[], cityId: number | null,
  eventType: string | null): Promise<Map<number, PazarKiyasi>>` — `createClient()` (supabase-server) ile `rpc('price_benchmark_lookup_many',
  { p_role_ids, p_city_id, p_event_type })`; hata → bos Map (ipucu sessizce cizilmez; konsola `console.error` degil — fiyat ipucu kritik degil);
  `roleIds` bos → RPC cagrilmaz. `rolIdleriSlugdan(slugs: string[]): Promise<Map<string, number>>` — `service_roles` `select('id, slug')`
  `.in('slug', slugs).eq('is_active', true)`.

## 2) Sihirbaz butce kutusu (`/etkinlik-sihirbazi`)

- `page.tsx`: mevcut `Promise.all`'a `service_roles` `select('id, slug').eq('is_active', true)` eklenir; `SihirbazClient`'a `rolIdler:
  Record<string, number>` (slug -> id) gecer.
- Yeni istemci bileseni **`app/etkinlik-sihirbazi/pazar-butce-kutusu.tsx`**: prop'lar `roller: { slug: string; ad: string; adet: number }[]`
  (secili kategoriler; `adetHaritasi`), `rolIdler`, `sehirId: number | null`, `tur: string | null`. `useEffect` (400 ms debounce; `AbortController`
  yerine `iptal` bayragi) → `createClient()` (supabase-browser) `rpc('price_benchmark_lookup_many', { p_role_ids: idler, p_city_id, p_event_type })`.
  **Kutu yalniz HER secili rol icin satir dondugunde cizilir** (bir rol bile yayinli degilse toplam yaniltir → hic cizilmez; yukleme/hata
  durumunda da cizilmez). Icerik: eyebrow "Pazar kıyası"; baslik "Benzer etkinliklerde bu roller ~{formatTL(Σ adet x medyan)}"; alt satir
  mono "son 90 gün · {GRANULARITY_ETIKETI[en kaba granularity]}"; altinda rol basina satir "{ad} × {adet} · medyan {formatTL} · {N} işlem".
  Yerlesim: `AnladimOzeti`'nin hemen altinda (tum adimlarda gorunur; adim 3 butce girilirken de). Rakam uretmeme kurali (anladim-ozeti
  yorumu) burada DELINMEZ: toplam yalniz RPC medyanlarinin adetle carpimi, "~" ile; yuvarlama yok, `formatTL` ne verirse o.
- Sihirbaz anonim de calisir: RPC anon'a acik; oturum kontrolu YOK.

## 3) Kesfet ipucu (`/kesfet`)

- `page.tsx` (sunucu): TAM 1 kategori secili ise kategori slug'indan rol (`rolIdleriSlugdan`), `pazarKiyaslari([rolId], cityId, null)`; satir
  varsa sonuc listesinin ustunde ince serit (`app/kesfet/pazar-ipucu.tsx`, sunucu bileseni, prop `kiyas: PazarKiyasi` + `rolAdi`):
  "{rolAdi} {GRANULARITY_ETIKETI[granularity]} genelde {pazarAraligi} · medyan {formatTL} · son 90 gün, {N} işlem". Sehir secili degilse
  granularity `role` doner ve metin "Türkiye genelinde" der (dogru). Satir yoksa serit YOK. Birden fazla kategori / kategori yok → serit yok.
  Stil: `bg-paper-2 border border-line rounded-xl px-4 py-2.5 text-sm`, eyebrow mono "Pazar kıyası".

## 4) Teklif editoru ipucu (`/ajans/teklifler/[id]`)

- `page.tsx`: `events` secimine `city_id` eklenir; `kalemler`'deki tekil `role_id`'ler → `pazarKiyaslari(roleIds, ev?.city_id ?? null,
  ev?.event_type ?? null)` (etkinlik yoksa / erisim yoksa `null, null` → `role` duzeyi doner; bu da gosterilir, etiketi "Türkiye genelinde").
  Yalniz `kurulus.canManageProposals` ise hesaplanir; degilse `pazarKiyaslari` bos Map (satici ekibinde fiyat yetkisi olmayan ipucu gormez).
  `TeklifEditoru` → `TeklifKalemTablosu`'na `pazarKiyaslari: Record<number, PazarKiyasi>` prop'u (serilestirilebilir; Map DEGIL).
- `teklif-kalem-tablosu.tsx`: fiyat hucresinin ALTINDA, yalniz `duzenlenebilir && kalem.role_id != null && pazarKiyaslari[role_id]` ise
  `font-mono text-[10px] text-ink-50` satir: "Pazar: medyan {formatTL} · {GRANULARITY_ETIKETI} · {N} işlem" (`kashe-tap` degil, tiklanmaz).
  Fiyat girdisine, toplama, kaydetmeye DOKUNMAZ. Dondurulmus/gonderilmis surumde cizilmez (`duzenlenebilir` zaten false). Yeni eklenen kalem
  (`role_id` null) ipucu almaz.

## 5) Pro profil pazar karti (`/profil`, kendi)

- `page.tsx` (sunucu), yalniz `isPro`: rol = `v_provider_roles` `provider_id = user.id AND role_is_active` icinden `is_primary`, yoksa TEK rol
  (birden fazla ve birincil yoksa kart YOK — DB kurali ile ayni); sehir `profile.city_id`; `pazarKiyaslari([rolId], cityId, null)`; satir yoksa
  kart YOK. Kendi fiyati: ayni `v_provider_roles` satirinin `price_min` / `price_max` (`pricing_mode` 'on_request' ya da ikisi de NULL →
  "Fiyatını Hizmetlerim'den gir" alt satiri + `/profil/hizmetlerim` baglantisi).
- Kart `PanelKart` basligi "Pazar aralığı"; "Kuruluşlarım" kartindan ONCE. Icerik: eyebrow mono "{rol adi} · {GRANULARITY_ETIKETI}";
  buyuk satir `pazarAraligi` ("4.750 – 12.250 TL"); alt satir "medyan {formatTL} · son 90 gün · {N} işlem"; kendi fiyati satiri:
  "Senin liste fiyatın: {formatTLAralik(price_min, price_max)}" + konum rozeti (`konum(price_min ?? price_max, kiyas)`): altinda → "pazarın
  altında" (`text-ink-72`), icinde → "pazar aralığında" (`text-moss`), ustunde → "pazarın üstünde" (`text-brand-accent`). Kucuk not
  (`text-xs text-ink-50`): "Kıyas, Kashe üzerinden gönderilen teklif ve kabul edilen fiyatlardan hesaplanır; liste fiyatları dahil değildir."
  Yalniz kendisine gorunur (bu sayfa zaten kendi profili); `/p/[slug]` kamu profiline HICBIR SEY eklenmez.

## 6) Admin `/admin/zeka` — Blok 4 "Fiyat kıyasları"

- Ilk `Promise.all`'a `rpc('price_benchmarks_summary')` eklenir (pencere seciciden BAGIMSIZ; pencere degisince yeniden cekilmez). Hata
  (42501 dahil) → blok icinde sade metin (`hataMetni` ile ayni esleme).
- `PanelKart baslik="Fiyat kıyasları · yayınlanan hücreler"`; `KpiSatir` 4: "Hücre" (`cells_total`), "Yayınlanan" (`cells_published`,
  `vurgu="moss"` yayinli > 0 ise), "Gözlem" (`observations_total`; altNot "son 90 gün"), "Eşik" (`threshold` + " işlem"; altNot `period_end`
  `tarihMetni`).
- **Grafik:** gruplu `BarChart` (yukseklik 200): X = aile ("Rol+şehir+tür", "Rol+şehir", "Rol"), iki seri "Toplam" (`C.brandInkDeep`) ve
  "Yayınlanan" (`C.moss`); `Legend`. Veri `by_granularity` (eksik anahtar 0).
- **Tablo 1** (`VeriTablosu`, `published_cells`): "Rol" (`role_name`), "Şehir" (`city_name ?? 'Tümü'`, `dar`), "Tür" (`event_type_name ??
  'Tümü'`, `dar`), "İşlem" (`sayisal`), "p25" / "Medyan" / "p75" (`sayisal`, `formatTL`). Bos → `bosMetin` "Yayınlanan hücre yok (eşik {threshold}
  işlem)."
- **Tablo 2** "Eşiğe yakın" (alt baslik `font-display text-sm`; `near_threshold`): "Rol", "Şehir" (`dar`), "Tür" (`dar`), "İşlem" (`sayisal`),
  "Eksik" (`sayisal`, `missing`). Bos → "Eşiğe yakın hücre yok."
- `period_end` null → KPI'lar "—", grafik/tablolar yerine "Henüz hesap yok." Blok yerlesimi: Blok 1'in altinda tam genislik; Blok 2-3 gridi
  onun altinda.
- `app/lib/zeka.ts`: `AILE_ETIKETI` = { role_city_type: 'Rol+şehir+tür', role_city: 'Rol+şehir', role: 'Rol' } (grafik/tablo icin;
  `fiyat-kiyas.ts`'teki cumle etiketlerinden farkli — biri baslik, oteki cumle ici).

## 7) Dogrulama

- `node node_modules/typescript/lib/tsc.js --noEmit -p tsconfig.json` ve degisen/yeni dosyalarda `npx eslint <dosyalar>` temiz; `npm run build` gecer.
- `grep -rn "from('price_benchmarks')" app` BOS; `grep -rn "price_benchmark_lookup\|price_benchmarks_summary" app` yalniz RPC cagrilari.
- `grep -rnP '[âîûÂÎÛ]' <yeni/degisen dosyalar>` bos.
- Istemci → sunucu import yok (`fiyat-kiyas-data.ts` yalniz sunucu dosyalarindan import edilir; istemci bilesenler `fiyat-kiyas.ts` kullanir).
- Uretimde yayinli hucre buyuk olasilikla YOK: tum yuzeylerin "hicbir sey cizmeme" dali dogru calismali (bos serit, bos kart, bos kutu
  OLMAMALI). Admin blogu "Yayınlanan hücre yok (eşik 15 işlem)." der — tek gorunen yer orasi.

## 8) Rapor

Bitince kisa rapor: yeni/degisen dosyalar, her yuzeyin "satir yoksa" davranisi, teklif sayfasinda `events` secimine eklenen alan, sapmalar
(yapilamayan ya da farkli yapilan maddeler — gerekcesiyle). Commit ATMA.
