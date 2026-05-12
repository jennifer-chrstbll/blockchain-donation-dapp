import { useState, useEffect, useCallback } from "react";
import {
  FiShield, FiPlus, FiTrash2, FiStar, FiRefreshCw,
  FiAlertCircle, FiCheck, FiUsers, FiAward, FiTrendingUp,
  FiSearch, FiSlash, FiUserCheck,
} from "react-icons/fi";
import NavbarAdmin from "../../components/navbar-admin";
import { useCampaign } from "../../context/CampaignContext";
import { ethers } from "ethers";
import "../../styles/admin/kelola-admin.css";

function shortAddr(addr = "") {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

export default function KelolaAdmin() {
  const {
    getAdminListOnChain,
    addAdminOnChain,
    removeAdminOnChain,
    setPrimaryAdminOnChain,
    reputation,
    fetchReputation,
    autoSyncTop10,
    syncTop10ToChain,
    setBanStatusOnChain,
  } = useCampaign();

  const [adminList, setAdminList]   = useState([]);
  const [primaryAdmin, setPrimary]  = useState("");
  const [chainLoading, setChainLoading] = useState(false);
  const [chainErr, setChainErr]     = useState("");

  const [newAddr, setNewAddr]       = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addErr, setAddErr]         = useState("");
  const [addOk, setAddOk]           = useState("");

  const [removeLoading, setRemoveLoading] = useState(null);
  const [actionErr, setActionErr]   = useState("");
  const [actionOk, setActionOk]     = useState("");

  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult]   = useState(null);

  const [userSearch, setUserSearch]   = useState("");
  const [banLoading, setBanLoading]   = useState(null);
  // Modal untuk ban reason
  const [banModal, setBanModal]       = useState(null); // { wallet, name } or null
  const [banReasonText, setBanReasonText] = useState("");

  const loadChainAdmins = useCallback(async () => {
    setChainErr("");
    setChainLoading(true);
    try {
      const { list, primary } = await getAdminListOnChain();
      setAdminList(list || []);
      setPrimary((primary || "").toLowerCase());
    } catch (e) {
      setChainErr(e?.shortMessage || e?.message || String(e));
    } finally {
      setChainLoading(false);
    }
  }, [getAdminListOnChain]);

  useEffect(() => {
    loadChainAdmins();
    fetchReputation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setAddErr(""); setAddOk("");
    const addr = newAddr.trim();
    if (!ethers.isAddress(addr)) return setAddErr("Alamat wallet tidak valid.");
    setAddLoading(true);
    try {
      await addAdminOnChain(addr);
      setAddOk(`Admin ${shortAddr(addr)} berhasil ditambahkan!`);
      setNewAddr("");
      await loadChainAdmins();
    } catch (e) {
      setAddErr(e?.shortMessage || e?.message || String(e));
    } finally { setAddLoading(false); }
  }

  async function handleRemove(addr) {
    setActionErr(""); setActionOk("");
    setRemoveLoading(addr);
    try {
      await removeAdminOnChain(addr);
      setActionOk(`Admin ${shortAddr(addr)} berhasil dihapus.`);
      await loadChainAdmins();
    } catch (e) {
      setActionErr(e?.shortMessage || e?.message || String(e));
    } finally { setRemoveLoading(null); }
  }

  async function handleSetPrimary(addr) {
    setActionErr(""); setActionOk("");
    try {
      await setPrimaryAdminOnChain(addr);
      setActionOk(`${shortAddr(addr)} dijadikan Primary Admin (penerima fee).`);
      await loadChainAdmins();
    } catch (e) {
      setActionErr(e?.shortMessage || e?.message || String(e));
    }
  }

  // Buka modal konfirmasi ban dengan input alasan
  function openBanModal(wallet, name) {
    setBanReasonText("");
    setBanModal({ wallet, name });
  }

  // Eksekusi ban dengan alasan dari modal
  async function handleConfirmBan() {
    if (!banModal) return;
    setActionErr(""); setActionOk("");
    setBanLoading(banModal.wallet);
    setBanModal(null);
    try {
      await setBanStatusOnChain(banModal.wallet, true, banReasonText.trim() || "Dibanned oleh admin.");
      setActionOk(`User ${banModal.name || shortAddr(banModal.wallet)} berhasil di-ban.`);
    } catch (e) {
      setActionErr(e?.shortMessage || e?.message || String(e));
    } finally {
      setBanLoading(null);
    }
  }

  // Unban langsung tanpa modal
  async function handleUnban(wallet, name) {
    setActionErr(""); setActionOk("");
    setBanLoading(wallet);
    try {
      await setBanStatusOnChain(wallet, false, "");
      setActionOk(`User ${name || shortAddr(wallet)} berhasil di-unban.`);
    } catch (e) {
      setActionErr(e?.shortMessage || e?.message || String(e));
    } finally {
      setBanLoading(null);
    }
  }

  async function handleSyncTop10() {
    setSyncLoading(true);
    setSyncResult(null);
    try {
      const res = await autoSyncTop10();
      setSyncResult(res);
    } catch (e) {
      setSyncResult({ synced: false, error: e?.message || String(e) });
    } finally { setSyncLoading(false); }
  }

  async function handleManualSync() {
    // Sync dengan hardhat signers (dev)
    setSyncLoading(true);
    setSyncResult(null);
    try {
      const top10 = reputation.slice(0, 10).map((r) => r.wallet);
      if (top10.length < 6) throw new Error("Perlu minimal 6 organizer di tabel reputasi. Tambah data rep dulu.");
      await syncTop10ToChain(top10);
      setSyncResult({ synced: true, top10 });
    } catch (e) {
      setSyncResult({ synced: false, error: e?.message || String(e) });
    } finally { setSyncLoading(false); }
  }

  const needsSync = reputation.some((r) => r.needs_chain_sync);

  const filteredUsers = (reputation || []).filter(r => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return (
      r.wallet.toLowerCase().includes(q) ||
      (r.display_name || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="ka-wrapper">
      <NavbarAdmin />
      <main className="ka-main">

        {/* Header */}
        <div className="ka-header">
          <div>
            <h1 className="ka-title">
              <FiShield size={20} color="#a855f7" /> Pengelolaan Admin
            </h1>
            <p className="ka-sub">
              Kelola admin on-chain, sync top10 validators, dan manajemen ban user.
            </p>
          </div>
          <button className="ka-btn-refresh" onClick={() => { loadChainAdmins(); fetchReputation(); }} disabled={chainLoading}>
            <FiRefreshCw size={14} /> Refresh
          </button>
        </div>

        <div className="ka-grid">

          {/* === Daftar Admin === */}
          <div className="ka-card">
            <h2 className="ka-card-title"><FiUsers size={15} /> Admin On-chain</h2>

            {chainErr && (
              <div className="ka-alert-err"><FiAlertCircle size={13} /> {chainErr}</div>
            )}
            {actionErr && (
              <div className="ka-alert-err"><FiAlertCircle size={13} /> {actionErr}</div>
            )}
            {actionOk && (
              <div className="ka-alert-ok"><FiCheck size={13} /> {actionOk}</div>
            )}

            <div className="ka-admin-list">
              {chainLoading && (
                <p className="ka-loading">Membaca dari chain...</p>
              )}
              {!chainLoading && adminList.length === 0 && !chainErr && (
                <p className="ka-empty-hint">Tidak ada admin ditemukan.</p>
              )}
              {adminList.map((addr) => {
                const addrLow = addr.toLowerCase();
                const isPrimary = addrLow === primaryAdmin;
                return (
                  <div key={addr} className={`ka-admin-row ${isPrimary ? "ka-admin-row--primary" : ""}`}>
                    <div className="ka-admin-info">
                      {isPrimary && (
                        <span className="ka-primary-badge"><FiStar size={10} /> Primary</span>
                      )}
                      <code className="ka-addr">{addr}</code>
                    </div>
                    <div className="ka-admin-actions">
                      {!isPrimary && (
                        <button
                          className="ka-btn-icon ka-btn-star"
                          title="Jadikan primary admin"
                          onClick={() => handleSetPrimary(addr)}
                        >
                          <FiStar size={13} />
                        </button>
                      )}
                      {adminList.length > 1 && (
                        <button
                          className="ka-btn-icon ka-btn-trash"
                          title="Hapus admin ini"
                          onClick={() => handleRemove(addr)}
                          disabled={removeLoading === addr}
                        >
                          {removeLoading === addr ? <FiRefreshCw size={13} /> : <FiTrash2 size={13} />}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tambah Admin */}
            <div className="ka-add-section">
              <h3 className="ka-section-sub">Tambah Admin Baru</h3>
              {addErr && <div className="ka-alert-err"><FiAlertCircle size={12} /> {addErr}</div>}
              {addOk  && <div className="ka-alert-ok"><FiCheck size={12} /> {addOk}</div>}
              <form className="ka-add-form" onSubmit={handleAdd}>
                <input
                  type="text"
                  className="ka-input"
                  placeholder="0x... alamat wallet admin baru"
                  value={newAddr}
                  onChange={(e) => setNewAddr(e.target.value)}
                  disabled={addLoading}
                />
                <button
                  type="submit"
                  className="ka-btn-add"
                  disabled={addLoading || !newAddr.trim()}
                >
                  {addLoading ? <FiRefreshCw size={14} /> : <FiPlus size={14} />}
                  {addLoading ? "Memproses..." : "Tambah"}
                </button>
              </form>
              <p className="ka-hint">
                Admin baru dapat mengelola pengajuan, laporan, dan campaign. Primary admin menerima fee & slash.
              </p>
            </div>
          </div>

          {/* === Reputation & Sync Top10 === */}
          <div className="ka-card">
            <div className="ka-card-title-row">
              <h2 className="ka-card-title"><FiAward size={15} /> Reputasi & Top10 Validators</h2>
              {needsSync && (
                <span className="ka-needs-sync-badge">
                  Perlu Sync
                </span>
              )}
            </div>

            <p className="ka-desc">
              Skor reputasi dihitung otomatis setelah setiap aksi penting.<br />
              Top10 terbaik akan menjadi validator untuk voting campaign berikutnya.
            </p>

            <div className="ka-rep-legend">
              <span className="ka-rep-item ka-rep-plus">+10 Campaign selesai sukses</span>
              <span className="ka-rep-item ka-rep-plus">+2 Voter on-time</span>
              <span className="ka-rep-item ka-rep-minus">-5 Voter missed/diganti</span>
              <span className="ka-rep-item ka-rep-minus">-50 Organizer di-slash</span>
            </div>

            {/* Tabel reputasi */}
            <div className="ka-rep-table-wrapper">
              <table className="ka-rep-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Wallet</th>
                    <th>Score</th>
                    <th>Selesai</th>
                    <th>On-time</th>
                    <th>Missed</th>
                    <th>Slashed</th>
                    <th>Sync</th>
                  </tr>
                </thead>
                <tbody>
                  {reputation.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", opacity: 0.4, padding: "20px" }}>
                        Belum ada data reputasi. Mulai testing untuk mengisi tabel ini.
                      </td>
                    </tr>
                  )}
                  {reputation.map((r, i) => (
                    <tr key={r.wallet} className={i < 10 ? "ka-rep-top10" : ""}>
                      <td style={{ color: i < 10 ? "#a855f7" : "rgba(255,255,255,0.4)", fontWeight: 700 }}>
                        {i + 1}
                      </td>
                      <td><code className="ka-addr-sm">{shortAddr(r.wallet)}</code></td>
                      <td style={{ fontWeight: 800, color: r.rep_score >= 0 ? "#22c55e" : "#ef4444" }}>
                        {r.rep_score > 0 ? `+${r.rep_score}` : r.rep_score}
                      </td>
                      <td style={{ textAlign: "center" }}>{r.campaigns_completed}</td>
                      <td style={{ textAlign: "center" }}>{r.votes_on_time}</td>
                      <td style={{ textAlign: "center" }}>{r.votes_missed}</td>
                      <td style={{ textAlign: "center" }}>{r.slashed_count}</td>
                      <td style={{ textAlign: "center" }}>
                        {r.needs_chain_sync
                          ? <span style={{ color: "#fbbf24", fontSize: 11 }}>Pending</span>
                          : <span style={{ color: "#22c55e", fontSize: 11 }}>Synced</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sync buttons */}
            <div className="ka-sync-actions">
              <button
                className="ka-btn-sync"
                onClick={handleSyncTop10}
                disabled={syncLoading}
                title="Auto-ambil top10 dari Supabase dan sync ke chain"
              >
                {syncLoading ? <FiRefreshCw size={14} /> : <FiTrendingUp size={14} />}
                {syncLoading ? "Syncing..." : "Auto-Sync Top10 ke Chain"}
              </button>
              <button
                className="ka-btn-refresh"
                onClick={fetchReputation}
                title="Refresh data reputasi"
              >
                <FiRefreshCw size={13} /> Refresh Rep
              </button>
            </div>

            {syncResult && (
              <div className={syncResult.synced ? "ka-alert-ok" : "ka-alert-err"} style={{ marginTop: 10 }}>
                {syncResult.synced
                  ? `Top10 berhasil disync ke chain! (${syncResult.top10?.length || 0} validator)`
                  : `Sync gagal: ${syncResult.error || "Wallet bukan admin atau rep < 6 organizer"}`
                }
              </div>
            )}
          </div>

          {/* === User Management & Ban === */}
          <div className="ka-card" style={{ gridColumn: "1 / -1" }}>
            <div className="ka-card-title-row">
              <h2 className="ka-card-title"><FiUsers size={15} /> Manajemen User & Ban
                <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.35)", marginLeft: 8 }}>
                  {filteredUsers.filter(r => r.is_banned).length} banned · {filteredUsers.length} total
                </span>
              </h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div className="ka-search-box">
                  <FiSearch size={14} />
                  <input
                    type="text"
                    placeholder="Cari nama atau wallet..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="ka-search-input-mini"
                  />
                </div>
                <button
                  className="ka-btn-refresh"
                  onClick={fetchReputation}
                  title="Sync data user dari Supabase"
                >
                  <FiRefreshCw size={13} /> Sync Data
                </button>
              </div>
            </div>

            <div className="ka-rep-table-wrapper" style={{ marginTop: 15 }}>
              <table className="ka-rep-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nama / Wallet</th>
                    <th>Score</th>
                    <th>Slashed</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", opacity: 0.4, padding: "20px" }}>
                        Tidak ada user ditemukan.
                      </td>
                    </tr>
                  )}
                  {filteredUsers.map((r, idx) => (
                    <tr key={r.wallet} className={r.is_banned ? "ka-row-banned" : ""}>
                      <td style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{idx + 1}</td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {r.display_name ? (
                            <span style={{ fontWeight: 700, fontSize: 13, color: r.is_banned ? "#fca5a5" : "rgba(255,255,255,0.9)" }}>
                              {r.display_name}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>Nama tidak tersedia</span>
                          )}
                          <code className="ka-addr-sm" style={{ fontSize: 10 }}>{shortAddr(r.wallet)}</code>
                          {r.ban_reason && r.is_banned && (
                            <span style={{ fontSize: 10, color: "rgba(239,68,68,0.6)", fontStyle: "italic" }}>
                              Alasan: {r.ban_reason}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontWeight: 800, color: r.rep_score >= 0 ? "#22c55e" : "#ef4444" }}>
                        {r.rep_score > 0 ? `+${r.rep_score}` : r.rep_score}
                      </td>
                      <td style={{ textAlign: "center" }}>{r.slashed_count}</td>
                      <td>
                        {/* Chip Toggle Ban / Aktif */}
                        <div
                          className={`ka-ban-chip ${r.is_banned ? "ka-ban-chip--banned" : "ka-ban-chip--active"}`}
                          onClick={() => {
                            if (banLoading === r.wallet) return;
                            if (r.is_banned) {
                              handleUnban(r.wallet, r.display_name);
                            } else {
                              openBanModal(r.wallet, r.display_name);
                            }
                          }}
                          title={r.is_banned ? "Klik untuk Unban" : "Klik untuk Ban"}
                        >
                          {banLoading === r.wallet ? (
                            <FiRefreshCw size={11} className="ka-spin" />
                          ) : (
                            <div className="ka-ban-chip-track">
                              <div className="ka-ban-chip-thumb" />
                            </div>
                          )}
                          <span className="ka-ban-chip-label">
                            {r.is_banned ? <><FiSlash size={10} /> Banned</> : <><FiCheck size={10} /> Aktif</>}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>

      {/* === Modal Ban Reason === */}
      {banModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
        }} onClick={() => setBanModal(null)}>
          <div style={{
            background: "#121218",
            border: "1px solid rgba(239,68,68,0.35)",
            borderRadius: 20,
            padding: 28,
            width: "100%",
            maxWidth: 460,
            boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          }} onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{
                background: "rgba(239,68,68,0.15)",
                borderRadius: "50%", width: 44, height: 44,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <FiSlash size={20} color="#ef4444" />
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: "#fff" }}>Konfirmasi Ban User</p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                  {banModal.name || shortAddr(banModal.wallet)}
                </p>
              </div>
            </div>

            {/* Info */}
            <div style={{
              background: "rgba(239,68,68,0.07)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 10, padding: "10px 14px", marginBottom: 18, fontSize: 12,
              color: "rgba(252,165,165,0.8)", lineHeight: 1.6,
            }}>
              User ini akan <strong style={{ color: "#fca5a5" }}>tidak bisa</strong> melakukan donasi, laporan, atau membuat campaign.
              Alasan ban akan ditampilkan kepada user yang bersangkutan.
            </div>

            {/* Reason input */}
            <label style={{ display: "block", marginBottom: 8, fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
              Alasan Ban <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>(opsional — akan ditampilkan ke user)</span>
            </label>
            <textarea
              value={banReasonText}
              onChange={(e) => setBanReasonText(e.target.value)}
              placeholder="Contoh: Melanggar kebijakan platform / Campaign terbukti fiktif..."
              rows={3}
              style={{
                width: "100%", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10,
                padding: "10px 14px", color: "#fff", fontSize: 13,
                outline: "none", resize: "none", fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button
                onClick={() => setBanModal(null)}
                style={{
                  flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)",
                  background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: 13,
                  fontWeight: 600, cursor: "pointer",
                }}
              >
                Batal
              </button>
              <button
                onClick={handleConfirmBan}
                style={{
                  flex: 2, padding: "11px 0", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg, #991b1b, #dc2626)",
                  color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                <FiSlash size={14} /> Konfirmasi Ban
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
