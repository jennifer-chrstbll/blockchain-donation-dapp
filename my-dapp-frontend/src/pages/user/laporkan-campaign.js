import { useState, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  FiArrowLeft, FiAlertTriangle, FiShield, FiCheck,
  FiAlertCircle, FiExternalLink, FiSend, FiLock, FiInfo,
} from "react-icons/fi";
import { useCampaign } from "../../context/CampaignContext";
import "../../styles/user/laporkan-campaign.css";

const ALASAN_OPTIONS = [
  { code: "FRAUD",         label: "Penipuan / Dana tidak sesuai tujuan" },
  { code: "FAKE_ORG",     label: "Organisasi / identitas palsu" },
  { code: "NO_PROOF",     label: "Tidak ada bukti kegiatan yang valid" },
  { code: "MANIPULATION", label: "Manipulasi data donasi / terkumpul" },
  { code: "OTHER",        label: "Lainnya (tulis detail di keterangan)" },
];

// Stake reporter FIXED oleh contract = 0.01 ETH
const REPORT_STAKE_ETH = "0.01";

function shortAddr(addr = "") {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

export default function LaporkanCampaign() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { getKampanyeById, submitReportOnChain, reputation } = useCampaign();
  const kampanye = useMemo(() => getKampanyeById(id), [getKampanyeById, id]);

  // Cek apakah user saat ini di-ban
  function getCurrentUser() {
    try { return JSON.parse(sessionStorage.getItem("currentUser")) || {}; } catch { return {}; }
  }
  const currentUser = getCurrentUser();
  const myWallet = (currentUser.wallet || "").toLowerCase();
  const myRep = (reputation || []).find((r) => (r.wallet || "").toLowerCase() === myWallet);
  const isBanned = myRep?.is_banned === true;

  const [alasanCode, setAlasanCode] = useState(ALASAN_OPTIONS[0].code);
  const [keterangan, setKeterangan] = useState("");
  const [loading, setLoading]       = useState(false);
  const [errMsg, setErrMsg]         = useState("");
  const [successInfo, setSuccessInfo] = useState(null);
  const [agreed, setAgreed]         = useState(false);

  if (!kampanye) {
    return (
      <div className="lr-wrapper">
        <main className="lr-main">
          <Link to="/donasi" className="lr-back">
            <FiArrowLeft size={16} /> Kembali ke Donasi
          </Link>
          <div className="lr-empty">
            <FiAlertCircle size={40} color="rgba(255,255,255,0.3)" />
            <p>Kampanye tidak ditemukan.</p>
            <p style={{ opacity: 0.5, fontSize: 13 }}>ID: <code>{id}</code></p>
          </div>
        </main>
      </div>
    );
  }

  // Check if campaign can be reported
  if (!kampanye.canReport) {
    return (
      <div className="lr-wrapper">
        <main className="lr-main">
          <Link to={`/donasi/${id}`} className="lr-back">
            <FiArrowLeft size={16} /> Kembali ke Kampanye
          </Link>
          <div className="lr-empty">
            <FiLock size={40} color="rgba(255,255,255,0.3)" />
            <p>Kampanye tidak dapat dilaporkan.</p>
            <p style={{ opacity: 0.5, fontSize: 13 }}>
              {kampanye.isCompleted ? "Campaign sudah selesai dan tidak dapat dilaporkan lagi." : "Campaign telah ditutup."}
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Blokir user yang di-ban
  if (isBanned) {
    return (
      <div className="lr-wrapper">
        <main className="lr-main">
          <Link to={`/donasi/${id}`} className="lr-back">
            <FiArrowLeft size={16} /> Kembali ke Kampanye
          </Link>
          <div className="lr-empty" style={{ gap: 14 }}>
            <div style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "50%",
              width: 72,
              height: 72,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <FiAlertCircle size={36} color="#ef4444" />
            </div>
            <p style={{ fontSize: 18, fontWeight: 800, color: "#fca5a5", margin: 0 }}>Akun Anda Di-Ban</p>
            <p style={{ opacity: 0.6, fontSize: 13, maxWidth: 400, textAlign: "center", lineHeight: 1.6 }}>
              Akun Anda saat ini di-ban oleh admin. Anda tidak dapat mengajukan laporan selama masa ban.
              Hubungi admin jika ada keberatan.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const isOther = alasanCode === "OTHER";

  function validate() {
    if (isOther && keterangan.trim().length < 20)
      return "Jika memilih 'Lainnya', keterangan minimal 20 karakter.";
    if (!agreed)
      return "Centang persetujuan risiko terlebih dahulu.";
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrMsg("");
    setSuccessInfo(null);

    const err = validate();
    if (err) { setErrMsg(err); return; }

    try {
      setLoading(true);
      const alasanText = ALASAN_OPTIONS.find(o => o.code === alasanCode)?.label || alasanCode;
      const alasanFull = keterangan.trim() ? `${alasanText} — ${keterangan.trim()}` : alasanText;
      const result = await submitReportOnChain(id, alasanFull);
      setSuccessInfo(result);
    } catch (e) {
      setErrMsg(e?.shortMessage || e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // ─── Success Screen ───
  if (successInfo) {
    return (
      <div className="lr-wrapper">
        <main className="lr-main">
          <div className="lr-success-card">
            <div className="lr-success-icon">
              <FiCheck size={36} color="#22c55e" />
            </div>
            <h2 className="lr-success-title">Laporan Berhasil Disubmit!</h2>
            <p className="lr-success-sub">
              Laporan kamu sudah tercatat on-chain dan akan ditinjau oleh admin.
              Jika laporan terbukti <strong>benar</strong>: stake kamu dikembalikan + kamu mendapat <strong>60% dari stake organizer</strong>.
              Jika <strong>salah</strong>: stake kamu di-slash.
            </p>

            <div className="lr-success-info">
              <div className="lr-info-row">
                <span>Report ID</span>
                <code>#{successInfo.reportId}</code>
              </div>
              <div className="lr-info-row">
                <span>Stake terkunci</span>
                <code>{REPORT_STAKE_ETH} ETH</code>
              </div>
              <div className="lr-info-row">
                <span>Tx Hash</span>
                <a
                  href={`https://etherscan.io/tx/${successInfo.txHash}`}
                  target="_blank" rel="noreferrer"
                  className="lr-link"
                >
                  {shortAddr(successInfo.txHash)} <FiExternalLink size={11} />
                </a>
              </div>
            </div>

            <div className="lr-success-actions">
              <button className="lr-btn-primary" onClick={() => navigate("/donasi")}>
                Kembali ke Donasi
              </button>
              <button className="lr-btn-ghost" onClick={() => navigate("/daftar-campaign")}>
                Campaign Saya
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ─── Form ───
  return (
    <div className="lr-wrapper">
      <main className="lr-main">
        <Link to={`/donasi/${id}`} className="lr-back">
          <FiArrowLeft size={16} /> Kembali ke Kampanye
        </Link>

        <div className="lr-header">
          <div className="lr-header-icon">
            <FiAlertTriangle size={22} color="#ffa757" />
          </div>
          <div>
            <h1 className="lr-title">Laporkan Kampanye</h1>
            <p className="lr-sub">
              <span className="lr-campaign-name">{kampanye.judul}</span>
            </p>
          </div>
        </div>

        {/* WARNING BOX */}
        <div className="lr-warning-box">
          <FiShield size={16} color="#ffa757" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p className="lr-warning-title">Sistem Anti-Spam Berbasis Stake</p>
            <p className="lr-warning-text">
              Untuk mencegah laporan tidak bertanggung jawab, kamu harus menyetor <strong>Stake Bond</strong> sebagai jaminan.
              Jika laporan terbukti <strong>benar</strong>: stake dikembalikan + kamu mendapat <strong>60% dari stake organizer</strong>.
              Jika laporan <strong>salah</strong>: stake di-slash + <strong>60% ke organizer</strong> dan <strong>40% ke admin</strong>.
            </p>
          </div>
        </div>

        <form className="lr-form" onSubmit={handleSubmit}>
          {/* Alasan */}
          <div className="lr-form-group">
            <label className="lr-label">Alasan Laporan <span className="lr-required">*</span></label>
            <div className="lr-radio-group">
              {ALASAN_OPTIONS.map((opt) => (
                <label key={opt.code} className={`lr-radio-item ${alasanCode === opt.code ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="alasan"
                    value={opt.code}
                    checked={alasanCode === opt.code}
                    onChange={() => setAlasanCode(opt.code)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Keterangan tambahan */}
          <div className="lr-form-group">
            <label className="lr-label">
              Keterangan {isOther && <span className="lr-required">*</span>}
              {!isOther && <span className="lr-optional">(opsional)</span>}
            </label>
            <textarea
              className="lr-textarea"
              rows={4}
              placeholder={isOther
                ? "Jelaskan bukti / indikasi penipuan yang kamu temukan (min. 20 karakter)..."
                : "Tambahkan detail pendukung laporan kamu..."}
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              disabled={loading}
            />
            <p className="lr-hint">{keterangan.length} karakter{isOther ? " (min. 20)" : ""}</p>
          </div>

          {/* Stake tetap — info saja, tidak ada input */}
          <div className="lr-total-box" style={{ border: "1px solid rgba(255,167,87,0.35)" }}>
            <div>
              <span className="lr-total-label">Stake Bond (ditetapkan sistem)</span>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                Fixed oleh smart contract · dikembalikan jika laporan terbukti benar
              </p>
            </div>
            <span className="lr-total-value">{REPORT_STAKE_ETH} ETH</span>
          </div>

          {/* Info flow */}
          <div className="lr-info-box">
            <FiInfo size={14} color="#57a3ff" style={{ flexShrink: 0, marginTop: 2 }} />
            <div className="lr-info-text">
              <strong>Alur setelah submit:</strong> Laporan diteruskan ke admin untuk ditinjau.
              Admin akan <strong>Accept</strong> (organizer di-slash) atau <strong>Reject</strong> (reporter di-slash) berdasarkan bukti yang ada.
            </div>
          </div>

          {/* Agreement */}
          <label className="lr-agree-label">
            <input
              type="checkbox"
              className="lr-agree-check"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={loading}
            />
            <span>
              Saya mengerti bahwa jika laporan ini terbukti <strong>tidak valid</strong>,
              stake bond saya ({REPORT_STAKE_ETH} ETH) akan di-slash. Saya hanya melaporkan berdasarkan bukti yang kuat.
            </span>
          </label>

          {errMsg && (
            <div className="lr-error">
              <FiAlertCircle size={14} /> {errMsg}
            </div>
          )}

          <div className="lr-form-actions">
            <button
              type="submit"
              className="lr-btn-primary"
              disabled={loading || !agreed}
              style={{ opacity: (!agreed || loading) ? 0.6 : 1 }}
            >
              {loading ? (
                "Memproses (konfirmasi MetaMask)..."
              ) : (
                <>
                  <FiSend size={15} /> Submit Laporan · {REPORT_STAKE_ETH} ETH
                </>
              )}
            </button>

            <Link to={`/donasi/${id}`} className="lr-btn-ghost">
              <FiLock size={14} /> Batal
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
