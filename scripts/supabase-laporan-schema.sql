-- ============================================================
-- Tabel: laporan
-- Jalankan di Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS laporan (
  id                  BIGSERIAL PRIMARY KEY,
  campaign_db_id      TEXT NOT NULL,          -- id di tabel pengajuan_campaign / kampanye_aktif
  campaign_id_onchain INTEGER NOT NULL,       -- campaign_id di StakingManager
  report_id_onchain   INTEGER NOT NULL,       -- reportId di StakingManager
  reporter_wallet     TEXT NOT NULL,          -- wallet address reporter (lowercase)
  stake_bond_wei      TEXT NOT NULL,          -- stakeBond dalam wei (string karena bigint)
  voting_fee_wei      TEXT NOT NULL,          -- votingFee dalam wei
  voting_contract     TEXT,                   -- address GovernanceVoting untuk report ini
  status              TEXT NOT NULL DEFAULT 'submitted',  -- submitted | approved | rejected
  submit_tx_hash      TEXT,
  finalize_tx_hash    TEXT,
  finalized_at        TIMESTAMPTZ,
  alasan              TEXT,                   -- opsional: alasan pelapor
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- Index untuk query cepat
CREATE INDEX IF NOT EXISTS laporan_campaign_db_id_idx ON laporan(campaign_db_id);
CREATE INDEX IF NOT EXISTS laporan_reporter_wallet_idx ON laporan(reporter_wallet);
CREATE INDEX IF NOT EXISTS laporan_status_idx ON laporan(status);

-- Enable Realtime (untuk auto-refresh frontend)
ALTER TABLE laporan REPLICA IDENTITY FULL;
