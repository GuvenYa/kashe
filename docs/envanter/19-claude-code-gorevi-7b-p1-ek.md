# Claude Code gorevi — FAZ 7b / P1-ek: sihirbazda kurulus secimi (etkinligin kurulusa atfi)

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: 7b-P1 canli turu (19 Ekim 2026) — `/kurumsal/rfp` → "Yeni teklif
talebi" → "Teklif talebi bir etkinlige baglanir. Once bir etkinlik olustur." → sihirbaz **kisisel** etkinlik uretiyor
(`event_briefs.organization_id` NULL → `create_event_from_spec` kurulussuz etkinlik), RFP formu ise yalniz kurulus
etkinliklerini listeliyor (`events.organization_id IN yonetilebilir`) ve `rfp_create` kurulus eslesmesini sart kosuyor.
Sonuc: kurumsal kullanici arayuzden hic RFP acamiyor. DB tarafi hazir (brief insert politikasi `organization_id`'yi
`events.manage` ile kabul ediyor; etkinlik brief'ten devraliyor) — eksik olan yalniz uygulama. FAZ 8 "kurulus atfi"nin
bu dilimi one alinir; migration YOK.

---

Kashe reposundasin. Once `git status` (temiz olmali). Oku: `app/etkinlik-sihirbazi/page.tsx` (props), `sihirbaz-client.tsx`
(`ANLAT_ANAHTARLARI` ve URL ayna mantigi, son adim "Ihtiyac" — baslik girdisi + Ozet, `onayla`), `actions.ts`
(`ConfirmEventInput`, `confirmEventFromWizard` — brief olusturma ~satir 233-272, RPC cagrisi ~383), `app/lib/org-context.ts`
(`getCrewContext` → `CrewOrg.canManageEvents`), `app/kurumsal/rfp/yeni-rfp.tsx` (bos durum baglantisi ~96),
`app/etkinliklerim/[id]/page.tsx` (~552 "Teklif talebi ac"), `supabase/migrations/20260922150000_faz4a_01_etkinlik_eventspec.sql`
(`event_briefs_insert` / `event_briefs_update` politikalari — DEGISMEZ), `CLAUDE.md`.

## Yapilacaklar

1. **`page.tsx`**: `getCrewContext()` ile kullanicinin `canManageEvents` kuruluslarini al; `SihirbazClient`'a
   `kuruluslar: { id: string; name: string }[]` gec (girissizde bos dizi).
2. **`sihirbaz-client.tsx`**:
   - Yeni URL anahtari `kurulus` (uuid ya da bos). `ANLAT_ANAHTARLARI`'na EKLENMEZ (analiz sifirlamasin); ayna/`guncelle`
     ile tasinir; `girisYolu(true)` donusunde korunur (sorguRef zaten tum parametreleri tasiyor — dogrula, raporda yaz).
   - Son adimda (Ihtiyac), baslik girdisinin USTUNDE, yalniz `kuruluslar.length > 0` iken "**Bu etkinlik kimin adına?**"
     secimi: radio grubu — `Kişisel` (deger bos) + her kurulus adi. Deger `kurulus` anahtarina yazilir
     (`guncelle({ kurulus: id || null })`). URL'den gelen `kurulus` listede yoksa yok sayilir (kisisel).
   - Ozet satirina kurulus adi eklenir (`Kişisel` ya da kurulus adi) — mevcut `join(' · ')` dizisine tek oge.
   - `onayla` → `confirmEventFromWizard({ …, organizationId: kurulus || undefined })`.
3. **`actions.ts`**: `ConfirmEventInput.organizationId?: string`. Sunucu tarafinda:
   - `organizationId` varsa `has_org_permission` kontrolu RLS'e birakilmaz, acik kontrol: `supabase.rpc('has_org_permission', { … })`
     ya da `getCrewContext()` ile `canManageEvents` eslesmesi — eslesmiyorsa `{ success: false, error: 'Bu kuruluş adına etkinlik oluşturma yetkin yok.' }`.
   - Brief YENI olusturuluyorsa insert'e `organization_id` eklenir. Brief ZATEN varsa (analizden gelen) ve
     `organization_id` NULL ise `update({ organization_id }).eq('id', briefId).is('organization_id', null)`; hata donerse
     ayni yetki mesaji. Etkinlik `create_event_from_spec` ile brief'ten devralir (RPC'ye dokunulmaz).
   - Dosya basi yorumundaki "`organization_id` gonderilmez (kurulus atfi FAZ 8)" notu guncellenir: "kurulus atfi: sihirbaz
     son adiminda secim (7b-P1-ek); DB politikasi events.manage ister".
4. **`yeni-rfp.tsx`**: bos durum baglantisi `/etkinlik-sihirbazi?kurulus=<secili kurulus id>` (form `kurulusId` state'i;
   yoksa `kuruluslar[0]?.id`). Metin: `Teklif talebi bir etkinliğe bağlanır. Önce kuruluş adına bir etkinlik oluştur.`
5. **`app/etkinliklerim/[id]/page.tsx`**: degisiklik yok — kurulus etkinliginde "Teklif talebi ac" zaten var; raporda
   kosulunu (dosya:satir) yaz.
6. Mesaj/menu: yok. E-posta: yok.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` → route tablosu + `.next/BUILD_ID`.
- `grep -n "organizationId\|organization_id" app/etkinlik-sihirbazi/actions.ts` → insert + update + yetki kontrolu.
- `grep -n "kurulus" app/etkinlik-sihirbazi/sihirbaz-client.tsx` → anahtar, radio grubu, ozet, onayla (≥ 4); `ANLAT_ANAHTARLARI` icinde YOK.
- `grep -rn "INSERT INTO\|from('events')" app/etkinlik-sihirbazi` → events'e dogrudan insert YOK (RPC tek yol).
- Sapkali harf 0; yorumlar ASCII; UI metni Turkce.
- **Canli (Guven):** Test Pro ile `/kurumsal/rfp` → "Etkinlik olustur" → sihirbaz `?kurulus=<Test Guven>` ile acilir →
  metin → adimlar → son adimda "Test Guven" secili → Onayla → `/etkinliklerim/<id>` ust satirda "Teklif talebi ac" →
  `/kurumsal/rfp?etkinlik=<id>` formda etkinlik secili. SQL: `select id, title, organization_id from events order by created_at desc limit 3`
  → yeni etkinlikte `organization_id` = Test Guven.

## Yapilmayacaklar

Migration/RPC/politika degisikligi YOK. Kesfet, ana sayfa, RFP editoru DOKUNULMAZ. Kisisel etkinlik akisi (kurulus
secilmeden) AYNEN calisir. Commit ATMA.

Rapor: degisen dosyalar, tsc/build (BUILD_ID), grep sonuclari, `girisYolu` donusunde `kurulus`un korundugu, "Teklif talebi
ac" kosulu (dosya:satir), sapma ve nedeni. Commit ATMA.
