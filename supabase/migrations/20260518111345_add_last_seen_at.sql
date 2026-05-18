-- profiles tablosuna last_seen_at kolonu ekle
ALTER TABLE profiles
  ADD COLUMN last_seen_at TIMESTAMPTZ;

-- Index — "son N dakikada aktifti" sorgularını hızlandırmak için
CREATE INDEX profiles_last_seen_at_idx ON profiles(last_seen_at DESC);

-- Mevcut kayıtları doldur — login olan tüm kullanıcılara şu anki tarihi yaz
-- (yoksa eski hesaplar "hiç aktif olmadı" görünür, kötü ilk izlenim)
UPDATE profiles
SET last_seen_at = now()
WHERE last_seen_at IS NULL;