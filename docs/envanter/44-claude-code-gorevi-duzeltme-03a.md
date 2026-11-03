# Claude Code gorevi — Duzeltme 03-A: yalniz uygulama (migration YOK, Vercel ayari YOK)

Kaynak: Sahne turu bulgulari 40-48 (`docs/sahne/bulgular.md`) ve Fahri test rehberi hazirligi sirasinda kod taramasi (3 Kasim 2026).
Dal: `duzeltme-03a` (Guven acar). DB tarafi (portal bildirimleri, quotes sure sonu, iptal/tamamlama bildirimleri, kurum rezervasyon
bildirimi, RFP revizyon kilidi, portal teklifi <-> musteri hesabi) AYRI dilim (03-B), bu goreve GIRMEZ. Commit ATMA.

---

Kashe reposundasin. Once `git status` (temiz; dal `duzeltme-03a`). Oku: `CLAUDE.md`. Her madde bagimsiz; sirayla uygula, her birinde
degisen dosyalari listele. **Kirmizi cizgi:** migration/RPC/SQL YOK; `bookings`, `proposals`, `quotes`, `organization_memberships`
tablolarina yeni yazma yolu acilmaz; sapkali harf yok, yorumlar ASCII, UI Turkce; `'use client'` modulunden sunucu modulu import
edilmez. Commit ATMA.

## A1) "Teklif Al" pencere basligi — ek uyumsuzlugu

`app/p/[id]/iletisim-button.tsx` (~satir 512-517): baslik `<em>{professionalName}</em>&apos;a talep gönder` her ada `'a` ekliyor
("Burcu Ateş'a"). Rezervasyon penceresiyle ayni kalip kullanilir: **"<Ad> için teklif talebi"** (`rezervasyon-button.tsx` ~318:
"<Ad> için rezervasyon talebi"). Ek uretme fonksiyonu YAZMA; kalip degisikligi yeter. Ayni ekli kalibi baska yerde de ara:
`grep -rn "&apos;a \|'a \|'e " app --include=*.tsx | grep -v "//"` — kisi/kurulus adina eklenen sabit `'a`/`'e`/`'de` varsa "için" /
"tarihinde" gibi eksiz kaliba cevir (3 Kasim'da `app/rezervasyon/[id]/page.tsx` boyle duzeltildi).

## A2) Sohbet etkinlik seridi: kategoriye ozel brief alanlari

`app/mesajlar/[id]/page.tsx` + `konusma-detay.tsx`: etkinlik seridi yalniz `event_type/event_date/location/guest_count/budget_range`
gosteriyor; `conversations.brief_data` (kategoriye ozel alanlar: stil, drone, cekim suresi, cizim turu, teslim...) hic okunmuyor.
Istenen: seridin altinda (ya da "Etkinlik" karti icinde) `brief_data` anahtarlari `app/lib/brief-config.ts` etiketleriyle
gosterilir — alan tanimi yoksa anahtar ham, ilk harf buyuk; bos/`null` deger atlanir; `message` ve zaten seritte olan bes alan
tekrar gosterilmez. Deger `no_pref` gibi kodsa secenek etiketine cevir (brief-config `options`). En fazla 8 alan; fazlasi "+N alan"
ile acilir. Hem musteri hem profesyonel gorur. `brief_data` sunucuda okunur (`page.tsx`), istemciye hazir `{ etiket, deger }[]` gecer.

## A3) Karsi taraf paneli: ajans karsi tarafta "Ajans" etiketi + "Profilini gor"

`app/mesajlar/[id]/karsi-taraf-paneli.tsx` (~27, ~42-47): karsi taraf `role === 'agency'` ise rol etiketi "Müşteri" cikiyor ve
"Profilini gör" gizleniyor. Etiket haritasi: client -> "Müşteri", professional -> "Profesyonel", agency -> "Ajans", business ->
"Kurumsal"; "Profilini gör" professional VE agency icin gosterilir (`/p/<id>` ikisinde de acilir).

## A4) Rezervasyon iptal penceresi metni

`app/rezervasyon/[id]/aksiyonlar.tsx`: "Bu işlem geri alınamaz. Karşı tarafa bildirim ve e-posta gönderilecek." -> uygulama ici
bildirim YOK (03-B'de gelecek); metin **"Bu işlem geri alınamaz. Karşı tarafa e-posta ile bildirilecek."** Tamamlama penceresi metni
zaten dogru.

## A5) Yorum yazma: sunucu tarafinda tamamlanmis rezervasyon sarti

`app/yorumlar/actions.ts` (~46-81): sunucu yalniz "ortak sohbet" ariyor; arayuz ise tamamlanmis rezervasyon istiyor (yorum-button).
Sunucu eylemi de ayni sarti arar: yorum yazan kullanicinin (ya da kurum adina yaziyorsa kurumunun) o saglayiciyla `bookings.status =
'completed'` bir satiri olmali (`customer_id` = kullanici VEYA `buyer_organization_id` = kullanicinin yonettigi kurum; `professional_id`
VEYA `seller_provider_id` = saglayici). Yoksa Turkce hata: **"Yorum bırakabilmek için bu profesyonelle tamamlanmış bir rezervasyonun
olmalı."** Eski "Yorum yazmak için önce profesyonelle mesajlaşmalısın." metni kalkar. Duzenleme/silme yetkisi degismez. DB politikasi
DOKUNULMAZ (03-B'de degerlendirilir).

## A6) Admin

- **Askiyi kaldirma** (`app/admin/actions.ts` `unbanUser`): `suspended_*` temizlenirken `approval_status = 'approved'` ise
  `is_published = true` geri verilir (askidan onceki yayin durumu bilinmiyor; onayli profil yayina doner, digerleri donmez). Askiyi
  kaldirma penceresi metnine bir satir: "Onaylı profil yeniden yayına alınır."
- **Dashboard rezervasyon sayilari** (`app/admin/page.tsx`): `bookings` dogrudan sayimi admin RLS ile eksik. "Bu hafta rezervasyon"
  `admin_stats_weekly_compare()` sonucundaki `rezervasyon` satirinin `this_week` degerinden; "Rezervasyon" (toplam)
  `admin_report_stats()` `bookings` metriginden okunur (ikisi SECURITY DEFINER; `app/admin/rapor/route.ts` ayni RPC'yi kullaniyor).
  Hata olursa "—" ve `console.error`.
- **Istatistikler ham etiketler** (`app/admin/istatistikler/page.tsx` ~1275-1288): `request_profile_revision` -> "Profil revizyonu
  istendi", `request_listing_revision` -> "İlan revizyonu istendi" haritaya eklenir; haritada olmayan her islem icin ham anahtar
  yerine `anahtar.replace(/_/g, ' ')` + ilk harf buyuk yedek etiketi.

## A7) Kurum

- **Durum etiketleri tek kaynak:** `/kurumsal` gostergesi (`app/kurumsal/page.tsx`) RFP durumlarini kendi haritasiyla ("Sonuçlandı",
  "Toplanıyor", "İptal edildi") yaziyor; `app/kurumsal/rfp/rfp-data.ts` etiketleri ("Seçim yapıldı", "Yanıt toplanıyor", "İptal")
  kullanilir — gostergedeki yerel harita silinir, `rfp-data.ts`'ten import edilir (sunucu modulu; gosterge sunucu bileseni).
- **Davetle katilan yonetici "Ekip" sayfasina giremiyor:** `app/profil/kurumsal-ekip/page.tsx` ve `app/profil/ekibim/page.tsx`
  kapisi `profiles.role` + `kurulusumunId` (sahiplik). Istenen: sayfa, kullanicinin **members.manage yetkili** oldugu kurulusu bulur
  (sahiplik VEYA uyelik): `getCrewContext()` orgs listesine `canManageMembers` (members.manage) alani eklenir (`app/lib/org-context.ts`,
  mevcut can* kalibiyla); kurumsal-ekip sayfasi `accountType === 'business'` ve `canManageMembers` olan ilk kurulusu, ekibim sayfasi
  `accountType === 'agency'` olani kullanir; `?kurulus=<id>` ile secim. Hicbiri yoksa `/profil`. Menu (`app/lib/panel-menu.ts`
  `kurumsalGrubu`/`ajansGrubu`): "Ekip" / "Ekip üyeleri" maddesi `kendiKurumu` yerine `org.canManageMembers` ile cikar (href'e
  `?kurulus=` eklenir). Davet/rol/cikarma RPC'leri zaten `members.manage` istiyor; uygulama yeni yetki kurali YAZMAZ.

## A8) Takvim ve Kazanclar: teklif sekli rezervasyonlar

`app/takvimim/page.tsx`, `app/kazanclarim/page.tsx`: yalniz eski sekil (`quote_id` dolu) rezervasyonlari okuyor; ajansin teklif
dosyasindan dogan rezervasyonlar (`proposal_version_id` dolu, `seller_provider_id` = kullanicinin kurulusunun saglayicisi) gorunmuyor.
Istenen: iki sayfa da `seller_provider_id = <kullanicinin saglayici id'si>` (ajansta `organizations.legacy_profile_id` = kullanici id
oldugundan `seller_provider_id = user.id` yeterli — once dogrula: `providers.id` ajansta profil id'sine esit) satirlarini da alir;
kartta karsi taraf adi `proposals.client_name` ya da alici kurulus adi (`organizations_public`), etiket "Teklif dosyası". Kazanclarda
tutar `total_amount` (KDV dahil), platform ucreti 0. Iki sekli acikca ayir (CLAUDE.md FAZ 7c kurali), eski kartlara dokunma.

## A9) Kurumsal davet formu gonderim sonrasi kapanir

`app/profil/kurumsal-ekip/kurumsal-uye-davet-formu.tsx` ve `app/profil/ekibim/uye-davet-formu.tsx`: basarili gonderimden sonra form
acik kaliyor (alanlar temizleniyor). Basari mesaji 2 sn gosterilip form kapanir; "Bekleyen davetler" listesi guncel.

## Dogrulama

- `node node_modules/typescript/lib/tsc.js --noEmit -p tsconfig.json`; `npx eslint <degisen dosyalar>` (mevcut `Date.now` purity
  uyarilari `app/admin/page.tsx`'te onceden var — onlari da `new Date(now.getTime() - ...)` ile temizle); `npm run build` (route tablosu
  + `.next/BUILD_ID`).
- `grep -rnP '[âîûÂÎÛ]' <degisen dosyalar>` bos. Uretilen CSS'te yeni Tailwind siniflari var (DESIGN.md bolum 8).
- Onizleme (dal) — Sahne hesaplari (`docs/sahne/hesaplar.md`): A1 Burcu Ateş profilinde "Teklif Al" basligi; A2 bir fotografci
  brief'i gonderip sohbette "Stil tercihi" vb. satirlari; A3 Mavi Sahne ile acilan sohbette sag panel "Ajans" + "Profilini gör"; A5
  tamamlanmis rezervasyonu olmayan musteriyle yorum denemesi (hata metni); A6 `/admin` "Bu hafta rezervasyon" = `/admin/zeka` huni
  "Rezervasyon" (7 gun) ile tutarli; A7 `sahne+bahar-keskin@kashe.net` (Akdeniz Gida Proje yoneticisi — members.manage YOK: menu yok)
  ve kurumun kendi hesabi (var); A8 Arti Bir Ajans `/takvimim`'de Teknopark Gala rezervasyonu; A9 davet sonrasi form kapanir.

## Rapor

Bitince kisa rapor: madde madde degisen dosyalar, A7 icin `canManageMembers` kaynagi, A8 icin saglayici id dogrulamasi, sapmalar.
Commit ATMA.
