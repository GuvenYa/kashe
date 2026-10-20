# Claude Code gorevi — Tasarim dili v2 / D1b-3: Teklif yuzeyi (editor tablosu, ozet kutular, musteri gorunumu, serit)

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: `docs/envanter/22-tasarim-dili-v2.md` desen 4-5 (video `kashe_eventos_v1` 4. kare:
kalem tablosu + uc ozet kutu + "Musteri gorunumu" anahtari + "PDF indir" / "Teklifi gonder"), `24-...-d1b-2` madde 2-3 (yapilmayan
kisim), `21-canli-tarama-1.md` A5. ON KOSUL: main'de D1b-2 (`para.ts`, `TeklifBelgesi`, panel kabugu). Dal: `tasarim/d1b-3` (Guven acti).
Migration/RPC YOK. TEK KONU: `/ajans/teklifler/[id]`.

---

Kashe reposundasin. Once `git status` (temiz; dal `tasarim/d1b-3`). Oku: `CLAUDE.md` (FAZ 7a/7b/7c paragraflari: teklif kurallari),
`DESIGN.md` bolum 9, `app/ajans/teklifler/[id]/teklif-editoru.tsx` (1379 satir; bolumler: ~451 RFP yaniti bandi, ~470 baslik satiri,
~540 rezervasyon, ~640 Kalemler (alandan cikinca kaydedilir; mobilde etiketler), ~852 surum alanlari + toplamlar (DB'den), ~924 durum
islemleri + ~1033 gonderim onay ekrani (gecerlilik tek yerden) + ~1110 ham jeton, ~1143 portal baglantilari, ~1218 gizli ic maliyet ve marj
karti (`maliyetGorulur`, tembel RPC)), `app/ajans/teklifler/[id]/page.tsx`, `teklif-data.ts` (tipler, `paraMetni`, `marjYuzdesi`,
`IC_KALEM_KAYNAK_ETIKETLERI`), `teklif-actions.ts` (updateProposalItem/addProposalItem/deleteProposalItem/updateVersionFields/sendProposal…),
`teklif-maliyet-actions.ts` (`listProposalInternalItems`, `upsertProposalItemCost` → `internal_proposal_items_list/upsert`),
`app/components/teklif/teklif-belgesi.tsx` (D1b-2; portal tuketiyor; ic maliyet prop'u YOK — oyle kalir), `app/components/panel/*`
(`VeriTablosu`, `OzetKutuSatiri`, `OzetSerit` varsa; yoksa `OzetSerit` bu gorevde `app/components/panel/ozet-serit.tsx` olarak eklenir),
`app/lib/para.ts`, `app/portal/teklif/[token]/page.tsx` (belgeyi nasil besliyor).

**Degismeyecek davranislar (kirmizi cizgi):** kalem ekleme/silme/guncelleme eylemleri ve "alandan cikinca kaydet"; toplamlarin DB'den
okunmasi (istemcide hesap YOK); gonderilmis/onayli surum kilidi; gonderim onay ekrani ve gecerlilik kurali; ham jetonun yalniz bir kez
gosterilmesi; portal baglantilari; rezervasyon olusturma onayi; ic maliyet verisinin yalniz `maliyetGorulur` ile ve yalniz RPC'lerle
yuklenmesi (DOM'da da yok). Bu gorev YERLESIM ve SUNUM degistirir; her eylem ayni action'i ayni argumanlarla cagirir.

## 1) Baslik karti (video ust bar)

Tek satir: sol — eyebrow "TEKLIF · <surum>" + baslik (tam genislik, kirpma yok; `truncate` KALKAR, `break-words`), alt satir "Alici:
<kurulus/musteri> · Etkinlik: <ad> · son tarih …" (RFP yanitinda mevcut bant bilgisi buraya iner; bant kalkar); sag — durum rozeti +
**"Musteri gorunumu" anahtari** (istemci `useState`; `aria-pressed`) + "PDF indir" (devre disi, `title="Yakinda"`) + birincil pembe
**"Teklifi gonder →"** (taslaksa; mevcut gonder akisina GIRER — onay ekrani ayni). Rezervasyon rozeti/baglantisi altta kucuk satir.
`md` alti: sag grup ikinci satira sarar.

## 2) Kalem tablosu (`VeriTablosu` dili)

Sutunlar: **KALEM** (ad; alt satir not/aciklama) · **ADET** · **BIRIM FIYAT** · **TOPLAM** (sag yasli, `para.ts`) · **MUSTERIYE GORUNUR**
(onay kutusu; mevcut `is_visible` davranisi) · [`maliyetGorulur` ise] **IC MALIYET** · **MARJ** (tutar + %; `marjYuzdesi`). Taslakta
hucreler satir ici girdi (bugunku girdiler, ayni `onBlur` kaydetme); kilitli surumde duz metin. Son satir "+ Kalem ekle" (mevcut ekleme).
Gizli kalem (`is_visible=false`) satiri `text-ink-50` + "gizli" rozeti (toplama girmez — DB kurali, UI yalniz gosterir). Ic maliyet sutunu
degerleri `listProposalInternalItems` ile TEMBEL: anahtar/akordeon yerine sutun basliginda "Ic maliyet · yukle" dugmesi; yuklenince
hucreler dolar ve `upsertProposalItemCost` ile duzenlenir (bugunku kart mantigi hucreye tasinir). Eski "Ic maliyet ve marj" karti KALKAR.
`md` alti: satir = kart (etiket:deger; ic maliyet/marj yalniz `maliyetGorulur`).

## 3) Ozet kutular (`OzetKutuSatiri`)

Tablo altinda: `maliyetGorulur` ise 3 kutu — "IC MALIYET · yalniz ajans" (ic kalem toplami; RPC listesinden; yuklenmemisse "—"), "MARJ ·
yalniz ajans" (musteri toplami − ic maliyet; % = marj/ic maliyet; yuklenmemisse "—") ve **"MUSTERIYE TEKLIF" hero (lacivert; genel toplam
KDV dahil; alt not "KDV %N dahil")**; degilse tek hero + yaninda "Ara toplam / KDV" kucuk kutu. Toplam degerleri DB'nin surum toplamlari
(bugunku alanlar). Marj hesabi yalniz GOSTERIM (iki DB degerinin farki); fiyat uretmez.

## 4) Musteri gorunumu

Anahtar acikken editor govdesi yerine **`TeklifBelgesi`** (D1b-2 bileseni) render edilir — portalin gordugu belge: yalniz `is_visible`
kalemler, toplamlar, gecerlilik, musteri notu, alici/satici. Veri: mevcut surumun verisi (`page.tsx`'in zaten cektigi kalemler/surum)
bilesenin prop tipine uydurulur; ic maliyet bu yola HIC girmez (prop yok). Ustte ince bant: "Musterinin gorecegi hali — duzenlemek icin
anahtari kapat."

## 5) Serit (`OzetSerit`, `md` alti)

Telefonda sayfa altinda yapiskan serit: sol "Genel toplam 23.400 TL · KDV dahil", sag birincil dugme (taslak: "Teklifi gonder →" → onay
ekrani; gonderilmis: "Yeni surum"; onayli: "Rezervasyona git"). Masaustunde serit YOK (baslik kartindaki dugmeler yeterli).

## 6) Dosya duzeni

`teklif-editoru.tsx` 1379 satir: tabloyu `teklif-kalem-tablosu.tsx`, ozet kutulari `teklif-ozet.tsx`, baslik kartini `teklif-baslik.tsx`
olarak ayni klasore cikar (istemci bilesenleri; props ile action'lar). Gonderim/rezervasyon/portal bolumleri yerinde kalir. Toplam satir
sayisi raporda.

## 7) Yapilmayacaklar

Migration/RPC YOK; fiyat/KDV/marj HESABI istemciye TASINMAZ; `internal.*` icin yeni okuma yolu YOK; portal sayfasi degismez; kurumsal RFP
karsilastirmasi (D1b-4) degismez. Commit ATMA.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` → route tablosu + `.next/BUILD_ID`.
- `grep -n "Ic maliyet ve marj\|İç maliyet ve marj" app/ajans/teklifler/[id]/*.tsx` → eski kart basligi 0; `grep -rn "teklif-belgesi" app | wc -l`
  → ≥ 2 (portal + editor); `grep -rn "internal_proposal_items" app` → yalniz `teklif-maliyet-actions.ts`; `grep -rn "₺" app` → 0.
- Ic maliyet sutunlari `maliyetGorulur=false` iken DOM'da yok (render kosulu; raporda kanit: `grep -n "maliyetGorulur &&"`).
- Sapkali harf 0; yorumlar ASCII.
- **Onizleme turu (Claude):** gmail — onayli RFP yaniti `/ajans/teklifler/d3a9847a-…`: baslik kirpilmiyor, tablo sutunlari, "Ic maliyet ·
  yukle" → sutunlar + 3 ozet kutu (hero "Musteriye teklif 23.400 TL"); "Musteri gorunumu" → belge, ic maliyet yok; taslak teklif
  (`/ajans/teklifler` listesindeki 28.800 TL taslak): hucre duzenleme + alandan cikinca kaydet, "Teklifi gonder →" onay ekrani acilir
  (gonderilmez, Vazgec); 375 px serit; hotmail (Sunucu Ajans izleyici, `maliyetGorulur` yok): ic maliyet sutunu/kutusu DOM'da yok.
  Konsol 0.

Rapor: degisen/yeni dosyalar, satir sayilari, tsc/build (BUILD_ID), grep sonuclari, sapma ve nedeni. Commit ATMA.
