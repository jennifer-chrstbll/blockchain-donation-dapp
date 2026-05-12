-- ============================================================
-- Ban System Migration (Lengkap)
-- Jalankan semua baris ini di Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Kolom is_banned (jika belum ada)
ALTER TABLE organizer_reputation
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE NOT NULL;

-- 2. Kolom display_name (nama user dari profiles)
ALTER TABLE organizer_reputation
  ADD COLUMN IF NOT EXISTS display_name TEXT DEFAULT NULL;

-- 3. Kolom ban_reason (alasan ban, ditampilkan ke user)
ALTER TABLE organizer_reputation
  ADD COLUMN IF NOT EXISTS ban_reason TEXT DEFAULT NULL;

-- 4. Sync display_name dari profiles yang sudah ada di DB
UPDATE organizer_reputation rep
SET display_name = p.nama
FROM profiles p
WHERE LOWER(p.wallet_address) = rep.wallet
  AND p.nama IS NOT NULL;

-- 5. Verifikasi
SELECT wallet, display_name, is_banned, ban_reason, rep_score
FROM organizer_reputation
ORDER BY rep_score DESC;
