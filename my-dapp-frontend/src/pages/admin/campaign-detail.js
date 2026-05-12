import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FiArrowLeft, FiShield, FiExternalLink, FiClock,
  FiUsers, FiTarget, FiCopy, FiCheck,
  FiAlertCircle, FiXCircle, FiFileText, FiDownload, FiLock
} from "react-icons/fi";
import NavbarAdmin from "../../components/navbar-admin";
import { useCampaign } from "../../context/CampaignContext";
import "../../styles/admin/campaign-detail.css";

const DUMMY_TRANSAKSI = [
  { wallet: "0xFa91...3Bc2", jumlah: "0.05 ETH", waktu: "2 menit lalu",  txHash: "0xabc123...def456" },
  { wallet: "0x7d3E...A1f9", jumlah: "0.10 ETH", waktu: "15 menit lalu", txHash: "0xbcd234...efa567" },
  { wallet: "0x2Cc8...09dB", jumlah: "0.02 ETH", waktu: "1 jam lalu",    txHash: "0xcde345...fab678" },
  { wallet: "0xB44a...7E1c", jumlah: "0.25 ETH", waktu: "3 jam lalu",    txHash: "0xdef456...abc789" },
  { wallet: "0x91fD...C230", jumlah: "0.08 ETH", waktu: "5 jam lalu",    txHash: "0xefa567...bcd890" },
];

const STATUS_CONFIG = {
  aktif:   { label: "Aktif",   className: "cda-badge-aktif"   },
  selesai: { label: "Selesai", className: "cda-badge-selesai" },
  ditutup: { label: "Ditutup", className: "cda-badge-ditutup" },
};

function CampaignDetailAdmin() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getKampanyeById, pengajuanList, slashOrganizerNoProofOnChain } = useCampaign();
  const [copied, setCopied]       = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [slashing, setSlashing]   = useState(false);
  const [statusOverride, setStatusOverride] = useState(null);

  const k = getKampanyeById(id);

  if (!k) {
    return (
      <div className="cda-wrapper">
        <NavbarAdmin />
        <main className="cda-main">
          <p style={{ color: "rgba(255,255,255,0.4)" }}>Kampanye tidak ditemukan.</p>
        </main>
      </div>
    );
  }

  const kampanye = {
    ...k,
    wallet: k.walletOrganizer,
    status: statusOverride || k.status,
  };
  const transaksi = k.transaksi?.length ? k.transaksi : DUMMY_TRANSAKSI;

  // Cari dokumen dari pengajuan yang sesuai dengan kampanye ini
  const pengajuan = pengajuanList?.find((p) => p.id === id) || null;
  const dokumenUrl  = pengajuan?.dokumen?.url || "";
  const dokumenNama = pengajuan?.dokumen?.nama || "Dokumen Pendukung";
  const dokumenTipe = pengajuan?.dokumen?.tipe || "";
  const persen = Math.min((kampanye.terkumpulETH / kampanye.targetETH) * 100, 100).toFixed(1);
  const sc = STATUS_CONFIG[kampanye.status] || STATUS_CONFIG["aktif"];

  function handleCopy() {
    navigator.clipboard.writeText(kampanye.contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleNonaktifkan() {
    setStatusOverride("ditutup");
    setShowModal(false);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const isAwaitingProof = kampanye.statusLifecycle === "awaiting_proof";
  const proofDeadlineRaw = kampanye.proofDeadlineAt || 0;
  const isTimeout = isAwaitingProof && proofDeadlineRaw > 0 && nowSec > proofDeadlineRaw;

  async function handleSlashTimeout() {
    if (!window.confirm("Batas waktu unggah bukti telah lewat. Anda yakin ingin menslash dana dan melakukan auto-ban pada organizer ini?")) return;
    setSlashing(true);
    try {
      await slashOrganizerNoProofOnChain(kampanye.id);
      alert("Organizer berhasil di-slash dan di-ban secara otomatis.");
    } catch (e) {
      alert("Gagal melakukan slash: " + e.message);
    } finally {
      setSlashing(false);
    }
  }

  return (
    <div className="cda-wrapper">
      <NavbarAdmin />

      <main className="cda-main">
        {/* BACK */}
        <button className="cda-back" onClick={() => navigate("/admin/campaign")}>
          <FiArrowLeft size={18} />
        </button>

        <div className="cda-content">
          {/* ===== KOLOM KIRI ===== */}
          <div className="cda-left">
            {/* Foto */}
            <div className="cda-foto-wrapper">
              <img src={kampanye.foto} alt={kampanye.judul} className="cda-foto" />
              <div className="cda-foto-overlay" />
              <span className={`cda-status-badge ${sc.className}`}>{sc.label}</span>
            </div>

            {/* Organizer */}
            <div className="cda-organizer-card">
              <div className="cda-organizer-info">
                <div className="cda-organizer-avatar">
                  {kampanye.organizer.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()}
                </div>
                <div>
                  <p className="cda-organizer-label">Dikelola oleh</p>
                  <p className="cda-organizer-name">{kampanye.organizer}</p>
                </div>
              </div>
              {kampanye.verified && (
                <div className="cda-verified-badge">
                  <FiShield size={12} /> Verified
                </div>
              )}
            </div>

            {/* Deskripsi */}
            <div className="cda-section-card">
              <h3 className="cda-section-title">Tentang Kampanye</h3>
              <p className="cda-deskripsi">{kampanye.deskripsi}</p>
            </div>

            {/* Contract Address */}
            <div className="cda-section-card cda-contract-card">
              <p className="cda-contract-label"><FiShield size={13} /> Smart Contract Address</p>
              <div className="cda-contract-row">
                <code className="cda-contract-address">{kampanye.contractAddress}</code>
                <button className="cda-copy-btn" onClick={handleCopy}>
                  {copied ? <FiCheck size={14} color="#22c55e" /> : <FiCopy size={14} />}
                </button>
              </div>
              <a
                href={`https://etherscan.io/address/${kampanye.contractAddress}`}
                target="_blank" rel="noreferrer"
                className="cda-etherscan-link"
              >
                Lihat di Etherscan <FiExternalLink size={12} />
              </a>
            </div>

            {/* Tombol Admin */}
            <div className="cda-admin-actions">
              <a
                href={`https://etherscan.io/address/${kampanye.contractAddress}`}
                target="_blank" rel="noreferrer"
                className="cda-btn-etherscan"
              >
                <FiExternalLink size={14} /> Buka Etherscan
              </a>
              {kampanye.status === "aktif" && (
                <button className="cda-btn-nonaktif" onClick={() => setShowModal(true)}>
                  <FiAlertCircle size={14} /> Nonaktifkan Campaign
                </button>
              )}
              {isTimeout && (
                <button 
                  className="cda-btn-nonaktif" 
                  style={{ backgroundColor: "#ef4444", borderColor: "#ef4444", color: "#fff" }}
                  onClick={handleSlashTimeout}
                  disabled={slashing}
                >
                  <FiAlertCircle size={14} /> {slashing ? "Memproses..." : "Tindak Timeout Proof (Ban)"}
                </button>
              )}
            </div>

            {/* ====== DOKUMEN PENDUKUNG (ADMIN ONLY) ====== */}
            <div className="cda-section-card" style={{ borderColor: "rgba(168,85,247,0.25)", background: "rgba(168,85,247,0.04)" }}>
              <h3 className="cda-section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FiLock size={13} color="#a855f7" />
                Dokumen Pendukung
                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", background: "rgba(168,85,247,0.2)", borderRadius: 999, color: "#c084fc", letterSpacing: 0.5 }}>ADMIN ONLY</span>
              </h3>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "0 0 12px", lineHeight: 1.5 }}>
                Dokumen identitas organizer (KTP/SK). Informasi ini bersifat rahasia dan tidak tampil ke publik.
              </p>
              {dokumenUrl ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <a
                    href={dokumenUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "9px 16px",
                      background: "rgba(168,85,247,0.15)",
                      border: "1px solid rgba(168,85,247,0.35)",
                      borderRadius: 10, color: "#c084fc",
                      fontSize: 13, fontWeight: 600, textDecoration: "none",
                    }}
                  >
                    <FiDownload size={13} /> Unduh Dokumen
                  </a>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <FiFileText size={11} />
                      <span>{dokumenNama}</span>
                    </div>
                    {dokumenTipe && (
                      <div style={{ marginTop: 2, opacity: 0.6 }}>{dokumenTipe}</div>
                    )}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>
                  Tidak ada dokumen tersimpan untuk campaign ini.
                </p>
              )}
            </div>
          </div>

          {/* KOLOM KANAN */}
          <div className="cda-right">
            {/* Judul & Stats */}
            <div className="cda-judul-card">
              <p className="cda-card-id">{kampanye.id}</p>
              <h1 className="cda-judul">{kampanye.judul}</h1>

              <div className="cda-stats-row">
                <div className="cda-stat"><FiUsers size={14} /><span>{kampanye.donatur} donatur</span></div>
                <div className="cda-stat"><FiClock size={14} /><span>{kampanye.sisaHari > 0 ? `${kampanye.sisaHari} hari lagi` : "Berakhir"}</span></div>
                <div className="cda-stat"><FiTarget size={14} /><span>Target {kampanye.targetETH} ETH</span></div>
              </div>

              {/* Progress */}
              <div className="cda-progress-section">
                <div className="cda-progress-bg">
                  <div className="cda-progress-fill" style={{ width: `${persen}%` }} />
                </div>
                <div className="cda-progress-info">
                  <span className="cda-terkumpul">{kampanye.terkumpulETH} ETH terkumpul</span>
                  <span className="cda-persen">{persen}%</span>
                </div>
              </div>

              <p className="cda-tanggal-aktif">Aktif sejak {kampanye.tanggalAktif}</p>
            </div>

            {/* Public Ledger */}
            <div className="cda-ledger-card">
              <div className="cda-ledger-header">
                <div>
                  <h3 className="cda-ledger-title">Public Ledger</h3>
                  <p className="cda-ledger-sub">Semua transaksi tercatat permanen di blockchain Ethereum</p>
                </div>
                <div className="cda-live-badge">
                  <span className="cda-live-dot" /> LIVE
                </div>
              </div>

              <div className="cda-table-wrapper">
                <table className="cda-table">
                  <thead>
                    <tr>
                      <th>Wallet</th>
                      <th>Jumlah</th>
                      <th>Waktu</th>
                      <th>TX Hash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transaksi.map((tx, i) => (
                      <tr key={i} className="cda-table-row">
                        <td><code className="cda-wallet">{tx.wallet}</code></td>
                        <td><span className="cda-jumlah-eth">{tx.jumlah}</span></td>
                        <td><span className="cda-waktu">{tx.waktu}</span></td>
                        <td>
                          <a href={`https://etherscan.io/tx/${tx.txHash}`} target="_blank" rel="noreferrer" className="cda-tx-link">
                            {tx.txHash.slice(0,10)}... <FiExternalLink size={11} />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="cda-ledger-footer">
                <span>{transaksi.length} transaksi ditampilkan</span>
                <a href={`https://etherscan.io/address/${kampanye.contractAddress}`} target="_blank" rel="noreferrer" className="cda-etherscan-link">
                  Lihat semua di Etherscan <FiExternalLink size={12} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL NONAKTIFKAN */}
      {showModal && (
        <div className="cda-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="cda-modal" onClick={e => e.stopPropagation()}>
            <div className="cda-modal-icon">
              <FiAlertCircle size={28} color="#ffa757" />
            </div>
            <h3 className="cda-modal-title">Nonaktifkan Campaign?</h3>
            <p className="cda-modal-desc">
              Kampanye <strong>"{kampanye.judul}"</strong> akan ditutup dan tidak bisa menerima donasi baru. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="cda-modal-actions">
              <button className="cda-btn-nonaktif-confirm" onClick={handleNonaktifkan}>
                <FiXCircle size={15} /> Ya, Nonaktifkan
              </button>
              <button className="cda-modal-batal" onClick={() => setShowModal(false)}>
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CampaignDetailAdmin;