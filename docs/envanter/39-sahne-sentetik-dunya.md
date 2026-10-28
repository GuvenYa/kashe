# 39 — Sahne: sentetik test dunyasi (dal projesi)

**Amac (Guven, 27 Ekim 2026):** Gercek olmayan onlarca profille Kashe'yi gercekten *kullanmak*: her kategoriden profesyoneller,
ajanslar, kurumlar ve musteriler; ici dolu profiller, fotografli portfoyler; 6 aylik gecmis (konusma, teklif, rezervasyon, yorum).
Bu hesaplara girip ajans gibi ekip kurmak, teklif almak/vermek, admin panelinde veri biriktirmek, FAZ 9 zeka katmaninin (olay zinciri,
fiyat kiyaslari, guven puani) ilk gunden dolu calismasini gormek ve eksikleri senaryo senaryo bulmak.
**Durum (27 Ekim 2026 gece):** KURULDU — dal Sahne'de 171 hesap + 6 aylik gecmis + 763 portfoy fotografi; onizleme (`sahne` dali)
Sahne'ye bagli. Senaryo turlari: admin, ajans (sihirbaz -> eslestirme -> ekip -> teklif -> portal onayi -> rezervasyon), profesyonel
(itiraz acildi), musteri (yorum, Teklif Al) YAPILDI; **kurum (RFP) turu ve admin'de itiraz karari KALDI.** Bulgular: `docs/sahne/bulgular.md`
(32 madde; Y: #11 duzeltildi, #29 acik). Sonraki oturum sirasi bolum 11.

## 1. Kararlar (Guven, 27 Ekim 2026)

1. **Dal projesi (`ukqhgspaallzjscjodbb`) = Sahne.** Vercel *Preview* ortam degiskenleri dal projesine cevrilir; onizleme adresleri artik
   Sahne'ye baglanir. **Uretim (`qydsooqmflrrwtgawhsv`) dokunulmaz;** Production ortam degiskenleri aynen kalir.
2. **Once Sahne kurulumu, sonra FAZ 10.** FAZ 10 dilimleri dolu dunyada turlanir (migration sirasi degismez: dal -> uretim).
3. **Orta olcek:** ~122 profesyonel (23 kategorinin hepsi), 12 ajans, 8 kurum, 20 musteri. Turkce gercekci veri; 10 sehir
   (Istanbul/Ankara/Izmir agirlikli); ajanslarda 3-8 kisilik ekipler; portfoyde 4-8 fotograf.
4. **Fotograf: kategoriye gore acik lisansli** (Wikimedia Commons, CC0 / CC BY / CC BY-SA / kamu mali). Kaynak ve lisans kaydedilir,
   portfoy altyazisinda atif gosterilir. **Avatarlarda gercek yuz yok:** harf avatari (ad-soyad bas harfleri, sabit renk).
5. **Gecmis veri uretilir:** son 6 ay (27 Nisan - 27 Ekim 2026) icin konusmalar, mesajlar (yanit sureleri), teklifler (quote + ajans
   proposal), rezervasyonlar (tamamlanan / planlanan / iptal), yorumlar; sonra `price_benchmarks_compute` ve `trust_score_compute`.

## 2. Ortam

| Ortam | Supabase | Veri | Kim girer |
|---|---|---|---|
| Uretim (`kashe.net`, Vercel Production) | `qydsooqmflrrwtgawhsv` | Gercek | Gercek kullanicilar; biz yalniz test hesabiyla UI'dan, salt okunur |
| **Sahne** (Vercel Preview `kashe-git-<dal>-...vercel.app` + yerel dev) | `ukqhgspaallzjscjodbb` | asama4 fixture'lari (`faz1test+...`) + **Sahne** (`sahne+...`) | Guven, Sahne hesaplariyla |
| Yerel harness (PG16, `kashe_zincir`) | — | Sema + fixture + Sahne provasi | Uretec testi (bu dosyanin yazari) |

**Vercel degisikligi (tek sefer):** Vercel -> kashe projesi -> Settings -> Environment Variables -> `NEXT_PUBLIC_SUPABASE_URL` ve
`NEXT_PUBLIC_SUPABASE_ANON_KEY` satirlarinda **yalniz Preview** kapsamindaki degerler dal projesinin URL'i ve *anon public* anahtariyla
degistirilir (Production kapsami aynen kalir). Sonra herhangi bir dal push'u yeni onizlemeyi Sahne'ye baglar. `NEXT_PUBLIC_BAKIM_MODU`
Preview'da `false` olmali (proxy.ts bakim kapisi). Service role anahtari Vercel'e EKLENMEZ, kimseyle paylasilmaz.

**Dal migration akisi degismez:** yeni migration once dala (`supabase link --project-ref ukqh... && supabase db push`), asama4 +
asamaN dalda, sonra uretime. Sahne verisi dalda kalici oldugu icin asama4'un **uretim korumasi** guncellendi (bolum 3).

## 3. Adlandirma, koruma, temizlik

- **Kimlikler:** `auth.users.id` = `profiles.id` = `providers.id` sabit: `5a4e0000-0000-4000-8000-0000000NNNNN` (`5a4e` = "SAHNE";
  NNNNN sira: 10001.. profesyoneller, 20001.. ajanslar, 30001.. kurumlar, 31001.. kurum uyeleri, 40001.. musteriler, 90001 yonetici). Ayni id ile
  yeniden calistirmak guvenli: uretec once **kendi verisini siler** (`00-sahne-temizlik.sql` ile ayni mantik), sonra yazar.
- **E-posta:** `sahne+<slug>@kashe.net` (orn. `sahne+elif-kaya@kashe.net`, `sahne+ajans-nova@kashe.net`). **Parola (hepsi):**
  `Sahne!2026`. Gercek posta kutusu yok; bildirim e-postalari dalda zaten gonderilmez (pg_cron isi yalniz uretimde).
- **Uretim korumasi:** asama4 ve tur betikleri "test disi profil > 10" sayarken `email NOT LIKE 'faz1test+%' AND email NOT LIKE
  'sahne+%'` kullanir (guncellendi). Sahne betiklerinin kendi korumasi da ayni: pg_cron `send-message-notifications` varsa veya
  `faz1test+`/`sahne+` disinda 10'dan fazla profil varsa **hicbir sey yazmaz**. Uretimde yanlislikla calistirilsa durur.
- **asama4 ile birlikte yasama:** asama4 T0 yalniz `a0000000-...` fixture id'lerini siler; Sahne'ye dokunmaz. Sahne verisi asama4
  testlerinin global varsayimlarini bozmaz (harness'ta Sahne yuklu + asama4 34/34 GECTI ile dogrulandi; bolum 9).
- **Temizlik:** `docs/sahne/00-sahne-temizlik.sql` tum Sahne satirlarini (asama4 T0 sirasiyla: etkinlik, hizmet, CRM, gorev, teklif,
  havuz, rezervasyon, mesaj, konusma, uyelik, bildirim, profil, auth) siler; `node scripts/sahne/foto-yukle.mjs --sil` Storage
  nesnelerini kaldirir. Fixture'lar ve gercek sema etkilenmez.

## 4. Kapsam ve dagilim

**Hesaplar (171):** 122 profesyonel (`role=professional`), 12 ajans (`agency`; sahip hesabi), 8 kurum (`business`; sahip) + 8 kurum
uyesi (`client`, `business_members` ile), 20 musteri (`client`), 1 Sahne yoneticisi (`sahne+admin@kashe.net`, `is_admin`; /admin icin).
Ajans ekip uyeleri profesyonellerden secilir (ayri hesap degil).

**Kategori dagilimi (profesyonel):** fotografci 10, dj 9, muzisyen 8, videograf 7, sunucu 6, organizasyon 6, hostes 6, dansci 6,
ses-isik 5, model 5, oyuncu 5, sac-makyaj-styling 5, diger 11 kategori 4'er = 122. ~%25'inin ikinci rolu var (fotografci+videograf,
fotografci+drone-pilotu, dj+ses-isik, muzisyen+dj, sunucu+konusmaci, hostes+model, akrobat+dansci, ...).

**Sehir (agirlik):** Istanbul 40, Ankara 14, Izmir 12, Antalya 8, Bursa 6, Mugla 5, Adana 4, Eskisehir 4, Gaziantep 4, Trabzon 3 (%).
Dalda `turkish_cities` bos oldugu icin 01 betigi 81 ili (plaka + ad) yazar (`WHERE NOT EXISTS`); uretimde zaten dolu.

**Durumlar:** profesyonellerin ~%88'i `approved` + `is_published`; 8'i `pending` (admin kuyrugu icin), 3'u `revision`, 2'si
`rejected`, 2'si `suspended`. Dogrulama: `none` %35, `email` %40, `document` %18, `full` %7. Premium: 10 profesyonel `premium`,
3 ajans `agency`, 2 ajans `plus`.

**Profil icerigi (her profesyonel):** `full_name`, `slug`, `bio` (>=120 karakter; kategoriye ozel sablon + sehir + yil + uzmanlik),
`phone`, `city_id`, `primary_category_id`, `avatar_url`, `last_seen_at`, `kvkk_approved_at`; `professional_profiles`: `headline`,
`experience_years`, `languages`, `equipment`; `attributes` (12 eski kategori: filter-config secenekleri) **veya**
`category_attributes` (11 yeni kategori: `quick`, `logistics`, `modules`, `service_region`, `experience_label`, `calisma_sekli`,
`summary` (uzmanlik arketipi), `skills` (cast)); `services` 1-3 (kategori alt hizmet adlari, fiyat araligi, `price_unit`);
`profile_experiences` 2-4 (work/education/award); `availability_blocks` 2-6 gelecek tarih; `portfolio_items` 4-8 (foto hattindan).

**Ajans (12):** `company_name` + `slug`, `organization_profiles` (`about`, `team_size_range`, `can_full_service`, `subcontracts`,
`min_project_budget`, `portfolio_scale`), 2-3 hizmet, 6-8 portfoy, `agency_members` 3-8 uye (manager/member; `trg_faz0_sync_*`
`organization_memberships`'e aynalar), `faz5_backfill_agency_members()` ile Ekibim havuzu + 2-4 dis (harici) havuz kaydi,
`suppliers` 2-4, `contacts` 3-5, `crm_leads` 2-4, `tasks` 3-6, 2-4 etkinlik (`events`), teklifler (bolum 7).

**Kurum (8):** sektorlu sirketler (teknoloji, perakende, ilac, otomotiv, finans, FMCG, egitim, turizm), sahip + 1 uye,
`organization_profiles` yok (kurum saglayici degil), 2-4 etkinlik (`events` + `event_requirements`), RFP'siz (FAZ 7b akislari turda
elle denenir), 1-2 `quote_requests` (teklif topla).

**Musteri (20):** sosyal etkinlik sahipleri; konusma/teklif/rezervasyon/yorum gecmisi; 2-6 favori.

## 5. Uretec

`scripts/sahne/uret.py` (Python 3, bagimliliksiz, sabit tohum `--seed 2026`) -> `docs/sahne/`:

| Dosya | Icerik | Calistirma |
|---|---|---|
| `00-sahne-temizlik.sql` | Koruma + tum Sahne satirlarini siler | Dal SQL Editor (gerekince) |
| `00-sahne-taksonomi.sql` | 23 kategori eksikse ekler (yalniz harness / guvence; dalda 0 satir yazar) | Dal: calistir, "0 eklendi" bekle |
| `01-sahne-hesaplar.sql` | 81 il; 171 `auth.users` (+`handle_new_user` -> profil, saglayici, kurulus); profil alanlari; hizmetler; deneyimler; uyelikler; havuz; tedarikci/CRM/gorev; favori; musaitlik | Dal SQL Editor (~30 sn) |
| `02a..02e-sahne-gecmis.sql` | 6 aylik akis (bolum 7) + zaman duzeltme; Dashboard SQL Editor boyut siniri ("Query is too large") yuzunden ~380 KB'lik 5 parca, sirayla ve atlamadan (02a kendi gecmisini silip bastan baslar; 02b+ on kosul kontrol eder) | Dal SQL Editor, 5 kez |
| `03-sahne-hesap.sql` | `price_benchmarks_compute`, `trust_score_compute`; ozet ciktilar | Dal SQL Editor |
| `foto-plan.json` | Her saglayici icin kategori + fotograf adedi + avatar bas harfleri/renk (betik girdisi) | `scripts/sahne/foto-*.mjs` okur |

Kaynak girdileri `scripts/sahne/kaynak/*.json` uygulama konfigurasyonundan turetildi (brief-config, filter-config, category-fields,
category-content alt hizmetleri); uretec bunlari okuyarak `attributes`/`category_attributes`/brief alanlarini **uygulamanin
bekledigi sekilde** yazar (Kesfet filtreleri ve /p/[id] modulleri dolu gorunur).

Teknik notlar: `auth.users` satirlari asama4 T1 kalibiyla (`extensions.crypt`, `email_confirmed_at`, `raw_user_meta_data`
`role/full_name/company_name/phone/city_id/kvkk_approved`); profil guncellemeleri superuser ile (koruma tetikleyicileri admin
disinda alanlari kilitler; `kashe.sync_bypass` yalniz `providers` dogrulama/puan alanlari icin). Teklifler `kashe.faz7_rpc='1'`
bayragiyla dogrudan yazilir (RPC kurallari), `sent_at` ilk kez atanirken gecmis tarih alir (sonradan degismez kurali korunur).
Olay zinciri tetikleyicileri (FAZ 9a) calisir; `occurred_at` degerleri son adimda varlik zamanlarina esitlenir (`now()` yazanlar).

## 6. Fotograf hatti (Guven'in makinesinde)

Konteyner ve cihaz VM'inden Commons/Openverse'e erisim yok (proxy); bu yuzden indirme ve yukleme **Guven'in makinesinde** kosar:

1. `node scripts/sahne/foto-indir.mjs` — kategori basina arama terimleriyle Wikimedia Commons API (`generator=search`,
   `iiprop=url|extmetadata`), lisans filtresi (CC0, CC BY, CC BY-SA, PD; `NonCommercial`/`NoDerivatives` disi), en az 1200px, en
   fazla 30 gorsel/kategori; 1600px'e `sharp` ile kucultme (JPEG q82); `docs/sahne/foto/<kategori>/NN.jpg` + `docs/sahne/foto/lisans.json`
   (dosya, Commons sayfasi, sanatci, lisans, lisans URL'i) + `docs/sahne/foto/onizleme-<kategori>.jpg` kontak sayfasi (kalite kontrolu).
   `docs/sahne/foto/` git'e girmez (`.gitignore`), `lisans.json` girer.
2. `node scripts/sahne/foto-yukle.mjs` — `foto-plan.json`'a gore her saglayiciya kategori havuzundan 4-8 gorsel (ayni gorsel birden
   cok profilde olabilir; her profil kendi yolunda: `portfolio/<uid>/sahne-NN.jpg`), harf avatari PNG (`avatars/<uid>/avatar.png`),
   `portfolio_items` satirlari (altyazi: "Foto: <sanatci> — <lisans>, Wikimedia Commons") ve `profiles.avatar_url` guncellemesi.
   Gerekli ortam: `SAHNE_SUPABASE_URL` + `SAHNE_SERVICE_ROLE_KEY` (PowerShell `$env:`; dosyaya yazilmaz, paylasilmaz). `--sil` ile
   Storage nesneleri + portfoy satirlari kaldirilir.

Avatar: SVG (bas harfler, kategoriye gore 8 renkten biri) -> `sharp` -> 256px PNG (`avatars` bucket 2 MB / jpeg-png-webp sinirina uyar).

## 7. Gecmis (27 Nisan - 27 Ekim 2026)

- **Pazaryeri akisi (musteri/kurum uyesi -> profesyonel):** ~260 konusma (`conversations`; cift tekil), her birinde 3-8 mesaj
  (ilk mesaj musteriden; profesyonel yaniti 0.3-60 saat sonra — guven "yanit" bileseni icin dagilim), `brief_data` kategori brief
  alanlariyla; ~%65'inde `quotes` (pending -> accepted %55 / declined %20 / expired %10 / pending kalan), kabul edilenlerde
  `bookings` (tarihi gecenler `completed` %80 / `cancelled` %12 (musteri veya saglayici iptal) / gelecek tarihliler `confirmed`),
  tamamlananlarin %70'inde `reviews` (4-5 agirlikli; 3 ve 2 de var) ve bazen `review_replies`.
- **Ajans akisi (FAZ 4-8):** ajans/kurum etkinlikleri (`events` confirmed/completed/cancelled; `event_requirements`), ajanslardan
  `proposals` (direct; versiyon + kalemler rol bazli, `unit_client_price` kategori araliginda), durumlar sent/viewed/approved/declined/
  revision_requested; onaylananlarda FAZ 7c `bookings` (`proposal_version_id` + `seller_provider_id` + `buyer_organization_id`).
  Istanbul x dugun/kurumsal x (fotografci, dj, muzisyen, videograf, sunucu) hucreleri bilerek yogun (>=15 gozlem) -> fiyat kiyasi
  yayinli; diger hucreler seyrek -> rol/sehir geri dusus gercekci test edilir.
- **Zaman:** `created_at`/`sent_at`/`responded_at`/`completed_at` gecmis; `analytics_events.occurred_at` son adimda esitlenir;
  `conversations.last_message_at` son mesaja cekilir; `notifications` gecmis tarihli ve okunmus (son 14 gun okunmamis).
- **03 hesap:** `price_benchmarks_compute()` (bugun) + `trust_score_compute()` (tum saglayicilar) + ozet: yayinli hucre sayisi,
  guven dagilimi, kategori basina profil/rezervasyon/yorum.

## 8. Calistirma sirasi (Guven)

1. Vercel Preview env -> dal (bolum 2). 2. Dal SQL Editor: `00-sahne-taksonomi.sql` (0 eklendi), `01-sahne-hesaplar.sql`.
3. PowerShell: `node scripts/sahne/foto-indir.mjs` -> kontak sayfalari kontrol (uygunsuz gorsel varsa `lisans.json`'dan sil, tekrar
   kosmadan devam) -> `node scripts/sahne/foto-yukle.mjs`. 4. Dal SQL Editor: `02a` ... `02e-sahne-gecmis.sql` (sirayla), `03-sahne-hesap.sql`.
5. Onizleme/yerel dev ile giris: `sahne+ajans-nova@kashe.net` / `Sahne!2026` vb. (hesap listesi `docs/sahne/hesaplar.md`).
Yeniden kurulum: `00-sahne-temizlik.sql` + `foto-yukle.mjs --sil`, sonra 2-4.

## 9. Senaryo listesi (eksik bulma turu)

A. **Musteri:** Kesfet filtreleri (kategori, sehir, ozellik), profil sayfasi (moduller, portfoy, pazar araligi, guven dokumu), teklif
iste -> konusma -> teklif kabul -> rezervasyon -> yorum; sihirbaz (pazar butce kutusu dolu mu?); favoriler; teklif topla.
B. **Profesyonel:** profil duzenleme + kategori bilgileri, hizmetlerim, portfoy yukleme (Storage politikalari dalda), musaitlik, gelen
talepler, teklif verme, rezervasyon tamamlama, yorum yaniti, guven dokumu + itiraz, premium.
C. **Ajans:** Ekibim (havuz: pazaryeri + harici), davet, rol atama, etkinlik acma, EventSpec, eslestirme (match), ekip kurma, teklif
editoru (pazar ipucu), gonderme (portal baglantisi), onay/revizyon, rezervasyon, gorevler, CRM, tedarikciler, kisa liste.
D. **Kurum:** etkinlik + gereksinim, RFP acma -> ajans davet -> teklif toplama -> karar; uye yetkileri (viewer/admin).
E. **Admin:** onay kuyrugu (pending/revision), zeka sayfasi 5 blok (huni, adalet, fiyat, guven, itiraz karari), raporlar, kategori
talepleri, askiya alma. F. **Zeka:** benchmark hucreleri (yayinli/esik alti), guven dagilimi ve bilesenler, itiraz akisi.
Her senaryoda bulunan eksik `docs/sahne/bulgular.md`'ye yazilir (tarih, hesap, adim, beklenen/gorulen, onem).

## 10. Dogrulama ve riskler

- Harness: Sahne 00-03 yuklu iken asama4 34/34 GECTI (T32 isaret tutarlari 50003/60007 oldu: Sahne tutarlari 500'un katidir), asama19
  K1-K14 ESIT/bilgi. Zaman tutarliligi: gelecek tarihli mesaj/olay/rezervasyon 0; tamamlanma etkinlikten sonra; yorum tamamlanmadan sonra.
  Dalda ayni kontrol 01-03 sonrasi. Harness olcumu: 01 ~2 sn, 02 ~2 sn (462 konusma, 2.633 mesaj, 353 teklif, 304 rezervasyon, 88 yorum,
  74 ajans teklifi, 76 etkinlik), 03: 205 hucre / 19 yayinli (9 rol+sehir+tur), guven 0-100 dagilimi dolu.
- Riskler: (1) Commons arama sonuclari kategoriye tam oturmayabilir -> kontak sayfasi kontrolu; (2) dal `pg_cron` ile gunluk
  `price-benchmarks-daily`/`trust-score-daily` isleri zaten calisir, 03 betigi ilk hesabi aninda yapar; (3) Sahne hesaplari gercek
  e-posta almaz, "sifremi unuttum" akisi test edilemez; (4) Vercel Preview env degisince eski onizleme URL'leri de Sahne'ye baglanir
  (istenen davranis); (5) asama4 uretim korumasi desen degisikligi: `sahne+` eposta deseni uretimde yoksa koruma gucu aynen surer.

## 11. Kaldigimiz yer ve sonraki oturum (27 Ekim gece)

**28 Ekim 2026 guncellemesi:** FAZ 10a-DB/01 yazildi ve harness'ta dogrulandi (asama4 35/35, asama20); durum ve kapanis notu
`38-faz10-temizlik.md` bolum 6, uygulama gorevi `40-claude-code-gorevi-10a-p1-uyelik.md`. Sahne v2 uretec degisiklikleri 38 bolum 6 madde 9'da.


1. **Guven tek basina kontrol eder:** (a) Merve Avci ile /profil/portfoy'dan bir gorsel yukle -> "yuklendi" (Storage politikalari);
   (b) bir musteriyle /p/<pro>'da "Teklif Al" formunu ELLE doldur (tarih + kisi dahil) -> konusma kartinda TARIH ve KISI cikiyor mu
   (bulgu #31); (c) Vercel Preview `NEXT_PUBLIC_SITE_URL` = sahne onizleme adresi (Config) yapildi -> sonraki push'ta portal baglantisi
   onizleme alan adiyla gelmeli (bulgu #16).
2. **Kurum turu** (`sahne+kurum-teknopark@kashe.net` sahip + `sahne+<uye>` uyesi): /kurumsal -> etkinlik + gereksinim -> "Teklif talebi ac
   (RFP)" -> ajans davet (Nova, Lumen) -> ajans tarafinda RFP yaniti -> kurumda karsilastirma -> karar (award) -> rezervasyon; uye
   (viewer) yetkileri. Sonra admin (`sahne+admin`) /admin/zeka itiraz kuyrugu: Merve'nin itirazina karar + not.
3. **Sahne v2 (uretec):** #8 eslestirme gecmisi (`04-sahne-eslestirme.sql`: `run_event_match` + shown/clicked, ajans jwt ile),
   #26 kurum alicilarda kurumsal turler + "'da/'de" ek uyumu, #32 kategoriye ozel performans modulu metni, etkinlik_turleri 3-6 secenek.
   Yeniden kurulum: 00-temizlik + foto-yukle --sil, sonra 01 -> foto-indir/yukle -> 02a..e -> 03 (ya da yalniz 02a..e + 03 ile gecmis).
4. **Uygulama duzeltmeleri (Sahne'den cikan, FAZ 10 oncesi kucuk dal `sahne-duzeltmeler`):** #29 tamamlanan is cipi (SECURITY DEFINER
   ozet; migration + asama4), #28 "Yorum birak" cagrisi, #14 suresi dolan teklif, #6 admin dashboard onay karti, #7 huni baslik KPI,
   #16 preview portal URL (`VERCEL_BRANCH_URL`), #20/#19 kucukler. Urun kararlari: #4, #5, #18, #23.
5. Sonra **FAZ 10a-DB/01** (38 numarali plan), dolu Sahne'de turlanir.

**Karar (Guven, 27 Ekim gece; sira degisti):** Guven tur yapmaz; kota sifirlaninca DOGRUDAN **FAZ 10a-DB/01** ile baslanir.
Kalan kurum (RFP, davet, uye yetkileri) turu 10a-P1'in canli turuna katilir (10a zaten davet/uyelik akisini degistirir); admin itiraz
karari ayni turda verilir. Sahne v2 uretec duzeltmeleri ve uygulama duzeltmeleri (#28, #29, #14, #6, #7, #16) FAZ 10a kapanisindan
sonra, 10b'den once tek kucuk dilim olarak ele alinir (10d'ye de tasinabilir). Madde 1'deki kontroller Guven'e birakilmadi;
10a-P1 turunda ben yaparim.

