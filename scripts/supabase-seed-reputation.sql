-- ============================================================
-- Seed organizer_reputation dari data top_organizer yang sudah ada
-- Jalankan di Supabase SQL Editor
-- Rules: rep_score = total_campaign_sukses * 10
--        (sesuai aturan +10 per campaign sukses)
-- ============================================================

INSERT INTO organizer_reputation (wallet, rep_score, campaigns_completed, votes_on_time, votes_missed, slashed_count, needs_chain_sync)
VALUES
  -- rank 1: Gabiru3, 8 kampanye sukses
  ('0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', 80, 8, 0, 0, 0, true),
  -- rank 2: Charlie Kirk, 7 kampanye sukses
  ('0xdD2FD4581271e230360230F9337D5c0430Bf44C0', 70, 7, 0, 0, 0, true),
  -- rank 3: Bimbim, 6 kampanye sukses
  ('0xFABB0ac9d68B0B445fB7357272Ff202C5651694a', 60, 6, 0, 0, 0, true),
  -- rank 4: Gabiru1, 5 kampanye sukses
  ('0x976EA74026E726554dB657fA54763abd0C3a0aa9', 50, 5, 0, 0, 0, true),
  -- rank 5: Ppyong, 5 kampanye sukses
  ('0xa0Ee7A142d267C1f36714E4a8F75612F20a79720', 50, 5, 0, 0, 0, true),
  -- rank 6: Chirae, 4 kampanye sukses
  ('0xBcd4042DE499D14e55001CcbB24a551F3b954096', 40, 4, 0, 0, 0, true),
  -- rank 7: Kute, 3 kampanye sukses
  ('0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 30, 3, 0, 0, 0, true),
  -- rank 8: Bells, 3 kampanye sukses
  ('0x71bE63f3384f5fb98995898A86B02Fb2426c5788', 30, 3, 0, 0, 0, true),
  -- rank 9: Gabiru, 2 kampanye sukses
  ('0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', 20, 2, 0, 0, 0, true),
  -- rank 10: YUNI, 2 kampanye sukses
  ('0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec', 20, 2, 0, 0, 0, true)
ON CONFLICT (wallet) DO UPDATE
  SET rep_score           = EXCLUDED.rep_score,
      campaigns_completed = EXCLUDED.campaigns_completed,
      needs_chain_sync    = true,
      updated_at          = NOW();

-- Verifikasi
SELECT wallet, rep_score, campaigns_completed, needs_chain_sync
FROM organizer_reputation
ORDER BY rep_score DESC;
