import { Link } from "react-router-dom";
import {
  FiTrendingUp, FiUsers, FiClock,
  FiExternalLink, FiChevronRight, FiPlusCircle
} from "react-icons/fi";
import NavbarUser from "../../components/navbar-user";
import BanGuard from "../../components/BanGuard";
import { useCampaign } from "../../context/CampaignContext";
import "../../styles/user/home-user.css";
import VoterNotification from "../../components/VoterNotification"; // <-- Komponen Baru

function getCurrentUser() {
  try { return JSON.parse(sessionStorage.getItem("currentUser")) || {}; } catch { return {}; }
}
function getInisial(nama = "") {
  return nama.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "??";
}

/* Baca riwayat donasi dari sessionStorage — diisi saat user berhasil donasi */
function getRiwayatDonasi() {
  try {
    return JSON.parse(sessionStorage.getItem("riwayatDonasi")) || [];
  } catch {
    return [];
  }
}

/* SVG heart berdebar — halus, tidak lebay */
function HeartIcon({ delay = 0, size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{ flexShrink: 0, animation: `duHeartbeat 2.4s ease ${delay}s infinite` }}
    >
      <style>{`
        @keyframes duHeartbeat {
          0%,100% { transform:scale(1); }
          20%      { transform:scale(1.18); }
          35%      { transform:scale(1); }
          50%      { transform:scale(1.1); }
          65%      { transform:scale(1); }
        }
      `}</style>
      <rect width="32" height="32" rx="9" fill="rgba(239,68,68,0.11)" />
      <path
        d="M16 23s-8-5.2-8-10.5a4.5 4.5 0 0 1 8-2.9 4.5 4.5 0 0 1 8 2.9C24 17.8 16 23 16 23z"
        fill="#ef4444"
      />
    </svg>
  );
}

function HomeUser() {
  const { kampanyeAktif, notifUser } = useCampaign();

  const user    = getCurrentUser();
  const nama    = user.nama || "User";
  const inisial = getInisial(nama);
  const wallet  = user.wallet || "";

  const hasNotif         = notifUser.some(n => !n.dibaca);
  const myWallet         = (wallet || "").toLowerCase();
  // Sembunyikan campaign milik sendiri + yang sudah selesai/arsip dari home
  const filteredKampanye = kampanyeAktif
    .filter(k =>
      (!myWallet || (k.walletOrganizer || "").toLowerCase() !== myWallet) &&
      k.status === "aktif" &&
      !k.isArchived
    )
    .slice(0, 3);

  /* ← baca dari sessionStorage, tampil 4 terbaru */
  const riwayat = getRiwayatDonasi().slice(0, 4);

  return (
    <div className="du-wrapper">
      <NavbarUser inisial={inisial} hasNotif={hasNotif} showSearch={false} />

      <main className="du-main">

        {/* BAN GUARD — muncul jika user sedang di-ban */}
        <BanGuard />

        {/* NOTIFIKASI VOTING (Otomatis muncul jika user adalah Voter) */}
        <VoterNotification />

        {/* WELCOME */}
        <div className="du-welcome-card">
          <div className="du-welcome-left">
            <div className="du-welcome-avatar">{inisial}</div>
            <div>
              <p className="du-welcome-greeting">Selamat datang kembali</p>
              <h1 className="du-welcome-nama">{nama}</h1>
              <div className="du-wallet-row">
                <span className="du-wallet-dot" />
                <code className="du-wallet-address">
                  {wallet ? `${wallet.slice(0,10)}...${wallet.slice(-6)}` : "Belum connect"}
                </code>
                <span className="du-wallet-connected">
                  {wallet ? "Terhubung" : "Belum Connect"}
                </span>
              </div>
            </div>
          </div>
          <div className="du-welcome-right">
            <div className="du-quick-stat">
              <FiTrendingUp size={18} color="#ffa757" />
              <div>
                <p className="du-quick-stat-value">
                  {/* total ETH dari riwayat beneran */}
                  {riwayat.length > 0
                    ? riwayat.reduce((sum, r) => sum + parseFloat(r.jumlah || 0), 0).toFixed(2) + " ETH"
                    : "0.00 ETH"}
                </p>
                <p className="du-quick-stat-label">Total Donasi Saya</p>
              </div>
            </div>
            <div className="du-quick-stat">
              <HeartIcon size={22} delay={0} />
              <div>
                <p className="du-quick-stat-value">{riwayat.length}</p>
                <p className="du-quick-stat-label">Kampanye Didukung</p>
              </div>
            </div>
          </div>
        </div>

        <div className="du-content">

          {/* KIRI */}
          <div className="du-left">
            <div className="du-section-header">
              <h2 className="du-section-title">Kampanye Aktif Terbaru</h2>
              <Link to="/donasi" className="du-see-all">Lihat semua <FiChevronRight size={14} /></Link>
            </div>

            {filteredKampanye.length === 0 ? (
              <div className="du-empty"><p>Tidak ada kampanye yang cocok.</p></div>
            ) : (
              <div className="du-kampanye-list">
                {filteredKampanye.map(k => {
                  const persen = Math.min((k.terkumpulETH / k.targetETH) * 100, 100).toFixed(0);
                  return (
                    <Link to={`/donasi/${k.id}`} key={k.id} className="du-kampanye-card">
                      <img src={k.foto} alt={k.judul} className="du-kampanye-foto" />
                      <div className="du-kampanye-info">
                        <h3 className="du-kampanye-judul">{k.judul}</h3>
                        <div className="du-kampanye-progress-bar-bg">
                          <div className="du-kampanye-progress-bar-fill" style={{ width: `${persen}%` }} />
                        </div>
                        <div className="du-kampanye-bottom">
                          <span className="du-kampanye-eth">{k.terkumpulETH} ETH</span>
                          <div className="du-kampanye-meta">
                            <span><FiUsers size={11} /> {k.donatur}</span>
                            <span><FiClock size={11} /> {k.sisaHari} hari</span>
                            <span className="du-kampanye-persen">{persen}%</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* KANAN */}
          <div className="du-right">
            <div className="du-section-header">
              <h2 className="du-section-title">Riwayat Donasi Saya</h2>
              <Link to="/akun" className="du-see-all">Lihat semua <FiChevronRight size={14} /></Link>
            </div>

            <div className="du-riwayat-card">
              {riwayat.length === 0 ? (
                <div className="du-riwayat-item" style={{ justifyContent: "center" }}>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.28)", padding: "8px 0" }}>
                    Belum ada riwayat donasi.
                  </p>
                </div>
              ) : (
                riwayat.map((r, i) => (
                  <div key={i} className="du-riwayat-item">
                    <div className="du-riwayat-icon">
                      <HeartIcon size={28} delay={i * 0.4} />
                    </div>
                    <div className="du-riwayat-info">
                      <p className="du-riwayat-kampanye">{r.kampanye}</p>
                      <p className="du-riwayat-tanggal">{r.tanggal}</p>
                    </div>
                    <div className="du-riwayat-right">
                      <p className="du-riwayat-jumlah">{r.jumlah} ETH</p>
                      <a
                        href={`https://etherscan.io/tx/${r.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="du-riwayat-tx"
                        onClick={e => e.stopPropagation()}
                      >
                        TX <FiExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="du-cta-card">
              <div className="du-cta-icon"><FiPlusCircle size={24} color="#ffa757" /></div>
              <h3 className="du-cta-title">Punya campaign?</h3>
              <p className="du-cta-desc">
                Daftarkan kampanye Anda dan mulai galang dana secara transparan di blockchain.
              </p>
              <Link to="/daftar-campaign" className="du-cta-btn">Daftar Campaign Sekarang</Link>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default HomeUser;