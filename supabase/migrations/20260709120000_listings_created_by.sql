-- =============================================================================
-- Kurumsal Ekip — Yazma Pass DİLİM 2 rötuş: listings.created_by (üye izi)
--
-- Kurum adına oluşturulan ilanda creator_id = KURUMUN id'si; created_by ise
-- ilanı fiilen oluşturan üyenin auth.uid()'si. quote_requests.created_by
-- kalıbının aynısı (nullable, DEFAULT yok — eski satırlar NULL = iz yok).
--
-- Kendi adına oluşturmada da created_by = user.id yazılır (createListing action),
-- bu durumda created_by === creator_id olur.
--
-- Dashboard'dan manuel apply (db push YOK). Idempotent + atomik.
-- =============================================================================

BEGIN;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id);

COMMIT;
