# 49 - Claude Code gorevi: FAZ 10d (lint + CLAUDE.md) + Duzeltme 08 (Sahne turu kucuk bulgulari)

Hazirlayan: Claude (Cowork), 5 Kasim 2026. Kaynak: `docs/envanter/38-faz10-temizlik.md` bolum 10d, `docs/sahne/bulgular.md`.
`main`'den acilan `faz10d` dalinda. Veritabani isi (10d/01 bookings politikalari) ayri migration'da, bu gorev DB'ye dokunmaz.
Kullanim: Claude Code'a "`docs/envanter/49-claude-code-gorevi-10d-duzeltme-08.md` dosyasini oku, "---" cizgisinin altindaki gorevi
uygula" denir.

---

## Gorev

Uc bolum: A) `eslint` hatalarini sifirla, B) CLAUDE.md'yi FAZ 10 sonrasi gercege esitle, C) Sahne turunun acik kucuk bulgularini
kapat. A ve B DAVRANIS DEGISTIRMEZ; C yalniz asagida yazilan davranisi degistirir. Turkce arayuz metinleri, ASCII kod yorumlari,
yeni dosyalarda sapkali harf yok. Commit ATMA.

### A) eslint: 68 hata -> 0

Baslangic (`npx eslint app --quiet`, 5 Kasim): 68 hata / 35 dosya - `@typescript-eslint/no-explicit-any` 25,
`react-hooks/set-state-in-effect` 19, `@next/next/no-html-link-for-pages` 9, `prefer-const` 6, `react-hooks/purity` 4,
`react/no-unescaped-entities` 3, `@typescript-eslint/no-empty-object-type` 1, `react-hooks/refs` 1. En yogun: `teklif-taleplerim/[id]/page.tsx`
(11), `admin/istatistikler/page.tsx` (8), `components/sections/footer.tsx` (4).

1. **Once envanter:** `npx eslint app --quiet` ciktisini dosya:satir:kural tablosu olarak rapora koy.
2. **`react-hooks/purity` (`Date.now()` render icinde: `kesfet/page.tsx` `tierWeight`, `components/sections/featured-profiles.tsx`,
   digerleri):** premium suresi karsilastirmasi saf bir yardimciya tasinir (or. `app/lib/premium.ts`
   `premiumAgirligi(tier, until, simdi)`); `simdi` sunucu fonksiyonunun basinda bir kez alinir. Siralama sonucu AYNI kalir.
3. **`react-hooks/set-state-in-effect` (19):** her biri icin once etkisiz karsilik ara - turetilmis deger (state yerine hesap),
   `useState` baslangic fonksiyonu (hidrasyon farki yoksa), `key` ile sifirlama, olay isleyicisine tasima. Mesru kullanimda
   (bagla sonrasi localStorage / adres cubugu okuma, dis aboneliklerle esitleme; or. `etkinlik-sihirbazi/sihirbaz-client.tsx`
   `setSorgu` geri/ileri esitlemesi) satir duzeyinde `// eslint-disable-next-line react-hooks/set-state-in-effect -- <ASCII gerekce>`.
   Rapor: her satir icin "duzeltildi (nasil)" ya da "devre disi (gerekce)".
4. **`no-explicit-any` (25):** gercek tip (`app/lib/types.ts` satir tipleri ya da yerel tip); gerekirse `unknown` + daraltma.
   Devre disi birakma yalniz dis kutuphane tipi zorunluysa, gerekceyle.
5. **`no-html-link-for-pages` (9):** ic yollardaki `<a href="/...">` -> `next/link` `<Link>`. Dis baglanti, `mailto:`, `tel:`,
   indirme (`/admin/rapor` gibi dosya donen yol) ve `target="_blank"` davranisi korunur; gerekiyorsa `<a>` kalir + gerekce.
6. **Digerleri:** `prefer-const`; `no-unescaped-entities` (Turkce kesme isareti `&apos;` - gorunen metin AYNI);
   `no-empty-object-type`; `react-hooks/refs`.
7. Gorunen metin, siralama, yonlendirme degismez. Kural ayari (`eslint.config.*`) DEGISMEZ, kural kapatilmaz.

### B) CLAUDE.md: FAZ 10 sonrasi gercek

FAZ 10a (uyelik tek tablo), 10b (etkinlik turu tek kaynak), 10c-1 (saglayici yazma yolu), 10c-2 (`provider_id`) uretimde.
Bilinen eskimis yerler (her birini KODLA dogrula, sonra duzelt; paragraflari uzatma, dosyanin ASCII uslubunu koru):

- "Sahip kimligi `provider_id` (FAZ 10c-2...)" paragrafi: "`provider_services` 2c'ye kadar uygulama tarafindan okunmaz ve yazilmaz"
  -> bugunku durum (`.from('provider_services')` okuyan dosyalari say: havuz rol listesi, Kashe AI vb.; yazan yok).
- "Yetenek havuzu (FAZ 5)" paragrafi: "`agency_members`'a yazan her yol ayni islemde `organization_talent_records` satirini da yazar"
  ve "Sil kurali: ... `agency_members`'ta var" -> 10a sonrasi gercek (uyelik `organization_memberships`; davet kabulu
  `org_invitation_respond`; havuz esitlemesi `sync_org_talent_pool`; silme kurali `app/ajans/havuz/havuz-actions.ts`'te bugun ne
  yapiyorsa o).
- "Mevcut sema ozeti": "`profiles` tablosu bugun uc isi birden yapiyor ... Goc bunlari ayiriyor" ve FAZ 2a ozetindeki
  "profiles hala kaynak, aynalanir" -> 10c sonrasi: `profiles` kimlik (+ FAZ 11'e kadar pazaryeri kopyasi, ters aynayla);
  pazaryeri kaynagi `providers` + alt profiller; kurulus `organizations`.
- Arama: `agency_members`, `business_members`, `agency_invitations`, `business_invitations`, `EVENT_TYPES`, "aynala", "profiles'a yaz",
  "2c'ye kadar", "FAZ 10'a" - her gecis 10a/10b/10c sonrasi gercekle celisiyorsa duzelt; tarihsel kayit (hangi fazda ne oldu)
  kalabilir. Rapor: degisen her cumle once / sonra.

### C) Duzeltme 08 - Sahne turu kucuk bulgulari (`docs/sahne/bulgular.md`)

| # | Yer | Yapilacak |
|---|---|---|
| 38 | `app/profil/kurumsal-ekip/kurumsal-uye-davet-formu.tsx` (+ panel) | Davet basariyla gonderilince form KAPANIR (ajans `/profil/ekibim` davet formu ne yapiyorsa ayni); bekleyen listesi bugunku gibi aninda guncellenir |
| 51 | `app/etkinliklerim/[id]/ekip-paneli.tsx` | "Onayla" sonrasi baslik ("Ekip · Taslak") sayfa yenilenmeden yeni durumu gosterir (yerel durum ya da `router.refresh()`; "Ekip durumu guncellendi." mesaji kalir) |
| 52 | `app/ajans/teklifler/[id]/teklif-editoru.tsx` "Musteri baglantilari" karti | Baglanti suresi etiketi "Baglanti gecerliligi"; teklifin kendi gecerliligi gecen yerlerde "Teklif gecerliligi" (iki tarih ayni kelimeyle anilmaz) |
| 53 | `app/portal/teklif/[token]/page.tsx` | "ETKINLIK" kutusunda ilk satirin etiketi "Etkinlik:" yerine "Ad:" (tekrar kalkar) |
| 54 | `app/kurumsal/rfp/[id]/rfp-editoru.tsx` | Butce ipucu min/max kutulari 1024 px'te degeri kesmez ("18(" gorunmez); 375 / 768 / 1024 / 1280 px'te okunur |
| 56 | `app/kazanclarim/page.tsx` | Teklif seklindeki satirda komisyon "-0 TL" yerine "—" + kisa not "Teklif dosyasindan komisyon alinmaz"; ust bilgi cumlesi "%10" kuralini dogrudan (eski sekil) rezervasyonlara baglar |
| 17 | Kashe AI / sihirbaz analizi (`app/lib/ai-actions.ts`, `analyzeEventNeeds` sonucu) | Metinde tek tutar + "civari / civarinda / yaklasik / gibi / asagi yukari" varsa ve sonuc `butce_min = butce_max` ise aralik ±%15: alt sinir 5.000'e ASAGI, ust sinir 5.000'e YUKARI yuvarlanir. Kesin ifade ("en fazla", "tam", "en az") ve zaten aralik olan sonuc DEGISMEZ. Model cagrisi / istem metni degismez; deterministik son isleme. Ornek: "250 bin civari" -> 210.000-290.000; "en fazla 250 bin" -> degismez |

Diger acik bulgular (#34 karar, #48 urun karari) bu gorevin disinda.

### Kabul olcutleri

- `npx tsc --noEmit` temiz; `npx eslint app` **0 hata**; `npm run build` temiz.
- Rapor: A envanter tablosu (once) + her satirin cozumu; devre disi birakilan satirlar ve gerekceleri; B once/sonra cumleler;
  C her bulgu icin degisen dosya:satir ve ekran metni; #17 icin en az 5 ornek girdi -> sonuc.
- Smoke icin acik sunucu birakma.

### Onizleme turu (Claude yapacak)

C maddelerinin hepsi (Sahne: Akdeniz Gida / Teknopark kurum, Lumen / Arti Bir ajans, Kashe AI "250 bin civari"); A'da
set-state-in-effect duzeltilen sayfalar (rapordaki liste) ve `<a>` -> `<Link>` gecen menuler (ust menu, alt bilgi, mobil menu);
Kesfet ve ana sayfa one cikan siralamasi (premium agirligi) degismemis.
