import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FiAlertTriangle, FiCheck, FiX, FiClock, FiRefreshCw,
  FiExternalLink, FiShield,
  FiSearch, FiAlertCircle, FiFilter, FiThumbsUp, FiThumbsDown,
} from "react-icons/fi";
import NavbarAdmin from "../../components/navbar-admin";
import { useCampaign } from "../../context/CampaignContext";
import { ethers } from "ethers";
import "../../styles/admin/laporan-list.css";


function shortAddr(addr = "") {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function weiToEth(wei = "0") {
  try { return parseFloat(ethers.formatEther(wei || "0")).toFixed(4); }
  catch { return "?"; }
}

const STATUS_CONFIG = {
  submitted: { label: "Menunggu Finalize", color: "#ffa757", bg: "rgba(255,167,87,0.1)", border: "rgba(255,167,87,0.25)", Icon: FiClock },
  approved:  { label: "Disetujui (Organizer Slashed)", color: "#22c55e", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.25)", Icon: FiCheck },
  rejected:  { label: "Ditolak (Reporter Slashed)", color: "#f87171", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)", Icon: FiX },
};

function LaporanRow({ lap, onAccept, onReject, processing }) {
  const cfg = STATUS_CONFIG[lap.status] || STATUS_CONFIG.submitted;
  const IconComp = cfg.Icon;
  const stakeEth = parseFloat(ethers.formatEther(lap.stake_bond_wei || "0")) || 0;
  const feeEth   = parseFloat(ethers.formatEther(lap.voting_fee_wei  || "0")) || 0;
  const totalEth = (stakeEth + feeEth).toFixed(4);
  const isProcessing = processing === lap.id;

  return (
    <div className="la-row">
      {/* Top */}
      <div className="la-row-top">
        <div className="la-row-left">
          <div className="la-row-id">
            <span className="la-label">Report #</span>
            <code className="la-code">{lap.report_id_onchain}</code>
          </div>
          <div
            className="la-status-badge"
            style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
          >
            <IconComp size={11} /> {cfg.label}
          </div>
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
          {lap.created_at ? new Date(lap.created_at).toLocaleString("id-ID") : ""}
        </div>
      </div>

      {/* Body */}
      <div className="la-row-body">
        <div className="la-detail-grid">
          <div>
            <span className="la-label">Campaign ID</span>
            <code className="la-code">#{lap.campaign_id_onchain}</code>
            {lap.campaign_db_id && (
              <Link to={`/admin/campaign/${lap.campaign_db_id}`} className="la-link" style={{ marginLeft: 8 }}>
                <FiExternalLink size={11} /> Detail
              </Link>
            )}
          </div>
          <div>
            <span className="la-label">Reporter Wallet</span>
            <code className="la-code">{shortAddr(lap.reporter_wallet)}</code>
          </div>
          <div>
            <span className="la-label">Stake Bond</span>
            <span className="la-value">{weiToEth(lap.stake_bond_wei)} ETH</span>
          </div>
          <div>
            <span className="la-label">Voting Fee</span>
            <span className="la-value">{weiToEth(lap.voting_fee_wei)} ETH</span>
          </div>
          <div>
            <span className="la-label">Total Ditransfer</span>
            <span className="la-value" style={{ color: "#ffa757", fontWeight: 700 }}>{totalEth} ETH</span>
          </div>
          <div>
            <span className="la-label">Voting Contract</span>
            <code className="la-code">{shortAddr(lap.voting_contract)}</code>
          </div>
        </div>

        {lap.finalize_tx_hash && (
          <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
            Finalize tx:{" "}
            <a
              href={`https://etherscan.io/tx/${lap.finalize_tx_hash}`}
              target="_blank" rel="noreferrer"
              className="la-link"
            >
              {shortAddr(lap.finalize_tx_hash)} <FiExternalLink size={10} />
            </a>
          </div>
        )}
      </div>

        {/* Actions - hanya jika masih submitted */}
      {lap.status === "submitted" && (
        <div className="la-row-actions">
          <div className="la-action-note">
            <FiAlertCircle size={13} color="#ffa757" />
            <span>Selidiki laporan ini sebelum accept atau reject</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="la-btn-reject"
              onClick={() => onReject(lap.report_id_onchain, lap.id)}
              disabled={isProcessing}
            >
              {isProcessing ? <FiRefreshCw size={13} /> : <FiThumbsDown size={13} />}
              Tolak (Slash Reporter)
            </button>
            <button
              className="la-btn-accept"
              onClick={() => onAccept(lap.report_id_onchain, lap.id)}
              disabled={isProcessing}
            >
              {isProcessing ? <FiRefreshCw size={13} /> : <FiThumbsUp size={13} />}
              Terima (Slash Organizer)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LaporanList() {
  const { laporan, acceptReportOnChain, rejectReportOnChain, fetchLaporan } = useCampaign();

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [processing, setProcessing] = useState(null); // laporan db id sedang diproses
  const [actionErr, setActionErr] = useState("");
  const [actionOk, setActionOk] = useState("");

  const filtered = useMemo(() => {
    return (laporan || []).filter((l) => {
      const matchStatus = filter === "all" || l.status === filter;
      const matchSearch = !search ||
        String(l.report_id_onchain).includes(search) ||
        String(l.campaign_id_onchain).includes(search) ||
        (l.reporter_wallet || "").toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [laporan, filter, search]);

  const countSubmitted = (laporan || []).filter(l => l.status === "submitted").length;

  async function handleAccept(reportIdOnChain, laporanDbId) {
    setActionErr(""); setActionOk("");
    setProcessing(laporanDbId);
    try {
      await acceptReportOnChain(reportIdOnChain, laporanDbId);
      setActionOk(`Report #${reportIdOnChain} DITERIMA | Organizer di-slash. Dana donatur di-drain untuk refund.`);
    } catch (e) {
      setActionErr(e?.shortMessage || e?.message || String(e));
    } finally { setProcessing(null); }
  }

  async function handleReject(reportIdOnChain, laporanDbId) {
    setActionErr(""); setActionOk("");
    setProcessing(laporanDbId);
    try {
      await rejectReportOnChain(reportIdOnChain, laporanDbId);
      setActionOk(`Report #${reportIdOnChain} DITOLAK | Reporter di-slash. Campaign lanjut normal.`);
    } catch (e) {
      setActionErr(e?.shortMessage || e?.message || String(e));
    } finally { setProcessing(null); }
  }

  return (
    <div className="la-wrapper">
      <NavbarAdmin />
      <main className="la-main">

        {/* Header */}
        <div className="la-header">
          <div>
            <h1 className="la-title">
              <FiAlertTriangle size={20} color="#ffa757" /> Manajemen Laporan
            </h1>
            <p className="la-sub">
              {countSubmitted > 0
                ? <><span className="la-urgent">{countSubmitted} laporan</span> menunggu keputusan admin</>
                : "Semua laporan sudah diputuskan"}
            </p>
          </div>
          <button className="la-btn-refresh" onClick={fetchLaporan}>
            <FiRefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="la-stats-row">
          {[
            { label: "Total Laporan", value: laporan?.length || 0, color: "#c084fc" },
            { label: "Menunggu", value: countSubmitted, color: "#ffa757" },
            { label: "Disetujui", value: (laporan||[]).filter(l=>l.status==="approved").length, color: "#22c55e" },
            { label: "Ditolak", value: (laporan||[]).filter(l=>l.status==="rejected").length, color: "#f87171" },
          ].map(s => (
            <div key={s.label} className="la-stat-card">
              <span className="la-stat-value" style={{ color: s.color }}>{s.value}</span>
              <span className="la-stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Feedback */}
        {actionOk && (
          <div className="la-alert-ok">
            <FiCheck size={14} /> {actionOk}
          </div>
        )}
        {actionErr && (
          <div className="la-alert-err">
            <FiAlertCircle size={14} /> {actionErr}
          </div>
        )}

        {/* Filter + Search */}
        <div className="la-toolbar">
          <div className="la-filter-tabs">
            <FiFilter size={13} color="rgba(255,255,255,0.4)" />
            {[
              { key: "all", label: "Semua" },
              { key: "submitted", label: "Pending" },
              { key: "approved", label: "Disetujui" },
              { key: "rejected", label: "Ditolak" },
            ].map(tab => (
              <button
                key={tab.key}
                className={`la-tab ${filter === tab.key ? "active" : ""}`}
                onClick={() => setFilter(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="la-search">
            <FiSearch size={13} color="rgba(255,255,255,0.35)" />
            <input
              type="text"
              placeholder="Cari report ID, campaign ID, wallet..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="la-search-input"
            />
          </div>
        </div>

        {/* List */}
        <div className="la-list">
          {filtered.length === 0 ? (
            <div className="la-empty">
              <FiAlertTriangle size={36} color="rgba(255,255,255,0.2)" />
              <p>Tidak ada laporan{filter !== "all" ? ` dengan status "${filter}"` : ""}.</p>
            </div>
          ) : (
            filtered.map(lap => (
              <LaporanRow
                key={lap.id}
                lap={lap}
                onAccept={handleAccept}
                onReject={handleReject}
                processing={processing}
              />
            ))
          )}
        </div>

      </main>
    </div>
  );
}
