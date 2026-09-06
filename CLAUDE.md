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

**PowerShell yapistirma sorunu.** Yapistirma sirasinda `<` karakteri dusuyor. Bu yuzden SQL migration'lari terminale yapistirilmaz; **Supabase Dashboard SQL Editor** uzerinden elle uygulanir. Migration dosyasi olusturulur, icerigi dosyada durur, kullanici panelden calistirir.

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

35 tablo, 148 RLS politikasi, 14 enum, ~60 fonksiyon.

**Kullanici rolleri (dort, degismez):** `client`, `professional`, `business`, `agency`

`profiles` tablosu bugun uc isi birden yapiyor: kullanici kimligi, pazaryeri profili ve kurulus hesabi. Goc bunlari ayiriyor. Ayrinti: `04-goc-plani.md`

**Yetkilendirme fonksiyonlari.** RLS politikalari yetki fonksiyonlarini cagirir; ancak **bu fonksiyonlarin bir kismi repoda tanimli degildir, uretimden dogrulanmalidir.** Migration'lardaki durum:

| Fonksiyon | Repoda tanim | Repoda cagri | Durum |
|---|---|---|---|
| `has_business_role(uuid, business_member_role)` | VAR | 26 politika | Guvenilir |
| `is_business_member(uuid)` | VAR | 10 politika | Guvenilir |
| `owns_quote_request(uuid, uuid)` | **YOK** | **VAR** | **Drift** — canli politika tanimi olmayan fonksiyona bagimli |
| `is_admin(uuid)` | **YOK** | yalniz yorum | Admin kapisi 11 yerde satir ici `EXISTS (... p.is_admin = true)` ile tekrarlaniyor |
| `is_professional_or_agency(uuid)` | **YOK** | **YOK** | Repoda hic gecmiyor |
| `is_assignee(uuid, uuid)` | **YOK** | yalniz yorum | Repoda tanimi ve cagrisi yok |

Bir yetki fonksiyonuna dayanmadan once **tanimi repoda ara**; yoksa uretim veritabanindan dogrula.
Ayrinti ve kanit: `docs/envanter/01-rol-kontrolleri.md` bolum 5b.

Gocte **politikalar degil, fonksiyon govdeleri** degistirilir: `has_business_role` ve `is_business_member` govdeleri `organization_memberships`'e cevrilince bu iki fonksiyonu cagiran 26 politika **otomatik** dogru calisir.

---

## Calisma bicimi

- Once mimari belgeyi oku, sonra kod yaz.
- Migration dosyasi olustur; SQL'i terminale yapistirmaya calisma.
- Buyuk degisiklikte once plan sun, onay al.
- Her degisiklikten sonra hangi dosyalarin degistigini listele.
- Emin olmadigin yerde tahmin etme, sor.
