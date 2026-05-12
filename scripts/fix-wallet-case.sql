-- ============================================================
-- Fix Wallet Case Sensitivity & Deduplication
-- Jalankan di Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Pastikan semua wallet di organizer_reputation di-lowercase
UPDATE organizer_reputation
SET wallet = LOWER(wallet);

-- 2. Pastikan semua wallet_address di profiles di-lowercase
UPDATE profiles
SET wallet_address = LOWER(wallet_address);

-- Catatan: Jika query #1 gagal karena duplicate key (sudah ada 0xABC dan 0xabc),
-- Anda harus menghapus duplikat secara manual.
-- Untuk melihat duplikat:
-- SELECT LOWER(wallet), COUNT(*) FROM organizer_reputation GROUP BY LOWER(wallet) HAVING COUNT(*) > 1;

-- Jika Anda ingin langsung menghapus duplikat, simpan yang rep_score nya lebih tinggi / is_banned nya true.
-- Tapi cara paling aman untuk sementara adalah hapus user duplikat secara manual di Table Editor.
