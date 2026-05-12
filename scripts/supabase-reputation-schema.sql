-- Jalankan file ini di Supabase SQL Editor untuk menambah tabel reputation + admins

-- 1) Tabel reputasi organizer/validator
CREATE TABLE IF NOT EXISTS organizer_reputation (
  wallet              TEXT PRIMARY KEY,
  rep_score           INTEGER NOT NULL DEFAULT 0,
  campaigns_completed INTEGER NOT NULL DEFAULT 0,
  votes_on_time       INTEGER NOT NULL DEFAULT 0,
  votes_missed        INTEGER NOT NULL DEFAULT 0,
  slashed_count       INTEGER NOT NULL DEFAULT 0,
  needs_chain_sync    BOOLEAN DEFAULT FALSE,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_rep_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rep_updated_at ON organizer_reputation;
CREATE TRIGGER trg_rep_updated_at
  BEFORE UPDATE ON organizer_reputation
  FOR EACH ROW EXECUTE FUNCTION update_rep_timestamp();

-- 2) Tabel admin (mirror on-chain state)
CREATE TABLE IF NOT EXISTS admins (
  wallet      TEXT PRIMARY KEY,
  added_by    TEXT NOT NULL DEFAULT 'system',
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  is_active   BOOLEAN DEFAULT TRUE,
  is_primary  BOOLEAN DEFAULT FALSE
);

-- 3) Enable RLS + policy public read + anon write
ALTER TABLE organizer_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins               ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rep_read_all' AND tablename = 'organizer_reputation') THEN
    CREATE POLICY rep_read_all ON organizer_reputation FOR SELECT TO public USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rep_upsert_anon' AND tablename = 'organizer_reputation') THEN
    CREATE POLICY rep_upsert_anon ON organizer_reputation FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins_read_all' AND tablename = 'admins') THEN
    CREATE POLICY admins_read_all ON admins FOR SELECT TO public USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins_write_anon' AND tablename = 'admins') THEN
    CREATE POLICY admins_write_anon ON admins FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Verifikasi
SELECT 'organizer_reputation OK' AS tabel, count(*) AS baris FROM organizer_reputation
UNION ALL
SELECT 'admins OK', count(*) FROM admins;
