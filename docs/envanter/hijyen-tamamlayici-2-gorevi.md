# Claude Code gorevi — Tamamlayici 2: teklif gecerliligi tek yerden; tarih kutusu tiklaninca takvim

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: Tamamlayici 1 canli turu (Guven, 19 Ekim): "gecerlilik tarihini giriyoruz, asagida
tekrar gecerlilik gun sayisini soruyor, tutarsiz" + "tarih kutusuna tiklayinca takvim acilsin, sagdaki ok tek sart olmasin".
Bildirim metinlerindeki Turkce karakter duzeltmesi ayri migration'da (`20261019130000_hijyen_02_bildirim_metinleri.sql`, Guven uygular);
bu gorev yalniz uygulama. Migration/RPC YOK.

---

Kashe reposundasin. Once `git status` (temiz olmali). Oku: `app/ajans/teklifler/[id]/teklif-editoru.tsx` (Gecerlilik tarih alani ~857,
`gecerlilikGun` state ~157, `gonder()` ~345, gonder onay kutusu "Geçerlilik (gün)" ~1041), `app/ajans/teklifler/teklif-actions.ts`
(`sendProposal` → `proposal_send(p_proposal_id, p_valid_days)`), `supabase/migrations/20261003120000_faz7a_01_teklif_portal.sql` ~541
(`valid_until = COALESCE(valid_until, now() + days)` — tarih doluysa gun YOK SAYILIR; davranis budur, degismez), `app/lib/tarih.ts`,
`CLAUDE.md`. Tarih girdileri (13 adet, 10 dosya): `grep -rn "type=\"date\"\|type=\"datetime-local\"" app --include=*.tsx`.

## 1) Gecerlilik tek yerden — `teklif-editoru.tsx`

- Gonder onay kutusunda: editordeki **Geçerlilik** tarihi (`gecerlilik` state, surumde `valid_until`) DOLUYSA "Geçerlilik (gün)" girdisi
  GOSTERILMEZ; yerine salt okunur satir `Geçerlilik: <tarihMetni> · Üstteki Geçerlilik alanından değiştirilir.` ve `sendProposal`'a
  `validDays: 14` (RPC yok sayar; tip zorunlu). Tarih BOSSA mevcut gun girdisi kalir (varsayilan 14) ve yardimci metin:
  `Tarih girilmediği için gönderimden itibaren gün sayısı kullanılır.`
- Editordeki Geçerlilik alaninin yanina kucuk aciklama: `Boş bırakılırsa gönderirken gün sayısı sorulur.`
- Baska davranis degismez (RPC `COALESCE` ayni).

## 2) Tarih kutusu tiklaninca takvim — ortak yardimci

- `app/lib/tarih-girdisi.ts` (`'use client'` YOK; saf fonksiyon):
  `export function takvimiAc(e: React.MouseEvent<HTMLInputElement>) { const el = e.currentTarget; if (el.disabled || el.readOnly) return;
  try { el.showPicker?.(); } catch { /* destek yoksa tarayici varsayilani */ } }`
  (Chromium/Firefox/Safari 16+ `showPicker`; kullanici hareketi icinde cagrilir, `onClick` uygun; `onFocus` KULLANILMAZ — klavye ile
  gezinirken takvim acilmasin.)
- 13 `type="date"` / `type="datetime-local"` girdisinin HEPSINE `onClick={takvimiAc}` eklenir (mevcut `onClick` varsa birlestir).
  Dosyalar: `ajans/havuz/havuz-paneli.tsx`, `ajans/teklifler/[id]/teklif-editoru.tsx`, `etkinlik-sihirbazi/sihirbaz-client.tsx`,
  `ilanlar/yeni/yeni-ilan-formu.tsx`, `kurumsal/rfp/yeni-rfp.tsx`, `kurumsal/rfp/[id]/page.tsx`, `kurumsal/rfp/[id]/rfp-editoru.tsx`,
  `p/[id]/iletisim-button.tsx`, `p/[id]/rezervasyon-button.tsx`, `teklif-topla/teklif-topla-formu.tsx`. Sunucu bileseninde tarih girdisi
  varsa (`kurumsal/rfp/[id]/page.tsx`?) `onClick` istemci bileseni gerektirir — girdi zaten istemci alt bileseninde degilse kucuk
  `TarihGirdisi` istemci sarmalayicisi (`app/components/ui/tarih-girdisi.tsx`) kullan; sunucu dosyasina `'use client'` EKLEME.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` → route tablosu + `.next/BUILD_ID`.
- `grep -rn "type=\"date\"\|type=\"datetime-local\"" app --include=*.tsx | grep -vc "takvimiAc\|TarihGirdisi"` → 0 (hepsi bagli; cok satirli
  JSX'te grep yaniltirsa dosya bazinda listele).
- `grep -n "Geçerlilik (gün)" app/ajans/teklifler/\[id\]/teklif-editoru.tsx` → yalniz tarih bos dalinda (kosullu render).
- `grep -rn "onFocus={takvimiAc}" app` → 0.
- Sapkali harf 0; yorumlar ASCII.
- **Canli (Guven):** teklif editorunde Gecerlilik tarihi secili → Gönder → kutuda gun girdisi yok, "Geçerlilik: <tarih>" satiri var; tarihi
  silip Gönder → gun girdisi (14) gorunur. Herhangi bir tarih kutusuna (ornegin RFP son tarih) kutunun ortasina tiklayinca takvim acilir.

## Yapilmayacaklar

Migration/RPC YOK; `proposal_send` davranisi degismez. `onFocus` ile takvim YOK. Commit ATMA.

Rapor: degisen dosyalar (sayi), tsc/build (BUILD_ID), grep sonuclari, sapma ve nedeni. Commit ATMA.
