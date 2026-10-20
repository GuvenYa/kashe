# Claude Code gorevi — Hijyen / Canli tarama 1 (metin, ham deger, kucuk duzen)

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: `docs/envanter/21-canli-tarama-1.md` (K2, K4, K5, K8, Z3, Z4, P1, P2, A3, A7, K6, K7,
K11, K16) + `20-faz8-event-os-modulleri.md` bolum 2 kozmetik (1)-(3). Dal: main (kucuk, dusuk risk). Migration/RPC YOK.

---

Kashe reposundasin. Once `git status` (temiz). Oku: `CLAUDE.md`, `app/lib/tarih.ts` (Istanbul tarih bicimi), `app/lib/profile-helpers.ts`
(`formatPrice`), `app/lib/brief-config.ts` (`DEFAULT_BRIEF_FIELDS`, kategori brief alanlari: `key`, `label`, `options[{value,label}]`),
`app/lib/filter-config.ts` (etkinlik turu etiketleri: `'birthday' → 'Dogum gunu'` vb.), `app/lib/org-roles.ts`,
`app/components/ui/kurulus-rol-secici.tsx`. Yorumlar ASCII; UI Turkce karakterli; sapkali harf yok.

## Yapilacaklar

1. **Etkinlik turu etiketi — tek yardimci** `app/lib/etkinlik-turu.ts` (yeni; `'use client'` yok): `etkinlikTuruEtiketi(value)` —
   `filter-config.ts`'teki mevcut sozlukten (birthday, wedding, engagement, corporate, launch, fashion, graduation, henna, festival, ...)
   Turkce etiket; bilinmeyen deger oldugu gibi, ilk harf buyuk. Kullan: `app/kazanclarim/page.tsx` ("launch/engagement/wedding" → Lansman /
   Nisan / Dugun), `app/teklif-talepleri/page.tsx` ("birthday/fashion/corporate").
2. **Gelen teklif talepleri** `app/teklif-talepleri/page.tsx` (P1): `brief_data` ham `Object.entries` yerine kategorinin brief alanlariyla
   eslenir — alan `key` → `label`, deger → `options` etiketi (yoksa deger); `event_date` → `app/lib/tarih.ts` ("15 Haziran 2027");
   "Butce: 20000 - 30000 TL" → `formatPrice` ("20.000 – 30.000 TL"). Gorunen ilk 4 alan kurali kalir.
3. **Kazanclarim** (P2): "Yaklasan isler"te tarihi gecmis onayli kayitlar ayri kume: baslik "Tarihi gecmis, tamamlanmamis (N)" + kisa not
   "Rezervasyon sayfasindan tamamla". Gelecek tarihli olanlar "Yaklasan" kalir.
4. **Etkinlik sayfasi** `app/etkinliklerim/[id]/page.tsx` (K2, K4, A7): "Ajans adaylari ekibe eklenmez; ajansla tam hizmet teklifi FAZ 7."
   cumlesi KALKAR; yerine (yalniz alici/kurulus etkinliginde) "Ajansla calismak icin: Teklif talebi ac →" baglantisi (mevcut
   `/kurumsal/rfp?etkinlik=` adresi). "EVENTSPEC SURUMU: V2" → "Etkinlik tanimi · surum 2". Liste sayfasinda ayni gunlu araliklar tek tarih
   ("27 Eylul 2026", ok yok). Butce "60000 – 90000 TL" → `formatPrice`.
5. **RFP sayfalari** (K5, K8, K6, K7): `/kurumsal/rfp` ve `/kurumsal/rfp/[id]` alt satirda etkinlik adi yalniz RFP basligindan FARKLIYSA;
   "Bu talep bir etkinlige bagli. Etkinlige git (etkinligin sahibi degilsen gorunmez)." → erisim varsa "Etkinlige git →", yoksa satir yok
   (ayni kural `/ajans/teklifler/[id]` altindaki "Bu teklif bir etkinlige bagli..." icin). Telefonda (`sm` alti): baslik kartinda durum
   rozeti basligin USTUNDE; "Istenen roller" tablosu kart moduna (Adet · Butce ipucu · Not · Zorunlu etiketli); karsilastirma tablosunda
   hucre kisa bicim (yalniz toplam "3.000 TL"; "1 × 3.000 TL =" yalniz `sm+`).
6. **Gelen RFP'ler** `/ajans/rfp` (A3): ajans gozuyle TEK sonuc rozeti: teklifi secildiyse "Teklifin secildi" (moss), baska teklif
   secildiyse "Secilmedi", RFP iptalse "Iptal edildi" (secilmedi rozeti gosterilmez), acik ve yanitlanmissa "Yanitladin", acik ve
   yanitlanmamissa "Yanit bekliyor" + son tarih.
7. **Rezervasyon sayfasi** `/rezervasyon/[id]` (K11): `sm` altinda baslik karti dikey (avatar+ad, altinda rozet, meta satiri `flex-wrap`).
8. **Ekip sayfalari** (K16 / 8-U kozmetik): `KurulusRolSecici` koku `min-w-0 w-full sm:w-[280px] sm:shrink-0` (`min-w-[190px]` kalkar); uye
   satirinda ad blogu `min-w-0 flex-1` (truncate calissin). Kurumsal yuzeyde ozetlerde "havuz" ifadesi gizlenir: `ORG_ROLE_SUMMARIES`
   yaninda `ORG_ROLE_SUMMARIES_KURUMSAL` (havuz/ yetenek ifadeleri cikarilmis), bilesene `yuzey?: 'ajans' | 'kurumsal'` prop'u;
   `kurumsal-uye-listesi.tsx` `yuzey="kurumsal"`.
9. **Sayfa basligi / yonlendirme** (Z3, Z4): `app/ilanlar/page.tsx` `metadata.title = 'Ilanlar — Kashe'` (Turkce "İlanlar"); `/ilanlarim`,
   `/basvurularim` de baslik eksikse ekle. `/yakinda` → `/`'ye kalici yonlendirme (`next.config` redirects ya da `redirect()`).

## Yapilmayacaklar

Migration/RPC YOK (bildirim metni SQL'i ve `organizations_public` ayri — DB turu). Panel kabugu/yan menu YOK (D1a). Kesfet/profil YOK (D2).
Commit ATMA.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` → route tablosu + `.next/BUILD_ID`.
- `grep -rn "FAZ 7" app --include=*.tsx` → 0 (UI'da faz adi yok); `grep -rn "EVENTSPEC" app` → 0; `grep -rn "min-w-\[190px\]" app` → 0.
- `grep -rn "etkinlikTuruEtiketi" app | wc -l` → ≥ 3.
- Sapkali harf 0; yorumlar ASCII.
- **Canli (Claude turu, main deploy sonrasi):** hotmail `/teklif-talepleri` etiketli alanlar + Turkce tarih; `/kazanclarim` Lansman/Nisan/Dugun;
  testguven `/etkinliklerim/[id]` cumle yok, "Teklif talebi ac →"; `/kurumsal/rfp/[id]` 375 px rozet ustte + kart tablo; gmail `/ajans/rfp`
  "Teklifin secildi" / "Iptal edildi"; `/profil/kurumsal-ekip` 807 px ad ezilmiyor, ozette "havuz" yok.

Rapor: degisen/yeni dosyalar, tsc/build (BUILD_ID), grep sonuclari, sapma ve nedeni. Commit ATMA.
