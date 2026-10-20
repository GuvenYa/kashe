# Claude Code gorevi — FAZ 8a / P1: Gorevler + Aktivite arayuzu (+ D1b-1: etkinlik sayfasi sekmeli, panel kabugunda)

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: `docs/envanter/20-faz8-event-os-modulleri.md` bolum 3 (8a-P1), `22-tasarim-dili-v2.md`
bolum 3-4 (D1b notlari 1-2, 6, 12), `21-canli-tarama-1.md` K1, K3, A6. ON KOSUL: `20261021110000_hijyen_03`, `20261021120000_faz8a_01`,
`20261021130000_faz8a_02` dal + uretimde (asama4 28/28, asama18 ESIT). Dal: `tasarim/d1b-8a` (Guven acti). Migration/RPC YOK.

---

Kashe reposundasin. Once `git status` (temiz; dal `tasarim/d1b-8a`). Oku: `CLAUDE.md`, `DESIGN.md` bolum 9 (desenler v2),
`supabase/migrations/20261021120000_faz8a_01_gorevler.sql` (tasks / activity_logs sutunlari, tetikleyici KURALLARI ve hata metinleri,
RLS, `org_module_set`), `20261021110000_hijyen_03_kurulus_karsi_taraf.sql` (`organizations_public`), `app/components/panel/*` (PanelKabugu,
KpiKutu, PanelKart, VeriTablosu, PanelBaslik), `app/lib/panel-menu.ts` (+ `panel-menu-tipler.ts`), `app/lib/org-context.ts` (`getCrewContext`,
`CrewOrg`: canViewEvents/canManageEvents/talentPoolEnabled…), `app/ajans/page.tsx`, `app/kurumsal/page.tsx`, `app/profil/page.tsx`,
`app/etkinliklerim/[id]/page.tsx` (968 satir; aday-paneli, ekip-paneli, aday/ekip actions), `app/kurumsal/rfp/page.tsx` (etkinlik RFP'leri),
`app/bildirimler/*` (tip etiketleri), `app/lib/tarih.ts`, `app/lib/tarih-girdisi.ts` (`takvimiAc`), `app/lib/org-roles.ts`,
`app/components/ui/kurulus-rol-secici.tsx` (satir ici onay deseni), `supabase/functions/send-message-notification/index.ts` (satir ~321
`.in('type', ['rfp', 'proposal'])`).

Ilke: yazma **dogrudan tablo** (RLS events.manage; FAZ 7'nin aksine RPC yok) — kurallar DB tetikleyicisinde, uygulama yalniz anlasilir
Turkce mesaj uretir. `internal.*` okunmaz. Renk/font yok, DESIGN.md token'lari. Sapkali harf yok; yorumlar ASCII; UI Turkce karakterli.

## 1) Ortak katman

- `app/lib/gorevler.ts` (`'use client'` yok): `GOREV_DURUMLARI` sirasi ve etiketleri (`todo` Yapılacak · `in_progress` Devam ediyor ·
  `blocked` Engellendi · `done` Tamamlandı · `cancelled` İptal), rozet renk eslemesi (todo gri, in_progress lacivert, blocked danger-soft,
  done moss, cancelled ink-50), `AKTIVITE_METNI(log, aktorAdi)` → Turkce cumle ("Güven 'Sahne kurulumu' görevini oluşturdu", "durumu
  Yapılacak → Devam ediyor yaptı", "görevi Test Pro'ya atadı", "son tarihi 14 Mayıs 2027 yaptı", "görevi sildi"), DB hata eslemesi:
  `gorev modulu bu kurulusta kapali` → "Görevler modülü bu kuruluşta kapalı.", `atanan kisi kurulusun aktif uyesi degil` → "Atanan kişi
  kuruluşun aktif üyesi değil.", `havuz kaydi bu kurulusa ait degil`, `etkinlik bu kurulusa ait degil`, `bagli gorev bu kurulusa ait degil`,
  `yalniz yapilacak ya da iptal durumundaki gorev silinir` → "Yalnız yapılacak ya da iptal durumundaki görev silinebilir.", 42501 → "Bu işlem
  için yetkin yok.", `tasks_title_check` → "Başlık 2–200 karakter olmalı."
- `app/lib/gorev-actions.ts` (`'use server'`): `gorevOlustur`, `gorevGuncelle` (kismi: title/description/status/assignee_user_id/
  assignee_talent_record_id/due_at/is_milestone/depends_on_task_id/sort_order), `gorevSil`; girdi dogrulama (uuid, baslik), supabase
  tablo islemleri, hata eslemesi, `revalidatePath` (etkinlik sayfasi + `/kurulus/gorevler` + gosterge).
- `app/lib/gorev-data.ts` (sunucu): `gorevleriGetir({ orgId, eventId?, durum?, atanan?, banaAtanan? })` (tasks + atanan profil adi +
  havuz kaydi adi + etkinlik basligi; `organizations_public` DEGIL — ayni kurulus), `atanabilirler(orgId)` (aktif uyeler: profiles ad +
  `ORG_ROLE_LABELS`; ajansta ek olarak havuz kayitlari — `talentPoolEnabled`), `aktiviteGetir({ orgId, eventId? })` (activity_logs;
  etkinlik sekmesinde: o etkinligin gorev id'leri + `entity_type='event' AND entity_id=eventId`; aktor adi profiles'tan; 50 satir, "daha
  fazla"), `gorevModuluAcik(orgId)` (`organization_modules` SELECT — RLS uye).

## 2) Bilesenler — `app/components/gorevler/`

- `gorev-listesi.tsx` (istemci): satirlar (`gorev-satiri.tsx`): onay kutusu gorunumlu durum (tiklayinca todo ↔ done degil — durum SECIMI:
  5 durum), baslik (kilometre tasi ise `◆` rozet + `font-semibold`), atanan (avatar/ad ya da havuz kaydi adi, "Atanmamış"), son tarih
  (`app/lib/tarih.ts`; gecmisse danger renk; "bugün"), etkinlik adi (yalniz kurulus genel listesinde), bagimlilik ("↳ X'ten sonra"),
  sag "…" menu: Düzenle · Sil (satir ici onay "Silinsin mi? Onayla / Vazgeç"). Filtre cubugu: Durum (coklu), Atanan, "Bana atanan",
  Etkinlik (genel listede), Yalnız kilometre taşları. Siralama: due_at (bos sonda) → sort_order → created_at.
  **Hizli ekle**: ust satirda tek girdi "Görev ekle… (Enter)" → `gorevOlustur` (baslik; etkinlik sekmesindeyse `event_id` sabit).
- `gorev-formu.tsx` (istemci; duzenle/yeni ayrinti): baslik, aciklama, durum, atanan (uye / havuz kaydi — tek secim: `atanan:user:<id>`
  ya da `atanan:talent:<id>`), son tarih (`type="datetime-local"` + `takvimiAc`), kilometre tasi, bagli gorev (ayni kurulus; kendisi haric),
  etkinlik (genel listede; kurulus etkinlikleri). Kaydet/Vazgec; hata metni formda.
- `aktivite-akisi.tsx` (sunucu bileseni + "daha fazla" istemci): satir = avatar + cumle + goreli zaman ("2 saat önce"; `title` tam tarih).
- `gorev-modul-kapali.tsx`: "Görevler modülü bu kuruluşta kapalı." + (settings.manage ise) "Ayarlar'dan aç →" baglantisi.
- Yetki: `canManageEvents` yoksa hizli ekle/duzenle/sil render edilmez (salt okunur liste); liste `canViewEvents`.

## 3) Sayfalar

- **`/kurulus/gorevler`** (yeni `app/kurulus/gorevler/page.tsx`; `?kurulus=<orgId>`; parametre yoksa kullanicinin `tasks` modulu acik ilk
  kurulusu; hicbiri yoksa `/profil`): `PanelKabugu` (ilgili kurulus grubu aktif); `PanelBaslik` eyebrow "<KURULUS> · GÖREVLER", baslik
  "Görevler"; KPI satiri: Açık görev · Bana atanan · Gecikmiş (due_at < now, acik) · Bu hafta biten; altinda `gorev-listesi` (genel
  liste: tum etkinlikler + genel). Modul kapaliysa `gorev-modul-kapali`.
- **Etkinlik sayfasi `/etkinliklerim/[id]`** — sekmeli yeniden duzen (D1b-1; A6, K1, K3). Kurulus etkinligi (`organization_id` dolu)
  `PanelKabugu` icinde (kurulus grubu aktif); kisisel etkinlik (`organization_id` NULL) bugunku TopNav duzeninde, sekmesiz (yalniz
  Genel icerik). Sekmeler `?sekme=` ile (bildirim baglantisi `?sekme=gorevler` calisir; varsayilan `genel`):
  - **Genel**: baslik + rozetler + ozet kutulari (tur/tarih/sehir/katilimci/butce/mekan) + Ihtiyaclar + Bagli kayitlar (rezervasyonlar
    **ve bu etkinligin RFP'leri**: baslik · durum · davet/yanit · baglanti — K3) + "Etkinlik tanımı · sürüm N". Alici (business)
    etkinliginde birincil dugme **"Teklif talebi aç"** (`/kurumsal/rfp?etkinlik=`); ajans etkinliginde "Eşleştir" / mevcut akis.
  - **Adaylar** (yalniz ajans kurulusu; mevcut `aday-paneli`).
  - **Ekip** (yalniz ajans; mevcut `ekip-paneli` + ic maliyet karti). Business etkinliginde Adaylar/Ekip/Ic maliyet sekmeleri YOK (K1;
    alici Talent Pool/ic maliyet gormez).
  - **Görevler**: `gorev-listesi` (`event_id` sabit; etkinlik sutunu yok). Modul kapaliysa `gorev-modul-kapali`.
  - **Aktivite**: `aktivite-akisi` (etkinlik + gorevleri).
  Sekme cubugu: `role="tablist"`, aktif sekme `aria-selected`, sayilar rozetle ("Görevler 4"). Telefonda yatay kaydirilir sekme seridi.
  Ihtiyaclar/Adaylar/Ekip icerigi KOPYALANMAZ — mevcut bilesenler sekme icine tasinir; davranis degismez.
- **Gostergeler**: `/ajans` ve `/kurumsal` KPI satirina **"Açık görev"** (modul acik ise; kapaliysa kutu "Görevler kapalı · Ayarlar →"),
  "Açık işler" tablosuna gecikmis gorevler satir tipi eklenmez (ayri "Gecikmiş görevler" PanelKart, 5 satir). `/profil` (profesyonel)
  "Bana atanan görevler" PanelKart (tum kuruluslar; 5 satir; "Tümü →" `/kurulus/gorevler?kurulus=…&bana=1`). D1b notu 2: `/ajans`
  "Açık RFP" sayimi `rfp_invites.provider_id = kurulus.legacyProfileId` (CrewOrg'a `legacyProfileId` ekle) ile suzulur. Gosterge ve
  gorev listelerinde karsi taraf adi `organizations_public` uzerinden (`buyer:organizations_public!rfps_organization_id_fkey(display_name)`,
  `seller:organizations_public!proposals_seller_organization_id_fkey(display_name)`).
- **Kurumsal Ayarlar `/kurumsal/ayarlar`** (yeni; `settings.manage`): `PanelKabugu`; "Modüller" PanelKart: **Görevler** satiri — durum +
  "Aç / Kapat" (satir ici onay) → `supabase.rpc('org_module_set', { p_org_id, p_module_key: 'tasks', p_enabled })` (yeni action
  `app/lib/modul-actions.ts`). Yan menu kurumsal grubuna "Ayarlar" (settings.manage). Ajansta ayar sayfasi YOK (modul varsayilan acik).
- **Yan menu** (`panel-menu.ts`): her kurulus grubuna "Görevler" (`/kurulus/gorevler?kurulus=<id>`; `events.view` + modul acik — `CrewOrg`'a
  `tasksEnabled` ekle); kurumsal gruba "Ayarlar" (settings.manage — `CrewOrg.canManageSettings` ekle).
- **Bildirimler** (`/bildirimler`): tip `task` etiketi "GÖREV"; satira tiklayinca `link` (tetikleyici `/etkinliklerim/<id>?sekme=gorevler`
  ya da `/kurulus/gorevler?gorev=<id>` yazar — ikincisinde liste o gorevi vurgular/acar).
- **Edge Function** `send-message-notification/index.ts`: `.in('type', ['rfp', 'proposal', 'task'])`; e-posta konusu/metni tip `task`
  icin "Kashe — görev" (mevcut rfp/proposal deseni). Deploy Guven: `supabase functions deploy send-message-notification --project-ref
  qydsooqmflrrwtgawhsv` (raporda hatirlat).
- `CLAUDE.md`: FAZ 8a paragrafi (gorevler dogrudan tablo + RLS, kurallar DB'de, modul kapisi, aktivite yalniz tetikleyici, bildirim tipi
  task, `/kurulus/gorevler`, etkinlik sayfasi sekmeli). Kisa.

## 4) Yapilmayacaklar

Migration/RPC YOK. Teklif editoru / RFP / rezervasyon / odeme sayfalari (D1b-2, ayri gorev). Kesfet/profil (D2). Ekip uyesi satir
dugmeleri (A6 ikinci yarisi) bu turda degismez. `internal.*` okunmaz. Commit ATMA.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` → route tablosu (`/kurulus/gorevler`, `/kurumsal/ayarlar` yeni) + `.next/BUILD_ID`.
- `grep -rn "from('tasks')" app | wc -l` → yalniz `gorev-data.ts` + `gorev-actions.ts` (+ gosterge sayimlari); `grep -rn "from('activity_logs')" app`
  → yalniz `gorev-data.ts`; `grep -rn "rpc('org_module_set'" app` → 1; `grep -rn "'rfp', 'proposal', 'task'" supabase/functions` → 1;
  `grep -rn "internal\." app --include=*.ts --include=*.tsx` → yeni dosyalarda 0.
- Sapkali harf 0; yorumlar ASCII; UI Turkce.
- **Onizleme turu (Claude; Vercel dal URL'si):** gmail (Sunucu Ajans sahibi) `/etkinliklerim/e5b98cc4-…` (lansman; 8a-DB/02 ile artik
  kurulus etkinligi) → sekmeler Genel · Adaylar · Ekip · Görevler · Aktivite; Görevler: hizli ekle "Sahne kurulumu" → satir; duzenle → atanan
  Test Pro (hotmail), son tarih, kilometre tasi → kaydedildi; durum Devam ediyor → Engellendi → Tamamlandı (tamamlanan satir sonda); done
  gorevi sil → "Yalnız yapılacak ya da iptal…" hatasi; Aktivite sekmesi: olusturdu / atadi / durum satirlari; `/kurulus/gorevler` KPI +
  filtreler; `/ajans` "Açık görev". hotmail (izleyici): bildirim "Sana görev atandı: Sahne kurulumu" (etiket GÖREV) → baglanti sekmeye
  dusuyor; `/profil` "Bana atanan görevler"; hizli ekle gorunmuyor (salt okunur). testguven (Test Guven, business): etkinlik sayfasinda
  Adaylar/Ekip/Ic maliyet YOK, Genel'de "Teklif talebi aç" dugmesi + RFP'ler listede; Görevler sekmesi "modül kapalı → Ayarlar'dan aç";
  `/kurumsal/ayarlar` Görevler Aç → sekme calisiyor → bir gorev ekle → Kapat (gorev kalir, ekleme kapanir). 807 + 375 px; konsol 0.
  SQL (uretim, Guven): `select status, count(*) from tasks group by 1`; `select action, count(*) from activity_logs group by 1`;
  asama18 K11-K13 0, K17 sayilar.

Rapor: degisen/yeni dosyalar, tsc/build (BUILD_ID), grep sonuclari, sekme/menu modelinin ozeti, sapma ve nedeni. Commit ATMA.
