# Kashe — Proje Baglami

Bu dosya her oturumda okunur. Kashe'nin ne oldugu, hangi kisitlarla calisildigi ve mimari kararlarin nerede oldugu burada.

---

## Urun

Kashe; etkinlik, eglence, medya ve produksiyon sektorlerinde hizmet alanlari bagimsiz profesyoneller, organizasyon firmalari, ajanslar ve menajerlerle bulusturan dikey bir platform.

Uc katman:

1. **Marketplace** — dogrulanmis profil, portfoy, teklif, rezervasyon, odeme. **Bugun canli.**
2. **Event AI** — serbest Turkce brief'ten yapilandirilmis etkinlik tanimi, aday getirme, eslestirme, ekip onerisi. **Gelistirilecek.**
3. **Event OS / Crew AI** — ajans ve organizatorler icin CRM, ekip, tedarikci, teklif, butce, operasyon yonetimi. **Gelistirilecek.**

Ayrintili urun modeli: `docs/architecture/00-genel-bakis.md`

---

## Teknik yigin

- Next.js 16 (App Router), React, TypeScript
- Tailwind CSS v4
- Supabase (Postgres + RLS + Auth + Storage + Realtime), Frankfurt
- Vercel
- Depo: `GuvenYa/kashe`, canli: `kashe.net`

---

## CALISMA KISITLARI — bunlara mutlaka uy

**Ortam:** Windows + PowerShell + VS Code.

**PowerShell yapistirma sorunu.** Yapistirma sirasinda `<` karakteri dusuyor. SQL veya kod terminale yapistirilmaz; her sey dosya olarak yazilir.

**Migration akisi (14 Eylul 2026'dan itibaren, FAZ -1 sonrasi).** Sema degisikligi = `supabase/migrations/` altinda benzersiz zaman damgali dosya -> `supabase db push` ile once onizleme dalina -> sonra uretime. Dashboard SQL Editor yalniz salt okunur kontroller ve test betikleri (`docs/envanter/asama4-davranis-testi.sql` YALNIZ dalda) icin. Dashboard'dan sema degisikligi yapilmaz; zorunlu kalinirsa ayni gun dosya yazilir ve `supabase migration repair --status applied <ts>` ile kayit duzeltilir. Dosyalar idempotan olur (IF NOT EXISTS / CREATE OR REPLACE / DROP IF EXISTS), veri degistiren dosya ayri ve acikca isaretli olur (ornek: `faz0_03_dolum`). Deploy sirasi kod gerektiren degisikliklerde: ekleyen dosya -> `git push` (Vercel) -> kisitlayan dosya (bkz. `docs/envanter/07-profiles-pii.md`). Uretimin migration kaydi tamdir (`supabase migration list` 46/46, 14 Eylul); repo zinciri uretimi birebir uretir.

**profiles ve organizations sutun yetkisi.** `anon` ve `authenticated`, `profiles` uzerinde 23 sutunluk SELECT listesine sahiptir (email, phone ve 5 yonetim sutunu kapali; erisim yalniz RPC'lerle: `get_own_private_profile`, `get_contact_info`, `admin_profile_contacts`, `admin_profile_ids_by_email`, `get_notification_email`). `profiles`'a yeni sutun eklenirse ayni migration'da `GRANT SELECT (sutun) ... TO anon, authenticated` ve `app/lib/own-profile.ts` `PROFILE_OPEN_COLUMNS` guncellenir. `organizations` icin ayni kural (`tax_number`, `billing_email` kapali; `anon` hic erisemez).

**Find/Replace All kullanma.** Buyuk dosyalarda toplu degistirme yapiyi bozuyor. Tek tek BUL/DEGISTIR ya da dosyanin tamamini yeniden yazma (Ctrl+A, Delete, yapistir) yontemi kullanilir.

**`.next` onbellegi bozuluyor.** Beklenmeyen davranista once `.next` klasoru silinip sunucu yeniden baslatilir. Kod hatasi aramadan once bunu dene.

**Dil:** Tum aciklamalar, yorum satirlari, commit mesajlari ve kullanici arayuzu metinleri **Turkce**. Sapkali harf (a, i, u) kullanilmaz.

**Uydurma veri yok.** Metrik, rakam veya orneklem sayisi uydurulmaz. Bilinmeyen deger icin "olculecek" denir.

**Migration raporlama.** Her oturum sonunda uygulanan migration dosyalari en ustte listelenir. "N tane donusturuldu" kaniti degildir; kalan sifir sonucunu gosteren bir arama kanittir.

**Tailwind sinifi `${` ile BITISIK yazilmaz.** Tailwind kaynak dosyalarini metin olarak tarayip aday sinif cikarir; bitisik `${` adayi bozar ve sinif uretilen CSS'e HIC girmez. Belirti sinsidir: derleme hatasi YOK, TypeScript hatasi YOK, lint hatasi YOK — yalniz kural eksik kalir ve duzen sessizce bozulur.

```jsx
// YANLIS — "md:grow" sinifi sessizce yok olur
className={`... md:basis-0 md:grow${adsiz ? ' border-danger/40' : ''}`}

// DOGRU — kosullu ifade sinifin TAMAMININ yerine gecer
className={adsiz ? `${INPUT} border-danger/40` : INPUT}

// DOGRU — ya da siniftan sonra bosluk
className={`... md:grow ${adsiz ? 'border-danger/40' : ''}`}
```

Duzen sinifi ekleyen her degisiklikten sonra uretilen CSS'te kuralin varligi kanitlanir — "derlendi" demek yetmez, satir gosterilir. Kural yalniz Tailwind utility'leri icindir; `globals.css`'te elle yazili siniflar (`pano-card`, `kashe-tap`) tarayicidan bagimsiz uretilir ama okunurluk icin yine kacinilir. Ayrinti ve olcum komutu: `DESIGN.md` → bolum 8.

**Commit ve push disiplini.** Commit'leri **Claude atar**; **push YALNIZ Guven'in onayiyla** yapilir. `git status --short`'ta gorunen her dosya bilincli olarak ya bir commit'e girer ya da raporda **"kasitli disarida"** diye adiyla yazilir — `??` isaretli dosya sessizce birakilmaz. Build her zaman **SON commit'ten SONRA** kosar; teyidi build sonrasi `git status --short` ciktisinin bos olmasidir (calisma agaci HEAD ile birebir ayni demektir).

Bu kural bir uretim olayindan dogdu: push brief'indeki `git add` satirlari eksik uygulanip modul commit'e girmeyince Vercel build'i "Module not found" ile kirildi; ayrica yarim uygulanmis bir ozellik (AI hala butce uretiyordu, yalniz gosterilmiyordu) ve olu kalmis bir mimari bag (ortak filtre fonksiyonu cagrilmiyordu) dogdu — ucu de derleme hatasi vermeden.

---

## Mimari kararlar nerede

| Dosya | Icerik |
|---|---|
| `docs/architecture/00-genel-bakis.md` | Urun modeli, roller, uc katman, modul haritasi |
| `docs/architecture/01-veri-modeli.md` | Tablo tasarimlari ve gerekceleri |
| `docs/architecture/02-guvenlik-modeli.md` | internal sema, RLS, portal erisimi, yapay zeka yetki sinirlari |
| `docs/architecture/03-taksonomi.md` | Servis/rol/beceri katmanlari ve mevcut kategorilerin gocu |
| `docs/architecture/04-goc-plani.md` | Faz faz goc sirasi ve uretim riskleri |
| `docs/architecture/05-arayuz-modeli.md` | Baglam anahtari, calisma alanlari, yuzey ayrimi |
| `docs/yeni-kategori-checklist.md` | Kategori/rol ekleme dokunma noktalari (operasyonel) |

Taksonomi isinde **her iki belge birlikte** okunur: `03-taksonomi.md` hedef yapiyi, checklist mevcut altyapinin dokunma noktalarini anlatir. `03-taksonomi.md`'nin son bolumu ikisi arasindaki catisma noktalarini ve cozumlerini icerir.

**Bu dosyalar celiskiye dusmez.** Bir karar degisirse ilgili dosya guncellenir; eski karar birakilmaz.

---

## Degismez kurallar

Bunlar mimari kararlar degil, **ihlal edilemez sinirlar**:

1. **`internal` semasi PostgREST'e acilmaz.** Ic maliyet, marj ve ozel notlar orada durur. Erisim yalniz `security definer` fonksiyonlarla ve uyelik + rol kontroluyle olur.

2. **Kurulus verisi kiraci sinirini gecmez.** Bir kurulusun ozel yetenek havuzu, maliyeti ve notlari baska kurulusa, musteriye veya pazaryeri sorgusuna sizamaz.

3. **Yapay zeka rakam uretmez.** Fiyat, butce, marj ve musaitlik sunucu tarafinda hesaplanir. Model yalniz anlama, aciklama ve taslak uretir.

4. **Yapay zeka kritik islem yapmaz.** Odeme, iade, kesin rezervasyon, teklif gonderimi, rol degisikligi ve profesyonel dislama **insan onayi** gerektirir.

5. **Model yalniz gecerli kimlik uretir.** Kategori, rol veya saglayici adi uydurulamaz; cikti veritabanindaki kimliklerle sinirlidir.

6. **Organik siralama satin alinamaz.** Sponsorlu gorunurluk ayri alanda tutulur ve arayuzde acikca etiketlenir.

7. **Eski akislar kesilmez.** Yeni yapilar mevcut olanlarin yanina eklenir; uretimde kullanicisi olan hicbir akis aniden kapatilmaz.

---

## Mevcut sema ozeti

35 tablo, 148 RLS politikasi, 14 enum, 69 fonksiyon (FAZ -1 sonrasi sayim; uretim = repo zinciri). FAZ 0 ile +5 tablo (`organizations`, `organization_memberships`, `organization_invitations`, `organization_modules`, `organization_sync_log`), +5 enum — bkz. `docs/envanter/08-faz0-kiraci-temeli.md`. FAZ 1 ile `internal` semasi + `internal.access_audit` — bkz. `docs/envanter/09-faz1-internal-sema.md`. FAZ 2a ile `talents`, `providers`, `professional_profiles`, `organization_profiles` (+6 enum; `providers.id = profiles.id`; profiles hala kaynak, aynalanir) — bkz. `docs/envanter/11-faz2-saglayici-defteri.md`.

**Kullanici rolleri (dort, degismez):** `client`, `professional`, `business`, `agency`

`profiles` tablosu bugun uc isi birden yapiyor: kullanici kimligi, pazaryeri profili ve kurulus hesabi. Goc bunlari ayiriyor. Ayrinti: `04-goc-plani.md`

**Yetkilendirme fonksiyonlari.** RLS politikalari yetki fonksiyonlarini cagirir. FAZ -1 (14 Eylul 2026) ile uretimdeki tum fonksiyonlar repoya alindi: `is_admin(uuid)` (`faz_minus1_02`), `has_business_role`, `is_business_member`, `is_business_member_of_request`, `owns_quote_request`, `is_professional_or_agency`, `is_assignee` (`faz_minus1_03`). FAZ 0 ekledi: `is_org_member(uuid)`, `has_org_permission(uuid, text)`, `org_role_permissions(role)`, `organization_id_for_profile(uuid)`; 04 dosyasiyla `is_agency_member(uuid)`. FAZ 1 (internal sema) kalibi: istemciye acik RPC `public.internal_*` adiyla `SECURITY DEFINER` yazilir ve sirayla `internal.assert_org_permission(org, izin, tablo)` -> `internal.log_access(org, 'read'|'write', tablo, id, detail)` -> sorgu cagirir; `internal` semasina yeni tablo = ayni migration'da RLS + `REVOKE ALL` + yalniz bu kalipla erisim (bkz. `docs/envanter/09-faz1-internal-sema.md`). Yeni bir RPC veya politika yazmadan once `docs/envanter/` altindaki ilgili raporu oku; RPC'lere satir bazinda iliski kontrolu gomulur (cagirani degil iliskiyi dogrula), `SECURITY DEFINER` + `SET search_path = public` + `REVOKE ... FROM PUBLIC, anon`.
Tarihsel kanit: `docs/envanter/01-rol-kontrolleri.md` bolum 5b (FAZ -1 oncesi durum).

Gocte **politikalar degil, fonksiyon govdeleri** degistirilir: `has_business_role` ve `is_business_member` govdeleri `organization_memberships`'e cevrilince bu iki fonksiyonu cagiran 26 politika **otomatik** dogru calisir.

---

## Calisma bicimi

- Once mimari belgeyi oku, sonra kod yaz.
- Migration dosyasi olustur; SQL'i terminale yapistirmaya calisma. Uygulama Guven'in isidir (`supabase db push`), Claude Code uygulamaz.
- Buyuk degisiklikte once plan sun, onay al.
- Her degisiklikten sonra hangi dosyalarin degistigini listele.
- Emin olmadigin yerde tahmin etme, sor.
