# Claude Code gorevi — Tasarim dili v2 / D1b-2: ticari ve calisma sayfalari panel kabuguna (teklif editoru, RFP, rezervasyon, odeme)

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: `docs/envanter/22-tasarim-dili-v2.md` (desen 4-5, bolum 3 D1b, bolum 4 notlar
3-13), `21-canli-tarama-1.md` (K5-K12, A5, A6, P5, P6), `20-faz8-event-os-modulleri.md` 8a-P1 kapanisindaki 8 kucuk bulgu, hijyen raporu
kapsam disi 3 ham `event_type`. ON KOSUL: main'de 8a-P1 + hijyen_03 (`organizations_public`). Dal: `tasarim/d1b-2` (Guven acti).
Migration/RPC YOK.

---

Kashe reposundasin. Once `git status` (temiz; dal `tasarim/d1b-2`). Oku: `CLAUDE.md`, `DESIGN.md` bolum 9, `app/components/panel/*`,
`app/lib/panel-menu.ts`, `app/etkinliklerim/[id]/page.tsx` (8a-P1 sekmeli duzen — ORNEK: kurulus sayfasi `PanelKabugu` icinde nasil
kuruluyor), `app/ajans/teklifler/[id]/page.tsx` + `teklif-editoru.tsx` (1379 satir; kalemler, KDV/gecerlilik, "Ic maliyet ve marj" karti
`maliyetGorulur` ile tembel; `teklif-data.ts`, `teklif-maliyet-actions.ts` → `internal_proposal_items_list/upsert`),
`app/portal/teklif/[token]/page.tsx` (musteri portali gorunumu; satir 189 `Tür` ham `event_type`), `app/kurumsal/rfp/page.tsx`,
`app/kurumsal/rfp/[id]/page.tsx` + `rfp-editoru.tsx` + `teklif-karsilastirma.tsx`, `app/ajans/rfp/page.tsx` + `[id]/page.tsx`,
`app/ajans/teklifler/page.tsx`, `app/rezervasyonlarim/page.tsx`, `app/rezervasyon/[id]/page.tsx` (+ `aksiyonlar.tsx`), `app/odemelerim/page.tsx`,
`app/kazanclarim/page.tsx`, `app/takvimim/page.tsx`, `app/teklif-talepleri/page.tsx`, `app/bildirimler/*`, `app/mesajlar/page.tsx`,
`app/ajans/havuz/page.tsx`, `app/ajans/ekipler/page.tsx`, `app/components/gorevler/gorev-satiri.tsx` (satir ~208 bagimlilik),
`app/components/gorevler/gorev-listesi.tsx`, `app/lib/gorevler.ts` (aktivite cumleleri), `app/lib/profile-helpers.ts` (`formatPrice`),
`app/lib/etkinlik-turu.ts`, `supabase/migrations/20261021110000_hijyen_03_kurulus_karsi_taraf.sql` (`organizations_public`: id, slug,
display_name, account_type, legacy_profile_id).

Ilke: renk/font yok, DESIGN.md token'lari; `internal.*` yalniz mevcut RPC'lerle (`internal_proposal_items_*`), yeni ic veri okuma yolu yok;
alici yuzeyinde ic maliyet/marj ASLA render edilmez. Sapkali harf yok; yorumlar ASCII; UI Turkce karakterli.

## 1) Panel kabugu — calisma sayfalari (mekanik tasima)

Asagidaki sayfalar `TopNav` yerine `PanelKabugu` icinde render edilir (etkinlik sayfasindaki desen; kurulus sayfalarinda ilgili kurulus
grubu aktif, kisisel sayfalarda kisinin grubu): **kurulus:** `/ajans/teklifler`, `/ajans/teklifler/[id]`, `/ajans/rfp`, `/ajans/rfp/[id]`,
`/ajans/havuz`, `/ajans/ekipler`, `/kurumsal/rfp`, `/kurumsal/rfp/[id]`, `/profil/ekibim`, `/profil/kurumsal-ekip`; **kisisel/karma:**
`/etkinliklerim` (liste), `/rezervasyonlarim`, `/rezervasyon/[id]`, `/odemelerim`, `/kazanclarim`, `/takvimim`, `/teklif-talepleri`,
`/teklif-taleplerim`, `/ilanlarim`, `/basvurularim`, `/bildirimler`, `/mesajlar` (liste; `/mesajlar/[id]` sohbet ekrani DOKUNULMAZ).
Her sayfada `PanelBaslik` (eyebrow + h1; vurgu kelimesi `brand-accent`). Sayfa icerigi/aksiyonlari degismez — yalniz kabuk ve baslik.
Vitrin (kesfet, p/[id], ilanlar, ana sayfa, giris) TopNav'da kalir.

## 2) Teklif editoru (A5; video `eventos` 4. kare)

`app/ajans/teklifler/[id]/teklif-editoru.tsx`:
- Kalem tablosu `VeriTablosu` diline: sutunlar **KALEM** (ad + alt satir not) · **ADET** · **BIRIM FIYAT** · **TOPLAM** · **MUSTERIYE
  GORUNUR** (onay kutusu) ve `maliyetGorulur` ise **IC MALIYET** · **MARJ %** sutunlari ayni tabloda (ayri "Ic maliyet ve marj" karti
  KALKAR; veri yine `internal_proposal_items_list`/`upsert` RPC'leriyle, tembel yukleme ayni). Duzenlenebilir hucreler (taslakta) satir
  ici girdi; gonderilmis/onayli surumde salt okunur (bugunku kilit kurali). `md` alti: satir = kart (etiket:deger).
- Tablo altinda **`OzetKutuSatiri`**: `maliyetGorulur` ise 3 kutu — "Ic maliyet · yalniz ajans" (toplam ic maliyet), "Marj · yalniz
  ajans" (tutar + %), **"Musteriye teklif" (hero, lacivert; KDV dahil genel toplam)**; degilse tek hero kutu + KDV satiri. Toplamlar
  sunucu degerleri (bugunku `proposal_versions` toplamlari) — istemcide HESAPLANMAZ.
- Ust bar: baslik + "Alici kurulus" + durum rozeti + **"Musteri gorunumu" anahtari** (istemci; acikken editor yerine `TeklifBelgesi`
  salt okunur gosterilir — madde 3) + sagda "PDF indir" (devre disi, `title="Yakinda (FAZ 9)"`) + birincil pembe **"Teklifi gonder →"**
  (mevcut gonder akisi; onay kapisi ve gecerlilik sorusu AYNEN).
- `md` alti: ozet kutular alt alta; gonder dugmesi `OzetSerit` (yapiskan alt serit: "Genel toplam 23.400 TL" + dugme).

## 3) Teklif belgesi — tek bilesen (portal + musteri gorunumu)

`app/components/teklif/teklif-belgesi.tsx` (sunucu/istemci notr, `'use client'` yok): portal sayfasinin sunum kismi buraya cikarilir
(baslik, alici/satici, etkinlik ozeti, kalemler — yalniz `is_visible`, ara toplam/KDV/genel toplam, gecerlilik, musteri notu, durum).
`app/portal/teklif/[token]/page.tsx` bu bileseni kullanir (davranis ayni: anon RPC verisi; onay/revizyon formlari sayfada kalir) —
**"Tur" satiri `etkinlikTuruEtiketi`** (ham `event_type` alici goruyordu). Editor "Musteri gorunumu"nda ayni bilesen, mevcut surum verisiyle.
Ic maliyet/marj bu bilesene HIC girmez (prop bile yok).

## 4) Rezervasyon / odeme / karsi taraf adi (K9-K12, P6)

- Tum karsi taraf adlari `organizations_public` uzerinden: `rezervasyonlarim/page.tsx` (2 embed), `rezervasyon/[id]/page.tsx`,
  `ajans/page.tsx` (2 embed), `kurumsal/page.tsx`, `kurumsal/rfp/*` ve `ajans/rfp/*` listelerinde alici/satici adi nerede `organizations`
  ile okunuyorsa. Kalip: `seller:organizations_public!proposals_seller_organization_id_fkey(display_name)`. `grep -rn "organizations!" app`
  → yalniz kullanicinin KENDI kurulusunu okuyan yerler (gerekce yorumla).
- `/rezervasyon/[id]` (alici dali): baslik karti = satici ajans adi (+ `account_type` rozeti), alt satir "Kurulusunuz adina · <alici
  kurulus>", meta: "Teklif surumu N · Onaylayan: <ad> · <tarih>"; "Teklif talebine git →" (rfp_id varsa) ve "Teklife git →" (satici
  dalinda). Satici dali (ajans) ayni kart: alici kurulus adi.
- `/rezervasyonlarim` "Kurulusunuz adina alinan" karti: ajans adi (ilk satir), etkinlik, tarih · sehir, "Teklif surumu 2", tutar.
- `/odemelerim` (K12): kurulus rezervasyonlari (`bookings.buyer_organization_id` = kullanicinin kuruluslari, `events.manage`/`finance.view`)
  KPI'lara ve tabloya dahil; tablo sutunu "Ajans / Etkinlik"; satirlar `/rezervasyon/[id]`'ye baglanir.
- **Para bicimi tek kural:** her yerde `"12.000 TL"` (TL soneki, binlik nokta, kurus yok; aralik `"2.500 – 3.000 TL"`; "…'den" eki
  pazaryerinde `"48.000 TL'den"`). `formatPrice` bu bicime cevrilir ve `formatTL` ile birlesir; `grep -rn "₺" app --include=*.tsx` → 0.
  Vitrin kartlari (kesfet/profil paket fiyatlari) da ayni yardimciyi kullanir — gorunum "2.500 – 3.000 TL".

## 5) RFP sayfalari (K5, K8 kalanlari, A3 tamam)

`/ajans/rfp` ve `/ajans/rfp/[id]`: alt satirda etkinlik adi yalniz RFP basligindan FARKLIYSA (kurumsal tarafta yapilan kural ayni).
`/kurumsal/rfp/[id]` karsilastirma tablosu `VeriTablosu` sutun basligi diline (eyebrow), secili sutun `brand-accent-soft` zemin; alt
yapiskan `OzetSerit` (secili teklif · tutar · "Sec" dugmesi) — mevcut secim onay kapisi AYNEN.

## 6) Etkinlik sayfasi kalanlari (A6 ikinci yarisi, 8a turu bulgulari)

- Baslik karti: rozetler ve CTA basligin ALTINA (title tam genislik; `flex-wrap`). `/etkinliklerim/[id]` ve `PanelBaslik`'ta ayni.
- Ekip sekmesi uye satiri (`ekip-paneli.tsx`): 7 metin dugmesi yerine **durum secimi** (Onerildi · Iletisime gecildi · Onaylandi ·
  Reddetti · Degistirildi) + "…" menusu (Kilitle · Not · Profili gor). Actions degismez.
- Gorev satiri: bagimlilik satiri yalniz `gorev.bagli?.id` varsa ("↳ X'ten sonra" bos ekle gelmez). Aktivite cumlesi: "gorevi Test Pro'ye
  atadi" yerine ek almayan kalip: **"gorevin atananini degistirdi → Test Pro"**; benzer sekilde "son tarihi → 14 Mayis 2027".
- Hizli ekle iyimser: satir hemen listeye eklenir ("kaydediliyor" rozetiyle), sunucu sonucu gelince id/zaman yerine oturur; hata olursa
  satir kalkar + mesaj. `revalidatePath` listesi: yalniz etkilenen etkinlik + `/kurulus/gorevler` (gosterge sayilari bir sonraki
  ziyarette tazelenir; `/ajans` `/kurumsal` `/profil` revalidate KALKAR).
- Filtre listesinde uye/havuz kaydi etiketi formdaki gibi ("Test Pro — Izleyici", "Test Pro — Havuz kaydi").
- `/profil` "Bana atanan gorevler" karti acik gorev 0 iken de gorunur ("Sana atanmis acik gorev yok.").
- Yan menu: ayni href'li madde (ornegin Etkinlikler) birden cok kurulus grubunda varsa yalniz `?kurulus=` eslesen ya da ilk grup aktif
  (`aria-current` tek). Alt hesap karti: cok kurulus uyesinde kisi adi + "N kurulus" (kurulus adi yerine).
- `/kurumsal` gosterge tablosu `lg` altinda ETKINLIK sutunu gizli; yan menu "Profesyonel teklifleri" → "Pro teklifleri".
- Kalan ham `event_type`: `app/odemelerim/page.tsx:205`, `app/mesajlar/mesaj-listesi.tsx:288` → `etkinlikTuruEtiketi`;
  `etkinlik-turu.ts` sozlugune `fashion` → "Moda / defile" (sozluk kaynaginda yoksa yerel ek).

## 7) Yapilmayacaklar

Migration/RPC YOK; `internal` icin yeni okuma yolu YOK; portal onay/revizyon akisi degismez; teklif gonderme/onay kapilari degismez;
kesfet/profil sayfasi yerlesimi (D2) degismez — yalniz para bicimi. Commit ATMA.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` → route tablosu + `.next/BUILD_ID`.
- `grep -rn "<TopNav" app --include=*.tsx` → yalniz vitrin sayfalari (liste raporda); `grep -rn "organizations!" app` → yalniz kendi kurulus
  okumalari; `grep -rn "₺" app --include=*.tsx --include=*.ts` → 0; `grep -rn "teklif-belgesi" app | wc -l` → ≥ 2 (portal + editor);
  `grep -rn "event_type}" app --include=*.tsx` → 0 (ham deger render yok).
- Sapkali harf 0; yorumlar ASCII.
- **Onizleme turu (Claude; Vercel dal URL'si):** gmail — `/ajans/teklifler/<onayli RFP yaniti>`: panelde, tablo sutunlari, ic maliyet/marj
  sutunlari + 3 ozet kutu (hero "Musteriye teklif 23.400 TL"), "Musteri gorunumu" anahtari → belge gorunumu (ic maliyet yok), 375 px
  yapiskan serit; `/rezervasyon/<id>` satici dali alici adi "Test Guven"; `/ajans/rfp` alt satir tekrar yok. testguven — `/rezervasyon/<id>`
  baslik "Sunucu Ajans", "Teklif talebine git →"; `/rezervasyonlarim` kartta "Sunucu Ajans"; `/odemelerim` onayli 23.400 TL sayimda ve
  tabloda; `/kurumsal/rfp/<id>` karsilastirma + serit. hotmail — `/teklif-talepleri`, `/kazanclarim`, `/takvimim` panelde; portal
  baglantisi (Guven verir) "Tur: Lansman". Para bicimi her yerde "… TL". Konsol 0.

Rapor: degisen/yeni dosyalar, tsc/build (BUILD_ID), grep sonuclari, panel kabuguna gecen sayfa listesi, sapma ve nedeni. Commit ATMA.
