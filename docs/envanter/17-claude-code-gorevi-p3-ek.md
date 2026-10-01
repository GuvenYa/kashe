# Claude Code gorevi — FAZ 5 / P3-ek: Kashe uyesi havuz kayitlarinda "Sil" kurali

Asagidaki metni oldugu gibi Claude Code'a ver. Neden: P1 paneli `talent_id` dolu her kaydi "Ekibim'den yonetilir" sayip Sil'i
gizliyor. P1'de dogruydu (talent_id yalniz Ekibim kayitlarinda doluydu); P2 (sahiplenilen harici kayit) ve P3 (pazaryerinden
eklenen kayit) ile artik Ekibim uyesi OLMAYAN Kashe uyesi kayitlari var ve bunlar havuzdan hic cikarilamiyor (canli turda goruldu:
"dj test" silinemedi).

---

Kashe reposundasin. Su dosyalari oku: `app/ajans/havuz/havuz-paneli.tsx` (Sil / "Ekibim'den yonetilir" dali, onay kutusu),
`app/ajans/havuz/havuz-actions.ts` (`deleteTalentRecord`), `app/ajans/havuz/page.tsx` (kayit SELECT'i), `app/ajans/havuz/havuz-data.ts`
(`HavuzKaydi`), `supabase/migrations/20260930120000_faz5_01_yetenek_havuzu.sql` (sutun `legacy_agency_member_id`; `internal.organization_talent_rates`
`ON DELETE CASCADE`), `docs/envanter/17-faz5-yetenek-havuzu.md` bolum 9.

Bu is **yalniz uygulama kodu**: migration yok, RPC yok. `git status --short` temiz olmali; degilse dur ve soyle.

## Kural (yeni)

Bir havuz kaydi "Ekibim'den yonetilir" sayilir ve Sil gizlenir **yalniz** su durumda: `legacy_agency_member_id` dolu VE o id
`agency_members`'ta hala var (aktif Ekibim uyeligi; silinse bile `sync_org_talent_pool` sayfa acilisinda geri yaratirdi).
Diger her kayit silinebilir: harici kayit (eskisi gibi), pazaryerinden eklenen (P3), sahiplenilmis harici (P2), Ekibim'den
cikarilmis eski uye (`legacy_agency_member_id` dolu ama `agency_members` satiri yok).

## Yapilacaklar

1. `page.tsx`: kayit SELECT'ine `legacy_agency_member_id` ekle (sutun yetkisi var; `invitation_token` yine SECILMEZ). Dolu legacy
   id'ler icin TEK sorgu: `agency_members` `select('id').in('id', legacyIdler)` -> var olanlar kumesi. Her kayda
   `ekibimUyesi: boolean` tureterek panele gec (`HavuzKaydi`'ya alan ekle). RLS satiri gizlerse (kurulus sahibi olmayan talent.manage
   uyesi) kume bos doner -> Sil gorunur; yanlis silme `sync_org_talent_pool` ile kendini onarir — yorumda bunu yaz.
2. `havuz-paneli.tsx`: `k.talent_id ? "Ekibim'den yonetilir" : Sil` dalini `k.ekibimUyesi ? ... : Sil` yap. Onay metni Kashe uyesi
   kayitlarda (talent_id dolu) ek cumle: "<Ad> havuzdan silinecek; iç oran kayıtları da silinir. Emin misin?" (harici kayitta eski metin).
3. `deleteTalentRecord`: `talent_id` dolu -> reddetme kaldirilir; yerine `legacy_agency_member_id` dolu ise `agency_members`'ta
   `id` var mi bak; varsa reddet: "Aktif Ekibim üyesi havuzdan silinemez; önce Ekibim'den çıkar." Yoksa sil (RLS kapisi aynen).
4. Dokunulmayacaklar: Ekibim `removeMember` havuz kaydina dokunmaz (eski uye havuzda kalir, istenirse Sil ile cikarilir — bolum 9'a
   kural olarak eklenecek, sen ekleme); `sync_org_talent_pool` cagrisi, Pasife al/Engelle akislari.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` -> route tablosu + hata yok + `.next/BUILD_ID`.
- `grep -n "legacy_agency_member_id" app` -> yalniz `havuz/page.tsx`, `havuz-data.ts`, `havuz-actions.ts`.
- Sapkali harf 0; kullaniciya gorunen metinler duzgun Turkce.
- **Canli tur (Guven, Sunucu Ajans):** `/ajans/havuz`: Test Pro ve Test Pro2 satirlarinda hala "Ekibim'den yönetilir" (Sil yok);
  "dj test" ve "Deneme_Harici" satirlarinda Sil var. "dj test" -> Sil -> onay metni ("iç oran kayıtları da silinir") -> Vazgeç -> Sil -> Sil
  -> satir gitti. Deneme_Harici'yi SILME (veri kalsin). SQL: `select name from public.organization_talent_records order by created_at;`
  -> 3 satir. `asama13` K5 0, K14 = 30000.

Rapor: degisen dosyalar, tsc/build (BUILD_ID), grep, sapma ve nedeni. Commit ATMA.
