# Claude Code gorevi — Duzeltme 02 / Menu sadelestirme: avatar menusu kisa baslatici, panel yan menusu katlanabilir bolumler

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: Sahne turu bulgusu #39 (`docs/sahne/bulgular.md`), kararlar Guven 3 Kasim 2026
(avatar menusu = kisa baslatici; yan menu = katlanabilir bolumler). Dal: `duzeltme-02` (Guven acar). **Migration YOK, DB YOK** — yalniz
uygulama. Commit ATMA.

---

Kashe reposundasin. Once `git status` (temiz; dal `duzeltme-02`). Oku: `CLAUDE.md`, `app/lib/panel-menu.ts` (menu TEK KAYNAGI:
`getPanelMenu`, `panelMenusu`, `menuyuDuzlestir`), `app/lib/panel-menu-tipler.ts`, `app/components/sections/top-nav.tsx` (avatar
menusu `UserMenu` + mobil `MobileNav` icin `menuLinks` uretimi), `app/components/sections/user-menu.tsx`, `app/components/sections/mobile-nav.tsx`,
`app/components/panel/panel-yan-menu.tsx` (gruplar, aktif madde, cekmece, hesap karti, "Siteye don" / "Cikis yap"),
`app/components/panel/panel-kabugu.tsx`, `app/lib/org-context.ts` (`CrewOrg` yetki bayraklari), `app/lib/ziyaretci.ts`.

**Sorun:** Ust bardaki avatar menusu panel yan menusunun TUM maddelerini duz listeye dokuyor (ajans sahibinde 16 satir + Admin + Cikis);
mobil hamburger ayni listeyi "Islerim" altinda gosteriyor. Panel yan menusunde ajans grubu 12 madde art arda (Gosterge ... Kazanclar),
kurumda 10, profesyonelde 6 + 6 "Profil icerigi". Kullanici ne yapacagini bulamiyor.

**Kararlar (degistirme):**
1. Avatar menusu ve mobil hamburger **kisa baslatici** olur: ad + rol satiri; "Panel" (kendi gostergesi) + role gore en cok kullanilan
   3-4 madde; Hesap (Profilim / Profili duzenle / Premium); Admin paneli (yonetici); Cikis yap. **En fazla 8 tiklanabilir satir**
   (Cikis dahil, baslik haric). Diger her sey panel yan menusunde.
2. Panel yan menusu **katlanabilir bolumler**: her kurulus/kisi grubu uc bolume ayrilir — **Calisma** (varsayilan ACIK), **Ekip ve
   kaynaklar**, **Yonetim** (varsayilan KAPALI); aktif sayfanin bolumu her zaman acik gelir. Bolum basligi tiklanir (chevron), durum
   oturum boyunca korunur (`localStorage` anahtari `kashe.panel-menu.<grupBaslik>.<bolum>`; okuma/yazma try/catch). "Profil icerigi"
   grubu (profesyonel) tek bolumlu katlanabilir grup olur (aktif degilse kapali). "Pazaryeri" ve "Hesap" gruplari oldugu gibi
   (bolumsuz, acik).
3. Menu modeli TEK KAYNAK kalir: hem baslatici hem yan menu `app/lib/panel-menu.ts`'ten uretilir; rol/izin kurali baska dosyaya
   yazilmaz. `menuyuDuzlestir` KALDIRILIR (yerine `baslaticiMenusu`).

**Kirmizi cizgi:** yetki kapisi menu degildir (madde yalniz kullanicinin girme hakki varsa yazilir — mevcut kural); hicbir sayfanin
erisimi/yetkisi degismez; menu maddelerinin href'leri degismez; sapkali harf yok, yorumlar ASCII, UI Turkce; `'use client'` yalniz
istemci bilesenlerinde (`panel-menu.ts` sunucu modulu kalir, tipler `panel-menu-tipler.ts`'te). Commit ATMA.

## 1) Model (`app/lib/panel-menu-tipler.ts` + `app/lib/panel-menu.ts`)

- `PanelMenuMaddesi`'ne iki istege bagli alan: `bolum?: 'calisma' | 'ekip' | 'yonetim'` (yan menu bolumu; yoksa grup bolumsuz
  render edilir) ve `oncelik?: boolean` (kisa baslaticida gosterilir).
- `PanelMenuGrubu`'na `katlanir?: boolean` (grup tek parca katlanir — "Profil icerigi" icin).
- Bolum etiketleri tek yerde: `export const BOLUM_ETIKETLERI = { calisma: 'Çalışma', ekip: 'Ekip ve kaynaklar', yonetim: 'Yönetim' }`
  (tipler dosyasinda; istemciye girer, sunucu importu yok).
- Yeni saf fonksiyon `baslaticiMenusu(gruplar, ziyaretci-ozeti)` → `{ panel: PanelMenuMaddesi | null; oncelikli: PanelMenuMaddesi[];
  hesap: PanelMenuMaddesi[] }`:
  - `panel`: ilk grubun (kisinin kendi grubu ya da ilk kurulus) ilk maddesi (Merkez / Gosterge). Etiket baslaticida "Panel" olarak
    gosterilir, href maddeninki.
  - `oncelikli`: tum gruplardan `oncelik: true` maddeler, href'e gore tekil, **en fazla 4**, grup sirasiyla. Kullanici uye oldugu
    (sahibi olmadigi) kuruluslar icin ayrica her kurulusun gosterge maddesi `"<Kurulus adi> paneli"` etiketiyle eklenir (4 sinirina
    dahil; once kendi oncelikleri, sonra kurulus panelleri).
  - `hesap`: sirayla — "Profilim" (`/p/<id>`; yalniz professional ve agency — halka acik sayfasi olanlar; id = `ziyaretci` kullanici
    id'si, mevcut `/p/[id]` profil id'siyle ayni), "Profili düzenle" (`/profil/duzenle`; tum roller — sayfa rolu kendi kontrol ediyor,
    once dogrula: client/business icin aciliyor mu? acilmiyorsa o rollerde bu satir YOK), "Premium" (`/premium`; professional + agency).
  - Bildirimler ve Mesajlar baslaticida YOK (ust barda zil ve "Mesajlar" zaten var; mobil hamburger kendi rozetli satirlarini korur).
- `oncelik` isaretleri (tek yer: `panel-menu.ts`):
  - saticiGrubu (profesyonel): Teklif talepleri, Rezervasyonlar, Takvim. Bolumler: calisma = Merkez, Teklif talepleri, Rezervasyonlar,
    Takvim, Basvurularim; yonetim = Kazanclar.
  - musteriGrubu: Etkinlikler, Rezervasyonlar, Pro teklifleri. Bolumler: calisma = Merkez, Etkinlikler, Ilanlarim, Pro teklifleri,
    Rezervasyonlar; yonetim = Odemeler.
  - ajansGrubu: Etkinlikler, Teklifler, Ekipler. Bolumler: calisma = Gosterge, Etkinlikler, Gelen RFP'ler, Teklifler, Takvim;
    ekip = Ekipler, Yetenek havuzu, Ekip uyeleri, Musteriler, Tedarikciler; yonetim = Gorevler, Kazanclar.
  - kurumsalGrubu: Etkinlikler, Teklif talepleri, Rezervasyonlar. Bolumler: calisma = Gosterge, Etkinlikler, Teklif talepleri, Kisa
    liste, Rezervasyonlar, Pro teklifleri, Ilanlarim; ekip = Ekip; yonetim = Gorevler, Odemeler, Ayarlar.
  - Madde SIRASI bolumlere gore yeniden duzenlenir (calisma -> ekip -> yonetim); yetki kosullari (`canViewEvents`, `crmEnabled` vb.)
    aynen korunur.
  - "Profil icerigi" grubu: `katlanir: true`, maddeler ayni (6).

## 2) Avatar menusu (`user-menu.tsx`) ve `top-nav.tsx`

- `top-nav.tsx` `menuyuDuzlestir` yerine `baslaticiMenusu` kullanir; `UserMenu`'ye `baslik: { ad, rol }`, `panel`, `oncelikli`,
  `hesap`, `isAdmin` gecer. Rol etiketi Turkce: Müşteri / Profesyonel / Ajans / İşletme; kurulus uyesiyse "<rol> · <Kurulus adi>"
  (ilk kurulus; `ORG_ROLE_LABELS` ile uyelik rolu: orn. "Proje yöneticisi · Akdeniz Gıda").
- Acilir kutu yapisi: ust blok (ad kalin, altinda rol satiri `text-xs text-ink-50`), ayirici, "Panel" + oncelikli maddeler (ikon
  yok, mevcut satir stili), ayirici, Hesap maddeleri, (yonetici ise ayirici + "Admin paneli"), ayirici, "Çıkış yap". Genislik `w-64`.
  Satir sayisi kontrolu: oncelikli 4 ile sinirli oldugundan toplam en fazla 1 + 4 + 3 + 1 + 1 = 10 olabilir; 8'i asarsa `hesap`tan
  "Profili düzenle" dusurulur (profesyonelde Profil icerigi zaten yan menude).
- Klavye: Escape kapatir; `role="menu"` / `role="menuitem"`; odak ilk maddeye gecer. Mevcut dis tiklama kapanisi kalir.

## 3) Mobil hamburger (`mobile-nav.tsx`)

- `menuLinks` prop'u kalkar; `baslatici` prop'u gelir (ayni nesne). Girisli bolum: "Panel" + oncelikli (baslik "Panel"), Mesajlar
  (rozet) + Bildirimler (rozet) + Hesap maddeleri (baslik "Hesap"), Admin paneli, Cikis yap. Kesif baglantilari (Kesfet, Ilanlar,
  Kashe AI, Teklif Topla) ve pazarlama baglantilari (girissiz) aynen. "Islerim" basligi ve `profileLink/premiumLink/workLinks`
  ayristirmasi kalkar.

## 4) Panel yan menusu (`panel-yan-menu.tsx`)

- Grup render'i: `bolum`u olan maddeler `BOLUM_ETIKETLERI` sirasina gore bolumlere ayrilir; bolumsuz maddeler (varsa) grup
  basliginin hemen altinda, bolumlerden once.
- Bolum basligi `<button aria-expanded>` + chevron (lucide `ChevronDown`, acikken 180 derece); icerik acikken liste, kapaliyken
  gizli. Varsayilan: `calisma` acik, digerleri kapali; aktif sayfanin bulundugu bolum acik (ilk render'da, `aktifAnahtar` hesabindan);
  kullanici degistirirse `localStorage`'a yazilir, sonraki acilista okunur (aktif bolum kurali localStorage'i EZER: aktif bolum her
  zaman acik). `katlanir: true` grup: grup basligi dugme olur, ayni kural (aktif madde icindeyse acik, yoksa kapali).
- Bolum basligi stili: grup basligindan bir kademe kucuk/soluk (`text-[9px] text-paper/35`), madde ile ayni yatay hiza; satir
  yuksekligi mevcut madde ile ayni. Grup basligi (kurulus adi) aynen kalir.
- Mobil cekmece (lg alti) ayni bileseni kullanir; ekstra bir sey yok.

## 5) Dogrulama

- `node node_modules/typescript/lib/tsc.js --noEmit -p tsconfig.json`; `npx eslint <degisen dosyalar>`; `npm run build`.
- `grep -rn "menuyuDuzlestir" app` BOS. `grep -rnP '[âîûÂÎÛ]' <degisen dosyalar>` bos.
- Onizleme (Sahne, `sahne` dali degil — kendi dalinin onizlemesi): ajans sahibi (`sahne+ajans-arti-bir@kashe.net`) ana sayfada avatar
  menusu: "Artı Bir Ajans / Ajans", Panel, Etkinlikler, Teklifler, Ekipler, Profilim, Profili düzenle (varsa), Premium, Çıkış yap —
  8'i asmaz. `/ajans` yan menu: "ARTI BIR AJANS" grubu altinda Çalışma (acik, 5 madde), Ekip ve kaynaklar (kapali), Yönetim (kapali);
  `/ajans/havuz`'a gidince Ekip ve kaynaklar acik. Kurum (`sahne+kurum-akdeniz-gida@kashe.net`): baslatici Panel, Etkinlikler, Teklif
  talepleri, Rezervasyonlar, Profili düzenle; yan menu Çalışma 7 / Ekip 1 / Yönetim 3 (Ayarlar sahipte). Kurum uyesi musteri
  (`sahne+bahar-keskin@kashe.net`): baslatici Panel (Merkez), Etkinlikler, Rezervasyonlar, Pro teklifleri + "Akdeniz Gıda paneli";
  rol satiri "Müşteri · Proje yöneticisi · Akdeniz Gıda". Profesyonel (`sahne+kerem-oz@kashe.net`): Panel, Teklif talepleri,
  Rezervasyonlar, Takvim, Profilim, Premium; yan menuda "Profil içeriği" kapali, `/profil/portfoy`'da acik. Admin
  (`sahne+admin@kashe.net`): baslaticida "Admin paneli" satiri. Mobil genislikte (390 px) hamburger ayni icerik, rozetler yerinde.
  Parola `docs/sahne/hesaplar.md` ilk satir.

## 6) Rapor

Bitince kisa rapor: degisen dosyalar, baslatici satir sayilari (rol basina), bolum dagilimi, `/profil/duzenle` client/business
karari, sapmalar. Commit ATMA.
