import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FiUser, FiFileText, FiGrid, FiClock, FiCheckCircle, FiXCircle,
  FiAlertCircle, FiTrendingUp, FiUsers, FiActivity,
  FiChevronRight, FiSearch, FiEye, FiRefreshCw
} from "react-icons/fi";
import NavbarAdmin from "../../components/navbar-admin";
import { useCampaign } from "../../context/CampaignContext";
import "../../styles/admin/home-admin.css";

const DUMMY_STATS = {
  totalDonasi: "47.82 ETH",
  totalDonatur: 1284,
};

const DUMMY_AKTIVITAS = [
  { type: "approve", pesan: "Kampanye 'Bantu Korban Banjir Jawa Barat' disetujui & smart contract di-deploy", waktu: "4 Mar 2026, 09:00" },
  { type: "donasi",  pesan: "Donasi masuk 0.25 ETH ke kampanye 'Bantu Korban Banjir'", waktu: "4 Mar 2026, 11:30" },
];

function HomeAdmin() {
  const { pengajuanList, kampanyeAktif, notifAdmin, syncTop10ToChain } = useCampaign();
  const [searchPengajuan, setSearchPengajuan] = useState("");
  const [syncing, setSyncing] = useState(false);

  const currentUser = JSON.parse(sessionStorage.getItem("currentUser") || "{}");
  const walletAdmin = currentUser.wallet || "";
  const namaAdmin = currentUser.nama || "Admin";

  const countPending = pengajuanList.filter(p => p.status === "pending").length;
  // Hanya hitung yang benar-benar aktif (bukan selesai/ditutup/arsip)
  const countAktif   = kampanyeAktif.filter(k => k.status === "aktif").length;

  const aktivitasReal = notifAdmin.map(n => ({
    type:  n.type === "pengajuan_baru" ? "pengajuan" : n.type,
    pesan: n.pesan,
    waktu: n.waktu,
  }));
  // Batasi log maksimal 3 item agar sejajar sempurna dengan kolom kiri
  const aktivitas = [...aktivitasReal, ...DUMMY_AKTIVITAS].slice(0, 3);

  const pengajuanTerbaru = pengajuanList.slice(0, 3).map(p => ({
    id:      p.id,
    nama:    p.namaOrganisasi,
    judul:   p.judulKampanye,
    jenis:   p.jenisVerifikasi,
    tanggal: p.tanggalMasuk,
    status:  p.status,
  }));

  const filteredPengajuan = pengajuanTerbaru.filter(p =>
    p.nama.toLowerCase().includes(searchPengajuan.toLowerCase()) ||
    p.judul.toLowerCase().includes(searchPengajuan.toLowerCase())
  );

  const statusConfig = {
    pending:   { label: "Pending",   icon: <FiClock size={11} />,       className: "da-badge-pending"  },
    voting:    { label: "Voting",    icon: <FiClock size={11} />,       className: "da-badge-pending"  },
    disetujui: { label: "Disetujui", icon: <FiCheckCircle size={11} />, className: "da-badge-approved" },
    ditolak:   { label: "Ditolak",   icon: <FiXCircle size={11} />,     className: "da-badge-rejected" },
  };

  const aktivitasIcon = {
    pengajuan: <FiFileText size={15} color="#ffa757" />,
    approve:   <FiCheckCircle size={15} color="#22c55e" />,
    reject:    <FiXCircle size={15} color="#ef4444" />,
    donasi:    <FiTrendingUp size={15} color="#57a3ff" />,
  };

  async function handleSyncTop10() {
    if (!syncTop10ToChain) return;
    setSyncing(true);
    try {
      await syncTop10ToChain();
      alert("Top10 berhasil di-sync ke chain!");
    } catch (e) {
      alert(e?.shortMessage || e?.message || String(e));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="da-wrapper">
      <NavbarAdmin />

      <main className="da-main">
        {/* WELCOME */}
        <div className="da-welcome-row">
          <div>
            <h1 className="da-welcome-title">Dashboard Admin</h1>
            <p className="da-welcome-sub">
              Kamis, 5 Maret 2026 &nbsp;·&nbsp;
              {countPending > 0 && (
                <span className="da-urgent-text">
                  <FiAlertCircle size={13} /> {countPending} pengajuan menunggu review
                </span>
              )}
            </p>

            {/* Info Admin + Wallet */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 12px",
                background: "rgba(255,255,255,0.06)",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
              }}>
                <FiUser size={13} color="#c084fc" />
                <span style={{ fontSize: 12, opacity: 0.6 }}>Admin:</span>
                <span style={{ fontSize: 12, color: "#c084fc", fontWeight: 500 }}>{namaAdmin}</span>
              </div>

              {walletAdmin ? (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 12px",
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.1)",
                }}>
                  <span style={{ fontSize: 14 }}></span>
                  <span style={{ fontSize: 12, opacity: 0.5 }}>Wallet aktif:</span>
                  <code style={{ fontSize: 12, color: "#22c55e" }}>
                    {walletAdmin.slice(0, 10)}...{walletAdmin.slice(-6)}
                  </code>
                </div>
              ) : (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 12px",
                  background: "rgba(239,68,68,0.08)",
                  borderRadius: 8,
                  border: "1px solid rgba(239,68,68,0.2)",
                }}>
                  <span style={{ fontSize: 12, color: "#ef4444" }}>
                    Wallet belum terhubung
                  </span>
                </div>
              )}
            </div>
          </div>

          <Link to="/admin/pengajuan" className="da-btn-review">
            Review Pengajuan <FiChevronRight size={15} />
          </Link>
        </div>

        {/* STATS CARDS */}
        <div className="da-stats-grid">
          <div className="da-stat-card pending">
            <div className="da-stat-icon"><FiClock size={20} color="#ffa757" /></div>
            <div>
              <p className="da-stat-value">{countPending}</p>
              <p className="da-stat-label">Pengajuan Pending</p>
            </div>
          </div>

          <div className="da-stat-card campaign">
            <div className="da-stat-icon"><FiGrid size={20} color="#57a3ff" /></div>
            <div>
              <p className="da-stat-value">{countAktif}</p>
              <p className="da-stat-label">Kampanye Aktif</p>
            </div>
          </div>

          <div className="da-stat-card donasi">
            <div className="da-stat-icon"><FiTrendingUp size={20} color="#22c55e" /></div>
            <div>
              <p className="da-stat-value">{DUMMY_STATS.totalDonasi}</p>
              <p className="da-stat-label">Total Donasi On-chain</p>
            </div>
          </div>

          <div className="da-stat-card donatur">
            <div className="da-stat-icon"><FiUsers size={20} color="#c084fc" /></div>
            <div>
              <p className="da-stat-value">{DUMMY_STATS.totalDonatur.toLocaleString()}</p>
              <p className="da-stat-label">Total Donatur</p>
            </div>
          </div>
        </div>

        <div className="da-content">
          {/* KOLOM KIRI */}
          <div className="da-left">
            {/* Tabel Pengajuan */}
            <div className="da-card">
              <div className="da-card-header">
                <div>
                  <h2 className="da-card-title"><FiFileText size={16} /> Pengajuan Terbaru</h2>
                  <p className="da-card-sub">{countPending} pengajuan perlu ditinjau</p>
                </div>
                <div className="da-search-mini">
                  <FiSearch size={13} color="rgba(255,255,255,0.35)" />
                  <input
                    type="text"
                    placeholder="Cari..."
                    value={searchPengajuan}
                    onChange={(e) => setSearchPengajuan(e.target.value)}
                    className="da-search-input"
                  />
                </div>
              </div>

              <div className="da-table-wrapper">
                <table className="da-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Nama / Kampanye</th>
                      <th>Jenis</th>
                      <th>Tanggal</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPengajuan.map((p) => {
                      const sc = statusConfig[p.status] || { label: p.status, icon: <FiClock size={11} />, className: "da-badge-pending" };
                      return (
                        <tr key={p.id} className="da-table-row">
                          <td><code className="da-req-id">{p.id}</code></td>
                          <td>
                            <p className="da-nama">{p.nama}</p>
                            <p className="da-judul-kecil">{p.judul}</p>
                          </td>
                          <td><span className="da-jenis">{p.jenis}</span></td>
                          <td><span className="da-tanggal">{p.tanggal}</span></td>
                          <td>
                            <span className={`da-badge ${sc.className}`}>
                              {sc.icon} {sc.label}
                            </span>
                          </td>
                          <td>
                            <Link to={`/admin/pengajuan/${p.id}`} className="da-btn-detail">
                              <FiEye size={13} /> Review
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="da-card-footer">
                <Link to="/admin/pengajuan" className="da-see-all">
                  Lihat semua pengajuan <FiChevronRight size={13} />
                </Link>
              </div>
            </div>

            {/* Kampanye Aktif */}
            <div className="da-card">
              <div className="da-card-header">
                <div>
                  <h2 className="da-card-title"><FiGrid size={16} /> Kampanye Aktif</h2>
                  <p className="da-card-sub">{countAktif} kampanye berjalan</p>
                </div>
                <Link to="/admin/campaign" className="da-see-all">
                  Lihat semua <FiChevronRight size={13} />
                </Link>
              </div>

              <div className="da-kampanye-list">
                {kampanyeAktif.filter(k => k.status === "aktif" && !k.isArchived).slice(0, 3).map((k) => {
                  const persen = Math.min((k.terkumpulETH / k.targetETH) * 100, 100).toFixed(0);
                  const urgent = k.sisaHari <= 7;
                  return (
                    <div key={k.id} className={`da-kampanye-item ${urgent ? "urgent" : ""}`}>
                      <div className="da-kampanye-info">
                        <div className="da-kampanye-top">
                          <p className="da-kampanye-judul">{k.judul}</p>
                          {urgent && (
                            <span className="da-urgent-badge">
                              <FiClock size={10} /> {k.sisaHari}h lagi
                            </span>
                          )}
                        </div>
                        <p className="da-kampanye-org">{k.organizer}</p>
                        <div className="da-kampanye-progress-bg">
                          <div className="da-kampanye-progress-fill" style={{ width: `${persen}%` }} />
                        </div>
                        <div className="da-kampanye-stats">
                          <span className="da-kampanye-eth">{k.terkumpulETH}/{k.targetETH} ETH</span>
                          <span className="da-kampanye-donatur"><FiUsers size={11} /> {k.donatur}</span>
                          <span className="da-kampanye-persen">{persen}%</span>
                        </div>
                      </div>
                      <Link to={`/admin/campaign/${k.id}`} className="da-kampanye-btn">
                        <FiEye size={14} />
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* KOLOM KANAN */}
          <div className="da-right">
            <div className="da-card">
              <div className="da-card-header">
                <div>
                  <h2 className="da-card-title"><FiActivity size={16} /> Aktivitas Terbaru</h2>
                  <p className="da-card-sub">Real-time log platform</p>
                </div>
                <div className="da-live-badge">
                  <span className="da-live-dot" /> LIVE
                </div>
              </div>

              <div className="da-aktivitas-list">
                {aktivitas.map((a, i) => (
                  <div key={i} className="da-aktivitas-item">
                    <div className="da-aktivitas-icon">{aktivitasIcon[a.type]}</div>
                    <div className="da-aktivitas-info">
                      <p className="da-aktivitas-pesan">{a.pesan}</p>
                      <p className="da-aktivitas-waktu">{a.waktu}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="da-card da-quick-card">
              <h2 className="da-card-title" style={{ marginBottom: 16 }}>
                <FiUser size={16} /> Quick Actions
              </h2>

              <div className="da-quick-list">
                <Link to="/admin/pengajuan" className="da-quick-item">
                  <div className="da-quick-icon pending-icon">
                    <FiFileText size={18} color="#ffa757" />
                  </div>
                  <div>
                    <p className="da-quick-label">Review Pengajuan</p>
                    <p className="da-quick-sub">{countPending} menunggu</p>
                  </div>
                  <FiChevronRight size={16} color="rgba(255,255,255,0.3)" />
                </Link>

                <Link to="/admin/campaign" className="da-quick-item">
                  <div className="da-quick-icon campaign-icon">
                    <FiGrid size={18} color="#57a3ff" />
                  </div>
                  <div>
                    <p className="da-quick-label">Monitor Kampanye</p>
                    <p className="da-quick-sub">{countAktif} aktif</p>
                  </div>
                  <FiChevronRight size={16} color="rgba(255,255,255,0.3)" />
                </Link>

                <Link to="/admin/akun" className="da-quick-item">
                  <div className="da-quick-icon akun-icon">
                    <FiUser size={18} color="#c084fc" />
                  </div>
                  <div>
                    <p className="da-quick-label">Pengaturan Akun</p>
                    <p className="da-quick-sub">Profil & password</p>
                  </div>
                  <FiChevronRight size={16} color="rgba(255,255,255,0.3)" />
                </Link>

                {/* Sync Top10 */}
                <button
                  type="button"
                  className="da-quick-item"
                  onClick={handleSyncTop10}
                  disabled={syncing}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    cursor: syncing ? "not-allowed" : "pointer",
                    opacity: syncing ? 0.6 : 1,
                    background: "transparent",
                  }}
                >
                  <div className="da-quick-icon pending-icon">
                    <FiRefreshCw size={18} color="#ffa757" />
                  </div>
                  <div>
                    <p className="da-quick-label">{syncing ? "Syncing..." : "Sync Top10 ke Chain"}</p>
                    <p className="da-quick-sub">Ambil Top10 dari Supabase → setTop10()</p>
                  </div>
                  <FiChevronRight size={16} color="rgba(255,255,255,0.3)" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default HomeAdmin;