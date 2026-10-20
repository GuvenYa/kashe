# Claude Code gorevi — Tasarim dili v2 / D2: Pazaryeri (kesfet kartlari + profil sayfasi: guven cipleri, paketler, fiyat/takvim karti)

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: `docs/envanter/22-tasarim-dili-v2.md` desen 6-7 (video `kashe_marketplace_v1`
3. kare: kesfet 5 sutun kompakt foto kart + sol filtre rayi; 4-5. kare: profil — genis medya hero, ad ✓ + "DJ · Ankara · ★ 4,9 (38
degerlendirme) · Kurumsal etkinlik, lansman, gala", guven cipleri satiri, "Paketler" listesi (fiyat sagda), SAG sutun: "48.000 TL'den" +
aylik musaitlik takvimi (yesil musait / gri dolu / pembe secili) + Tarih/Sehir/Kisi + "Teklif al" + "Paketi dogrudan rezerve et").
ON KOSUL: main'de D1 (panel kabugu, `para.ts`). Dal: `tasarim/d2` (Guven acti). Migration/RPC YOK. Vitrin sayfalari: `TopNav` KALIR
(panel kabugu YOK). Vurgu kelimesi vitrinde LACIVERT kalir (DESIGN.md 9).

---

Kashe reposundasin. Once `git status` (temiz; dal `tasarim/d2`). Oku: `CLAUDE.md`, `DESIGN.md` bolum 9, `docs/envanter/22-tasarim-dili-v2.md`
(desen 6-7), `app/kesfet/page.tsx` (674; sorgu, siralama, havuz kisa yolu), `app/kesfet/profile-card.tsx` (516; `default`/`compact`
varyantlari, `yogun`, `TopChips`, `MetaRow`, hover paneli, `HavuzKisaYol`), `app/kesfet/kesfet-filters.tsx` (944; DOKUNMA — Kim/Kategori/
Sehir/"Daha fazla filtre" zaten var), `app/kesfet/sort-dropdown.tsx`, `app/components/sections/featured-profiles.tsx`, `app/kategori/[slug]/page.tsx`,
`app/favoriler/page.tsx` (ayni karti kullanir), `app/p/[id]/page.tsx` (1280; iki yol: `ProfessionalProfile` (professional) ve eski tek sutun
(agency); `badgeCards`, `blockedDates`, `isBusyNow`, tamamlanmis rezervasyon sinyalleri ~467), `app/p/[id]/professional-profile.tsx` (990;
`lg:grid-cols-[360px_1fr]` sol ray + sag icerik, `OfferRow`, `MetaRow`, mobil alt CTA cubugu), `app/p/[id]/profile-media-hero.tsx`,
`app/p/[id]/iletisim-button.tsx` (form alanlari + mesaj), `app/p/[id]/rezervasyon-button.tsx`, `app/components/availability-calendar.tsx`,
`app/lib/badges.ts` (`getBadgeCards`: verified / fastResponse (`avgHours`) / repeatChoice / premium), `app/lib/profile-helpers.ts`
(`formatPriceRange`), `app/lib/para.ts`.

**Kirmizi cizgi:** kesfet sorgusu, filtre/URL parametreleri, siralama, favori, havuz kisa yolu, `IletisimButton`/`RezervasyonButton`/
`DavetButton` eylemleri ve formlari, yorum akisi DEGISMEZ. Guven cipleri yalniz GERCEK sinyalden uretilir (uydurma metin YOK: "Portfoy
incelendi", "Komisyon dahil" gibi videoya ozel ifadeler siteye GELMEZ). Bu gorev YERLESIM ve SUNUM isidir.

## 1) Kesfet (`/kesfet`, `/kategori/[slug]`, `/favoriler` ayni kart)

- Baslik blogu: eyebrow videodaki gibi kisa pembe cizgi + "KESFET" (`<span class="w-5 h-px bg-brand-accent">` + mono etiket); h1
  `tip=ajans` ise "Ajans ve organizasyon firmalarini kesfet." degilse "Profesyonelleri kesfet." (vurgu lacivert, bugunku gibi); alt satir
  tek cumle. Blok `mb-6` (bugunku `mb-8`, daha sik).
- Sonuc cubugu: sol mono eyebrow "N SONUC" (`tip=ajans`: "N KURUMSAL PROFIL"), sag `SortDropdown` etiketi "Sirala: <secenek>". Yapiskanlik
  ve mobil davranis AYNEN.
- Izgara: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4`. Kesfet karti masaustunde `aspect-[4/3]`
  (bugunku `yogun` gorunumu kesfet icin VARSAYILAN olur; ana sayfa `featured-profiles` ve `compact` varyanti DEGISMEZ). Mobil (`md` alti)
  yerlesim AYNEN.
- Kart alt seridi (foto uzeri gradyan): ad ✓ (`isVerified`) · altinda "<Sehir> · ★ 4,9 (38) · 120 is" (`MetaRow`, var) · **alt rozet**:
  profesyonelde "72.000 TL'den" (yayindaki, talep-uzerine OLMAYAN hizmetlerin en dusuk `price_min`; `para.ts` "'den" bicimi; fiyat yoksa
  rozet YOK), ajansta "KURUMSAL PROFIL". Fiyat verisi: `page.tsx` kesfet sorgusuna TEK toplu `services` okumasi (benzer profillerdeki
  `similarServicesByProfile` kalibi; `in('professional_id', ids)`); `ProfileCard`'in zaten var olan `services` prop'u yeniden kullanilir
  (yorumdaki "karttan kalkti" notu guncellenir: video ile geri geldi). `/kategori` ve `/favoriler` zaten `services` geciyor.
- `TopChips` (kategori etiketi, sol ust): mono etiket onune cyan nokta (`bg-sky`), videodaki gibi. Favori kalbi sag ust (var). Hover paneli
  ve icindeki eylemler (Teklif Al, havuz kisa yolu, etkinlige ekle) AYNEN.

## 2) Profesyonel profili (`ProfessionalProfile`) — yerlesim tersine: icerik SOL, islem karti SAG

`lg:grid-cols-[minmax(0,1fr)_360px] gap-7`; sag sutun `lg:sticky lg:top-24`.

**Sol (icerik):**
- Ekmek kirintisi (mono eyebrow): "KESFET · <Kategori> · <Ad>" (`/kesfet` ve `/kategori/<slug>` baglantili). "← Kesfet'e don" KALKAR.
- Medya hero (`ProfileMediaHero`, var) tam genislik, `rounded-2xl`; sag altta kucuk kare onizlemeler zaten varsa kalir.
- Kimlik satiri: avatar 72 px (`rounded-2xl`), ad `text-3xl` + ✓, alt satir "<Kategori> · <Sehir> · ★ 4,9 (38 degerlendirme) ·
  <etkinlik turleri: attributes'taki event types etiketleri, en cok 3, varsa>". Favori / paylas / sikayet ikonlari ad satirinin saginda
  (`actionBar`, var).
- **Guven cipleri** (`app/components/guven-cipleri.tsx`, yeni; `✓` + metin, `bg-moss/10 text-moss` yesil cip; sinyalsiz cip gri): yalniz
  gercek sinyaller — "Kimlik dogrulandi" (`verified`), "Profil onayli" (`approval_status === 'approved'`), "N tamamlanmis is" (tamamlanmis
  rezervasyon sayisi > 0; `page.tsx` zaten tekrar-tercih sinyali icin tamamlanmis rezervasyonlari okuyor — SAYISI buradan, ek sorgu YOK),
  "Ortalama yanit: N saat" (`fastResponse` sinyali varsa; `avgHours` yuvarlanir), "Tekrar tercih ediliyor" (`repeatChoice`), "Premium".
  Mevcut `badgeCards` karti (2 rozet) bu satira DONUSUR (ayri kart kalkar).
- **Paketler** bolumu kimligin hemen altinda: baslik "Paketler", `OfferRow` listesi (ad + aciklama solda, fiyat sagda `font-display`
  `tabular-nums`; var). Paket/hizmet yoksa bolum yok.
- Sonra bugunku bolumler ayni sirayla: Hakkimda + hizli hucreler, kategori modulleri, deneyim, portfoy, yorumlar. Icerik degismez.
- Meta satirlari (Sehir, Hizmet bolgesi, Calisma sekli, Fiyat araligi, Deneyim, Musaitlik) sag kartin ALTINA ince liste olarak gecer
  (`MetaRow`, var).

**Sag (islem karti, `app/components/fiyat-takvim-karti.tsx`, yeni, istemci):**
- Ust: "48.000 TL'den" (`text-3xl`; en dusuk paket/hizmet fiyati, `para.ts`; fiyat yoksa "Fiyat teklifle") + kucuk not "Paketlerden
  baslayan fiyat" (KDV/komisyon iddiasi YOK).
- Aylik takvim: `AvailabilityCalendar` (var; `editable={false}`, `blockedDates`) uzerine "secilebilir gun" modu: `onSelect?(iso)` prop'u
  eklenir (editable=false iken bos gunler tiklanabilir; secili gun `bg-brand-accent text-paper`; dolu gun gri, tiklanamaz). Altta aciklama
  "● Musait · ● Dolu · ● Secilen" (video). Takvim yalniz ay gorunumu; ay degistirme oklari var olan davranis.
- Alanlar: "Tarih" (takvimden gelir, elle de girilebilir `type=date`), "Sehir" (varsayilan profil sehri), "Kisi" (sayi). Hepsi istege bagli.
- CTA'lar: birincil lacivert **"Teklif al"** → `IletisimButton` (mevcut modal; `initialMessage` prop'u eklenir: "Tarih: 14 Mayis 2027 ·
  Sehir: Ankara · 300 kisi" satiri mesaj metninin basina; formda tarih/sehir alanlari varsa ONLARI doldur, mesaja yazma); ikincil
  **"Paketi dogrudan rezerve et"** → `RezervasyonButton` (`variant="outline-ink"`; `initialDate` prop'u — rezervasyon modali tarih
  aliyorsa doldurur). `canTransact=false` (kendi profili / yetkisiz) ise kart yalniz fiyat + takvim; `DavetButton`/`havuzSlot` kartin
  altinda (var).
- `lg` alti: kart kimlik satirinin altinda tek sutun; takvim "Musaitlik" acilir bolum (varsayilan kapali); mobil alt sabit CTA cubugu
  (var) AYNEN.

## 3) Ajans profili (eski tek sutun yol, `page.tsx` ~765)

Yalniz: ekmek kirintisi, kimlik satiri (ad ✓ + "<Kategori> · <Sehir> · ★ …"), guven cipleri satiri (ayni bilesen), paket listesi `OfferRow`.
Iki sutunlu yerlesim ajans icin BU GOREVDE YOK (D2-ek).

## 4) `DESIGN.md` bolum 9

Desen 6-7 notu: kesfet karti (4:3, alt rozet fiyat/kurumsal), guven cipleri (yalniz gercek sinyal), fiyat/takvim karti (sag, sticky; mobilde
acilir takvim + alt cubuk).

## 5) Yapilmayacaklar

Migration/RPC YOK; kesfet sorgusu/filtreleri/siralamasi degismez; `featured-profiles` ve `compact` varyant degismez; iletisim/rezervasyon
formlarinin alanlari ve action'lari degismez (yalniz on-doldurma prop'u); Kashe AI (D3) ve koyu kapanis (D4) yok. Commit ATMA.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` → route tablosu + `.next/BUILD_ID`.
- `grep -rn "Komisyon dahil\|Portföy incelendi\|Portfoy incelendi" app` → 0; `grep -rn "₺" app` → 0; `grep -rn "2xl:grid-cols-5" app/kesfet` → 1.
- Sapkali harf 0; yorumlar ASCII; UI metinleri Turkce.
- **Onizleme turu (Claude):** anonim `/kesfet` (baslik, sonuc cubugu, kart alt rozeti "… TL'den", 1200 px'te 4-5 sutun, 375 px mobil
  yerlesim ayni), `/kesfet?tip=ajans` ("Ajans ve organizasyon firmalarini kesfet.", "N KURUMSAL PROFIL", "KURUMSAL PROFIL" rozeti);
  `/p/<Test Pro>` anonim: ekmek kirintisi, kimlik satiri, cipler yalniz gercek sinyal, Paketler, sag kart fiyat + takvim (dolu gun gri,
  bos gun secilince pembe + Tarih dolar), 375 px'te kart kimligin altinda, takvim kapali; testguven ile "Teklif al" → modal acilir, mesaj
  basinda Tarih satiri (gonderilmez, kapatilir); "Paketi dogrudan rezerve et" → modal (kapatilir). Konsol 0, yatay tasma 0.

Rapor: degisen/yeni dosyalar, satir sayilari, tsc/build (BUILD_ID), grep sonuclari, sapma ve nedeni. Commit ATMA.
