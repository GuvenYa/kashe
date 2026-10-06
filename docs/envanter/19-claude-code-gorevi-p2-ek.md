# Claude Code gorevi — FAZ 7a / P2-ek: saat dilimi + kalem kaydetme geri bildirimi (P2 canli turu bulgulari)

Asagidaki metni oldugu gibi Claude Code'a ver. Plan: `docs/envanter/19-faz7-ticari-katman.md` (bolum 10, P2 kapanisi). ON KOSUL: P2 deploy'da
(commit `9672df0`), canli tur gecti; bu is yalniz iki kucuk duzeltme.

---

Kashe reposundasin. Su dosyalari oku: `app/portal/teklif/[token]/portal-data.ts` (`tarihMetni`, `zamanMetni`), `app/ajans/teklifler/teklif-data.ts`
(tarih/zaman bicimleyiciler; `tarihAlani` zaten `Europe/Istanbul`), `app/ajans/teklifler/page.tsx`, `app/ajans/teklifler/[id]/teklif-editoru.tsx`
(kalem satirlari, `onBlur` ile kaydetme), `CLAUDE.md` (calisma kisitlari).

Bu is **yalniz uygulama kodu**: migration yok, RPC yok. Baslamadan `git status --short` temiz olmali; degilse dur ve soyle.

## Bulgular (P2 canli turu, 6 Ekim 2026)

1. **Saat dilimi.** Portal sayfasi sunucuda (Vercel, UTC) render edildigi icin "Sürüm 3 · gönderim 6 Ekim 2026 19:30" ve "Onaylandı · … 19:33"
   gosterdi; ayni anlar editorde (istemci, Istanbul) 22:30 / 22:33. Liste sayfasi da sunucuda render ediliyor: "Sürüm 2 · 2 Ekim 2026" aslinda
   3 Ekim 01:04 Istanbul. Bicimleyicilerde `timeZone` yok; istemcide tarayici saatiyle dogru, sunucuda UTC ile yanlis.
2. **Kalem kaydetme geri bildirimi.** Kalem fiyati alandan cikinca (`onBlur`) kaydediliyor; "Kaydet" dugmesi yok ve kaydedildigine dair
   bir isaret yok — Guven "kaydet butonu yok, bos bir alana tiklayinca guncellendi" dedi. Davranis dogru, geri bildirim eksik.

## Yapilacaklar

### A. Tum tarih/zaman bicimleyicileri Istanbul saatinde

- `portal-data.ts` `tarihMetni` ve `zamanMetni`: `toLocaleDateString/toLocaleString('tr-TR', { ..., timeZone: 'Europe/Istanbul' })`.
- `teklif-data.ts`'teki tarih ve zaman bicimleyicileri (ad ne olursa olsun; `tarihAlani` zaten dogru): ayni sekilde `timeZone: 'Europe/Istanbul'`.
  Istemcide de ayni sabit dilim kullanilir (Turkiye tek dilim; tarayici dilimi farkli olsa bile Kashe saati Istanbul'dur).
- `app/ajans/teklifler/**` ve `app/portal/**` icinde `toLocale*('tr-TR'` ya da `Intl.DateTimeFormat(` gecen baska yer varsa ayni sabiti ekle.
  Ortak bir `const KASHE_SAAT_DILIMI = 'Europe/Istanbul'` sabiti `teklif-data.ts`'te tanimlanabilir; portal `teklif-data`'yi import ETMEZ
  (portal ayri yuzey) — kendi dosyasinda ayni degeri tasir.
- Repo genelinde (`app/**`) `timeZone` olmadan `toLocaleDateString|toLocaleString|toLocaleTimeString|Intl.DateTimeFormat` kullanan **sunucu**
  bilesenlerini (`'use client'` olmayan dosyalar) grep ile LISTELE, raporda ver, **degistirme** (ayri hijyen kalemi; kapsam disi).

### B. Kalem kaydetme geri bildirimi (`teklif-editoru.tsx`)

- Kalemler bolumunun basligi altina sessiz bir ipucu: "Değişiklikler alandan çıkınca kaydedilir." (yalniz surum taslakken; kilitliyken yok).
- Bir kalem alani kaydedilince (basarili action donusu) kalem satirinin yaninda ~2 saniye "Kaydedildi" metni (mevcut pending durumu varsa
  "Kaydediliyor…" -> "Kaydedildi"); hata zaten gosteriliyorsa dokunma. Yeni bagimlilik yok, `setTimeout` temizligi (`useEffect` cleanup) olsun.
- Baslik / musteri alanlari da `onBlur` ile kaydediliyorsa ayni ipucu onlari da kapsar (tek ipucu yeter, ayri metin yazma).

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` -> route tablosu + hata yok + `.next/BUILD_ID`.
- `grep -rn "toLocale\|Intl.DateTimeFormat" app/portal app/ajans/teklifler` -> her satirda `Europe/Istanbul` (sabit ya da dogrudan) var.
- Sapkali harf 0; metinler duzgun Turkce, yorumlar ASCII.
- **Canli (Guven):** portalda 3. baglanti (onayli): "Sürüm 3 · gönderim 6 Ekim 2026 22:30", "Onaylandı · Deneme Müşteri · 6 Ekim 2026 22:33".
  Liste: lansman "Sürüm 3 · 6 Ekim 2026"; "qas" satiri "3 Ekim 2026" (2 Ekim 22:08 UTC = 3 Ekim 01:08 Istanbul). Editorde bos taslak ac,
  kalem ekle, fiyat yaz, alandan cik -> "Kaydedildi" gorunup kayboluyor; sonra taslagi sil.

## Yapilmayacaklar

- Baska sayfalarin saat dilimi (yalniz listele). Portal/editor davranis degisikligi. Migration. Commit ATMA.

Rapor: degisen dosyalar, tsc/build (BUILD_ID), grep ciktisi (FAZ 7 dosyalari + repo geneli liste), sapma ve nedeni. Commit ATMA.
