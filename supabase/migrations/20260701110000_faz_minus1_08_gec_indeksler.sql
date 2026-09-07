-- =============================================================================
-- FAZ -1 / 08 — Gec baglanan indeksler (1)
--
-- KAYNAK: docs/envanter/04-sema-uzlastirma.md (GRUP A = yalniz uretimde olan nesneler)
-- VERI  : docs/envanter/uretim-dokum/*.csv (uretim semasindan alinan dokum)
--
-- Bu dosya 07'den AYRI, cunku dayandigi tablo zincirde daha sonra olusuyor:
--
--   business_invitations         dogum: 20260630120000
--
-- 07 ve oncesi 2026062009xxxx damgasinda; 20260630120000 ondan sonra.
-- Bu yuzden indeks kendi tablosunun dogumundan sonraki bir damgaya alindi.
--
-- Icerik yine indeksler.csv'den BIREBIR; tek fark dosyanin sirasi.
--
-- KURALLAR (bu dosyalarin tamaminda gecerli):
--   * VERI DEGISTIRILMEZ — hicbir INSERT/UPDATE/DELETE yoktur, yalniz DDL.
--   * CATISMADA URETIM KAZANIR — govdeler uretim dokumundan birebir alinmistir.
--   * IDEMPOTENT — dosya iki kez kosturulsa da hata vermez.
--   * GRUP D'ye (repoda da uretimde de ayni olan nesneler) DOKUNULMAZ.
--
-- UYGULAMA: Supabase Dashboard > SQL Editor. Terminale yapistirilmaz.
-- =============================================================================

BEGIN;

-- business_invitations
CREATE INDEX IF NOT EXISTS no_duplicate_pending_business_invitation ON public.business_invitations USING btree (business_id, invited_email) WHERE (status = 'pending'::business_invitation_status);

COMMIT;
