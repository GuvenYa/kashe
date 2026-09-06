# Envanter 01 — Rol kontrolleri

Uretim tarihi kaynagi: repo calisma agaci, HEAD = `46fcf49`

Bu belge **yalniz okuma** ile uretildi; hicbir kaynak dosya degistirilmedi.

**Amac:** goc planinda kullanici rolu kontrolleri (`client`/`professional`/`business`/`agency`)
`organization_memberships` tabanli izin kontrolune donusecek. Bu envanter bu kontrollerin
nerede oldugunu, neyi korudugunu ve hangisinin donusecegini tespit eder.

---

## 1. OZET TABLO

### 1a. Rol degeri basina (dogrudan karsilastirma)

| Rol degeri | Gecis (tekil dosya:satir) | Dosya |
|---|---|---|
| `role === 'business'` | 66 | 39 |
| `role === 'agency'` | 48 | 29 |
| `role === 'professional'` | 28 | 20 |
| `role === 'client'` | 10 | 10 |

### 1b. Kalip basina

| Kalip | Gecis | Dosya |
|---|---|---|
| rol dizileri | 20 | 17 |
| TS yardimcilari (isProfessional vb.) | 78 | 19 |
| .role erisimi | 88 | 44 |
| SQL: dogrudan role = ... | 10 | 5 |
| SQL: yetki fonksiyonu adi | 65 | 11 |

**Birlesik tekil bulgu: 312 + 25 (ek tarama) = 337** / 90 dosya.

### 1c. Siniflandirma dagilimi

| Sinif | Adet | Oran |
|---|---|---|
| A | 66 | %19.6 |
| B | 216 | %64.1 |
| C | 55 | %16.3 |

| Baglam tipi | Adet |
|---|---|
| arayuz-gosterimi | 112 |
| is-mantigi | 70 |
| yardimci-tanim | 56 |
| RLS | 42 |
| veri-filtresi | 20 |
| tip-tanimi | 19 |
| sayfa-erisimi | 18 |

### 1d. Aramanin kendisi (kanit)

Sayilar asagidaki komutlarla uretildi; `-o` cikti satirlari `dosya:satir` ile tekillestirildi.

```bash
# rol esitlik kontrolleri
git ls-files "*.ts" "*.tsx" | xargs grep -noE "role\s*[!=]==\s*[\x27\"]<rol>[\x27\"]"

# rol dizileri
git ls-files "*.ts" "*.tsx" | xargs grep -noE "\[\s*\x27(client|professional|business|agency)\x27(\s*,\s*\x27...\x27)*\s*\]"

# TS yardimcilari
git ls-files "*.ts" "*.tsx" | xargs grep -noE "\b(isProfessional|isBusiness|isAgency|isClient)\b"

# SQL tarafi
git ls-files "supabase/*" | xargs grep -noiE "\brole\s*=\s*\x27(client|professional|business|agency)\x27"
git ls-files "supabase/*" | xargs grep -noE "\b(is_admin|has_business_role|is_business_member|owns_quote_request)\b"

# EK TARAMA (ilk taramanin kacirdiklari)
git ls-files "*.ts" "*.tsx" | xargs grep -noE "\.(in|eq|neq)\(\s*\x27role\x27"
git ls-files "*.ts" "*.tsx" | xargs grep -nE "switch\s*\(\s*[a-zA-Z.?]*role"
git ls-files "*.ts" "*.tsx" | xargs grep -noE "role:\s*[\x27\"](client|professional|business|agency)[\x27\"]"
```

---

## 2. AYRINTI TABLOSU

337 bulgu. `EK` isaretli satirlar ilk taramanin kacirdigi, ikinci taramada bulunan bulgulardir.

| # | Dosya:satir | Kontrol | Baglam | Sinif | Onerilen yeni hal |
|---|---|---|---|---|---|
| 1 | `app/admin/istatistikler/page.tsx:64` | const ROLE_ORDER = ['client', 'professional', 'business', 'agency'] as const | yardimci-tanim — Admin istatistik grafiklerinde kullanici rolu serilerinin gosterim sirasini belirleyen sabit. | **B** | pazaryeri rolu olarak kalir |
| 2 | `app/admin/kategori-talepleri/page.tsx:213` | (req.user?.role === 'business' \|\| req.user?.role === 'agency') && req.user?.company_name ? req.user.company_ | arayuz-gosterimi — Kategori talebini acan kullanicinin listede sirket adiyla mi kisi adiyla mi yazilacagi. | **B** | pazaryeri rolu olarak kalir |
| 3 | `app/admin/kullanicilar/kullanici-aksiyonlar.tsx:123` | (user.role === 'business' \|\| user.role === 'agency') && user.company_name ? user.company_name : ... | arayuz-gosterimi — Admin aksiyon menusu ve onay modallarinda kullanicinin gosterilecek adi. | **B** | pazaryeri rolu olarak kalir |
| 4 | `app/admin/kullanicilar/kullanici-aksiyonlar.tsx:128` | const canHavePremium = user.role === 'professional' \|\| user.role === 'agency' | arayuz-gosterimi — Premium verme/kaldirma menu grubunun (satir 443) yalnizca profesyonel ve ajans hesaplarda gosterilmesi. | **C** | incelenmeli |
| 5 | `app/admin/kullanicilar/page.tsx:75` | if (roleFilter && ['client', 'professional', 'agency', 'business'].includes(roleFilter)) { query = query.eq('r | veri-filtresi — Admin kullanici listesinde rol filtresi parametresinin beyaz listeye alinip profiles.role uzerinde uygulanmasi. | **B** | pazaryeri rolu olarak kalir |
| 6 | `app/admin/kullanicilar/page.tsx:76` `EK` | query.eq('role', roleFilter) | veri-filtresi — Admin kullanici listesinde role gore suzme. | **B** | pazaryeri rolu olarak kalir |
| 7 | `app/admin/kullanicilar/page.tsx:242` | (user.role === 'business' \|\| user.role === 'agency') && user.company_name ? user.company_name : ... | arayuz-gosterimi — Masaustu tablo satirinda (UserRow) kullanicinin gosterilecek adi. | **B** | pazaryeri rolu olarak kalir |
| 8 | `app/admin/kullanicilar/page.tsx:286` | <RoleBadge role={user.role} /> | arayuz-gosterimi — Tablo satirinda kullanicinin rol rozetinin (Musteri/Isletme/Profesyonel/Ajans) basilmasi. | **B** | pazaryeri rolu olarak kalir |
| 9 | `app/admin/kullanicilar/page.tsx:312` | (user.role === 'business' \|\| user.role === 'agency') && user.company_name ? user.company_name : ... | arayuz-gosterimi — Mobil kart gorunumunde (UserCard) kullanicinin gosterilecek adi. | **B** | pazaryeri rolu olarak kalir |
| 10 | `app/admin/kullanicilar/page.tsx:352` | <RoleBadge role={user.role} /> | arayuz-gosterimi — Mobil kartta kullanicinin rol rozetinin basilmasi. | **B** | pazaryeri rolu olarak kalir |
| 11 | `app/admin/page.tsx:74` | .in('role', ['professional', 'agency']) | veri-filtresi — Admin ozet panelinde toplam saglayici (profesyonel + ajans) sayisini veren count sorgusu. | **B** | pazaryeri rolu olarak kalir |
| 12 | `app/admin/page.tsx:239` | (u.role === 'business' \|\| u.role === 'agency') && u.company_name ? u.company_name : ... | arayuz-gosterimi — Ozet panelindeki son 5 yeni kullanici listesinde gosterilecek ad. | **B** | pazaryeri rolu olarak kalir |
| 13 | `app/admin/profiller/page.tsx:14` | const APPROVABLE_ROLES = ['professional', 'business', 'agency'] | yardimci-tanim — Profil onay akisina giren rollerin sabiti; satir 71-74 sayaclarinda ve satir 95 liste sorgusunda .in('role', ...) olarak kullanili | **B** | pazaryeri rolu olarak kalir |
| 14 | `app/admin/profiller/page.tsx:71` `EK` | .in('role', APPROVABLE_ROLES) | veri-filtresi — Onay bekleyen profil sayaci. | **B** | pazaryeri rolu olarak kalir |
| 15 | `app/admin/profiller/page.tsx:72` `EK` | .in('role', APPROVABLE_ROLES) | veri-filtresi — Onay durumu sayaci. | **B** | pazaryeri rolu olarak kalir |
| 16 | `app/admin/profiller/page.tsx:73` `EK` | .in('role', APPROVABLE_ROLES) | veri-filtresi — Onay durumu sayaci. | **B** | pazaryeri rolu olarak kalir |
| 17 | `app/admin/profiller/page.tsx:74` `EK` | .in('role', APPROVABLE_ROLES) | veri-filtresi — Onay durumu sayaci. | **B** | pazaryeri rolu olarak kalir |
| 18 | `app/admin/profiller/page.tsx:95` `EK` | .in('role', APPROVABLE_ROLES) | veri-filtresi — Onaylanabilir profil listesi sorgusu. | **B** | pazaryeri rolu olarak kalir |
| 19 | `app/admin/profiller/page.tsx:185` | (p.role === 'business' \|\| p.role === 'agency') && p.company_name ? p.company_name : ... | arayuz-gosterimi — Onay listesindeki profil kartinda gosterilecek ad. | **B** | pazaryeri rolu olarak kalir |
| 20 | `app/admin/profiller/page.tsx:213` | {ROLE_LABELS[p.role] ?? p.role} | arayuz-gosterimi — Profil kartinda rol etiketinin (Profesyonel/Kurumsal/Ajans/Musteri) rozet olarak basilmasi. | **B** | pazaryeri rolu olarak kalir |
| 21 | `app/admin/rapor/route.ts:26` | const APPROVABLE = ['professional', 'business', 'agency'] | yardimci-tanim — Excel raporunda onay akisina tabi rollerin sabiti; satir 167 ve 255'te kullaniliyor. | **B** | pazaryeri rolu olarak kalir |
| 22 | `app/admin/rapor/route.ts:154` | (p.role === 'business' \|\| p.role === 'agency') && p.company_name ? p.company_name : ... | arayuz-gosterimi — Excel hucrelerinde kullanilacak displayName yardimcisinin ad secimi. | **B** | pazaryeri rolu olarak kalir |
| 23 | `app/admin/rapor/route.ts:166` | if (p.role in roleCount) roleCount[p.role] += 1 | is-mantigi — Ozet sekmesi icin kullanicilarin rol bazinda sayilmasi. | **B** | pazaryeri rolu olarak kalir |
| 24 | `app/admin/rapor/route.ts:167` | if (APPROVABLE.includes(p.role)) { ... approvalCount / published / catCount } | is-mantigi — Onay durumu, yayin durumu ve kategori dagilimi toplamlarinin yalnizca onaya tabi roller icin sayilmasi. | **B** | pazaryeri rolu olarak kalir |
| 25 | `app/admin/rapor/route.ts:222` | for (const key of ['client', 'professional', 'business', 'agency']) s1.addRow([ROLE_TR[key], roleCount[key]]) | arayuz-gosterimi — Ozet sekmesine her rol icin bir satir yazilmasi. | **B** | pazaryeri rolu olarak kalir |
| 26 | `app/admin/rapor/route.ts:255` | APPROVABLE.includes(p.role) && p.approval_status ? APPROVAL_TR[...] : 'Aktif' | is-mantigi — Kullanicilar sekmesinde durum hucresinin onay durumu mu yoksa 'Aktif' mi yazacagi. | **B** | pazaryeri rolu olarak kalir |
| 27 | `app/admin/rapor/route.ts:262` | rol: ROLE_TR[p.role] ?? p.role | arayuz-gosterimi — Kullanicilar sekmesinde rol hucresine Turkce rol etiketinin yazilmasi. | **B** | pazaryeri rolu olarak kalir |
| 28 | `app/admin/rapor/route.ts:284` | profiles.filter((x) => x.role === 'professional' \|\| x.role === 'agency') | veri-filtresi — Profesyoneller sekmesine yalnizca saglayici rollu profillerin alinmasi. | **B** | pazaryeri rolu olarak kalir |
| 29 | `app/admin/sikayetler/page.tsx:126` | (p?.role === 'business' \|\| p?.role === 'agency') && p?.company_name ? p.company_name : ... | arayuz-gosterimi — Sikayet hedefi profil oldugunda listede gosterilecek ad. | **B** | pazaryeri rolu olarak kalir |
| 30 | `app/admin/yorumlar/page.tsx:259` | (review.customer?.role === 'business' \|\| ...  (customerName ifadesinin 259-260. satiri) | arayuz-gosterimi — Yorumu yazan musterinin sirket adiyla mi gosterilecegini belirleyen kosulun ilk yarisi. | **B** | pazaryeri rolu olarak kalir |
| 31 | `app/admin/yorumlar/page.tsx:260` | review.customer?.role === 'agency') && review.customer?.company_name (ayni customerName ifadesinin ikinci yari | arayuz-gosterimi — Yorumu yazan musterinin ad secimi kosulunun ikinci yarisi. | **B** | pazaryeri rolu olarak kalir |
| 32 | `app/admin/yorumlar/page.tsx:268` | (review.professional?.role === 'business' \|\| ... (professionalName ifadesinin 268-269. satiri) | arayuz-gosterimi — Yorumun hedefi olan saglayicinin sirket adiyla mi gosterilecegini belirleyen kosulun ilk yarisi. | **B** | pazaryeri rolu olarak kalir |
| 33 | `app/admin/yorumlar/page.tsx:269` | review.professional?.role === 'agency') && review.professional?.company_name (ayni professionalName ifadesinin | arayuz-gosterimi — Yorum hedefi saglayicinin ad secimi kosulunun ikinci yarisi. | **B** | pazaryeri rolu olarak kalir |
| 34 | `app/ajans/agency-actions.ts:57` | if (profile.role !== 'agency') { error: 'Sadece ajanslar profesyonel davet edebilir' } | is-mantigi — Ajansin kendi ekibine profesyonel daveti gonderebilmesini korur (inviteProfessional sunucu eylemi). | **A** | has_org_permission(orgId, 'members.manage') |
| 35 | `app/ajans/agency-actions.ts:202` | if (newStatus === 'accepted' && myProfile.role !== 'professional') | is-mantigi — Ajans davetini yalnizca profesyonel hesabin kabul edebilmesini saglar. | **B** | pazaryeri rolu olarak kalir |
| 36 | `app/auth/callback/route.ts:52` | const mail = hosgeldinEmail({ role: p.role, name: p.full_name }); | is-mantigi — Kayit onayindan sonra gonderilecek hosgeldin e-postasinin govde metni ve CTA'sini hesap turune gore sectirir (account-emails.ts:10 | **B** | pazaryeri rolu olarak kalir |
| 37 | `app/auth/confirm/route.ts:82` | const mail = hosgeldinEmail({ role: p.role, name: p.full_name }); | is-mantigi — token_hash dogrulama rotasinda signup onayi sonrasi hosgeldin e-postasinin metnini hesap turune gore sectirir (callback rotasindak | **B** | pazaryeri rolu olarak kalir |
| 38 | `app/basvurularim/page.tsx:35` | if (profile?.role !== 'professional' && profile?.role !== 'agency') redirect('/profil') | sayfa-erisimi — Basvurularim sayfasina yalniz satici tarafi (profesyonel/ajans) girebilsin diye giris kapisi. | **B** | pazaryeri rolu olarak kalir |
| 39 | `app/components/sections/category-marquee.tsx:52` | (p.role === "business" \|\| p.role === "agency") && p.company_name ? p.company_name : p.full_name | arayuz-gosterimi — Ana sayfa kayan seritte gosterilecek ismin secimi: kurumsal/ajans profilinde sirket adi, digerlerinde ad soyad. | **B** | pazaryeri rolu olarak kalir (gocte isim kaynagi organizations.name'e tasinabilir ama yetki kontrolu degil) |
| 40 | `app/components/sections/featured-profiles.tsx:117` | role: p.role, | arayuz-gosterimi — Sorgudan gelen profil rolunun FeaturedProfile nesnesine tasinmasi; kart uzerinde rol rozetleri/isim secimi icin kullanilir. | **B** | pazaryeri rolu olarak kalir |
| 41 | `app/components/sections/featured-profiles.tsx:185` | role: p.role,  (ProfileCard profile prop'u icinde) | arayuz-gosterimi — Rol degerinin ProfileCard'a verilmesi; kart icinde agency rozeti ve business/agency icin sirket adi gosterimi bu degere bakiyor. | **B** | pazaryeri rolu olarak kalir |
| 42 | `app/components/sections/marquee-profiles.ts:80` | role: p.role, | arayuz-gosterimi — Serit icin secilen profilin rolunun MarqueeProfile nesnesine tasinmasi; category-marquee.tsx:52'deki isim secimi bunu kullanir. | **B** | pazaryeri rolu olarak kalir |
| 43 | `app/components/sections/mobile-nav.tsx:14` | isProfessional: boolean;  (Props tipi) | tip-tanimi — Mobil menunun disaridan aldigi 'kullanici profesyonel mi' bayraginin tip tanimi. | **B** | pazaryeri rolu olarak kalir (kullanilmadigi icin gocte tumden kaldirilabilir) |
| 44 | `app/components/sections/mobile-nav.tsx:15` | isClient: boolean;  (Props tipi) | tip-tanimi — Mobil menunun disaridan aldigi 'kullanici musteri mi' bayraginin tip tanimi. | **B** | pazaryeri rolu olarak kalir (kullanilmadigi icin gocte tumden kaldirilabilir) |
| 45 | `app/components/sections/mobile-nav.tsx:16` | isAgency: boolean;  (Props tipi) | tip-tanimi — Mobil menunun disaridan aldigi 'kullanici ajans mi' bayraginin tip tanimi. | **B** | pazaryeri rolu olarak kalir (kullanilmadigi icin gocte tumden kaldirilabilir) |
| 46 | `app/components/sections/mobile-nav.tsx:17` | isBusiness: boolean;  (Props tipi) | tip-tanimi — Mobil menunun disaridan aldigi 'kullanici kurumsal hesap mi' bayraginin tip tanimi. | **A** | has_org_permission(orgId, 'commercial.view') sonucu tek bayrak olarak gecirilir (kullanilmadigi icin tumden de kaldirila |
| 47 | `app/components/sections/mobile-nav.tsx:28` | isProfessional,  (bilesen imzasinda destructure) | tip-tanimi — Profesyonel bayraginin bilesen parametrelerinden cikarilmasi; menu render'inda hicbir yerde okunmuyor. | **B** | pazaryeri rolu olarak kalir (kullanilmadigi icin gocte tumden kaldirilabilir) |
| 48 | `app/components/sections/mobile-nav.tsx:29` | isClient,  (bilesen imzasinda destructure) | tip-tanimi — Musteri bayraginin bilesen parametrelerinden cikarilmasi; menu render'inda okunmuyor. | **B** | pazaryeri rolu olarak kalir (kullanilmadigi icin gocte tumden kaldirilabilir) |
| 49 | `app/components/sections/mobile-nav.tsx:30` | isAgency,  (bilesen imzasinda destructure) | tip-tanimi — Ajans bayraginin bilesen parametrelerinden cikarilmasi; menu render'inda okunmuyor. | **B** | pazaryeri rolu olarak kalir (kullanilmadigi icin gocte tumden kaldirilabilir) |
| 50 | `app/components/sections/mobile-nav.tsx:31` | isBusiness,  (bilesen imzasinda destructure) | tip-tanimi — Kurumsal hesap bayraginin bilesen parametrelerinden cikarilmasi; menu render'inda okunmuyor. | **A** | has_org_permission(orgId, 'commercial.view') sonucu tek bayrak olarak gecirilir (kullanilmadigi icin tumden de kaldirila |
| 51 | `app/components/sections/top-nav.tsx:30` | role = profile?.role ?? null; | is-mantigi — Giris yapmis kullanicinin profiles.role degerinin okunmasi; ust bardaki tum rol bayraklarinin tek kaynagi. | **B** | pazaryeri rolu olarak kalir (kurulus tarafi icin ek olarak aktif kurulus baglami okunmasi gerekir) |
| 52 | `app/components/sections/top-nav.tsx:37` | const isProfessional = role === "professional"; | is-mantigi — Profesyonel bayragi; satici menu ogelerini (Rezervasyonlarim, Takvimim, Kazanclarim, Teklif Talepleri, Premium) ve canReceiveOffer | **B** | pazaryeri rolu olarak kalir |
| 53 | `app/components/sections/top-nav.tsx:38` | const isClient = role === "client"; | is-mantigi — Musteri bayragi; canCollectOffers (satir 43) ve alici menu ogeleri (satir 72) ile satir 80'deki disarida birakma kosulunu besler. | **B** | pazaryeri rolu olarak kalir |
| 54 | `app/components/sections/top-nav.tsx:39` | const isAgency = role === "agency"; | is-mantigi — Ajans bayragi; satici menu ogelerini (satir 65, 89, 96), Basvurularim'i (satir 85) ve canReceiveOffers'i besler. | **B** | pazaryeri rolu olarak kalir |
| 55 | `app/components/sections/top-nav.tsx:40` | const isBusiness = role === "business"; | is-mantigi — Kurumsal hesap bayragi; Teklif Topla erisimini (satir 43) ve alici calisma alani menusunu (satir 72) acar. | **A** | has_org_permission(orgId, 'commercial.manage') |
| 56 | `app/components/sections/top-nav.tsx:41` | const canReceiveOffers = isProfessional \|\| isAgency; | is-mantigi — Teklif alabilen (satici) taraf bayragi; MobileNav'a prop olarak gecer (satir 191). | **B** | pazaryeri rolu olarak kalir |
| 57 | `app/components/sections/top-nav.tsx:43` | const canCollectOffers = isClient \|\| isBusiness \|\| isBusinessManager; | is-mantigi — Teklif Topla baglantisinin gorunurlugu; hem masaustu (satir 138) hem mobil menude kullanilir. | **A** | isClient \|\| has_org_permission(orgId, 'commercial.manage') |
| 58 | `app/components/sections/top-nav.tsx:65` | if (isProfessional \|\| isAgency) {  → Rezervasyonlarim, Takvimim, Kazanclarim | arayuz-gosterimi — Satici koltugundaki menu ogelerinin eklenmesi; yalniz menu icerigi, sayfa yetkisi degil. | **B** | pazaryeri rolu olarak kalir |
| 59 | `app/components/sections/top-nav.tsx:72` | if (isClient \|\| isBusiness) {  → Ilanlarim, Rezervasyonlarim, Odeme Gecmisi, Teklif Taleplerim | arayuz-gosterimi — Alici calisma alani menu ogelerinin eklenmesi. | **A** | isClient \|\| has_org_permission(orgId, 'commercial.view') |
| 60 | `app/components/sections/top-nav.tsx:80` | if (isBusinessManager && !isClient && !isBusiness) {  → Ilanlarim | arayuz-gosterimi — Profil rolu client/business olmayan ama bir kurumda owner/manager olan uyeye Ilanlarim baglantisi gosterilmesi. | **A** | has_org_permission(orgId, 'commercial.view') |
| 61 | `app/components/sections/top-nav.tsx:85` | if (isAgency) {  → Basvurularim | arayuz-gosterimi — Ajansa Basvurularim (ilan basvurulari) menu ogesinin eklenmesi; profesyonelde ayni bolum /profil icinde oldugu icin menuye konmuyo | **B** | pazaryeri rolu olarak kalir |
| 62 | `app/components/sections/top-nav.tsx:89` | if (isProfessional \|\| isAgency) {  → Teklif Talepleri | arayuz-gosterimi — Saticiya gelen teklif talepleri menu ogesinin eklenmesi. | **B** | pazaryeri rolu olarak kalir |
| 63 | `app/components/sections/top-nav.tsx:96` | if (isProfessional \|\| isAgency) {  → Premium | arayuz-gosterimi — Premium (gorunurluk paketi) menu ogesinin yalniz saticilara gosterilmesi. | **B** | pazaryeri rolu olarak kalir (ajans/kurum aboneligi organizations.subscription_tier'a tasindiginda menu kaynagi ayrica go |
| 64 | `app/components/sections/top-nav.tsx:187` | isProfessional={isProfessional} | arayuz-gosterimi — Profesyonel bayraginin MobileNav'a gecirilmesi. | **B** | pazaryeri rolu olarak kalir (alan tarafta kullanilmadigi icin prop kaldirilabilir) |
| 65 | `app/components/sections/top-nav.tsx:188` | isClient={isClient} | arayuz-gosterimi — Musteri bayraginin MobileNav'a gecirilmesi. | **B** | pazaryeri rolu olarak kalir (alan tarafta kullanilmadigi icin prop kaldirilabilir) |
| 66 | `app/components/sections/top-nav.tsx:189` | isAgency={isAgency} | arayuz-gosterimi — Ajans bayraginin MobileNav'a gecirilmesi. | **B** | pazaryeri rolu olarak kalir (alan tarafta kullanilmadigi icin prop kaldirilabilir) |
| 67 | `app/components/sections/top-nav.tsx:190` | isBusiness={isBusiness} | arayuz-gosterimi — Kurumsal hesap bayraginin MobileNav'a gecirilmesi. | **A** | has_org_permission(orgId, 'commercial.view') sonucu gecirilir (alan tarafta kullanilmadigi icin prop kaldirilabilir) |
| 68 | `app/davetlerim/page.tsx:146` | {profile.role !== 'professional' && ( ... uyari kutusu ... )} | arayuz-gosterimi — Ajans davetini kabul edebilmek icin profesyonel hesap gerektigini soyleyen uyari serididir; sayfaya girisi engellemez. | **C** | incelenmeli |
| 69 | `app/davetlerim/page.tsx:149` | hesap gerek. Mevcut hesabin <strong>{profile.role}</strong> rolunde. | arayuz-gosterimi — Uyari kutusunun metninde kullanicinin mevcut hesap turu adini yazdirir. | **B** | pazaryeri rolu olarak kalir |
| 70 | `app/davetlerim/page.tsx:155` | canAccept={profile.role === 'professional'} | arayuz-gosterimi — DavetlerimListesi bileseninde ajans davetinin kabul dugmesinin etkin olup olmayacagini belirler. | **C** | incelenmeli |
| 71 | `app/etkinlik-sihirbazi/page.tsx:53` | rol: p.role as string,  (applyDiscoverBase ile cekilen profil satirlarindan SihirbazProfil sekline) | is-mantigi — Sihirbaz sayacinin kullandigi hafif profil sekline rol alanini tasir; gercek rol suzgeci applyDiscoverBase icindeki DISCOVER_ROLES | **B** | pazaryeri rolu olarak kalir |
| 72 | `app/favoriler/actions.ts:41` | if (profile.role !== 'client') { return { success: false, error: 'Sadece musteri hesaplari favori ekleyebilir. | is-mantigi — addFavorite sunucu eyleminde favori ekleme hakkini yalniz musteri (alici) hesaplarina verir. | **B** | pazaryeri rolu olarak kalir |
| 73 | `app/favoriler/actions.ts:59` | if (target.role !== 'professional' && target.role !== 'agency') { return { success: false, error: 'Sadece prof | is-mantigi — Favorilenen hedefin pazaryerinde satici (profesyonel veya ajans) olmasini zorunlu kilar. | **B** | pazaryeri rolu olarak kalir |
| 74 | `app/favoriler/page.tsx:97` | const userRole = profile?.role ?? null;  (satir 101'de: if (userRole !== 'client') → "musterilere ozel" sayfas | sayfa-erisimi — Favoriler sayfasinin musteri disi hesaplara icerik yerine 'bu sayfa musterilere ozel' ekrani dondurmesini saglayan rol degiskenini | **B** | pazaryeri rolu olarak kalir |
| 75 | `app/favoriler/page.tsx:314` | role: p.role,  (ProfileCard profile prop icinde) | arayuz-gosterimi — Favorilenen profilin rolunu kart bilesenine gecirir; kart rozet/etiket ve bicimlendirme icin kullanir. | **B** | pazaryeri rolu olarak kalir |
| 76 | `app/ilanlar/[id]/ilan-detay.tsx:89` | isProfessional: boolean; | tip-tanimi — Bilesenin prop tipinde, kullanicinin basvurabilen (satici) taraf olup olmadigini tasiyan bayrak. | **B** | pazaryeri rolu olarak kalir |
| 77 | `app/ilanlar/[id]/ilan-detay.tsx:108` | isProfessional, (prop destructure) | arayuz-gosterimi — Basvuru arayuzunu gosterip gostermeyecegini belirleyen prop'un bilesen imzasinda cozulmesi. | **B** | pazaryeri rolu olarak kalir |
| 78 | `app/ilanlar/[id]/ilan-detay.tsx:130` | listing.creator?.role === 'business' && listing.creator?.company_name ? company_name : full_name | arayuz-gosterimi — Ilan sahibinin ekranda gorunen adini secer: kurumsal hesapsa sirket adi, degilse tam ad. | **C** | incelenmeli |
| 79 | `app/ilanlar/[id]/ilan-detay.tsx:626` | ) : isProfessional && myApplication ? ( | arayuz-gosterimi — Sag kolon CTA dallanmasi: basvurusu olan profesyonele kendi basvurusunu gosterir. | **B** | pazaryeri rolu olarak kalir |
| 80 | `app/ilanlar/[id]/ilan-detay.tsx:694` | ) : isProfessional ? ( | arayuz-gosterimi — Sag kolonda Basvur butonunu yalniz basvurabilen (satici) kullaniciya gosterir. | **B** | pazaryeri rolu olarak kalir |
| 81 | `app/ilanlar/[id]/ilan-detay.tsx:738` | isProfessional \|\| (mobil sabit cubugun gosterim kosulu icinde) | arayuz-gosterimi — Mobil alt sabit aksiyon cubugunun hic render edilip edilmeyecegini belirleyen kosulun bir dali. | **B** | pazaryeri rolu olarak kalir |
| 82 | `app/ilanlar/[id]/ilan-detay.tsx:757` | ) : isProfessional && myApplication ? ( | arayuz-gosterimi — Mobil cubukta basvurmus profesyonele basvuru durum rozetini gosterir. | **B** | pazaryeri rolu olarak kalir |
| 83 | `app/ilanlar/[id]/ilan-detay.tsx:776` | ) : isProfessional ? ( | arayuz-gosterimi — Mobil cubukta Basvur butonunu yalniz basvurabilen kullaniciya gosterir. | **B** | pazaryeri rolu olarak kalir |
| 84 | `app/ilanlar/[id]/ilan-detay.tsx:789` | {isProfessional && !canDecide && !myApplication && ( | arayuz-gosterimi — Basvuru modalini yalniz satici tarafa ve ilanda karar verici olmayanlara render eder. | **B** | pazaryeri rolu olarak kalir |
| 85 | `app/ilanlar/[id]/ilan-detay.tsx:940` | const typeLabel = creator.role === 'business' ? 'Kurumsal' : 'Musteri' | arayuz-gosterimi — Ilan sahibi kartinda hesap turu etiketini yazar. | **C** | incelenmeli |
| 86 | `app/ilanlar/[id]/ilan-detay.tsx:948` | const showProfileLink = creator.role === 'business' | arayuz-gosterimi — Ilan sahibi kartinda kamuya acik profil baglantisinin gosterilip gosterilmeyecegini belirler. | **C** | incelenmeli |
| 87 | `app/ilanlar/[id]/ilan-detay.tsx:1033` | applicant?.role === 'business' && applicant?.company_name ? company_name : full_name | arayuz-gosterimi — Basvuru kartinda basvuranin gorunen adini secer. | **C** | incelenmeli |
| 88 | `app/ilanlar/[id]/ilan-detay.tsx:1234` | applicant?.role === 'business' && applicant?.company_name ? company_name : full_name | arayuz-gosterimi — Basvuru karsilastirma sutununda basvuranin gorunen adini secer (1033'un ikizi). | **C** | incelenmeli |
| 89 | `app/ilanlar/[id]/page.tsx:59` | const creatorIsBusiness = (listing.creator as { role?: string } \| null)?.role === 'business' | is-mantigi — Ilanin sahibi kurumsal hesap mi diye bakar; yalniz oyleyse canWriteForBusiness/canOwnForBusiness uyelik sorgulari calisir (canDeci | **A** | has_org_permission(listing.organization_id, 'crew.manage') |
| 90 | `app/ilanlar/[id]/page.tsx:85` | userRole = profile?.role ?? null; | is-mantigi — Kullanicinin pazaryeri rolunu okuyup canApply hesabina (satir 96) besler. | **B** | pazaryeri rolu olarak kalir |
| 91 | `app/ilanlar/[id]/page.tsx:269` | isProfessional={canApply} (canApply = userRole === 'professional' \|\| userRole === 'agency') | arayuz-gosterimi — Satici tarafi bayragini detay bilesenine gecirir; bilesen basvuru arayuzunu buna gore render eder. | **B** | pazaryeri rolu olarak kalir |
| 92 | `app/ilanlar/invitations-actions.ts:70` | if (target.role !== 'professional' && target.role !== 'agency') return { error: 'Sadece profesyonel veya ajans | is-mantigi — Ilana davet edilecek hedefin pazaryeri satici hesabi olmasini zorunlu kilar. | **B** | pazaryeri rolu olarak kalir |
| 93 | `app/ilanlar/invitations-actions.ts:309` ⚠ | // (dilim 3b rotus — davet gonderebilen iptal de edebilmeli). has_business_role kurum | is-mantigi — Davet iptal yetkisinin neden ayri bir creator_id dali gerektirdigini anlatan aciklama satiri; gercek kontrol satir 311-320'de (inv | **A** | has_org_permission(listing.organization_id, 'crew.manage') |
| 94 | `app/ilanlar/listings-actions.ts:111` | if (profile.role !== 'client' && profile.role !== 'business') return { error: 'Sadece musteri veya kurumsal he | is-mantigi — Kendi adina ilan acmak isteyen kullanicinin alici tarafi hesabi olmasini zorunlu kilar (kurum adina acma dali satir 94-101'de ayri | **B** | pazaryeri rolu olarak kalir |
| 95 | `app/ilanlar/listings-actions.ts:557` | if (profile.role !== 'professional' && profile.role !== 'agency') return { error: 'Sadece profesyonel ve ajans | is-mantigi — Ilana basvuru gonderme yetkisini pazaryeri satici hesaplariyla sinirlar. | **B** | pazaryeri rolu olarak kalir |
| 96 | `app/ilanlar/listings-actions.ts:605` | ['professional', 'agency']  (effectiveRoles varsayilan degeri) | is-mantigi — Ilanda ve ilan sahibi profilinde basvuran rol kisiti tanimli degilse varsayilan olarak iki satici rolunu kabul eder. | **B** | pazaryeri rolu olarak kalir |
| 97 | `app/ilanlar/listings-actions.ts:608` | if (!effectiveRoles.includes(profile.role)) { ... return { error: msg } } | is-mantigi — Ilan sahibinin sectigi basvuran rol kisitini (yalniz ajans / yalniz bireysel / ikisi) uygular. | **B** | pazaryeri rolu olarak kalir |
| 98 | `app/ilanlar/listings-actions.ts:671` | (applicantProfile?.role === 'business' \|\| | arayuz-gosterimi — Ilan sahibine giden web push bildiriminde basvuranin gorunen adini secen kosulun ilk dali. | **C** | incelenmeli |
| 99 | `app/ilanlar/listings-actions.ts:672` | applicantProfile?.role === 'agency') && | arayuz-gosterimi — Ayni bildirim adi kosulunun ikinci dali; kurum/ajans hesabinda company_name gosterilir. | **C** | incelenmeli |
| 100 | `app/ilanlar/listings-actions.ts:872` | (ownerProfile?.role === 'business' \|\| | arayuz-gosterimi — Basvurusu kabul edilen profesyonele giden push bildiriminde ilan sahibinin gorunen adini secen kosulun ilk dali. | **C** | incelenmeli |
| 101 | `app/ilanlar/listings-actions.ts:873` | ownerProfile?.role === 'agency') && | arayuz-gosterimi — Ayni bildirim adi kosulunun ikinci dali; kurum/ajans hesabinda company_name gosterilir. | **C** | incelenmeli |
| 102 | `app/ilanlar/page.tsx:20` | return profile?.role ?? null;  (getUserRole yardimcisinin govdesi) | yardimci-tanim — Ilan tahtasi sayfasinda kullanicinin pazaryeri rolunu dondurur; satir 42'de canCreateListing (client\|business) CTA karari icin ku | **B** | pazaryeri rolu olarak kalir |
| 103 | `app/ilanlar/yeni/page.tsx:59` | const role = profile?.role; | is-mantigi — Yeni ilan sayfasinda kullanicinin pazaryeri rolunu okur; hemen altindaki canSelfCreate hesabina girdi olur. | **B** | pazaryeri rolu olarak kalir |
| 104 | `app/ilanlar/yeni/page.tsx:60` | const canSelfCreate = role === 'client' \|\| role === 'business'; | sayfa-erisimi — Kullanicinin kendi adina ilan acma hakkini belirler; satir 63'te kurum uyeligiyle (writableBusinesses) birlesip sayfaya girisi aca | **B** | pazaryeri rolu olarak kalir |
| 105 | `app/ilanlar/yeni/yeni-ilan-formu.tsx:241` `EK` | // 'both' \| 'professional' \| 'agency' (yorum) | tip-tanimi — Ilana kimlerin basvurabilecegini anlatan aciklama. | **B** | pazaryeri rolu olarak kalir |
| 106 | `app/ilanlar/yeni/yeni-ilan-formu.tsx:243` `EK` | detectApplicantRoles(): 'both'\|'professional'\|'agency' | is-mantigi — Ilanin izin verdigi basvuran rolunu belirler. | **B** | pazaryeri rolu olarak kalir |
| 107 | `app/ilanlar/yeni/yeni-ilan-formu.tsx:251` `EK` | 'both' \| 'professional' \| 'agency' | tip-tanimi — Ayni fonksiyonun donus tipi. | **B** | pazaryeri rolu olarak kalir |
| 108 | `app/ilanlar/yeni/yeni-ilan-formu.tsx:318` | ? ['professional', 'agency']  (applicantRoles === 'both' dali) | is-mantigi — Formda 'Herkes basvurabilir' secildiginde ilana yazilacak allowed_applicant_roles degerini uretir. | **B** | pazaryeri rolu olarak kalir |
| 109 | `app/ilanlarim/page.tsx:51` | const role = profile?.role; | is-mantigi — Ilanlarim sayfasinda kullanicinin pazaryeri rolunu okur; satir 66'daki erisim kapisina girdi olur. | **B** | pazaryeri rolu olarak kalir |
| 110 | `app/ilanlarim/page.tsx:66` | if (role !== 'client' && role !== 'business' && !hasTeamAccess) redirect('/profil') | sayfa-erisimi — Ilanlarim sayfasina girisi acar: ya alici tarafi hesabi olacak ya da bir kurumun ekip uyesi olunacak. | **B** | pazaryeri rolu olarak kalir |
| 111 | `app/kategori/[slug]/page.tsx:135` | .in('role', ['professional', 'agency']) | veri-filtresi — Kategori sayfasinda listelenecek profilleri yalniz satici rollerine (professional/agency) daraltir. | **B** | pazaryeri rolu olarak kalir |
| 112 | `app/kategoriler/page.tsx:85` | .in('role', ['professional', 'agency']) | veri-filtresi — Kategori kartlarindaki yayinda profesyonel sayimini yalniz satici rolleriyle sinirlar. | **B** | pazaryeri rolu olarak kalir |
| 113 | `app/kazanclarim/page.tsx:52` | const isProvider = profile?.role === 'professional' \|\| profile?.role === 'agency';  (satir 117'de: {!isProvi | arayuz-gosterimi — Kazanclar ozetinin gosterilip gosterilmeyecegini belirler; satici olmayan hesaba 'yalnizca hizmet veren hesaplar icin' notu cikar. | **B** | pazaryeri rolu olarak kalir |
| 114 | `app/kazanclarim/page.tsx:78` | (c.role === 'business' \|\| c.role === 'agency') && c.company_name ? c.company_name : c.full_name \|\| 'Muster | arayuz-gosterimi — Rezervasyon musterisinin listede sirket adiyla mi kisi adiyla mi gosterilecegini secer. | **B** | pazaryeri rolu olarak kalir |
| 115 | `app/kesfet/page.tsx:35` | if (customer.role === 'business' && customer.company_name) | arayuz-gosterimi — Kart uzerindeki yorum alintisinda yazar adini kurumsal musteride sirket adi olarak gosterir. | **B** | pazaryeri rolu olarak kalir |
| 116 | `app/kesfet/page.tsx:160` `EK` | query.eq('role', 'professional') | veri-filtresi — Kesfet tip filtresi: yalniz profesyoneller. | **B** | pazaryeri rolu olarak kalir |
| 117 | `app/kesfet/page.tsx:162` `EK` | query.eq('role', 'agency') | veri-filtresi — Kesfet tip filtresi: yalniz ajanslar. | **B** | pazaryeri rolu olarak kalir |
| 118 | `app/kesfet/profile-card.tsx:152` | function TopChips({ isAgency, ... }) | yardimci-tanim — Foto uzeri rozet bileseninin ajans bayragini alan parametre tanimi. | **B** | pazaryeri rolu olarak kalir |
| 119 | `app/kesfet/profile-card.tsx:155` | isAgency: boolean; | tip-tanimi — TopChips bileseninin isAgency prop tip bildirimi. | **B** | pazaryeri rolu olarak kalir |
| 120 | `app/kesfet/profile-card.tsx:160` | {isAgency && ( ... Ajans rozeti ... )} | arayuz-gosterimi — Kart fotografi uzerinde AJANS rozetinin gosterilip gosterilmeyecegini belirler. | **B** | pazaryeri rolu olarak kalir |
| 121 | `app/kesfet/profile-card.tsx:205` | const isAgencyCard = profile.role === 'agency'; | arayuz-gosterimi — Kartin ajans rozeti icin kullandigi bayragi profil rolunden turetir. | **B** | pazaryeri rolu olarak kalir |
| 122 | `app/kesfet/profile-card.tsx:211` | (profile.role === 'business' \|\| profile.role === 'agency') && profile.company_name | arayuz-gosterimi — Kartta gosterilecek adi secer: kurumsal/ajans hesapta sirket adi, digerlerinde tam ad. | **B** | pazaryeri rolu olarak kalir |
| 123 | `app/kesfet/profile-card.tsx:265` | profile.role === 'professional' \|\| profile.role === 'agency' | arayuz-gosterimi — Favori kalbi yalniz satici (profesyonel/ajans) kartlarinda gosterilir. | **B** | pazaryeri rolu olarak kalir |
| 124 | `app/kesfet/profile-card.tsx:301` | <TopChips isAgency={isAgencyCard} categoryName={categoryName} /> | arayuz-gosterimi — Kompakt kart varyantinda ajans rozetini/kategori chipini basar. | **B** | pazaryeri rolu olarak kalir |
| 125 | `app/kesfet/profile-card.tsx:339` | <TopChips isAgency={isAgencyCard} categoryName={categoryName} /> | arayuz-gosterimi — Mobil kart duzeninde ajans rozetini/kategori chipini basar. | **B** | pazaryeri rolu olarak kalir |
| 126 | `app/kesfet/profile-card.tsx:388` | <TopChips isAgency={isAgencyCard} categoryName={categoryName} /> | arayuz-gosterimi — Masaustu kart duzeninde ajans rozetini/kategori chipini basar. | **B** | pazaryeri rolu olarak kalir |
| 127 | `app/kurumsal/business-actions.ts:57` | if (profile.role !== 'business') { return { success: false, error: 'Sadece kurumsal hesaplar ekip uyesi davet  | is-mantigi — inviteUserToTeam sunucu eylemi: yalniz business rolundeki hesabin business_invitations satiri olusturmasina izin verir. | **A** | has_org_permission(orgId, 'members.manage') |
| 128 | `app/kurumsal/business-actions.ts:201` ⚠ | // NOT: agency'deki "role==='professional'" gate'i YOK — kurum ekip uyesi // herhangi bir kullanici olabilir ( | is-mantigi — Kurumsal davet yanitlama akisinda, davet edilen tarafta rol kapisi bulunmadigini aciklayan yorum satiri. | **C** | incelenmeli |
| 129 | `app/lib/ai-actions.ts:125` | isAgency: boolean; (generateProfileBio girdi tipi alani) | tip-tanimi — Profil 'Hakkimda' metni uretilirken saticinin ajans mi bireysel mi oldugunu tasiyan girdi alani. | **B** | pazaryeri rolu olarak kalir |
| 130 | `app/lib/ai-actions.ts:149` | const voice = input.isAgency ? 'Birinci cogul sahis ("biz"...)' : 'Birinci tekil sahis ("ben"...)' | is-mantigi — AI istemine gonderilecek anlatim dilini (biz/ben) satici turune gore secer. | **B** | pazaryeri rolu olarak kalir |
| 131 | `app/lib/ai-actions.ts:453` | .in('role', ['professional', 'agency']) — recommendProfessionals on-filtresi (.eq('is_published', true) ile bi | veri-filtresi — AI eslestirme havuzunu yalnizca yayindaki satici profilleriyle (profesyonel + ajans) sinirlar. | **B** | pazaryeri rolu olarak kalir |
| 132 | `app/lib/ai-actions.ts:478` | (p.role === 'agency' \|\| p.role === 'business') && p.company_name ? p.company_name : p.full_name | arayuz-gosterimi — AI istemine yazilacak aday adini secer: kurumsal saticida sirket adi, bireyselde ad soyad. | **B** | pazaryeri rolu olarak kalir |
| 133 | `app/lib/ai-actions.ts:487` | Tur: ${p.role === 'agency' ? 'Ajans' : 'Bireysel profesyonel'} | arayuz-gosterimi — AI istemindeki aday listesinde saticinin turunu etiketler. | **B** | pazaryeri rolu olarak kalir |
| 134 | `app/lib/ai-actions.ts:555` | (p.role === 'agency' \|\| p.role === 'business') && p.company_name ? p.company_name : p.full_name (ProMatch so | arayuz-gosterimi — Donen eslesme sonucunda kullaniciya gosterilecek satici adini secer. | **B** | pazaryeri rolu olarak kalir |
| 135 | `app/lib/discover-base.ts:17` | export const DISCOVER_ROLES = ['professional', 'agency'] as const; | yardimci-tanim — Kesfet'te ve etkinlik sihirbazi sayacinda listelenebilen satici rollerinin tek kaynak tanimi. | **B** | pazaryeri rolu olarak kalir |
| 136 | `app/lib/discover-base.ts:42` `EK` | .in('role', DISCOVER_ROLES) | veri-filtresi — Kesfet temel gorunurluk kosulu (ortak fonksiyon). | **B** | pazaryeri rolu olarak kalir |
| 137 | `app/lib/email/account-emails.ts:101` `EK` | switch (opts.role) | arayuz-gosterimi — Hosgeldin e-postasi metnini role gore secer. | **C** | incelenmeli |
| 138 | `app/lib/premium.ts:23` | forRoles: ['professional'] (Premium plani, 499 TL) | yardimci-tanim — Premium planini hangi rolun satin alabilecegini belirleyen sabit; app/premium/actions.ts:47 ve plan-secici.tsx:40 bunu kullanir. | **B** | pazaryeri rolu olarak kalir |
| 139 | `app/lib/premium.ts:36` | forRoles: ['professional'] (Plus plani, 999 TL) | yardimci-tanim — Plus planini hangi rolun satin alabilecegini belirleyen sabit. | **B** | pazaryeri rolu olarak kalir |
| 140 | `app/lib/premium.ts:48` | forRoles: ['agency'] (Ajans plani, 1999 TL — ozellikleri arasinda 'Sinirsiz ekip uyesi' var) | yardimci-tanim — Ajans planini yalniz agency rollu hesabin satin alabilmesini saglar. | **A** | has_org_permission(orgId, 'finance.manage') |
| 141 | `app/lib/profile-helpers.ts:14` | export function isProfessional(profile: Profile \| null \| undefined): boolean { | yardimci-tanim — Bir profilin bireysel satici olup olmadigini soyleyen yardimcinin tanimi; cagrildigi yerler profil alt sayfalarinin erisim kapisi  | **B** | pazaryeri rolu olarak kalir |
| 142 | `app/lib/profile-helpers.ts:15` | return profile?.role === 'professional'; | yardimci-tanim — isProfessional yardimcisinin govdesi; bireysel satici kimliginin tek kaynak kontrolu. | **B** | pazaryeri rolu olarak kalir |
| 143 | `app/lib/profile-helpers.ts:18` | export function isClient(profile: Profile \| null \| undefined): boolean { | yardimci-tanim — Bir profilin pazaryeri alicisi olup olmadigini soyleyen yardimcinin tanimi; bugun yalniz app/profil/page.tsx:62'de kullaniliyor. | **B** | pazaryeri rolu olarak kalir |
| 144 | `app/lib/profile-helpers.ts:19` | return profile?.role === 'client'; | yardimci-tanim — isClient yardimcisinin govdesi; bireysel alici kimliginin tek kaynak kontrolu. | **B** | pazaryeri rolu olarak kalir |
| 145 | `app/lib/profile-helpers.ts:22` | export function isBusiness(profile: Profile \| null \| undefined): boolean { | yardimci-tanim — Bir profilin kurumsal hesap olup olmadigini soyleyen yardimcinin tanimi; app/profil/page.tsx:63 (kurumsal panel bolumleri) ve app/ | **A** | has_org_permission(orgId, 'events.view') |
| 146 | `app/lib/profile-helpers.ts:23` | return profile?.role === 'business'; | yardimci-tanim — isBusiness yardimcisinin govdesi; kurumsal hesap kimliginin tek kaynak kontrolu. | **A** | has_org_permission(orgId, 'events.view') |
| 147 | `app/lib/profile-helpers.ts:26` | export function isAgency(profile: Profile \| null \| undefined): boolean { | yardimci-tanim — Bir profilin ajans olup olmadigini soyleyen yardimcinin tanimi; bugun yalniz app/profil/page.tsx:64'te (ekip ve davet bolumleri) k | **C** | incelenmeli — cagiran yuzeye gore ikiye ayrilmali: pazaryeri satici gorunumu icin rol kalir, ekip/davet gibi kurulus isl |
| 148 | `app/lib/profile-helpers.ts:27` | return profile?.role === 'agency'; | yardimci-tanim — isAgency yardimcisinin govdesi; ajans kimliginin tek kaynak kontrolu. | **C** | incelenmeli — cagiran yuzeye gore ya pazaryeri rolu olarak kalir ya da has_org_permission(orgId, 'members.manage') olur |
| 149 | `app/lib/profile-helpers.ts:71` | if (profile.role === 'professional') { ... 'Ana hizmet kategorisi' / 'En az 1 aktif hizmet' zorunlu } | is-mantigi — getMissingPublishFields icinde bireysel saticinin profil yayinlayabilmesi icin gereken ek alanlari belirler. | **B** | pazaryeri rolu olarak kalir |
| 150 | `app/lib/profile-helpers.ts:83` | if (profile.role === 'business') { ... 'Sirket adi' zorunlu } | is-mantigi — getMissingPublishFields icinde kurumsal hesabin yayinlanmasi icin sirket adi zorunlulugunu koyar. | **C** | incelenmeli — sirket adi organizations/organization_profiles alanina tasindiginda bu dal profil yayinlama kontrolunden c |
| 151 | `app/lib/profile-helpers.ts:90` | if (profile.role === 'agency') { ... 'Ajans adi' zorunlu } | is-mantigi — getMissingPublishFields icinde ajansin pazaryeri profilini yayinlayabilmesi icin ajans adi zorunlulugunu koyar. | **B** | pazaryeri rolu olarak kalir |
| 152 | `app/lib/profile-helpers.ts:118` | if (profile.role === 'professional') { checks.push(!!profile.primary_category_id); checks.push(activeServices. | is-mantigi — getCompletenessPercent icinde bireysel satici icin tamlik yuzdesine eklenen ek kriterleri belirler. | **B** | pazaryeri rolu olarak kalir |
| 153 | `app/lib/profile-helpers.ts:123` | if (profile.role === 'business') { checks.push(!!profile.company_name); } | is-mantigi — getCompletenessPercent icinde kurumsal hesap icin sirket adini tamlik kriterine ekler. | **C** | incelenmeli — alan organizations tarafina tasindiginda tamlik hesabi kurumsal hesap icin yeniden tanimlanmali |
| 154 | `app/lib/profile-helpers.ts:126` | if (profile.role === 'agency') { checks.push(!!profile.company_name); } | is-mantigi — getCompletenessPercent icinde ajans icin ajans adini tamlik kriterine ekler. | **B** | pazaryeri rolu olarak kalir |
| 155 | `app/mesajlar/[id]/karsi-taraf-paneli.tsx:27` | const isOtherProfessional = other.role === 'professional' \|\| other.role === 'business' | arayuz-gosterimi — Karsi taraf satici hesabiysa panelde 'Profilini gor' baglantisi cizilir; musterinin kamu profili yoktur. | **B** | pazaryeri rolu olarak kalir |
| 156 | `app/mesajlar/[id]/karsi-taraf-paneli.tsx:30` | other.role === 'business' && other.company_name ? other.company_name : other.full_name | arayuz-gosterimi — Panelde gosterilecek adin kaynagini secer: kurumsal hesapta sirket adi, digerlerinde kisi adi. | **B** | pazaryeri rolu olarak kalir |
| 157 | `app/mesajlar/[id]/karsi-taraf-paneli.tsx:43` | other.role === 'professional' ? 'Profesyonel' | arayuz-gosterimi — Karsi tarafin ustunde gorunen rol etiketini uretir (Profesyonel dali). | **B** | pazaryeri rolu olarak kalir |
| 158 | `app/mesajlar/[id]/karsi-taraf-paneli.tsx:45` | : other.role === 'business' ? 'Kurumsal' : 'Musteri' | arayuz-gosterimi — Ayni rol etiketi ternary'sinin Kurumsal/Musteri dali. | **B** | pazaryeri rolu olarak kalir |
| 159 | `app/mesajlar/[id]/konusma-detay.tsx:41` | isProfessional: boolean;  (Props tipi) | tip-tanimi — Bilesenin satici tarafi bayragini tasiyan prop tipinin tanimi; calisma zamani karari yok. | **B** | pazaryeri rolu olarak kalir |
| 160 | `app/mesajlar/[id]/konusma-detay.tsx:134` | isProfessional,  (KonusmaDetay prop cozumlemesi) | yardimci-tanim — Satici tarafi bayraginin bilesen imzasinda baglanmasi; burada dallanma yok. | **B** | pazaryeri rolu olarak kalir |
| 161 | `app/mesajlar/[id]/konusma-detay.tsx:217` | other.role === 'business' && other.company_name ? other.company_name : other.full_name | arayuz-gosterimi — Sohbet basligindaki karsi taraf adinin kaynagini secer. | **B** | pazaryeri rolu olarak kalir |
| 162 | `app/mesajlar/[id]/konusma-detay.tsx:892` | {(isProfessional \|\| isAssignedPro) && ( ... 'Teklif olustur' butonu )} | arayuz-gosterimi — Teklif olustur butonu yalnizca konusmanin sahibi profesyonele veya atanmis profesyonele cizilir. | **B** | pazaryeri rolu olarak kalir |
| 163 | `app/mesajlar/[id]/konusma-detay.tsx:975` | {(isProfessional \|\| isAssignedPro) && ( <QuoteModal ... /> )} | arayuz-gosterimi — Teklif olusturma modalinin DOM'a eklenmesi ayni satici kosuluna bagli. | **B** | pazaryeri rolu olarak kalir |
| 164 | `app/mesajlar/[id]/page.tsx:151` | return p.role === 'business' && p.company_name ? p.company_name : p.full_name  (profileName yardimcisi) | yardimci-tanim — Gonderen adi haritasi icin kullanilan yerel profileName yardimcisinin govdesi; kurumsal hesapta sirket adini dondurur. | **B** | pazaryeri rolu olarak kalir |
| 165 | `app/mesajlar/[id]/page.tsx:157` | const ownerIsAgency = conv.professional?.role === 'agency' | is-mantigi — Konusma sahibi ajanssa, ajans adina yazan profesyonellerin mesajlarina ajans etiketi eklenir (189-194). | **B** | pazaryeri rolu olarak kalir |
| 166 | `app/mesajlar/[id]/page.tsx:201` | const customerIsBusiness = conv.customer?.role === 'business'  (202'de viewerIsProfessional ile birlikte kulla | is-mantigi — Musteri tarafi kurumsalsa ve bakan kisi kurum disindaki profesyonelse, kurum ekip uyelerinin gercek adi kurum adiyla maskelenir. | **C** | incelenmeli |
| 167 | `app/mesajlar/[id]/page.tsx:248` | const isProfessional = conv.professional_id === user.id | is-mantigi — Konusmanin satici tarafinin sahibi mi; teklif olusturma yetkisini tasiyan bayragi uretir ve 287'de bilesene gecirilir. | **B** | pazaryeri rolu olarak kalir |
| 168 | `app/mesajlar/[id]/page.tsx:252` | conv.professional_id === user.id && conv.professional?.role === 'agency' | is-mantigi — Ajans sahibiyse konusmayi ekip uyesine atama listesi acilir ve agency_members sorgulanir (256-268). | **A** | has_org_permission(orgId, 'commercial.manage') — konusma atamasi ticari akisin yonetimi sayilir; 'crew.manage' alternati |
| 169 | `app/mesajlar/[id]/page.tsx:287` | isProfessional={isProfessional} | arayuz-gosterimi — Satici tarafi bayraginin KonusmaDetay bilesenine gecirilmesi; burada dallanma yok, karar 248'de veriliyor. | **B** | pazaryeri rolu olarak kalir |
| 170 | `app/mesajlar/actions.ts:204` | senderProfile?.role === 'business' && senderProfile?.company_name | arayuz-gosterimi — Yeni mesaj bildiriminde (e-posta ve web push) gonderen adinin kaynagini secer. | **B** | pazaryeri rolu olarak kalir |
| 171 | `app/mesajlar/actions.ts:209` | recipientProfile?.role === 'business' && recipientProfile?.company_name | arayuz-gosterimi — Ayni bildirimde alici adinin kaynagini secer. | **B** | pazaryeri rolu olarak kalir |
| 172 | `app/mesajlar/actions.ts:271` | senderProfile?.role === 'business' && senderProfile?.company_name | arayuz-gosterimi — Yeni konusma bildiriminde gonderen (musteri) adinin kaynagini secer. | **B** | pazaryeri rolu olarak kalir |
| 173 | `app/mesajlar/actions.ts:276` | recipientProfile?.role === 'business' && recipientProfile?.company_name | arayuz-gosterimi — Yeni konusma bildiriminde alici (profesyonel) adinin kaynagini secer. | **B** | pazaryeri rolu olarak kalir |
| 174 | `app/mesajlar/actions.ts:385` | targetProfile.role !== 'professional' (386 ile tek kosul) -> 'Bu kullaniciya mesaj gonderilemez.' | is-mantigi — Yeni konusma acilirken hedefin satici hesap turunde olmasini zorunlu kilan sunucu tarafi dogrulamasinin ilk dali. | **B** | pazaryeri rolu olarak kalir |
| 175 | `app/mesajlar/actions.ts:386` | targetProfile.role !== 'agency' (385 ile ayni kosulun ikinci dali) | is-mantigi — Ayni dogrulamanin ajans dali; profesyonel veya ajans disindaki hesaplara konusma acilamaz. | **B** | pazaryeri rolu olarak kalir |
| 176 | `app/mesajlar/mesaj-listesi.tsx:220` | other.role === 'business' && other.company_name ? other.company_name : other.full_name | arayuz-gosterimi — Konusma listesi kartinda karsi tarafin adinin kaynagini secer. | **B** | pazaryeri rolu olarak kalir |
| 177 | `app/mesajlar/quote-actions.ts:371` | proProfile?.role === 'business' && proProfile?.company_name | arayuz-gosterimi — Yeni teklif bildiriminde teklifi gonderenin adinin kaynagini secer. | **B** | pazaryeri rolu olarak kalir |
| 178 | `app/mesajlar/quote-actions.ts:376` | customerProfile?.role === 'business' && customerProfile?.company_name | arayuz-gosterimi — Yeni teklif bildiriminde alici musterinin adinin kaynagini secer. | **B** | pazaryeri rolu olarak kalir |
| 179 | `app/mesajlar/quote-actions.ts:440` | customerProfile?.role === 'business' && customerProfile?.company_name | arayuz-gosterimi — Teklif kabul bildiriminde musteri adinin kaynagini secer. | **B** | pazaryeri rolu olarak kalir |
| 180 | `app/mesajlar/quote-actions.ts:445` | proProfile?.role === 'business' && proProfile?.company_name | arayuz-gosterimi — Teklif kabul bildiriminde alici profesyonelin adinin kaynagini secer. | **B** | pazaryeri rolu olarak kalir |
| 181 | `app/odemelerim/page.tsx:96` | (p.role === 'business' \|\| p.role === 'agency') && p.company_name ? p.company_name : p.full_name \|\| 'Profes | arayuz-gosterimi — Odemeler listesinde karsi tarafin sirket adiyla mi kisi adiyla mi yazilacagini secer. | **B** | pazaryeri rolu olarak kalir |
| 182 | `app/p/[id]/page.tsx:74` | data.role !== 'professional' && | arayuz-gosterimi — generateMetadata icinde kamu profili olmayan rollerde sayfa basligini 'Profil bulunamadi' yapar (professional kolu). | **B** | pazaryeri rolu olarak kalir |
| 183 | `app/p/[id]/page.tsx:75` | data.role !== 'business' && | arayuz-gosterimi — Ayni baslik guard'inin kurumsal hesap kolu; business rolu kamu profili sayilir. | **C** | incelenmeli |
| 184 | `app/p/[id]/page.tsx:76` | data.role !== 'agency') | arayuz-gosterimi — Ayni baslik guard'inin ajans kolu; ajans kamu profili sayilir. | **B** | pazaryeri rolu olarak kalir |
| 185 | `app/p/[id]/page.tsx:82` | (data.role === 'business' \|\| data.role === 'agency') && data.company_name | arayuz-gosterimi — Sayfa basliginda gosterilecek adi secer: kurumsal/ajans hesapta sirket adi. | **B** | pazaryeri rolu olarak kalir |
| 186 | `app/p/[id]/page.tsx:141` | profile.role !== 'professional' && | sayfa-erisimi — Kamu profili olmayan rollerde notFound() ureten guard'in professional kolu (musteri profilleri kapali). | **B** | pazaryeri rolu olarak kalir |
| 187 | `app/p/[id]/page.tsx:142` | profile.role !== 'business' && | sayfa-erisimi — Ayni notFound guard'inin kurumsal hesap kolu; business profili kamuya acik kabul edilir. | **C** | incelenmeli |
| 188 | `app/p/[id]/page.tsx:143` | profile.role !== 'agency' | sayfa-erisimi — Ayni notFound guard'inin ajans kolu; ajans profili kamuya acik. | **B** | pazaryeri rolu olarak kalir |
| 189 | `app/p/[id]/page.tsx:153` | const isAgencyProfile = profile.role === 'agency'; | is-mantigi — Profilin ajans olup olmadigini isaretler; ajans ekibi sorgusunu ve avatar rengini bu bayrak belirler. | **B** | pazaryeri rolu olarak kalir |
| 190 | `app/p/[id]/page.tsx:198` | if (profile.role === 'professional') | is-mantigi — Yalniz profesyonel profillerde 'temsil eden ajanslar' sorgusunu calistirir. | **B** | pazaryeri rolu olarak kalir |
| 191 | `app/p/[id]/page.tsx:270` | (profile.role === 'professional' \|\| profile.role === 'agency') | arayuz-gosterimi — Favori butonu yalniz baskasinin profesyonel/ajans profilinde gosterilir. | **B** | pazaryeri rolu olarak kalir |
| 192 | `app/p/[id]/page.tsx:409` | (profile.role === 'business' \|\| profile.role === 'agency') && profile.company_name | arayuz-gosterimi — Kamu profilinde gosterilecek adi secer: kurumsal/ajans hesapta sirket adi. | **B** | pazaryeri rolu olarak kalir |
| 193 | `app/p/[id]/page.tsx:453` | if (profile.role === 'professional') | is-mantigi — Profesyonel profillerde yeni iki kolon duzenine erken donus yapar; ajans/kurumsal eski render'da kalir. | **B** | pazaryeri rolu olarak kalir |
| 194 | `app/p/[id]/page.tsx:540` | role: profile.role, | arayuz-gosterimi — Profil rolunu ProfessionalProfile bilesenine prop olarak tasir; bilesende yalniz tip bildiriminde yer alir, calisma zamani dallanm | **B** | pazaryeri rolu olarak kalir |
| 195 | `app/p/[id]/page.tsx:619` | .in('role', ['professional', 'agency']) | veri-filtresi — Benzer profiller onerisini yalniz yayinda ve onayli satici profilleriyle sinirlar. | **B** | pazaryeri rolu olarak kalir |
| 196 | `app/p/[id]/page.tsx:724` | {getRoleLabel(profile.role)} | arayuz-gosterimi — Profil basliginin ustunde rol etiketini (Profesyonel/Kurumsal/Ajans/Musteri) metin olarak basar. | **B** | pazaryeri rolu olarak kalir |
| 197 | `app/p/[id]/yorumlar/page.tsx:34` | data.role === 'business' && data.company_name | arayuz-gosterimi — Yorumlar sayfasinin metadata basliginda kurumsal hesapta sirket adini kullanir. | **B** | pazaryeri rolu olarak kalir |
| 198 | `app/p/[id]/yorumlar/page.tsx:68` | profile.role === 'business' && profile.company_name | arayuz-gosterimi — Yorumlar sayfasinda gosterilecek adi secer: kurumsal hesapta sirket adi, digerlerinde tam ad. | **B** | pazaryeri rolu olarak kalir |
| 199 | `app/premium/actions.ts:47` | if (plan.forRoles.length > 0 && !plan.forRoles.includes(profile.role)) { return { success: false, error: 'Bu p | is-mantigi — Premium plan satin alma/aktifleme eyleminde planin hesap turune uygunlugunu dogrular (app/lib/premium.ts icinde forRoles: professi | **B** | pazaryeri rolu olarak kalir |
| 200 | `app/premium/page.tsx:31` | const role = profile?.role ?? 'client';  (satir 55'te PlanSecici userRole={role}; plan-secici.tsx:40 forRoles  | arayuz-gosterimi — Premium sayfasinda hangi planlarin listeleneceginin filtresi olarak kullanicinin rolunu bilesene gecirir. | **B** | pazaryeri rolu olarak kalir |
| 201 | `app/profil/deneyim/page.tsx:5` | import { isProfessional } from '@/app/lib/profile-helpers'; | yardimci-tanim — Rol yardimcisinin sayfaya alinmasi; satirin kendisinde calisma zamani karari yok, kontrol satir 36'da. | **B** | pazaryeri rolu olarak kalir |
| 202 | `app/profil/deneyim/page.tsx:36` | if (!isProfessional(profile)) { redirect('/profil'); } | sayfa-erisimi — Deneyim ve egitim duzenleme sayfasini yalnizca profesyonel hesaba acar, digerlerini /profil'e dondurur. | **B** | pazaryeri rolu olarak kalir |
| 203 | `app/profil/duzenle/actions.ts:52` | defaultApplicantRoles = ['professional', 'agency']; | is-mantigi — Ilan sahibinin 'herkes basvursun' secimini iki pazaryeri satici rolune (professional, agency) cevirip profiles.default_allowed_app | **B** | pazaryeri rolu olarak kalir |
| 204 | `app/profil/duzenle/actions.ts:159` | (profile as Profile).role !== 'client' && approval_status !== 'approved' | is-mantigi — Yayinlama isteginde client disindaki rollerin admin onayi almadan profilini yayinlamasini engeller. | **B** | pazaryeri rolu olarak kalir |
| 205 | `app/profil/duzenle/actions.ts:171` | if ((profile as Profile).role === 'professional') { services sorgusu } | is-mantigi — Yayin sartlarini kontrol etmek icin yalniz profesyonel hesapta aktif hizmet listesini ceker. | **B** | pazaryeri rolu olarak kalir |
| 206 | `app/profil/duzenle/duzenle-form.tsx:11` | import { isProfessional, isBusiness } from '@/app/lib/profile-helpers'; | yardimci-tanim — Iki rol yardimcisini forma baglar; satirda karar yok, kullanimlar satir 104 ve 105. | **C** | incelenmeli |
| 207 | `app/profil/duzenle/duzenle-form.tsx:64` | isAgency: profile.role === 'agency' | is-mantigi — Yapay zeka bio taslaginin ajans diliyle mi bireysel dille mi uretilecegini belirler. | **B** | pazaryeri rolu olarak kalir |
| 208 | `app/profil/duzenle/duzenle-form.tsx:87` `EK` | // 'both' \| 'professional' \| 'agency' (yorum) | tip-tanimi — Varsayilan basvuran rol tercihi aciklamasi. | **B** | pazaryeri rolu olarak kalir |
| 209 | `app/profil/duzenle/duzenle-form.tsx:88` `EK` | detectDefaultRoles(): 'both'\|'professional'\|'agency' | is-mantigi — Profilin varsayilan basvuran rol tercihini cozer. | **B** | pazaryeri rolu olarak kalir |
| 210 | `app/profil/duzenle/duzenle-form.tsx:97` `EK` | 'both' \| 'professional' \| 'agency' | tip-tanimi — Ayni fonksiyonun donus tipi. | **B** | pazaryeri rolu olarak kalir |
| 211 | `app/profil/duzenle/duzenle-form.tsx:104` | const showProfessionalFields = isProfessional(profile); | arayuz-gosterimi — Ana hizmet kategorisi alani, kategori ozellikleri editoru ve bio metnini profesyonel hesaplarda gosterir. | **B** | pazaryeri rolu olarak kalir |
| 212 | `app/profil/duzenle/duzenle-form.tsx:105` | const showBusinessFields = isBusiness(profile); | arayuz-gosterimi — Kurumsal hesaplarda 'Sirket adi' alanini ve kuruma ozel bio yer tutucusunu gosterir (satir 194 ve 367). | **C** | incelenmeli |
| 213 | `app/profil/duzenle/duzenle-form.tsx:109` | profile.role === 'client' \|\| profile.role === 'business' | arayuz-gosterimi — Ilan acabilen taraflara (client/business) 'Ilanlarima kimler basvursun' varsayilan secimini gosterir. | **B** | pazaryeri rolu olarak kalir |
| 214 | `app/profil/ekibim/page.tsx:33` | if (profile?.role !== 'agency') { redirect('/profil'); } | sayfa-erisimi — Ajans ekip yonetimi sayfasini (uyeler + davetler) yalnizca ajans hesabina acar. | **A** | has_org_permission(orgId, 'members.manage') |
| 215 | `app/profil/hizmetlerim/page.tsx:6` | import { isProfessional } from '@/app/lib/profile-helpers'; | yardimci-tanim — Rol yardimcisinin sayfaya alinmasi; karar satir 41'de veriliyor. | **B** | pazaryeri rolu olarak kalir |
| 216 | `app/profil/hizmetlerim/page.tsx:41` | if (!isProfessional(profile)) { redirect('/profil'); } | sayfa-erisimi — Kullanicinin kendi pazaryeri hizmetlerini yonettigi sayfayi yalniz profesyonele acar. | **B** | pazaryeri rolu olarak kalir |
| 217 | `app/profil/kategori-bilgileri/actions.ts:90` | if (prof.role !== 'professional') return { error: 'Bu islem yalniz profesyonel hesaplarda.' } | is-mantigi — category_attributes kaydini yalnizca profesyonel hesaplarin yapabilmesini saglayan sunucu eylemi guvenligi. | **B** | pazaryeri rolu olarak kalir |
| 218 | `app/profil/kategori-bilgileri/page.tsx:5` | import { isProfessional } from '@/app/lib/profile-helpers'; | yardimci-tanim — Rol yardimcisinin sayfaya alinmasi; karar satir 38'de. | **B** | pazaryeri rolu olarak kalir |
| 219 | `app/profil/kategori-bilgileri/page.tsx:38` | if (!isProfessional(profile)) { redirect('/profil'); } | sayfa-erisimi — Kategoriye ozel profil bilgileri formunu yalniz profesyonel hesaba acar. | **B** | pazaryeri rolu olarak kalir |
| 220 | `app/profil/kurumsal-ekip/page.tsx:33` | if (profile?.role !== 'business') { redirect('/profil'); } | sayfa-erisimi — Kurumsal ekip yonetimi sayfasini (business_members + business_invitations) yalnizca kurum hesabina acar. | **A** | has_org_permission(orgId, 'members.manage') |
| 221 | `app/profil/page.tsx:11` | isProfessional, (profile-helpers import bloku) | yardimci-tanim — isProfessional yardimcisinin sayfaya alinmasi; kullanim satir 61'de. | **B** | pazaryeri rolu olarak kalir |
| 222 | `app/profil/page.tsx:12` | isClient, (profile-helpers import bloku) | yardimci-tanim — isClient yardimcisinin sayfaya alinmasi; kullanim satir 62'de. | **B** | pazaryeri rolu olarak kalir |
| 223 | `app/profil/page.tsx:13` | isBusiness, (profile-helpers import bloku) | yardimci-tanim — isBusiness yardimcisinin sayfaya alinmasi; kullanim satir 63'te. | **C** | incelenmeli |
| 224 | `app/profil/page.tsx:14` | isAgency, (profile-helpers import bloku) | yardimci-tanim — isAgency yardimcisinin sayfaya alinmasi; kullanim satir 64'te. | **A** | has_org_permission(orgId, 'members.manage') |
| 225 | `app/profil/page.tsx:61` | const isPro = isProfessional(profile); | arayuz-gosterimi — Profil sayfasinda profesyonele ozel bloklari (kategori, hizmetler, portfoy, paketler, premium) acar ve bu verilerin cekilmesini te | **B** | pazaryeri rolu olarak kalir |
| 226 | `app/profil/page.tsx:62` | const isClientUser = isClient(profile); | arayuz-gosterimi — Musteri hesabinda favoriler ve ilanlarim bloklarini acar, onay uyarisini gizler (satir 139, 367, 957, 985). | **B** | pazaryeri rolu olarak kalir |
| 227 | `app/profil/page.tsx:63` | const isBusinessUser = isBusiness(profile); | arayuz-gosterimi — Kurumsal ekip kartini ve uye sayisi sorgusunu (satir 87, 922) acarken ayni zamanda yayin rozeti, sirket adi ve ilanlarim kartini ( | **C** | incelenmeli |
| 228 | `app/profil/page.tsx:64` | const isAgencyUser = isAgency(profile); | arayuz-gosterimi — Ajans uye ve bekleyen davet sayilarini cekip 'Ekibim' ile 'Bekleyen davet' kartlarini gosterir (satir 69, 862, 897). | **A** | has_org_permission(orgId, 'members.manage') |
| 229 | `app/profil/page.tsx:317` | {getRoleLabel(profile.role)} | arayuz-gosterimi — Profil basliginda kullanicinin rol etiketini (Profesyonel/Musteri/Kurumsal/Ajans) yazar. | **B** | pazaryeri rolu olarak kalir |
| 230 | `app/profil/page.tsx:1009` | pro.role === 'business' && pro.company_name ? pro.company_name : pro.full_name | arayuz-gosterimi — Favoriler onizlemesinde kart basligi olarak sirket adini mi ad soyadi mi gosterecegini secer. | **B** | pazaryeri rolu olarak kalir |
| 231 | `app/profil/paketler/page.tsx:6` | import { isProfessional } from '@/app/lib/profile-helpers'; | yardimci-tanim — Rol yardimcisinin sayfaya alinmasi; karar satir 37'de. | **B** | pazaryeri rolu olarak kalir |
| 232 | `app/profil/paketler/page.tsx:37` | if (!isProfessional(profile)) { redirect('/profil'); } | sayfa-erisimi — Hizmet paketleri yonetimi sayfasini yalniz profesyonel hesaba acar. | **B** | pazaryeri rolu olarak kalir |
| 233 | `app/profil/portfoy/page.tsx:7` | import { isProfessional } from '@/app/lib/profile-helpers'; | yardimci-tanim — Rol yardimcisinin sayfaya alinmasi; karar satir 39'da. | **B** | pazaryeri rolu olarak kalir |
| 234 | `app/profil/portfoy/page.tsx:39` | if (!isProfessional(profile)) { redirect('/profil'); } | sayfa-erisimi — Portfoy yukleme ve yonetim sayfasini yalniz profesyonel hesaba acar. | **B** | pazaryeri rolu olarak kalir |
| 235 | `app/rezervasyon/[id]/actions.ts:61` | const isProfessional = booking.professional_id === user.id; | is-mantigi — Iptal isleminde kullanicinin bu rezervasyonun satici tarafi olup olmadigini belirler. | **B** | pazaryeri rolu olarak kalir |
| 236 | `app/rezervasyon/[id]/actions.ts:63` | if (!isCustomer && !isProfessional) { return { success: false, error: 'Bu rezervasyonu iptal etme yetkin yok'  | is-mantigi — Rezervasyonu yalnizca alici veya satici tarafin iptal edebilmesini saglar. | **B** | pazaryeri rolu olarak kalir |
| 237 | `app/rezervasyon/[id]/actions.ts:279` | cancellerProfile?.role === 'business' && cancellerProfile?.company_name | arayuz-gosterimi — Iptal e-postasinda iptali yapan tarafin adinin sirket adi mi kisi adi mi yazilacagini secer. | **B** | pazaryeri rolu olarak kalir |
| 238 | `app/rezervasyon/[id]/actions.ts:284` | recipientProfile?.role === 'business' && recipientProfile?.company_name | arayuz-gosterimi — Iptal e-postasinda alicinin adinin sirket adi mi kisi adi mi yazilacagini secer. | **B** | pazaryeri rolu olarak kalir |
| 239 | `app/rezervasyon/[id]/actions.ts:347` | proProfile?.role === 'business' && proProfile?.company_name | arayuz-gosterimi — Tamamlandi e-postasinda profesyonelin adinin sirket adi mi kisi adi mi yazilacagini secer. | **B** | pazaryeri rolu olarak kalir |
| 240 | `app/rezervasyon/[id]/actions.ts:352` | customerProfile?.role === 'business' && customerProfile?.company_name | arayuz-gosterimi — Tamamlandi e-postasinda musterinin adinin sirket adi mi kisi adi mi yazilacagini secer. | **B** | pazaryeri rolu olarak kalir |
| 241 | `app/rezervasyon/[id]/page.tsx:175` | const isProfessional = booking.professional_id === user.id; | is-mantigi — Detay sayfasinda goruntuleyenin bu rezervasyonun satici tarafi olup olmadigini belirler; hem 177'deki erisim kararini hem viewer d | **B** | pazaryeri rolu olarak kalir |
| 242 | `app/rezervasyon/[id]/page.tsx:177` | if (!isCustomer && !isProfessional) { notFound(); } | sayfa-erisimi — Rezervasyon detay sayfasini yalnizca islemin iki tarafina acar, digerlerine notFound doner. | **B** | pazaryeri rolu olarak kalir |
| 243 | `app/rezervasyon/[id]/page.tsx:184` | ? (otherParty.role === 'business' \|\| otherParty.role === 'agency') && otherParty.company_name | arayuz-gosterimi — Karsi tarafin basligi olarak sirket adi mi kisi adi mi gosterilecegini secer. | **B** | pazaryeri rolu olarak kalir |
| 244 | `app/rezervasyonlarim/rezervasyon-karti.tsx:101` | ? (otherParty.role === 'business' \|\| otherParty.role === 'agency') && otherParty.company_name | arayuz-gosterimi — Rezervasyon kartinda karsi tarafin sirket adi mi kisi adi mi yazilacagini secer. | **B** | pazaryeri rolu olarak kalir |
| 245 | `app/sitemap.ts:58` | .in('role', ['professional', 'agency'])  (bir ustte .eq('is_published', true)) | veri-filtresi — Sitemap'e yalnizca yayinlanmis satici profillerinin (/p/:id) girmesini saglar. | **B** | pazaryeri rolu olarak kalir |
| 246 | `app/takvimim/page.tsx:57` | if (!myProfile \|\| (myProfile.role !== 'professional' && myProfile.role !== 'agency')) { redirect('/'); } | sayfa-erisimi — Takvim sayfasini yalniz satici hesaplara acar, digerlerini ana sayfaya yonlendirir. | **B** | pazaryeri rolu olarak kalir |
| 247 | `app/teklif-talepleri/page.tsx:29` | if (profile?.role !== 'professional' && profile?.role !== 'agency') { redirect('/profil'); } | sayfa-erisimi — Gelen teklif talepleri sayfasini yalnizca satici tarafa (profesyonel/ajans) acar, digerlerini /profil'e yollar. | **B** | pazaryeri rolu olarak kalir |
| 248 | `app/teklif-topla/actions.ts:31` `EK` | target_roles: ('professional' \| 'agency')[] | tip-tanimi — Teklif talebinin hedef rol kumesi tipi. | **B** | pazaryeri rolu olarak kalir |
| 249 | `app/teklif-topla/actions.ts:70` | if (profile.role !== 'client' && profile.role !== 'business') { return { success: false, error: 'Sadece hizmet | is-mantigi — Kendi adina teklif talebi olusturmayi yalnizca alici hesaplara (client/business) izin vererek sinirlar. | **C** | incelenmeli — 'client' dali pazaryeri alici rolu olarak kalabilir; 'business' dalinin kurulus adina olusturma yoluyla (m |
| 250 | `app/teklif-topla/actions.ts:87` | : ['professional', 'agency'];  (matchQuery .in('role', roles) icin varsayilan hedef roller) | veri-filtresi — Teklif talebinin hangi satici profillerine gonderilecegini belirleyen rol filtresinin varsayilan degeri. | **B** | pazaryeri rolu olarak kalir |
| 251 | `app/teklif-topla/actions.ts:92` `EK` | .in('role', roles) | veri-filtresi — Teklif alicilarini role gore secer. | **B** | pazaryeri rolu olarak kalir |
| 252 | `app/teklif-topla/page.tsx:58` | const role = profile?.role; | is-mantigi — Sayfa erisim kararinda kullanilacak profil rolunu okur; karar 61 ve 63. satirlarda veriliyor. | **C** | incelenmeli — 61. satirin karariyla birlikte ele alinmali |
| 253 | `app/teklif-topla/page.tsx:61` | const canSelfCreate = role === 'client' \|\| role === 'business'; | sayfa-erisimi — Kendi adina teklif toplama hakkini belirler; 63. satirda writableBusinesses bos ise sayfa 'Erisim yok' ekranina duser. | **C** | incelenmeli — 'business' dali kurulus uyeligi yoluyla (getWritableBusinesses) karsilanacaksa buradan kaldirilabilir; han |
| 254 | `app/teklif-topla/teklif-topla-formu.tsx:49` `EK` | value: 'both' \| 'professional' \| 'agency' | tip-tanimi — Hedef rol secici prop tipi. | **B** | pazaryeri rolu olarak kalir |
| 255 | `app/teklif-topla/teklif-topla-formu.tsx:119` `EK` | useState<'both' \| 'professional' \| 'agency'> | tip-tanimi — Hedef rol form durumu. | **B** | pazaryeri rolu olarak kalir |
| 256 | `app/teklif-topla/teklif-topla-formu.tsx:206` `EK` | targetRoles: ('professional' \| 'agency')[] | is-mantigi — Secilen hedef rolun diziye cevrilmesi. | **B** | pazaryeri rolu olarak kalir |
| 257 | `app/teklif-topla/teklif-topla-formu.tsx:208` | ? ['professional', 'agency']  (targetRole === 'both' ise hedef roller) | is-mantigi — Alicinin talebini profesyonellere mi ajanslara mi yoksa ikisine birden mi gonderecegini belirleyip sunucudaki rol filtresine gonde | **B** | pazaryeri rolu olarak kalir |
| 258 | `app/uye-ol/ajans/ajans-uye-ol-form.tsx:69` `EK` | role: "agency" | is-mantigi — Ajans kaydinda rol atamasi. | **C** | incelenmeli — kayit akisi kurulus olusturmali mi |
| 259 | `app/uye-ol/uye-ol-form.tsx:68` `EK` | role: "professional" as Role | is-mantigi — Kayitta pazaryeri rolu atamasi. | **B** | pazaryeri rolu olarak kalir |
| 260 | `app/uye-ol/uye-ol-form.tsx:75` `EK` | role: "client" as Role | is-mantigi — Kayitta pazaryeri rolu atamasi. | **B** | pazaryeri rolu olarak kalir |
| 261 | `app/uye-ol/uye-ol-form.tsx:82` `EK` | role: "business" as Role | is-mantigi — Kayitta kurumsal rol atamasi. | **C** | incelenmeli — kayit akisi kurulus olusturmali mi |
| 262 | `supabase/functions/send-message-notification/index.ts:113` | if (profile.role === 'business' && profile.company_name) return profile.company_name; | arayuz-gosterimi — Bildirim e-postasinda gonderen adi olarak sirket adinin mi tam adin mi yazilacagini secer. | **C** | incelenmeli — kurulus adi organizations tablosuna tasindiginda gosterim kaynagi yeniden belirlenir. |
| 263 | `supabase/migrations/20260518000000_initial_schema.sql:430` | WHEN ((role = 'professional'::text) AND (primary_category_id IS NOT NULL)) THEN 1 | is-mantigi — profile_completeness gorunumunde profesyonel profilinin ana kategori alaninin dolulugunu puanlar. | **B** | pazaryeri rolu olarak kalir |
| 264 | `supabase/migrations/20260518000000_initial_schema.sql:434` | WHEN ((role = 'business'::text) AND (company_name IS NOT NULL)) THEN 1 | is-mantigi — Ayni gorunumde kurumsal hesabin sirket adi alaninin dolulugunu puanlar. | **C** | incelenmeli — company_name organizations'a tasindiginda gorunum kaynagi guncellenir. |
| 265 | `supabase/migrations/20260519133753_add_listings_and_applications.sql:191` | AND p.role = 'professional' ("Professionals apply to published listings" INSERT WITH CHECK) | RLS — Yayindaki bir ilana yalnizca profil rolu professional olan kullanicinin basvurabilmesini saglar. | **B** | pazaryeri rolu olarak kalir |
| 266 | `supabase/migrations/20260520071330_add_agency_role_and_members.sql:8` ⚠ | -- Ajansin kendisi profiles tablosunda role='agency' ile yasar (yorum satiri) | yardimci-tanim — Ajans hesabinin profiles satirinda yasadigini anlatan aciklama satiri. | **C** | incelenmeli — ajans kimligi organizations'a tasindiginda aciklama guncellenir. |
| 267 | `supabase/migrations/20260520071330_add_agency_role_and_members.sql:202` | WHERE p.id = auth.uid() AND p.role = 'agency' ("Agencies create invitations" INSERT) | RLS — agency_invitations satirini yalnizca profil rolu agency olan hesabin olusturabilmesini saglar. | **A** | has_org_permission(agency_id, 'members.manage') |
| 268 | `supabase/migrations/20260520151810_fix_handle_new_user_for_agency.sql:58` ⚠ | -- (Test ajans hesabi yanlis role='client' ile olustu) (yorum satiri) | is-mantigi — Altindaki tek seferlik veri duzeltmesinin gerekcesini anlatan aciklama satiri. | **C** | incelenmeli — kod degisikligi gerektirmeyen tarihsel aciklama. |
| 269 | `supabase/migrations/20260520151810_fix_handle_new_user_for_agency.sql:63` | UPDATE profiles SET role = 'agency', company_name = 'Sunucu Ajans' | is-mantigi — Uygulanmis tek seferlik veri duzeltmesi; bir test hesabinin pazaryeri rolunu agency yapar. | **B** | pazaryeri rolu olarak kalir |
| 270 | `supabase/migrations/20260520151810_fix_handle_new_user_for_agency.sql:66` | AND role = 'client' (UPDATE WHERE kosulu) | veri-filtresi — Ayni duzeltmede yalnizca rolu hala client olan satirin guncellenmesini saglar. | **B** | pazaryeri rolu olarak kalir |
| 271 | `supabase/migrations/20260630120000_add_business_members_and_invitations.sql:13` ⚠ | -- KENDISI (profiles.role='business', profile.id) de-facto owner'dir ... RLS'te business_id = auth.uid() (yoru | yardimci-tanim — Kurum hesabinin kendisinin ayri bir uyelik satiri olmadan de-facto owner sayildigini anlatir. | **A** | has_org_permission(business_id, 'members.manage') |
| 272 | `supabase/migrations/20260630120000_add_business_members_and_invitations.sql:27` ⚠ | -- is_business_member() yardimci fonksiyonu burada (ozyinelemesiz RLS icin zorunlu) (yorum) | yardimci-tanim — Uyelik yardimcisinin neden bu migration'da tanimlandigini anlatan aciklama satiri. | **A** | incelenmeli — is_business_member govdesi organization_memberships'a cevrilince aciklama guncellenir. |
| 273 | `supabase/migrations/20260630120000_add_business_members_and_invitations.sql:149` ⚠ | -- 4. is_business_member() yardimci fonksiyon (SECURITY DEFINER — ozyinelemesiz RLS) (bolum basligi yorumu) | yardimci-tanim — Yardimci fonksiyon bolumunun baslik yorumu. | **A** | incelenmeli — donusum satir 157'deki fonksiyon govdesinde yapilir. |
| 274 | `supabase/migrations/20260630120000_add_business_members_and_invitations.sql:157` | CREATE OR REPLACE FUNCTION is_business_member(p_business_id UUID) ... SELECT EXISTS (SELECT 1 FROM business_me | yardimci-tanim — Oturumdaki kullanicinin verilen kurumun ekip uyesi olup olmadigini SECURITY DEFINER ile doner. | **A** | incelenmeli — imza korunup govde organization_memberships'a cevrilir; cagri yerine gore has_org_permission(business_id,  |
| 275 | `supabase/migrations/20260630120000_add_business_members_and_invitations.sql:183` | OR is_business_member(business_id) ("Business team visible to owner and members" SELECT; ust dal business_id = | RLS — Kurum ekip listesini yalnizca kurum hesabina ve o kurumun uyelerine gosterir. | **A** | incelenmeli — uye listesi OKUMASI icin mevcut anahtarlarda karsilik yok ('members.manage' yonetim anahtari); anahtar sec |
| 276 | `supabase/migrations/20260630120000_add_business_members_and_invitations.sql:237` | WHERE p.id = auth.uid() AND p.role = 'business' ("Businesses create invitations" INSERT) | RLS — business_invitations satirini yalnizca profil rolu business olan kurum hesabinin olusturabilmesini saglar. | **A** | has_org_permission(business_id, 'members.manage') |
| 277 | `supabase/migrations/20260701120000_business_member_shared_visibility.sql:4` ⚠ | -- EK politikalar: mevcut sahip + agency/is_assignee politikalarina DOKUNULMAZ. (yorum) | yardimci-tanim — Bu migration'in hangi mevcut politikalara dokunmadigini anlatan aciklama satiri. | **C** | incelenmeli |
| 278 | `supabase/migrations/20260701120000_business_member_shared_visibility.sql:19` | USING (is_business_member(creator_id)) ("Business members read team listings" SELECT) | RLS — Kurum uyesinin, kurumun olusturdugu ilanlari okumasina izin verir. | **A** | has_org_permission(creator_id, 'commercial.view') |
| 279 | `supabase/migrations/20260701120000_business_member_shared_visibility.sql:25` | USING (is_business_member(customer_id)) ("Business members read team conversations" SELECT) | RLS — Kurum uyesinin, kurumun musteri oldugu konusmalari okumasina izin verir. | **A** | has_org_permission(customer_id, 'commercial.view') |
| 280 | `supabase/migrations/20260701120000_business_member_shared_visibility.sql:31` | USING (is_business_member(customer_id)) ("Business members read team bookings" SELECT) | RLS — Kurum uyesinin, kurumun rezervasyonlarini okumasina izin verir. | **A** | has_org_permission(customer_id, 'commercial.view') |
| 281 | `supabase/migrations/20260701120000_business_member_shared_visibility.sql:37` | USING (is_business_member(customer_id)) ("Business members read team quote requests" SELECT) | RLS — Kurum uyesinin, kurumun teklif taleplerini okumasina izin verir. | **A** | has_org_permission(customer_id, 'commercial.view') |
| 282 | `supabase/migrations/20260701120000_business_member_shared_visibility.sql:46` | AND is_business_member(c.customer_id) ("Business members read team messages" SELECT, conversations uzerinden z | RLS — Kurum uyesinin, kurumun konusmalarindaki mesajlari okumasina izin verir. | **A** | has_org_permission(c.customer_id, 'commercial.view') |
| 283 | `supabase/migrations/20260701120000_business_member_shared_visibility.sql:56` | AND is_business_member(c.customer_id) ("Business members read team quotes" SELECT, conversations uzerinden zin | RLS — Kurum uyesinin, kurumun konusmalarina gelen teklifleri okumasina izin verir. | **A** | has_org_permission(c.customer_id, 'commercial.view') |
| 284 | `supabase/migrations/20260701120000_business_member_shared_visibility.sql:66` | AND is_business_member(q.customer_id) ("Business members read team request recipients" SELECT, quote_requests  | RLS — Kurum uyesinin, kurumun teklif talebine eklenen alicilari okumasina izin verir. | **A** | has_org_permission(q.customer_id, 'commercial.view') |
| 285 | `supabase/migrations/20260707120000_business_write_pass_messages.sql:36` | CREATE OR REPLACE FUNCTION public.has_business_role(p_business_id uuid, p_min_role business_member_role) ... b | yardimci-tanim — Kullanicinin verilen kurumda en az belirtilen uyelik rolune sahip olup olmadigini doner. | **A** | incelenmeli — imza korunup govde organization_memberships'a cevrilir; cagri yerlerinde has_org_permission(business_id, ' |
| 286 | `supabase/migrations/20260707120000_business_write_pass_messages.sql:78` | OR has_business_role(c.customer_id, 'manager') (messages_insert_participant INSERT) | RLS — manager ve ustu kurum uyesinin kurum adina mesaj gondermesine izin verir. | **A** | has_org_permission(c.customer_id, 'commercial.manage') |
| 287 | `supabase/migrations/20260707120000_business_write_pass_messages.sql:97` | OR has_business_role(c.customer_id, 'manager') (messages_update_recipient UPDATE / okundu isaretleme) | RLS — manager ve ustu kurum uyesinin kurum konusmasindaki mesaji okundu isaretlemesine izin verir. | **A** | has_org_permission(c.customer_id, 'commercial.manage') |
| 288 | `supabase/migrations/20260708120000_business_write_pass_create.sql:9` ⚠ | -- Rol esigi helper'i has_business_role(...) DILIM 1'de kuruldu (owner=3>manager=2>member=1) (yorum) | yardimci-tanim — Dosyanin dayandigi rol esigi yardimcisini isaret eden aciklama satiri. | **A** | incelenmeli — helper govdesi degistiginde aciklama guncellenir. |
| 289 | `supabase/migrations/20260708120000_business_write_pass_create.sql:22` ⚠ | --     WITH CHECK (owns_quote_request(request_id, auth.uid())) (geri donus notu yorumu) | yardimci-tanim — Politikanin degistirilmeden onceki halini kaydeden geri donus notu. | **C** | incelenmeli |
| 290 | `supabase/migrations/20260708120000_business_write_pass_create.sql:58` | AND has_business_role(q.customer_id, p_min_role) (has_business_role_on_request fonksiyon govdesi) | yardimci-tanim — Teklif talebi uzerinden kurumun rol esigini kontrol eden yardimci fonksiyonun govdesi. | **A** | has_org_permission(q.customer_id, 'commercial.manage') |
| 291 | `supabase/migrations/20260708120000_business_write_pass_create.sql:70` | OR has_business_role(customer_id, 'manager') ("Customers create own quote requests" INSERT) | RLS — manager ve ustu kurum uyesinin kurum adina teklif talebi olusturmasina izin verir. | **A** | has_org_permission(customer_id, 'commercial.manage') |
| 292 | `supabase/migrations/20260708120000_business_write_pass_create.sql:81` | OR has_business_role(customer_id, 'manager') ("Customers update own quote requests" UPDATE USING) | RLS — manager ve ustu kurum uyesinin kurumun teklif talebini guncellemesine izin verir. | **A** | has_org_permission(customer_id, 'commercial.manage') |
| 293 | `supabase/migrations/20260708120000_business_write_pass_create.sql:85` | OR has_business_role(customer_id, 'manager') (ayni politikanin WITH CHECK dali) | RLS — Guncelleme sonrasi satirin da kurum yetkisi kapsaminda kalmasini zorunlu kilar. | **A** | has_org_permission(customer_id, 'commercial.manage') |
| 294 | `supabase/migrations/20260708120000_business_write_pass_create.sql:90` ⚠ | --    (owns_quote_request fonksiyonuna DOKUNULMAZ — baska yerlerde sahiplik anlamiyla kullanimda) (yorum) | yardimci-tanim — owns_quote_request yardimcisinin bilerek degistirilmedigini anlatan aciklama satiri. | **C** | incelenmeli |
| 295 | `supabase/migrations/20260708120000_business_write_pass_create.sql:96` | owns_quote_request(request_id, auth.uid()) ("Customers add recipients to own requests" INSERT, ilk dal) | RLS — Teklif talebine alici eklemeyi talebin sahibine acar (kurum dali bir alt satirdaki has_business_role_on_request'tir). | **C** | incelenmeli |
| 296 | `supabase/migrations/20260708120000_business_write_pass_create.sql:108` | OR has_business_role(customer_id, 'manager') (conversations_insert_customer INSERT) | RLS — manager ve ustu kurum uyesinin kurum adina konusma baslatmasina izin verir. | **A** | has_org_permission(customer_id, 'commercial.manage') |
| 297 | `supabase/migrations/20260708120000_business_write_pass_create.sql:127` | OR has_business_role(creator_id, 'manager') ("Customers and businesses create listings" INSERT; ayni politikan | RLS — manager ve ustu kurum uyesinin kurum adina ilan olusturmasina izin verir. | **A** | has_org_permission(creator_id, 'commercial.manage') |
| 298 | `supabase/migrations/20260708120000_business_write_pass_create.sql:141` | OR has_business_role(creator_id, 'manager') ("Users update their own listings" UPDATE) | RLS — manager ve ustu kurum uyesinin kurumun ilanini guncellemesine izin verir. | **A** | has_org_permission(creator_id, 'commercial.manage') |
| 299 | `supabase/migrations/20260710120000_business_write_pass_accept.sql:6` ⚠ | -- Rol helper'i has_business_role(business_id, min_role) DILIM 1'de kuruldu. (yorum) | yardimci-tanim — Dosyanin dayandigi rol esigi yardimcisini isaret eden aciklama satiri. | **A** | incelenmeli — helper govdesi degistiginde aciklama guncellenir. |
| 300 | `supabase/migrations/20260710120000_business_write_pass_accept.sql:49` | OR has_business_role(c.customer_id, 'manager') ("Quote status updates by authorized parties" UPDATE) | RLS — manager ve ustu kurum uyesinin kurum konusmasindaki teklifi kabul/red etmesine izin verir. | **A** | has_org_permission(c.customer_id, 'commercial.manage') |
| 301 | `supabase/migrations/20260710120000_business_write_pass_accept.sql:67` | OR has_business_role(l.creator_id, 'manager') ("Authorized parties update applications" UPDATE) | RLS — manager ve ustu kurum uyesinin kurum ilanina gelen basvuruyu kabul/red/shortlist etmesine izin verir. | **A** | has_org_permission(l.creator_id, 'crew.manage') |
| 302 | `supabase/migrations/20260710120000_business_write_pass_accept.sql:85` | AND has_business_role(l.creator_id, 'manager') ("Business managers see team applications" SELECT) | RLS — manager ve ustu kurum uyesinin kurum ilanina gelen basvurulari gormesine izin verir. | **A** | has_org_permission(l.creator_id, 'crew.view') |
| 303 | `supabase/migrations/20260711120000_business_write_pass_owner.sql:6` ⚠ | --   has_business_role(..., 'owner') VEYA kurum hesabinin kendisi. manager YAPAMAZ. (yorum) | yardimci-tanim — Bu paketin owner esigiyle calistigini anlatan aciklama satiri. | **A** | incelenmeli — owner esiginin hangi izin anahtariyla karsilanacagi belirlenince aciklama guncellenir. |
| 304 | `supabase/migrations/20260711120000_business_write_pass_owner.sql:11` ⚠ | -- Rol helper'lari: has_business_role(business_id, min_role) + is_business_member (yorum) | yardimci-tanim — Dosyanin dayandigi iki kurum uyelik yardimcisini isaret eden aciklama satiri. | **A** | incelenmeli — helper govdeleri degistiginde aciklama guncellenir. |
| 305 | `supabase/migrations/20260711120000_business_write_pass_owner.sql:63` | OR has_business_role(customer_id, 'owner') ("Customers can create reviews for their conversations" INSERT) | RLS — owner rolundeki kurum uyesinin kurum adina degerlendirme yazmasina izin verir. | **A** | has_org_permission(customer_id, 'commercial.manage') |
| 306 | `supabase/migrations/20260711120000_business_write_pass_owner.sql:78` | OR has_business_role(customer_id, 'owner') ("Customers can update their own reviews" UPDATE USING) | RLS — owner rolundeki kurum uyesinin kurum adina yazilmis degerlendirmeyi guncellemesine izin verir. | **A** | has_org_permission(customer_id, 'commercial.manage') |
| 307 | `supabase/migrations/20260711120000_business_write_pass_owner.sql:82` | OR has_business_role(customer_id, 'owner') (ayni politikanin WITH CHECK dali) | RLS — Guncelleme sonrasi degerlendirmenin de kurum yetkisi kapsaminda kalmasini zorunlu kilar. | **A** | has_org_permission(customer_id, 'commercial.manage') |
| 308 | `supabase/migrations/20260711120000_business_write_pass_owner.sql:90` | OR has_business_role(customer_id, 'owner') ("Customers can delete their own reviews" DELETE) | RLS — owner rolundeki kurum uyesinin kurum adina yazilmis degerlendirmeyi silmesine izin verir. | **A** | has_org_permission(customer_id, 'commercial.manage') |
| 309 | `supabase/migrations/20260711120000_business_write_pass_owner.sql:103` | OR has_business_role(creator_id, 'owner') ("Users delete their own draft listings" DELETE; status IN ('draft', | RLS — owner rolundeki kurum uyesinin kurumun taslak/iptal ilanini silmesine izin verir. | **A** | has_org_permission(creator_id, 'commercial.manage') |
| 310 | `supabase/migrations/20260711120000_business_write_pass_owner.sql:125` | OR has_business_role(l.creator_id, 'manager') ("Inviter creates invitations to own published listing" INSERT) | RLS — manager ve ustu kurum uyesinin kurumun yayindaki ilanina profesyonel davet etmesine izin verir. | **A** | has_org_permission(l.creator_id, 'crew.manage') |
| 311 | `supabase/migrations/20260711120000_business_write_pass_owner.sql:137` ⚠ | --    ve diger uyeler de daveti gorebilir (is_business_member — tum uyeler). (yorum) | yardimci-tanim — Alttaki SELECT politikasinin tum kurum uyelerini kapsadigini anlatan aciklama satiri. | **A** | incelenmeli — politika satir 152'de, donusum orada yapilir. |
| 312 | `supabase/migrations/20260711120000_business_write_pass_owner.sql:152` | AND is_business_member(l.creator_id) ("Business members see team listing invitations" SELECT) | RLS — Kurum uyesinin, kurum ilanina gonderilmis davetleri gormesine izin verir. | **A** | has_org_permission(l.creator_id, 'crew.view') |
| 313 | `supabase/migrations/20260711120000_profil_redesign_adim1.sql:24` ⚠ | --   • BLACKLIST (yalniz role/is_admin/approval_status gibi alanlari koruyorsa) → dokunma; ... (yorum) | yardimci-tanim — Repoda bulunmayan protect_sensitive_profile_fields trigger'inin hangi alanlari koruyor olabilecegini tartisan aciklama satiri. | **C** | incelenmeli — protect_sensitive_profile_fields govdesi panelden okunup siniflandirilmali. |
| 314 | `supabase/migrations/20260712120000_invitation_cancel_and_touches.sql:10` ⚠ | --     invitations" SELECT politikasi yalniz is_business_member(creator_id) diyor; (yorum) | yardimci-tanim — Onceki SELECT politikasinin kurum hesabini kapsamamasindan kaynaklanan hatayi anlatan aciklama satiri. | **A** | incelenmeli — politikanin son hali satir 87'de, donusum orada yapilir. |
| 315 | `supabase/migrations/20260712120000_invitation_cancel_and_touches.sql:11` ⚠ | --     is_business_member kurum HESABINI kapsamaz (no_self_business_membership → ...) (yorum) | yardimci-tanim — Uyelik yardimcisinin kurum hesabinin kendisini kapsamadigini anlatan aciklama satiri. | **A** | incelenmeli — kurum hesabi organizations'a tasininca bu istisna yeniden degerlendirilir. |
| 316 | `supabase/migrations/20260712120000_invitation_cancel_and_touches.sql:18` ⚠ | -- NOT (helper kapsami): has_business_role + is_business_member kurum HESABINI (yorum) | yardimci-tanim — Iki uyelik yardimcisinin da kurum hesabini kapsamadigini kaydeden aciklama satiri. | **A** | incelenmeli — helper govdeleri organization_memberships'a cevrilince bu not gecersizlesir. |
| 317 | `supabase/migrations/20260712120000_invitation_cancel_and_touches.sql:35` ⚠ | --                   AND is_business_member(l.creator_id))) (geri donus notu yorumu) | yardimci-tanim — Yeniden yazilan SELECT politikasinin onceki halini kaydeden geri donus notu. | **A** | incelenmeli — politikanin yururlukteki hali satir 87'dedir. |
| 318 | `supabase/migrations/20260712120000_invitation_cancel_and_touches.sql:55` | OR has_business_role(l.creator_id, 'manager') ("Inviter or invited update invitation" UPDATE USING) | RLS — manager ve ustu kurum uyesinin, bir baska uyenin gonderdigi ilan davetini iptal etmesine izin verir. | **A** | has_org_permission(l.creator_id, 'crew.manage') |
| 319 | `supabase/migrations/20260712120000_invitation_cancel_and_touches.sql:67` | OR has_business_role(l.creator_id, 'manager') (ayni politikanin WITH CHECK dali) | RLS — Guncelleme sonrasi davet satirinin da kurum yetkisi kapsaminda kalmasini zorunlu kilar. | **A** | has_org_permission(l.creator_id, 'crew.manage') |
| 320 | `supabase/migrations/20260712120000_invitation_cancel_and_touches.sql:74` ⚠ | --     gorebilsin. is_business_member kurum hesabini kapsamadigindan creator_id (yorum) | yardimci-tanim — Alttaki SELECT politikasina neden ayri bir creator_id dali eklendigini anlatan aciklama satiri. | **A** | incelenmeli — politika satir 87'de, donusum orada yapilir. |
| 321 | `supabase/migrations/20260712120000_invitation_cancel_and_touches.sql:87` | OR is_business_member(l.creator_id) ("Business members see team listing invitations" SELECT; ust dal l.creator | RLS — Kurum uyesinin ve kurum hesabinin, kurum ilanina gonderilmis davetleri gormesine izin verir. | **A** | has_org_permission(l.creator_id, 'crew.view') |
| 322 | `supabase/migrations/20260713120000_admin_preview_select.sql:14` ⚠ | -- Admin gate KONVANSIYONU: bu repoda RLS icin is_admin() SQL fonksiyonu YOK; admin (yorum) | yardimci-tanim — Admin kontrolunun politikalarda inline EXISTS ile yapildigini kaydeden aciklama satiri. | **C** | incelenmeli — platform admin kontrolu oldugu gibi kalir, has_org_permission'a donusmez. |
| 323 | `supabase/migrations/20260713120000_admin_preview_select.sql:16` ⚠ | -- AND p.is_admin=true) ile yapilir (kaynak: 20260716120000_testimonials.sql). (yorum) | yardimci-tanim — Inline admin kontrolu kalibinin kaynagini gosteren aciklama satiri. | **C** | incelenmeli — platform admin kontrolu oldugu gibi kalir, has_org_permission'a donusmez. |
| 324 | `supabase/migrations/20260713120000_admin_preview_select.sql:37` | EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true) (portfolio_admin_read S | RLS — Platform yoneticisinin yayinda olmayan portfoy ogelerini onizlemede okumasina izin verir. | **C** | incelenmeli — platform admin kontrolu oldugu gibi kalir, has_org_permission'a donusmez. |
| 325 | `supabase/migrations/20260713120000_admin_preview_select.sql:46` | EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true) (services_admin_read SE | RLS — Platform yoneticisinin yayinda olmayan hizmetleri onizlemede okumasina izin verir. | **C** | incelenmeli — platform admin kontrolu oldugu gibi kalir, has_org_permission'a donusmez. |
| 326 | `supabase/migrations/20260713120000_admin_preview_select.sql:55` | EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true) (service_addons_admin_r | RLS — Platform yoneticisinin hizmet ek secenklerini onizlemede okumasina izin verir. | **C** | incelenmeli — platform admin kontrolu oldugu gibi kalir, has_org_permission'a donusmez. |
| 327 | `supabase/migrations/20260713120000_admin_preview_select.sql:64` | EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true) (service_packages_admin | RLS — Platform yoneticisinin hizmet paketlerini onizlemede okumasina izin verir. | **C** | incelenmeli — platform admin kontrolu oldugu gibi kalir, has_org_permission'a donusmez. |
| 328 | `supabase/migrations/20260713120000_admin_preview_select.sql:73` | EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true) (profile_experiences_ad | RLS — Platform yoneticisinin profil deneyim/egitim/odul satirlarini onizlemede okumasina izin verir. | **C** | incelenmeli — platform admin kontrolu oldugu gibi kalir, has_org_permission'a donusmez. |
| 329 | `supabase/migrations/20260713120000_admin_preview_select.sql:82` | EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true) (availability_blocks_ad | RLS — Platform yoneticisinin musaitlik takvimi satirlarini onizlemede okumasina izin verir. | **C** | incelenmeli — platform admin kontrolu oldugu gibi kalir, has_org_permission'a donusmez. |
| 330 | `supabase/migrations/20260713120000_admin_preview_select.sql:91` | EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true) (agency_members_admin_r | RLS — Platform yoneticisinin ajans uyelik satirlarini onizlemede okumasina izin verir. | **C** | incelenmeli — tablo organization_memberships'a tasininca admin okumasinin yeni tabloda karsiliginin kurulmasi gerekir. |
| 331 | `supabase/migrations/20260715130000_admin_report_stats.sql:9` ⚠ | -- is_admin() drift fonksiyonuna YENI bagimlilik yok). (yorum) | yardimci-tanim — Fonksiyonun ic guard'inda hangi admin kalibinin kullanildigini kaydeden aciklama satiri. | **C** | incelenmeli — platform admin kontrolu oldugu gibi kalir, has_org_permission'a donusmez. |
| 332 | `supabase/migrations/20260715130000_admin_report_stats.sql:25` | WHERE p.id = auth.uid() AND p.is_admin = true (admin_report_stats ic guard'i; degilse RAISE EXCEPTION) | is-mantigi — SECURITY DEFINER rapor fonksiyonunu admin disindaki cagirana kapatir. | **C** | incelenmeli — platform admin kontrolu oldugu gibi kalir, has_org_permission'a donusmez. |
| 333 | `supabase/migrations/20260716120000_testimonials.sql:7` ⚠ | -- Admin gate: bu repoda RLS icin `is_admin()` SQL fonksiyonu YOK (admin kontrolu app (yorum) | yardimci-tanim — Admin kontrolunun neden inline yazildigini anlatan aciklama satiri. | **C** | incelenmeli — platform admin kontrolu oldugu gibi kalir, has_org_permission'a donusmez. |
| 334 | `supabase/migrations/20260716120000_testimonials.sql:8` ⚠ | -- katmaninda profiles.is_admin okunarak yapiliyor). Bu yuzden politikalar kendine yeterli (yorum) | yardimci-tanim — Admin kontrolunun uygulama katmaninda profiles.is_admin ile yapildigini kaydeden aciklama satiri. | **C** | incelenmeli — platform admin kontrolu oldugu gibi kalir, has_org_permission'a donusmez. |
| 335 | `supabase/migrations/20260716120000_testimonials.sql:9` ⚠ | -- sekilde profiles.is_admin sutununu inline EXISTS ile kontrol eder (helper bagimliligi yok). (yorum) | yardimci-tanim — Politikalarin is_admin sutununu inline EXISTS ile okudugunu kaydeden aciklama satiri. | **C** | incelenmeli — platform admin kontrolu oldugu gibi kalir, has_org_permission'a donusmez. |
| 336 | `supabase/migrations/20260716120000_testimonials.sql:46` | WHERE p.id = auth.uid() AND p.is_admin = true (testimonials_admin_all FOR ALL, USING dali) | RLS — Platform yoneticisinin yayinda olmayan gorusleri de okumasina ve yazma islemlerini yapmasina izin verir. | **C** | incelenmeli — platform admin kontrolu oldugu gibi kalir, has_org_permission'a donusmez. |
| 337 | `supabase/migrations/20260716120000_testimonials.sql:52` | WHERE p.id = auth.uid() AND p.is_admin = true (testimonials_admin_all WITH CHECK dali) | RLS — Yazilan/guncellenen gorus satirinin da yalnizca platform yoneticisi tarafindan olusturulabilmesini zorunlu kilar. | **C** | incelenmeli — platform admin kontrolu oldugu gibi kalir, has_org_permission'a donusmez. |

⚠ = ajan, verilen satirda kontrolun tam olarak durmadigini isaretledi (cogunlukla yorum satiri ya da bir-iki satir kayma).

---

## 3. SINIFLANDIRMA

### GRUP A — Kurulus izniyle degistirilecek (66 bulgu)

Event OS / Buyer Workspace erisimi. Kurulus ici yetki sorusu: "bu kullanici bu kurulusun verisini gorebilir/degistirebilir mi".

| Dosya | Satirlar | Adet |
|---|---|---|
| `supabase/migrations/20260711120000_business_write_pass_owner.sql` | 6, 11, 63, 78, 82, 90, 103, 125, 137, 152 | 10 |
| `supabase/migrations/20260708120000_business_write_pass_create.sql` | 9, 58, 70, 81, 85, 108, 127, 141 | 8 |
| `supabase/migrations/20260712120000_invitation_cancel_and_touches.sql` | 10, 11, 18, 35, 55, 67, 74, 87 | 8 |
| `supabase/migrations/20260701120000_business_member_shared_visibility.sql` | 19, 25, 31, 37, 46, 56, 66 | 7 |
| `supabase/migrations/20260630120000_add_business_members_and_invitations.sql` | 13, 27, 149, 157, 183, 237 | 6 |
| `app/components/sections/top-nav.tsx` | 40, 43, 72, 80, 190 | 5 |
| `supabase/migrations/20260710120000_business_write_pass_accept.sql` | 6, 49, 67, 85 | 4 |
| `supabase/migrations/20260707120000_business_write_pass_messages.sql` | 36, 78, 97 | 3 |
| `app/components/sections/mobile-nav.tsx` | 17, 31 | 2 |
| `app/lib/profile-helpers.ts` | 22, 23 | 2 |
| `app/profil/page.tsx` | 14, 64 | 2 |
| `app/ajans/agency-actions.ts` | 57 | 1 |
| `app/ilanlar/[id]/page.tsx` | 59 | 1 |
| `app/ilanlar/invitations-actions.ts` | 309 | 1 |
| `app/kurumsal/business-actions.ts` | 57 | 1 |
| `app/lib/premium.ts` | 48 | 1 |
| `app/mesajlar/[id]/page.tsx` | 252 | 1 |
| `app/profil/ekibim/page.tsx` | 33 | 1 |
| `app/profil/kurumsal-ekip/page.tsx` | 33 | 1 |
| `supabase/migrations/20260520071330_add_agency_role_and_members.sql` | 202 | 1 |

### GRUP B — Pazaryeri rolu olarak kalacak (216 bulgu)

Kim satici kim alici ayrimi. Kurulustan bagimsiz, pazaryerinin kendi ayrimi.

| Dosya | Satirlar | Adet |
|---|---|---|
| `app/p/[id]/page.tsx` | 74, 76, 82, 141, 143, 153, 198, 270, 409, 453, 540, 619, 724 | 13 |
| `app/components/sections/top-nav.tsx` | 30, 37, 38, 39, 41, 65, 85, 89, 96, 187, 188, 189 | 12 |
| `app/kesfet/profile-card.tsx` | 152, 155, 160, 205, 211, 265, 301, 339, 388 | 9 |
| `app/admin/profiller/page.tsx` | 14, 71, 72, 73, 74, 95, 185, 213 | 8 |
| `app/admin/rapor/route.ts` | 26, 154, 166, 167, 222, 255, 262, 284 | 8 |
| `app/ilanlar/[id]/ilan-detay.tsx` | 89, 108, 626, 694, 738, 757, 776, 789 | 8 |
| `app/lib/profile-helpers.ts` | 14, 15, 18, 19, 71, 90, 118, 126 | 8 |
| `app/admin/kullanicilar/page.tsx` | 75, 76, 242, 286, 312, 352 | 6 |
| `app/components/sections/mobile-nav.tsx` | 14, 15, 16, 28, 29, 30 | 6 |
| `app/lib/ai-actions.ts` | 125, 149, 453, 478, 487, 555 | 6 |
| `app/mesajlar/actions.ts` | 204, 209, 271, 276, 385, 386 | 6 |
| `app/profil/duzenle/duzenle-form.tsx` | 64, 87, 88, 97, 104, 109 | 6 |
| `app/profil/page.tsx` | 11, 12, 61, 62, 317, 1009 | 6 |
| `app/rezervasyon/[id]/actions.ts` | 61, 63, 279, 284, 347, 352 | 6 |
| `app/mesajlar/[id]/konusma-detay.tsx` | 41, 134, 217, 892, 975 | 5 |
| `app/admin/yorumlar/page.tsx` | 259, 260, 268, 269 | 4 |
| `app/ilanlar/listings-actions.ts` | 111, 557, 605, 608 | 4 |
| `app/ilanlar/yeni/yeni-ilan-formu.tsx` | 241, 243, 251, 318 | 4 |
| `app/mesajlar/[id]/karsi-taraf-paneli.tsx` | 27, 30, 43, 45 | 4 |
| `app/mesajlar/[id]/page.tsx` | 151, 157, 248, 287 | 4 |
| `app/mesajlar/quote-actions.ts` | 371, 376, 440, 445 | 4 |
| `app/teklif-topla/teklif-topla-formu.tsx` | 49, 119, 206, 208 | 4 |
| `app/kesfet/page.tsx` | 35, 160, 162 | 3 |
| `app/profil/duzenle/actions.ts` | 52, 159, 171 | 3 |
| `app/rezervasyon/[id]/page.tsx` | 175, 177, 184 | 3 |
| `app/teklif-topla/actions.ts` | 31, 87, 92 | 3 |
| `app/admin/page.tsx` | 74, 239 | 2 |
| `app/components/sections/featured-profiles.tsx` | 117, 185 | 2 |
| `app/favoriler/actions.ts` | 41, 59 | 2 |
| `app/favoriler/page.tsx` | 97, 314 | 2 |
| `app/ilanlar/[id]/page.tsx` | 85, 269 | 2 |
| `app/ilanlar/yeni/page.tsx` | 59, 60 | 2 |
| `app/ilanlarim/page.tsx` | 51, 66 | 2 |
| `app/kazanclarim/page.tsx` | 52, 78 | 2 |
| `app/lib/discover-base.ts` | 17, 42 | 2 |
| `app/lib/premium.ts` | 23, 36 | 2 |
| `app/p/[id]/yorumlar/page.tsx` | 34, 68 | 2 |
| `app/profil/deneyim/page.tsx` | 5, 36 | 2 |
| `app/profil/hizmetlerim/page.tsx` | 6, 41 | 2 |
| `app/profil/kategori-bilgileri/page.tsx` | 5, 38 | 2 |
| `app/profil/paketler/page.tsx` | 6, 37 | 2 |
| `app/profil/portfoy/page.tsx` | 7, 39 | 2 |
| `app/uye-ol/uye-ol-form.tsx` | 68, 75 | 2 |
| `supabase/migrations/20260520151810_fix_handle_new_user_for_agency.sql` | 63, 66 | 2 |
| `app/admin/istatistikler/page.tsx` | 64 | 1 |
| `app/admin/kategori-talepleri/page.tsx` | 213 | 1 |
| `app/admin/kullanicilar/kullanici-aksiyonlar.tsx` | 123 | 1 |
| `app/admin/sikayetler/page.tsx` | 126 | 1 |
| `app/ajans/agency-actions.ts` | 202 | 1 |
| `app/auth/callback/route.ts` | 52 | 1 |
| `app/auth/confirm/route.ts` | 82 | 1 |
| `app/basvurularim/page.tsx` | 35 | 1 |
| `app/components/sections/category-marquee.tsx` | 52 | 1 |
| `app/components/sections/marquee-profiles.ts` | 80 | 1 |
| `app/davetlerim/page.tsx` | 149 | 1 |
| `app/etkinlik-sihirbazi/page.tsx` | 53 | 1 |
| `app/ilanlar/invitations-actions.ts` | 70 | 1 |
| `app/ilanlar/page.tsx` | 20 | 1 |
| `app/kategori/[slug]/page.tsx` | 135 | 1 |
| `app/kategoriler/page.tsx` | 85 | 1 |
| `app/mesajlar/mesaj-listesi.tsx` | 220 | 1 |
| `app/odemelerim/page.tsx` | 96 | 1 |
| `app/premium/actions.ts` | 47 | 1 |
| `app/premium/page.tsx` | 31 | 1 |
| `app/profil/kategori-bilgileri/actions.ts` | 90 | 1 |
| `app/rezervasyonlarim/rezervasyon-karti.tsx` | 101 | 1 |
| `app/sitemap.ts` | 58 | 1 |
| `app/takvimim/page.tsx` | 57 | 1 |
| `app/teklif-talepleri/page.tsx` | 29 | 1 |
| `supabase/migrations/20260518000000_initial_schema.sql` | 430 | 1 |
| `supabase/migrations/20260519133753_add_listings_and_applications.sql` | 191 | 1 |

### GRUP C — Kararsiz / incelenmeli (55 bulgu)

Hangi gruba girdigi koddan net degil. Karar verilmeden donusturulmemeli.

| Dosya | Satirlar | Adet |
|---|---|---|
| `supabase/migrations/20260713120000_admin_preview_select.sql` | 14, 16, 37, 46, 55, 64, 73, 82, 91 | 9 |
| `app/ilanlar/[id]/ilan-detay.tsx` | 130, 940, 948, 1033, 1234 | 5 |
| `supabase/migrations/20260716120000_testimonials.sql` | 7, 8, 9, 46, 52 | 5 |
| `app/ilanlar/listings-actions.ts` | 671, 672, 872, 873 | 4 |
| `app/lib/profile-helpers.ts` | 26, 27, 83, 123 | 4 |
| `supabase/migrations/20260708120000_business_write_pass_create.sql` | 22, 90, 96 | 3 |
| `app/davetlerim/page.tsx` | 146, 155 | 2 |
| `app/p/[id]/page.tsx` | 75, 142 | 2 |
| `app/profil/duzenle/duzenle-form.tsx` | 11, 105 | 2 |
| `app/profil/page.tsx` | 13, 63 | 2 |
| `app/teklif-topla/page.tsx` | 58, 61 | 2 |
| `supabase/migrations/20260715130000_admin_report_stats.sql` | 9, 25 | 2 |
| `app/admin/kullanicilar/kullanici-aksiyonlar.tsx` | 128 | 1 |
| `app/kurumsal/business-actions.ts` | 201 | 1 |
| `app/lib/email/account-emails.ts` | 101 | 1 |
| `app/mesajlar/[id]/page.tsx` | 201 | 1 |
| `app/teklif-topla/actions.ts` | 70 | 1 |
| `app/uye-ol/ajans/ajans-uye-ol-form.tsx` | 69 | 1 |
| `app/uye-ol/uye-ol-form.tsx` | 82 | 1 |
| `supabase/functions/send-message-notification/index.ts` | 113 | 1 |
| `supabase/migrations/20260518000000_initial_schema.sql` | 434 | 1 |
| `supabase/migrations/20260520071330_add_agency_role_and_members.sql` | 8 | 1 |
| `supabase/migrations/20260520151810_fix_handle_new_user_for_agency.sql` | 58 | 1 |
| `supabase/migrations/20260701120000_business_member_shared_visibility.sql` | 4 | 1 |
| `supabase/migrations/20260711120000_profil_redesign_adim1.sql` | 24 | 1 |

---

## 4. DENETIMDE BULUNAN EK BULGULAR (ilk taramanin kacirdiklari)

Bunlar ilk grep desenine takilmadi; adversarial denetim ajani buldu ve **her biri elle dogrulandi**.

### 4a. 🔴 EN BUYUK BOSLUK — `app/lib/business-write.ts`

Bu dosya **bugun fiilen `has_org_permission`in uygulama karsiligi**. Kurum adina yazma yetkisini
`member_role IN ('owner','manager')` esigiyle veriyor. `role` degil `member_role` kullandigi icin
ilk tarama desenine **hic girmedi** — envanterde sifir kayitla temsil ediliyordu.

| Fonksiyon | Esik | Cagri yeri |
|---|---|---|
| `getWritableBusinesses()` | `member_role IN (owner, manager)` | 11 |
| `canWriteForBusiness(businessId)` | `owner` veya `manager` | 22 |
| `canOwnForBusiness(businessId)` | yalniz `owner` | 9 |
| `getOwnedBusinessIds()` | yalniz `owner` | 3 |
| `getTeamContext()` | uyelik baglami | 13 |
| `hasTeamAccess` | uyelik baglami | 2 |

**Toplam 60 cagri yeri / 18 dosya.** Tamami **GRUP A**.

<details><summary>60 cagri yerinin tam listesi</summary>

| Dosya:satir | Fonksiyon |
|---|---|
| `app/components/sections/top-nav.tsx:10` | getWritableBusinesses |
| `app/components/sections/top-nav.tsx:34` | getWritableBusinesses |
| `app/ilanlar/[id]/duzenle/page.tsx:6` | canWriteForBusiness |
| `app/ilanlar/[id]/duzenle/page.tsx:52` | canWriteForBusiness |
| `app/ilanlar/[id]/page.tsx:9` | canWriteForBusiness |
| `app/ilanlar/[id]/page.tsx:10` | canOwnForBusiness |
| `app/ilanlar/[id]/page.tsx:64` | canWriteForBusiness |
| `app/ilanlar/[id]/page.tsx:70` | canOwnForBusiness |
| `app/ilanlar/invitations-actions.ts:7` | canWriteForBusiness |
| `app/ilanlar/invitations-actions.ts:8` | getWritableBusinesses |
| `app/ilanlar/invitations-actions.ts:54` | canWriteForBusiness |
| `app/ilanlar/invitations-actions.ts:320` | canWriteForBusiness |
| `app/ilanlar/invitations-actions.ts:366` | getWritableBusinesses |
| `app/ilanlar/listings-actions.ts:7` | canWriteForBusiness |
| `app/ilanlar/listings-actions.ts:96` | canWriteForBusiness |
| `app/ilanlar/listings-actions.ts:206` | canWriteForBusiness |
| `app/ilanlar/listings-actions.ts:362` | canWriteForBusiness |
| `app/ilanlar/listings-actions.ts:369` | canOwnForBusiness |
| `app/ilanlar/listings-actions.ts:480` | canOwnForBusiness |
| `app/ilanlar/listings-actions.ts:590` | canWriteForBusiness |
| `app/ilanlar/listings-actions.ts:768` | canWriteForBusiness |
| `app/ilanlar/listings-actions.ts:928` | canOwnForBusiness |
| `app/ilanlar/listings-actions.ts:1081` | canWriteForBusiness |
| `app/ilanlar/listings-actions.ts:1348` | canOwnForBusiness |
| `app/ilanlar/listings-actions.ts:1402` | canOwnForBusiness |
| `app/ilanlar/listings-actions.ts:1471` | canOwnForBusiness |
| `app/ilanlar/yeni/page.tsx:7` | getWritableBusinesses |
| `app/ilanlar/yeni/page.tsx:62` | getWritableBusinesses |
| `app/ilanlarim/page.tsx:8` | getTeamContext |
| `app/ilanlarim/page.tsx:60` | getTeamContext |
| `app/ilanlarim/page.tsx:62` | hasTeamAccess |
| `app/ilanlarim/page.tsx:66` | hasTeamAccess |
| `app/lib/business-write.ts:13` | getWritableBusinesses |
| `app/lib/business-write.ts:43` | canWriteForBusiness |
| `app/lib/business-write.ts:70` | canOwnForBusiness |
| `app/lib/business-write.ts:92` | getOwnedBusinessIds |
| `app/lib/business-write.ts:119` | getTeamContext |
| `app/mesajlar/[id]/page.tsx:9` | getTeamContext |
| `app/mesajlar/[id]/page.tsx:64` | getTeamContext |
| `app/mesajlar/actions.ts:6` | canWriteForBusiness |
| `app/mesajlar/actions.ts:332` | canWriteForBusiness |
| `app/mesajlar/page.tsx:7` | getTeamContext |
| `app/mesajlar/page.tsx:64` | getTeamContext |
| `app/mesajlar/quote-actions.ts:5` | canWriteForBusiness |
| `app/mesajlar/quote-actions.ts:209` | canWriteForBusiness |
| `app/mesajlar/quote-actions.ts:281` | canWriteForBusiness |
| `app/p/[id]/page.tsx:7` | getWritableBusinesses |
| `app/p/[id]/page.tsx:265` | getWritableBusinesses |
| `app/teklif-taleplerim/[id]/page.tsx:7` | getTeamContext |
| `app/teklif-taleplerim/[id]/page.tsx:50` | getTeamContext |
| `app/teklif-taleplerim/[id]/page.tsx:52` | getTeamContext |
| `app/teklif-taleplerim/page.tsx:7` | getTeamContext |
| `app/teklif-taleplerim/page.tsx:34` | getTeamContext |
| `app/teklif-taleplerim/page.tsx:36` | getTeamContext |
| `app/teklif-topla/actions.ts:10` | canWriteForBusiness |
| `app/teklif-topla/actions.ts:56` | canWriteForBusiness |
| `app/teklif-topla/page.tsx:9` | getWritableBusinesses |
| `app/teklif-topla/page.tsx:60` | getWritableBusinesses |
| `app/yorumlar/actions.ts:6` | getOwnedBusinessIds |
| `app/yorumlar/actions.ts:63` | getOwnedBusinessIds |

</details>

**Onerilen yeni hal:** bu bes fonksiyon `has_org_permission(orgId, ...)` cagrisina cevrilir.
Esik eslemesi: `canWriteForBusiness` → `events.manage` / `commercial.manage` (cagri yerine gore),
`canOwnForBusiness` → `settings.manage` veya `members.manage`, `getWritableBusinesses` → uyelik listesi sorgusu.
Kesin eslemeyi cagri yeri bazinda belirlemek gerekir; burada tek tip esleme **onerilmez**.

### 4b. SQL govdesindeki rol kapilari ve `role IN (...)` (7 bulgu)

Ilk desen yalniz TS bicimi `===`/`!==` yakaliyordu; SQL `!=` ve `IN (...)` kacti.

| Dosya:satir | Kontrol | Baglam | Sinif |
|---|---|---|---|
| `supabase/migrations/20260520071330_add_agency_role_and_members.sql:79` | `IF agency_role != 'agency' THEN` | is-mantigi — validate_agency_membership_roles: uyelik satirindaki ajansin gercekten agency rolunde olmasini zorlar. | **A** |
| `supabase/migrations/20260520071330_add_agency_role_and_members.sql:83` | `IF professional_role != 'professional' THEN` | is-mantigi — Ayni tetikleyicide uye tarafinin professional olmasini zorlar. | **B** |
| `supabase/migrations/20260520071330_add_agency_role_and_members.sql:246` | `IF accepter_role != 'professional' THEN` | is-mantigi — Ajans davetini kabul edenin professional olmasini zorlar. | **B** |
| `supabase/migrations/20260630120000_add_business_members_and_invitations.sql:85` | `IF owner_role != 'business' THEN` | is-mantigi — validate_business_membership_roles: kurum tarafinin business rolunde olmasini zorlar. | **A** |
| `supabase/migrations/20260519133753_add_listings_and_applications.sql:147` | `AND p.role IN ('client', 'business')` | RLS — Ilan olusturmayi alici tarafina kisitlar. | **A** |
| `supabase/migrations/20260708120000_business_write_pass_create.sql:124` | `AND p.role IN ('client', 'business')` | RLS — Teklif talebi olusturmayi alici tarafina kisitlar. | **A** |
| `supabase/migrations/20260711120000_business_write_pass_owner.sql:131` | `AND p.role IN ('professional', 'agency')` | RLS — Davet edilenin satici tarafi olmasini zorlar. | **B** |

### 4c. Rol kumesinin kendi tanimi

| Dosya:satir | Icerik |
|---|---|
| `supabase/migrations/20260518000000_initial_schema.sql:398` | `profiles_role_check CHECK (role = ANY (ARRAY[professional, client, business]))` — **agency YOK** |
| `supabase/migrations/20260520071330_add_agency_role_and_members.sql:20-23` | Kisit dusurulup `agency` eklenmis hali |
| `app/lib/types.ts:2` | `export type UserRole = professional \| client \| business \| agency` |

Rol kumesi **iki ayri yerde** tanimli (DB CHECK + TS union). Goc sirasinda ikisi ayri ayri guncellenmeli.

---

## 5. RISK NOTLARI

### 5a. 🔴 TS tarafinda tek kaynak YOK

| Durum | Dosya |
|---|---|
| Yalniz **elle** karsilastirma (`role === 'x'`) | **36** |
| Yalniz **yardimci** (`isProfessional()` vb.) | 6 |
| **Ikisini birden** kullanan | 13 |

`app/lib/profile-helpers.ts` yardimcilari var ama dosyalarin **cogunlugu kullanmiyor**.
Goc sirasinda yardimci govdesini degistirmek yetmez; 36 dosyadaki elle yazilmis kontrol tek tek bulunmali.
Ikisini birden kullanan 13 dosya en tehlikelisi: yardimci guncellenince yarisi doner, yarisi eski kalir.

<details><summary>Ikisini birden kullanan 13 dosya</summary>

- `app/components/sections/top-nav.tsx`
- `app/ilanlar/[id]/ilan-detay.tsx`
- `app/ilanlar/[id]/page.tsx`
- `app/ilanlar/invitations-actions.ts`
- `app/kesfet/profile-card.tsx`
- `app/lib/ai-actions.ts`
- `app/lib/profile-helpers.ts`
- `app/mesajlar/[id]/konusma-detay.tsx`
- `app/mesajlar/[id]/page.tsx`
- `app/profil/duzenle/duzenle-form.tsx`
- `app/profil/page.tsx`
- `app/rezervasyon/[id]/actions.ts`
- `app/rezervasyon/[id]/page.tsx`

</details>

### 5b. 🔴 CLAUDE.md yetkilendirme listesi kismen gercek degil

CLAUDE.md alti yetkilendirme fonksiyonu sayiyor. Migration'larda gercek durum:

| Fonksiyon | Migration'da tanim | Migration'da cagri | Durum |
|---|---|---|---|
| `has_business_role` | VAR | 26 | ✓ |
| `is_business_member` | VAR | 20 | ✓ |
| `is_admin` | **YOK** | yalniz yorum | Migration'lar acikca "bu repoda YOK" diyor |
| `is_professional_or_agency` | **YOK** | **YOK** | Repoda hic gecmiyor |
| `is_assignee` | **YOK** | yalniz 1 yorum | Tanim ve cagri yok |
| `owns_quote_request` | **YOK** | **VAR** | 🔴 **DRIFT** |

**`owns_quote_request` drifti:** `supabase/migrations/20260708120000_business_write_pass_create.sql:96`
satirindaki canli politika, repoda `CREATE FUNCTION` tanimi **bulunmayan** bir fonksiyona bagimli.
Migration zinciri sifirdan calistirilirsa bu politika **basarisiz olur**. Fonksiyon canli veritabaninda
elle olusturulmus olmali. Goc oncesi tanimin repoya alinmasi gerekir.

**Admin kapisi tek yerden yonetilmiyor:** `is_admin()` olmadigi icin admin kontrolu
`EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)`
kalibiyla **11 yerde / 3 dosyada** satir ici tekrarlaniyor
(`20260713120000_admin_preview_select.sql` x8, `20260716120000_testimonials.sql` x2, `20260715130000_admin_report_stats.sql` x1).
Bu kalip `profiles.is_admin` sutununu okur; sutun **profiles'ta kalacagi** icin goc bunu bozmaz,
ama tek yerden yonetilmedigi icin ileride ayni riski tasir.

### 5c. Siniflandirma tutarsizliklari (denetim ajaninin tespiti)

Ayni mantiksal kontrol farkli yerlerde farkli sinifa konmus. Bunlar **karar bekliyor**:

| Konu | Celiskili siniflar | Yerler |
|---|---|---|
| Alici tarafi kapisi (`client \|\| business`) | A, B, C uc ayri | `top-nav.tsx:43,72` (A) · `listings-actions.ts:111`, `ilanlar/yeni/page.tsx:59,60`, `ilanlarim/page.tsx:51,66` (B) · `teklif-topla/actions.ts:70`, `teklif-topla/page.tsx:58,61` (C) |
| `isBusiness` tanimi vs kullanimi | tanim A, kullanim C | `profile-helpers.ts:22,23` (A) · `profil/page.tsx:13,63`, `duzenle-form.tsx:11,105` (C) |
| `isAgency` tanimi vs kullanimi | tanim C, kullanim A/B | `profile-helpers.ts:26,27` (C) · `profil/page.tsx:14,64` (A) · `top-nav.tsx:39` (B) |
| Gorunen-ad secimi | ~30 B, 8 C | C olanlar: `send-message-notification/index.ts:113`, `ilan-detay.tsx:130,1033,1234`, `listings-actions.ts:671,672,872,873` |
| Profil tamlik kurallari | professional B, business C | `profile-helpers.ts:71,90,118,126` (B) · `:83,123` (C) · `initial_schema.sql:430` (B) · `:434` (C) |
| Premium uygunlugu | tanim A, tuketici B | `premium.ts:48` (A) · `premium.ts:23,36`, `premium/actions.ts:47` (B) |

**Neden onemli:** ayni kontrolun bir kopyasi donusturulup digeri birakilirsa yetki **sessizce ayrisir**.

### 5d. Satir uyusmazligi isaretli kayitlar

27 bulgu, ajan tarafindan "verilen satirda kontrol tam olarak durmuyor" diye isaretlendi.
Cogu yorum satiri ya da bir-iki satir kayma. Kapsama denetimi ~90 satiri dosyadan okuyup **kayma bulmadi**;
isaretler cogunlukla "bu satir yorum, gercek kontrol birkac satir asagida" anlaminda.

---

## 6. YONTEM VE SINIRLAR

- Satir numaralari `grep -n` ciktisindan alindi, `dosya:satir` ile tekillestirildi; hicbiri hesaplanmadi.
- Baglam ve sinif atamalari 10 paralel ajan tarafindan dosyalar okunarak yapildi (312/312 kapsama).
- Iki adversarial denetim ajani kapsama ve tekrar avi yapti; buldugu ek bulgular **elle dogrulandi**.
- Ilk grep deseni SQL `!=`, `IN (...)`, `.in('role',...)`, tip birlesimleri ve `member_role` kalibini
  kacirdi. Bunlar 4. bolumde ayrica raporlandi. **Desen tabanli envanterin sinirini gosterir:**
  yetki yuzeyi her zaman `role` kelimesiyle yazilmiyor.
- Sinif atamalari **oneridir**, karar degildir. C sinifi ve 5c'deki celiskiler karar bekliyor.
