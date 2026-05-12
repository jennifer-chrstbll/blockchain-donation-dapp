-- Tambah kolom alasan ke tabel laporan (jika belum ada)
ALTER TABLE laporan ADD COLUMN IF NOT EXISTS alasan TEXT;

-- Tambah kolom fundraising_finished_early_at ke kampanye_aktif
ALTER TABLE kampanye_aktif ADD COLUMN IF NOT EXISTS fundraising_finished_early_at TIMESTAMPTZ;

-- Verifikasi
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'laporan' ORDER BY ordinal_position;
