# Claude Code gorevi — Tasarim dili v2 / D2-ek: Profil yerlesimi (icerik sol, islem karti sag; mobil kart; ajans profili iki sutun)

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: `docs/envanter/22-tasarim-dili-v2.md` bolum 6 ("D2-ek'e kalan"), video
`kashe_marketplace_v1` 4-5. kare (SOL: genis medya hero → avatar 72 px + ad ✓ + "DJ · Ankara · ★ 4,9 (38 degerlendirme) · Kurumsal
etkinlik, lansman, gala" → guven cipleri → "Paketler" listesi; SAG sticky: fiyat/takvim karti + CTA'lar). ON KOSUL: main'de D2
(`GuvenCipleri`, `FiyatTakvimKarti`, `AvailabilityCalendar` secim modu, `IletisimButton.onDolgu`, `RezervasyonButton.initialDate/
initialLocation`). Dal: `tasarim/d2-ek` (Guven acti). Migration/RPC YOK. TopNav KALIR.

---

Kashe reposundasin. Once `git status` (temiz; dal `tasarim/d2-ek`). Oku: `DESIGN.md` bolum 9 ("Pazaryeri desenleri (D2)"),
`docs/envanter/22-tasarim-dili-v2.md` bolum 6, `app/p/[id]/professional-profile.tsx` (1041; `lg:grid-cols-[360px_1fr]`: sol ray =
kimlik (mobil) + avatar/ad (masaustu) + cipler + hero (mobil) + meta karti + lojistik + temsil eden ajans + `FiyatTakvimKarti` (`lg`) +
havuz + ikon satiri (mobil); sag = hero (`lg`) + uzmanlik bandi + Hakkimda + moduller + Hizmetler & Paketler + deneyim + portfoy +
yorumlar; altta mobil sabit CTA cubugu), `app/p/[id]/page.tsx` (1336; iki yol: `ProfessionalProfile` ve eski tek sutun AJANS yolu ~765+),
`app/components/fiyat-takvim-karti.tsx` (istemci; `cta` duz prop'lar, `altAlan`), `app/components/guven-cipleri.tsx`,
`app/p/[id]/profile-media-hero.tsx`, `app/p/[id]/iletisim-button.tsx` (`onDolgu`), `app/p/[id]/rezervasyon-button.tsx`.

**Kirmizi cizgi:** veri sorgulari, action'lar, `IletisimButton`/`RezervasyonButton`/`DavetButton`/`HavuzaEkle`/yorum akisi DEGISMEZ;
guven cipleri yalniz gercek sinyal (D2 kurali); sunucu bileseninden istemci bilesenine FONKSIYON gecirilmez (D2'de uretimi dusuren
hata: render-prop). Bu gorev YERLESIM isidir.

## 1) `ProfessionalProfile` — izgara tersine: `lg:grid-cols-[minmax(0,1fr)_360px] gap-7`

**Sol (icerik), sirayla:**
1. Medya hero (`ProfileMediaHero`) tam genislik `rounded-2xl`; mobilde de burada (ayri `lg:hidden` kopyasi KALKAR — tek render).
2. **Kimlik satiri:** avatar 72 px `rounded-2xl` (yoksa bas harfler) · ad `font-display text-3xl` + ✓ (`isVerified`) · sagda ikon satiri
   (`actionBar`: favori / paylas / sikayet; `flex-wrap`). Alt satir `text-sm text-ink-72`: "<Kategori> · <Sehir> · ★ 4,9 (38 degerlendirme)
   · <etkinlik turleri>" — etkinlik turleri `attributes`/`category_attributes` icindeki event type etiketleri (`getEventTypeLabel`), en cok 3,
   yoksa parca yok. Puan yoksa "Yeni".
3. `GuvenCipleri` (var).
4. **Paketler**: mevcut "Hizmetler & Paketler" bolumu buraya tasinir (icerigi aynen: `OfferRow` listesi; baslik yalniz paket varsa
   "Paketler", hizmet de varsa "Hizmetler & Paketler").
5. Sonra bugunku sira: uzmanlik bandi, Hakkimda + hizli hucreler, kategori modulleri, deneyim, portfoy, yorumlar + `YorumButton`.

**Sag (`lg:sticky lg:top-24 lg:self-start`, sirayla):** `FiyatTakvimKarti` (CTA'lar icinde; `canTransact=false` ise kart yalniz fiyat +
takvim ve altinda "Profili duzenle" blogu); meta karti (Sehir, Hizmet bolgesi, Calisma sekli, Fiyat araligi, Deneyim, Musaitlik —
`MetaRow`, var); lojistik satirlari; temsil eden ajans karti; `havuzSlot`; `DavetButton`.

## 2) `lg` alti (telefon / tablet)

Tek sutun, sira: hero → kimlik satiri → cipler → **kart** (fiyat + "Musaitlik" acilir takvim (kapali) + Tarih/Sehir/Kisi; CTA'lar kartta
YOK) → Paketler → geri kalan icerik → sag sutun kalanlari (meta, lojistik, ajans, havuz, davet) en altta. **Alt sabit CTA cubugu AYNEN
kalir** ve karttaki Tarih/Sehir/Kisi degerlerini alir: kart ile cubuk ayni durumu paylasir — `app/p/[id]/profil-islem-baglami.tsx`
(istemci; `createContext` + `useState`; `ProfilIslemSaglayici` sarmalayici, `useProfilIslem()` kancasi). Kart baglamdan okur/yazar;
cubuktaki `IletisimButton` `onDolgu={dolgu}` ve `RezervasyonButton` `initialDate/initialLocation` baglamdan alir. Saglayici
`ProfessionalProfile`'in govdesini sarar (sunucu cocuklari `children` olarak gecer — fonksiyon prop YOK).

## 3) Ajans profili (page.tsx eski yol) — ayni iki sutun

`max-w-3xl` tek sutun → `max-w-6xl` + ayni izgara: SOL hero/kapak (varsa) → kimlik satiri (ajans adi ✓ + "Ajans · <Sehir> · ★ …") →
cipler (var) → Hizmetler & Paketler (varsa) → Hakkimda → portfoy → yorumlar → benzer profiller; SAG `FiyatTakvimKarti` (en dusuk
hizmet fiyati; `blockedDates` ajans icin de okunuyorsa takvim, yoksa takvimsiz kart: fiyat + alanlar) + ajansin mevcut CTA'lari
(`IletisimButton`; rezervasyon dugmesi ajansta bugun varsa o da) + meta + `DavetButton`/`HavuzaEkle` (varsa). Mobil kurali madde 2
ile ayni (baglam saglayici burada da).

## 4) Yapilmayacaklar

Migration/RPC YOK; `IletisimButton`/`RezervasyonButton` etiketleri DEGISMEZ ("Teklif Al" / "Rezervasyon Talebi" — site genelinde
ayni); kesfet degismez; Kashe AI (D3) yok. Commit ATMA.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` → route tablosu + `.next/BUILD_ID`.
- `grep -rn "lg:grid-cols-\[360px_1fr\]" app/p` → 0; `grep -rn "lg:grid-cols-\[minmax(0,1fr)_360px\]" app/p` → 2 (pro + ajans);
  `grep -rn "cta={(" app` → 0 (fonksiyon prop yok); `grep -rn "₺" app` → 0.
- Sapkali harf 0; yorumlar ASCII.
- **Onizleme turu (Claude):** anonim `/p/<Test Pro2>` 1280 px: hero solda tam genislik, kimlik satiri (72 px avatar, ad, "DJ · Istanbul ·
  ★ 5 (1 degerlendirme)"), cipler, "Paketler" kimligin altinda, SAG kart sticky; `/p/<Sunucu Ajans>` ayni izgara; 375 px: hero →
  kimlik → cipler → kart (takvim kapali) → Paketler, alt cubuk var; testguven: kartta tarih sec + kisi gir → alt cubuktaki "Teklif Al"
  modalinda Tarih/Katilimci dolu (gonderilmez); konsol 0, tasma 0.

Rapor: degisen/yeni dosyalar, satir sayilari, tsc/build (BUILD_ID), grep sonuclari, sapma ve nedeni. Commit ATMA.
