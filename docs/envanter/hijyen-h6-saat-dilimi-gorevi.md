# Claude Code gorevi — Hijyen H6: tum tarih/saat bicimlemesi Kashe saatinde (Europe/Istanbul)

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: `docs/envanter/19-faz7-ticari-katman.md` bolum 10 (P2-ek bulgusu H6; 7c-P1 turunda
`/rezervasyon/[id]` "19:33" ile tekrar gorundu). ON KOSUL: 7c-P1 deploy'da.

---

Kashe reposundasin. Su dosyalari oku: `app/ajans/teklifler/teklif-data.ts` (`KASHE_SAAT_DILIMI`, `tarihMetni`, `zamanMetni`, `tarihAlani` — P2-ek),
`app/portal/teklif/[token]/portal-data.ts` (portalin kendi sabiti; AYRI YUZEY, dokunma), `app/rezervasyon/[id]/page.tsx` (satir ~99 ve ~118:
`toLocaleDateString/toLocaleString('tr-TR', ...)` timeZone'suz — canlida "19:33", Istanbul 22:33), `CLAUDE.md`.

**Sorun.** Sunucuda render edilen bilesenler Vercel'de UTC ile bicimliyor (3 saat geri, bazen bir gun geri); istemci bilesenleri tarayici
saatiyle. Kashe tek dilimli bir urun: **her yerde Istanbul saati**. P2-ek'te yalniz FAZ 7 dosyalari duzeltildi; repo genelinde 25 sunucu + 32
istemci cagrisi kaldi.

## Yapilacaklar

1. **Ortak modul** `app/lib/tarih.ts` (`'use client'` YOK; hem sunucu hem istemciden import edilebilir):
   `export const KASHE_SAAT_DILIMI = 'Europe/Istanbul'`; `tarihMetni(iso)` -> "3 Ekim 2026"; `zamanMetni(iso)` -> "3 Ekim 2026 14:05";
   `saatMetni(iso)` -> "14:05"; `kisaTarihMetni(iso)` -> "03.10.2026"; `tarihAlani(iso)` -> "YYYY-MM-DD" (Istanbul; `<input type=date>` icin);
   hepsi `null/undefined/gecersiz` icin `null` doner ve `timeZone: KASHE_SAAT_DILIMI` verir. `teklif-data.ts`'teki bicimleyiciler bu modulden
   re-export edilir (tek kaynak); portal kendi sabitini korur (import ETMEZ) — sadece degerin ayni oldugunu yorumda belirt.
2. **Repo genelinde** `app/**` icinde `timeZone` olmadan `toLocaleDateString | toLocaleString | toLocaleTimeString | Intl.DateTimeFormat`
   kullanan **tum** tarih/saat cagrilarini (sunucu VE istemci; P2-ek raporundaki 25 + 32) ortak yardimcilara ya da `timeZone: KASHE_SAAT_DILIMI`
   secenegine bagla. Sayi bicimleyen `toLocaleString('tr-TR')` (number uzerinde: para, adet) DOKUNULMAZ. Secenek nesnesi ozel olan yerlerde
   (haftanin gunu, kisa ay vb.) yardimci yerine mevcut cagriya `timeZone` eklemek yeterli; metin bicimi degismesin.
3. `app/lib/email/templates.ts` (e-posta sablonlari; sunucu, hep UTC'ydi): ayni sekilde.
4. Takvim (`app/takvimim`) ve musaitlik gibi **gun hesaplayan** yerlerde (`getDate/getMonth`, `toISOString().slice(0,10)`) dilim kaymasi
   olabilir: yalniz **listele** (dosya:satir + ne yaptigi), degistirme — ayri kalem (davranis degisikligi riski).

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` -> route tablosu + hata yok + `.next/BUILD_ID`.
- `grep -rnE "toLocale(Date|Time)?String\('tr-TR'|Intl\.DateTimeFormat\(" app | grep -v timeZone | grep -v KASHE_SAAT_DILIMI` -> yalniz sayi
  bicimleme satirlari (raporda listele, her biri number oldugunu dogrula).
- Sapkali harf 0; yorumlar ASCII.
- **Canli (Guven):** `/rezervasyon/49e694e4-2782-4dcc-aad1-d9984c586f91` -> "Sürüm 3 · Onaylandı · Deneme Müşteri · 6 Ekim 2026 **22:33**";
  `/rezervasyonlarim` kartlarinda tarihler; `/mesajlar` zaman damgalari; `/takvimim` gun yerlesimi degismedi.

## Yapilmayacaklar

- Portal dosyalarina dokunma. Gun hesaplama mantigini degistirme (yalniz listele). Metin bicimlerini degistirme. Commit ATMA.

Rapor: yeni/degisen dosyalar (sayi), tsc/build (BUILD_ID), kalan timeZone'suz cagrilarin listesi (hepsi number), gun hesaplama listesi. Commit ATMA.
