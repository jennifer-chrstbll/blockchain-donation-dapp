-- ============================================================
-- SQL untuk Menghapus Duplikat pada tabel organizer_reputation
-- ============================================================

-- 1. Hapus duplikat (menyisakan 1 row untuk tiap wallet yang sama meskipun beda huruf besar/kecil)
DELETE FROM organizer_reputation
WHERE ctid NOT IN (
  SELECT min(ctid)
  FROM organizer_reputation
  GROUP BY LOWER(wallet)
);

-- 2. (Opsional tapi sangat disarankan) 
-- Jadikan semua wallet huruf kecil agar aman kedepannya
UPDATE organizer_reputation
SET wallet = LOWER(wallet);

UPDATE profiles
SET wallet_address = LOWER(wallet_address);
