# Claude Code gorevi — Tasarim dili v2 / D1a: Panel kabugu + uc calisma merkezi

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: `docs/envanter/22-tasarim-dili-v2.md` (desen 1-2-4-5), `21-canli-tarama-1.md`
(A1, A2, P3, P4, K13, K15). ON KOSUL: Guven `tasarim/d1a` dalini acti (`git checkout -b tasarim/d1a`); is dalda yapilir, main'e DOKUNULMAZ.

---

Kashe reposundasin. Once `git status` (temiz, dal `tasarim/d1a`). Oku: `DESIGN.md` (token adlari; hex yazma), `CLAUDE.md`,
`app/admin/layout.tsx` + `app/admin/admin-nav.tsx` (lacivert yan menu + hesap karti — **D1a'nin kaynagi, bu kabuk genellestirilecek**),
`app/admin/page.tsx` (KPI kutulari), `app/components/sections/top-nav.tsx` + `mobile-nav.tsx` + `user-menu.tsx` (bugunku ☰ menu: ISLERIM
13 madde), `app/lib/ziyaretci.ts` (`getZiyaretci`: girisli, rol, ajansPaneli, kurumsalPanel), `app/lib/org-context.ts` (`getCrewContext` →
`CrewOrg` izinleri; `hasRfpBuyerAccess`, `hasProposalAccess`), `app/profil/page.tsx` (profesyonel/ajans/kurumsal merkez — tek dosya, rol
dallari), `app/kazanclarim/page.tsx` (KPI deseni var), `app/ajans/havuz/page.tsx` (KPI deseni var), `app/lib/org-roles.ts`,
migrations: `20261009120000_faz7b_01_rfp.sql` (`rfps`, `rfp_invites` sutun/durumlari), `20261003120000_faz7a_01_teklif_portal.sql`
(`proposals.status`), `20261001120000_faz6_*` (`crews.status`), `20260922*faz4a*` (`events`), `20261007*faz7c*` (`bookings`).

Hedef: videodaki (TUBITAK sunumu) Event OS paneli — lacivert yan menu, KPI satiri, "Gunaydin, <kurulus>" baslik; **uc calisma merkezi** bu
kabuga tasinir: `/ajans` (yeni), `/kurumsal` (yeni), `/profil` (yeniden). `/admin` ayni bilesene gecer. Renk/font YENI DEGIL: DESIGN.md
token'lari. Sapkali harf yok; yorumlar ASCII; UI metinleri Turkce karakterli.

## 1) `app/components/panel/` — yeni bilesenler

- `panel-kabugu.tsx` (`PanelKabugu`; sunucu bileseni + istemci yan menu): props `menu: PanelMenuGrubu[]`, `hesap: { ad, altSatir, avatarUrl?,
  rozet? }`, `ustBaslik?: { eyebrow, baslik, sagAlan?: ReactNode }`, `children`. Yerlesim admin ile ayni: `md:` sol sabit 240 px lacivert
  (`bg-ink` zemin, `text-paper`; aktif madde `bg-paper/10 text-paper`, pasif `text-paper/55`), icerik `md:ml-60 px-6 md:px-12 py-8`,
  `max-w-7xl`. `md` alti: ust cubukta ☰ → cekmece (admin-nav'daki mobil desen). Yan menu `nav aria-label="Panel"`; aktif madde
  `aria-current="page"`. Madde: ikon (lucide, 16 px) + etiket (`font-mono text-[11px] uppercase tracking-[0.14em]` — admin ile ayni).
  Grup basligi eyebrow (`text-paper/40`). Altta hesap karti (video: ad + alt satir "Ajans hesabi · 3 kisilik ekip"), altinda "Siteye don" ve
  "Cikis yap" (admin-nav'daki). Platform yoneticisiyse en altta "Admin paneli".
- `kpi-kutu.tsx` (`KpiKutu`): `etiket` (eyebrow), `deger` (display 3xl), `altNot?`, `vurgu?: 'accent' | 'moss' | 'none'`, `href?` (tum kutu
  baglanti; sag ustte → oku). Zemin `bg-card border border-line rounded-xl`. `KpiSatir` sarmalayici: `grid grid-cols-2 lg:grid-cols-4 gap-4`.
- `ozet-kutu-satiri.tsx` (`OzetKutuSatiri`): 2-3 kutu; `hero` olan `bg-brand-ink text-paper` (video: "Musteriye teklif 680.000 TL").
  D1a'da yalniz tanimlanir + gosterge panellerinde kullanilir (D1b teklif editorunde kullanacak).
- `veri-tablosu.tsx` (`VeriTablosu`): eyebrow sutun basliklari, satir `border-b border-line`, sayisal sutun saga yasli, `satirVurgu` →
  `bg-brand-accent-soft`. `md` alti: `kart` modu (her satir kart, etiket:deger). D1a'da gosterge listelerinde kullanilir.
- `panel-baslik.tsx` (`PanelBaslik`): eyebrow ("AJANS PANELI · GOSTERGE") + h1 (`font-display text-3xl md:text-4xl`; vurgu kelimesi
  `<em className="not-italic text-brand-accent">` — DESIGN.md'ye kural eklenir, bkz. madde 6) + sagda alan (tarih/avatar/CTA).
- `index.ts` ile dis aktarim. Hepsi `'use client'` OLMAYAN; yalniz yan menu cekmecesi istemci (`panel-yan-menu.tsx`, `usePathname`).

## 2) Menu modeli — `app/lib/panel-menu.ts` (sunucu; tek kaynak)

`getPanelMenu(baglam)` → `PanelMenuGrubu[]` (`{ baslik, maddeler: { href, etiket, ikon, rozet? }[] }`). Baglam `getZiyaretci()` +
`getCrewContext()` ile kurulur. Gruplar:

- **Ajans** (`CrewOrg.accountType === 'agency'`, kullanici uye): Gosterge `/ajans` · Etkinlikler `/etkinliklerim` (events.view) · Gelen
  RFP'ler `/ajans/rfp` (proposals.view) · Teklifler `/ajans/teklifler` (proposals.view) · Yetenek havuzu `/ajans/havuz` (talent.view) ·
  Ekipler `/ajans/ekipler` (crew.view) · Ekip uyeleri `/profil/ekibim` (yalniz sahip — sayfa sahibe ait) · Takvim `/takvimim` ·
  Kazanclar `/kazanclarim` (finance.view).
- **Kurumsal** (business): Gosterge `/kurumsal` · Etkinlikler `/etkinliklerim` · Teklif talepleri (RFP) `/kurumsal/rfp` · Rezervasyonlar
  `/rezervasyonlarim` · Ilanlarim `/ilanlarim` · Profesyonel teklifleri `/teklif-taleplerim` (eski "Teklif Taleplerim" — etiket degisti) ·
  Ekip `/profil/kurumsal-ekip` (sahip) · Odemeler `/odemelerim`.
- **Profesyonel** (rol professional): Merkez `/profil` · Teklif talepleri `/teklif-talepleri` · Rezervasyonlar · Takvim · Kazanclar ·
  Basvurularim `/basvurularim` · **Profil icerigi** alt grubu: Duzenle, Hizmetler, Paketler, Portfoy, Deneyim, Kategori bilgileri.
  Profesyonel menusunde "Ilanlarim" YOK (P3).
- **Musteri** (rol client): Merkez `/profil` · Etkinlikler · Ilanlarim · Profesyonel teklifleri · Rezervasyonlar · Odemeler.
- **Pazaryeri** (herkes): Kesfet · Ilanlar · Kashe AI. **Hesap**: Bildirimler (rozet) · Mesajlar (rozet) · Premium (profesyonel) ·
  Cikis.
- Birden cok baglam (orn. hotmail: profesyonel + Sunucu Ajans izleyici + Test Guven yonetici): yan menude once kisinin kendi grubu, sonra
  her kurulus kendi grubuyla (grup basligi kurulus adi; izin yoksa madde gosterilmez). Kullanici sayfa adresine gore aktif grup belli.
- `mobile-nav.tsx` / `user-menu.tsx`: girisli kullanicida ISLERIM listesi **bu modelden** uretilir (13 duz madde kalkar); vitrin ust
  menusu (Kesfet, Ilanlar, Blog, Kashe AI, Fiyatlandirma) degismez.

## 3) Uc merkez

- **`/ajans` (yeni `app/ajans/page.tsx`)**: `PanelKabugu`; baslik "Gunaydin, <display_name>" (saat 12-18 "Iyi gunler", 18+ "Iyi aksamlar";
  `app/lib/tarih.ts` Istanbul), sagda bugunun tarihi. KPI: **Acik RFP** (rfp_invites: kurulusa gelen, rfp durumu acik ve yanitlanmamis),
  **Bekleyen teklif** (proposals seller = kurulus, status draft/sent/viewed — gonderilip yanit bekleyen + taslak ayri alt not), **Bu ay
  etkinlik** (events organization_id = kurulus, tarih bu ay), **Aktif ekip** (crews status confirmed/approved). Altinda iki kolon:
  "Acik isler" (`VeriTablosu`: gelen RFP'ler + bekleyen teklifler — baslik · karsi taraf · son tarih · durum · →) ve "Yaklasan etkinlikler"
  (5 satir). Sagda kucuk kart "Ekip ve havuz" (uye sayisi, havuz sayisi — `organization_memberships` + `organization_talent_records`).
  Uye degilse (ajans baglami yok) → `/profil`'e yonlendir. Ajans rolu profile ise (`ziyaretci.ajansPaneli`) `/profil` → `/ajans`'a yonlenir
  (profil icerigi duzenleme `/profil/duzenle`'de kalir).
- **`/kurumsal` (yeni `app/kurumsal/page.tsx`)**: ayni kabuk; KPI: **Acik teklif talebi** (rfps buyer = kurulus, durum acik), **Gelen
  teklif** (o RFP'lere gelen gonderilmis teklif sayisi), **Yaklasan etkinlik**, **Onayli rezervasyon** (bookings buyer_organization_id,
  confirmed; toplam tutar alt not). Listeler: "Teklif talepleri" (son 5) ve "Yaklasan etkinlikler". business rolu profile ise `/profil` →
  `/kurumsal`.
- **`/profil` (profesyonel ve musteri; yeniden)**: ayni kabuk; profesyonelde KPI: **Bekleyen teklif talebi**, **Yaklasan rezervasyon**,
  **Bu ay kazanc** (tamamlanan, net), **Profil tamligi %** (mevcut hesap). Altinda bugunku kartlar **iki sutuna** toplanir: sol "Yapilacaklar"
  (Gorunurluk uyarisi, Profil tamligi eksikleri), sag "Profil icerigi" (Deneyim · Kategori · Portfoy · Hizmetler+Paketler TEK kartta iki
  satir). **Kuruluslarim** karti: ajans VE kurumsal uyelikler (P4: Test Guven de listelenir) — her satir kurulus adi · rol etiketi
  (`ORG_ROLE_LABELS`) · "Panele git →" (izin varsa). Musteri rolunde KPI: Acik ilan, Gelen teklif, Yaklasan rezervasyon, Etkinlik.
  Hesap bilgileri + Kullanici ID en alta kucuk.
- **`/admin`**: `AdminNav` + `admin/layout.tsx` → `PanelKabugu` (menu sabit NAV_ITEMS; hesap karti admin; "Siteye don"). Davranis ayni.

## 4) Ust nav (calisma yuzeylerinde)

`PanelKabugu` kullanilan sayfalarda `TopNav` render edilmez (admin'de de yok). Panel disi sayfalarda (etkinlik, teklif, RFP, rezervasyon
sayfalari — D1b'de kabuga girecek) bugunku TopNav kalir; yalniz ☰ listesi madde 2'deki modelden uretilir.

## 5) Yapilmayacaklar

Migration/RPC YOK. Etkinlik/teklif/RFP/rezervasyon sayfalarinin ic tasarimi D1b (dokunma). Kesfet/profil sayfasi D2. Renk/font/hex ekleme
yok. `DESIGN.md`'ye yalniz madde 6. Commit ATMA.

## 6) `DESIGN.md` eki

"## 9. Desenler (v2, 20 Ekim 2026)" bolumu: PanelKabugu, KpiKutu, OzetKutuSatiri (hero), VeriTablosu, PanelBaslik; calisma yuzeyi
basliklarinda vurgu kelimesi `brand-accent` (vitrinde lacivert kalir); yan menu lacivert `ink` zemin, etiketler mono eyebrow. Kisa.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` → route tablosu (`/ajans`, `/kurumsal` yeni) + `.next/BUILD_ID`.
- `grep -rn "PanelKabugu" app | wc -l` → ≥ 4 (ajans, kurumsal, profil, admin); `grep -rn "ISLERIM\|İŞLERİM" app/components/sections` →
  liste artik `getPanelMenu`'den (sabit dizi yok).
- Sapkali harf 0; yorumlar ASCII.
- **Onizleme (Vercel dal URL'si; tur Claude):** gmail (Sunucu Ajans sahibi, admin) → `/profil` `/ajans`'a yonlenir; KPI gercek sayilar
  (Acik RFP 0 · Bekleyen teklif 1 (taslak) · Bu ay etkinlik · Aktif ekip 1); yan menu Ajans grubu + Pazaryeri + Hesap + Admin paneli; ☰
  mobilde ayni. testguven → `/kurumsal`: Acik teklif talebi 0 · Gelen teklif 0 · Yaklasan etkinlik 1 · Onayli rezervasyon 1 (23.400 TL).
  hotmail → `/profil`: KPI'lar + Kuruluslarim'da Sunucu Ajans (Izleyici) ve Test Guven (Yonetici · Panele git). `/admin` ayni gorunum.
  807 ve 375 px; konsol 0.

Rapor: degisen/yeni dosyalar, tsc/build (BUILD_ID), grep sonuclari, menu modelinin ozeti (hangi rol hangi gruplari gorur), sapma ve nedeni.
Commit ATMA.
