import { useMemo, useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import {
  FiShield, FiArrowLeft, FiExternalLink,
  FiClock, FiUsers, FiTarget, FiZap,
  FiCopy, FiCheck, FiThumbsUp, FiThumbsDown, FiCheckCircle, FiXCircle,
  FiAlertTriangle, FiFileText, FiDownload, FiDollarSign, FiLock,
} from "react-icons/fi";
import "../../../styles/user/donation/campaign-detail.css";

import { ethers } from "ethers";
import CampaignArtifact from "../../../web3/abi/CampaignDonation.json";
import { HARDHAT_CHAIN_ID } from "../../../web3/config";
import { useCampaign } from "../../../context/CampaignContext";

function formatWaktuSekarang() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}
function shortAddr(addr = "") {
  if (!addr || typeof addr !== "string") return "-";
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
function getCurrentUser() {
  try { return JSON.parse(sessionStorage.getItem("currentUser")) || {}; } catch { return {}; }
}
// Top 5 user = yang paling banyak punya campaign sukses (aktif/selesai)
function isTop5ByCampaignSuccess(kampanyeAktif, walletUser) {
  if (!walletUser || !kampanyeAktif?.length) return false;
  const countMap = {};
  kampanyeAktif.forEach(k => {
    const w = (k.walletOrganizer || "").toLowerCase();
    if (w) countMap[w] = (countMap[w] || 0) + 1;
  });
  const top5 = Object.entries(countMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);
  return top5.includes(walletUser.toLowerCase());
}

const MAX_VOTERS = 11;
const THRESHOLD = 80;

function DetailCampaign() {
  const { id } = useParams();
  const { getKampanyeById, applyDonationToCampaign, getPengajuanById, voteKampanye, kampanyeAktif, getCampaignOnChainStateByDbId } = useCampaign();

  const [copied, setCopied] = useState(false);
  const [donasiAktif, setDonasiAktif] = useState(false);
  const [jumlahETH, setJumlahETH] = useState("");
  const [txState, setTxState] = useState({ loading: false, lastTxHash: "", error: "" });

  // ── state voting ──
  const u = getCurrentUser();
  const userId = u.wallet || u.id || u.email || "me";
  const isTop5 = isTop5ByCampaignSuccess(kampanyeAktif, u.wallet || "");
  const [voteAktif, setVoteAktif] = useState(null);
  const [voteDone, setVoteDone] = useState(null);

  // Coba ambil dari kampanyeAktif, lalu fallback ke pengajuanList
  const k = useMemo(() => getKampanyeById(id), [getKampanyeById, id]);
  const pengajuan = useMemo(() => {
    if (typeof getPengajuanById === "function") return getPengajuanById(id);
    return null;
  }, [getPengajuanById, id]);

  // Data gabungan — bisa dari kampanye aktif atau pengajuan menunggu
  const data = k || (pengajuan ? {
    id: pengajuan.id,
    judul: pengajuan.judulKampanye,
    foto: pengajuan.fotoCover,
    organizer: pengajuan.namaOrganisasi,
    walletOrganizer: pengajuan.walletAddress,
    deskripsi: pengajuan.deskripsiKampanye || pengajuan.alasan,
    anggaran: pengajuan.anggaran || [],
    terkumpulETH: 0,
    targetETH: parseFloat(pengajuan.targetETH) || 0,
    donatur: 0,
    sisaHari: parseInt(pengajuan.durasiHari) || 0,
    verified: false,
    contractAddress: null,
    transaksi: [],
    votes: pengajuan.votes || { yes: 0, no: 0, voters: [] },
    statusVoting: "menunggu",
  } : null);

  // Tentukan apakah ini campaign menunggu voting
  const isVotingMode = !k && !!pengajuan;

  // Cek apakah user yang login adalah organizer campaign ini
  const isOrganizer = !!(
    data && u.wallet &&
    (data.walletOrganizer || "").toLowerCase() === (u.wallet || "").toLowerCase()
  );
  const votes = (isVotingMode ? pengajuan?.votes : null) || { yes: 0, no: 0, voters: [] };
  const sudahVote = (votes.voters || []).includes(userId);
  const totalVotes = votes.yes + votes.no;
  const yesPercent = Math.round((votes.yes / MAX_VOTERS) * 100);
  const noPercent = Math.round((votes.no / MAX_VOTERS) * 100);
  const isLolos = yesPercent >= THRESHOLD;
  const isGagal = noPercent > (100 - THRESHOLD);

  function handleVoteUser(pilihan) {
    setVoteAktif(null);
    setVoteDone(pilihan);
    if (typeof voteKampanye === "function") {
      voteKampanye(id, pilihan, userId);
    }
  }

  const [onChainFinished, setOnChainFinished] = useState(false);
  const [showAnggaranModal, setShowAnggaranModal] = useState(false);

  useEffect(() => {
    if (!data?.contractAddress || !getCampaignOnChainStateByDbId) return;
    let isMounted = true;
    getCampaignOnChainStateByDbId(id).then(state => {
      if (!isMounted || !state) return;
      const fundraisingEndAt = Number(state.fundraisingEndAt || 0);
      const lifecycle = Number(state.lifecycle || 0);
      const nowSec = Math.floor(Date.now() / 1000);

      // Jika waktu sudah lewat ATAU fase bukan lagi Fundraising (1)
      if ((fundraisingEndAt > 0 && nowSec >= fundraisingEndAt) || lifecycle > 1) {
        setOnChainFinished(true);
      }
    }).catch(e => {
      console.warn("Gagal mengambil status on-chain:", e);
    });
    return () => { isMounted = false; };
  }, [data?.contractAddress, id, getCampaignOnChainStateByDbId]);

  if (!data) {
    return (
      <div className="dk-wrapper">
        <main className="dk-main">
          <Link to="/donasi" className="dk-back-link"><FiArrowLeft size={14} /> Kembali</Link>
          <div style={{ textAlign: "center", marginTop: "4rem", color: "rgba(255,255,255,0.55)" }}>
            <p style={{ fontSize: 18, marginBottom: 8 }}>Kampanye tidak ditemukan.</p>
            <p style={{ fontSize: 13, opacity: 0.8 }}>ID: <code>{id}</code></p>
          </div>
        </main>
      </div>
    );
  }

  const persen = data.targetETH > 0
    ? Math.min((data.terkumpulETH / data.targetETH) * 100, 100).toFixed(1)
    : "0.0";

  const fundraisingBerakhir = !isVotingMode && (
    onChainFinished ||
    data.sisaHari <= 0 ||
    data.status === "selesai" ||
    data.status === "ditutup" ||
    data.status === "arsip" ||
    data.isArchived ||
    data.isCompleted
  );

  // Tabel anggaran
  const anggaran = Array.isArray(data.anggaran) ? data.anggaran.filter(r => r.barang || r.harga) : [];
  const totalAnggaran = anggaran.reduce((s, r) => s + (parseFloat(r.harga) || 0), 0).toFixed(3);

  function handleCopyContract() {
    if (!data.contractAddress) return;
    navigator.clipboard.writeText(data.contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Semua logika donasi tidak diubah
  async function handleDonasi() {
    setTxState({ loading: true, lastTxHash: "", error: "" });
    try {
      if (!data.contractAddress) throw new Error("Contract address belum tersedia.");
      if (!window.ethereum) throw new Error("MetaMask tidak terdeteksi.");
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      if (chainId !== HARDHAT_CHAIN_ID) {
        throw new Error(`Network salah. Pindah ke Hardhat Local (chainId ${HARDHAT_CHAIN_ID}). ChainId kamu sekarang: ${chainId}`);
      }
      const signer = await provider.getSigner();
      const donor = await signer.getAddress();
      const campaign = new ethers.Contract(data.contractAddress, CampaignArtifact.abi, signer);
      const value = ethers.parseEther(String(jumlahETH));
      const tx = await campaign.donate({ value });
      setTxState({ loading: true, lastTxHash: tx.hash, error: "" });
      const receipt = await tx.wait();
      applyDonationToCampaign(id, { donor, amountEth: String(jumlahETH), txHash: tx.hash, waktu: formatWaktuSekarang() });
      try {
        const existing = JSON.parse(sessionStorage.getItem("riwayatDonasi")) || [];
        sessionStorage.setItem("riwayatDonasi", JSON.stringify([
          {
            kampanye: data.judul,
            jumlah: String(jumlahETH),
            txHash: tx.hash,
            tanggal: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
          },
          ...existing,
        ]));
      } catch (_) { }
      alert(`Donasi berhasil!\nTx: ${tx.hash}\nBlock: ${receipt.blockNumber}`);
      setDonasiAktif(false);
      setJumlahETH("");
    } catch (e) {
      setTxState({ loading: false, lastTxHash: "", error: e?.message || String(e) });
      alert(e?.message || String(e));
    } finally {
      setTxState(prev => ({ ...prev, loading: false }));
    }
  }

  return (
    <div className="dk-wrapper">
      <main className="dk-main">
        <Link to="/donasi" className="dk-back-link"><FiArrowLeft size={14} /> Kembali</Link>

        {/* ── CONTENT WRAPPER ── */}
        <div className="dk-content-wrapper">
          {/* ── HERO FULL WIDTH ── */}
          <div className="dk-hero">
            <img src={data.foto} alt={data.judul} className="dk-hero-img" />
          <div className="dk-hero-overlay" />
          {/* Badge voting jika masih menunggu */}
          {isVotingMode && (
            <div className="dk-voting-hero-badge">
              <FiShield size={12} /> Menunggu Voting Komunitas
            </div>
          )}
          <div className="dk-hero-info">
            <h1 className="dk-judul">{data.judul}</h1>
            <div className="dk-hero-meta">
              <div className="dk-organizer-mini">
                <div className="dk-org-av">{(data.organizer || "??").slice(0, 2).toUpperCase()}</div>
                <span>{data.organizer}</span>
                {data.organizer && (
                  <span className="dk-verified-badge">
                    Terverifikasi
                  </span>
                )}
              </div>
              <div className="dk-hero-stats">
                {!isVotingMode && <span className="dk-stat"><FiUsers size={12} /> {data.donatur} donatur</span>}
                <span className="dk-stat"><FiClock size={12} /> {data.sisaHari} hari</span>
                <span className="dk-stat"><FiTarget size={12} /> Target {data.targetETH} ETH</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── VOTE PANEL — tampil jika campaign masih menunggu voting ── */}
        {isVotingMode && (
          <div className="dk-vote-panel">
            {/* Header */}
            <div className="dk-vote-header">
              <div className="dk-vote-shield">
                <FiShield size={16} color="#ffa757" />
              </div>
              <div style={{ flex: 1 }}>
                <p className="dk-vote-title">Voting Komunitas</p>
                <p className="dk-vote-sub">Admin + 5 top organizer terbaik — butuh ≥{THRESHOLD}% Yes untuk aktif</p>
              </div>
              <div className={`dk-vote-pill ${isLolos ? "lolos" : isGagal ? "gagal" : "berlangsung"}`}>
                {isLolos ? "Lolos" : isGagal ? "Ditolak" : "Berlangsung"}
              </div>
            </div>

            {/* Bar Yes */}
            <div className="dk-vote-bars">
              <div className="dk-vote-bar-row">
                <span className="dk-vote-bar-label yes">
                  <FiThumbsUp size={11} /> Ya &nbsp;<strong>{votes.yes}</strong>
                  <span className="dk-vote-pct">{yesPercent}%</span>
                </span>
                <div className="dk-vote-track">
                  <div className="dk-vote-fill yes" style={{ width: `${yesPercent}%` }} />
                  <div className="dk-vote-threshold" style={{ left: `${THRESHOLD}%` }} />
                </div>
              </div>
              <div className="dk-vote-bar-row">
                <span className="dk-vote-bar-label no">
                  <FiThumbsDown size={11} /> Tidak &nbsp;<strong>{votes.no}</strong>
                  <span className="dk-vote-pct">{noPercent}%</span>
                </span>
                <div className="dk-vote-track">
                  <div className="dk-vote-fill no" style={{ width: `${noPercent}%` }} />
                </div>
              </div>
            </div>

            {/* Counter + meter */}
            <div className="dk-vote-footer-row">
              <span className="dk-vote-count">
                <FiUsers size={11} /> {totalVotes}/{MAX_VOTERS} voter
              </span>
              <div className="dk-vote-meter-wrap">
                <div className="dk-vote-meter">
                  <div className="dk-vote-meter-fill" style={{ width: `${yesPercent}%` }} />
                  <div className="dk-vote-meter-line" style={{ left: `${THRESHOLD}%` }} />
                </div>
                <span className="dk-vote-meter-pct">{THRESHOLD}%</span>
              </div>
            </div>

            {/* Tombol vote — hanya top donor yang belum vote */}
            {!isLolos && !isGagal && isTop5 && !sudahVote && !voteDone && (
              <>
                <p className="dk-vote-cta">Sebagai salah satu top 5 organizer, Anda berhak ikut menentukan kelayakan kampanye ini:</p>
                <div className="dk-vote-actions">
                  <button className="dk-vote-btn yes" onClick={() => setVoteAktif("yes")}>
                    <FiThumbsUp size={14} /> Vote Ya
                  </button>
                  <button className="dk-vote-btn no" onClick={() => setVoteAktif("no")}>
                    <FiThumbsDown size={14} /> Vote Tidak
                  </button>
                </div>
              </>
            )}

            {/* Konfirmasi inline */}
            {voteAktif && (
              <div className={`dk-vote-confirm ${voteAktif}`}>
                <p>Konfirmasi vote <strong>{voteAktif === "yes" ? "Ya" : "Tidak"}</strong> untuk kampanye ini? Tidak bisa diubah.</p>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className={`dk-vote-btn ${voteAktif}`} style={{ flex: 1 }} onClick={() => handleVoteUser(voteAktif)}>
                    Ya, Konfirmasi
                  </button>
                  <button className="dk-vote-btn-batal" onClick={() => setVoteAktif(null)}>Batal</button>
                </div>
              </div>
            )}

            {/* Sudah vote */}
            {(sudahVote || voteDone) && !isLolos && !isGagal && (
              <div className={`dk-vote-done ${voteDone || "yes"}`}>
                ? <>Suara Ya tercatat. Menunggu voter lain...</>
                : <>Suara Tidak tercatat.</>
              </div>
            )}

            {/* Bukan top donor */}
            {!isTop5 && !isLolos && !isGagal && (
              <p className="dk-vote-locked">
                Hanya top 5 organizer dengan campaign sukses terbanyak yang bisa voting.
              </p>
            )}

            {/* Hasil final */}
            {isLolos && <div className="dk-vote-result lolos">Campaign lolos voting... Akan segera aktif.</div>}
            {isGagal && !isLolos && <div className="dk-vote-result gagal">Voting gagal, terlalu banyak penolakan.</div>}
          </div>
        )}

        {/* ── PROGRESS FULL WIDTH — hanya tampil jika aktif ── */}
        {!isVotingMode && (
          <div className="dk-progress-card">
            <div className="dk-progress-top">
              <span className="dk-terkumpul">{data.terkumpulETH} ETH terkumpul</span>
              <span className="dk-persen">{persen}% | target {data.targetETH} ETH</span>
            </div>
            <div className="dk-progress-bar-bg">
              <div className="dk-progress-bar-fill" style={{ width: `${persen}%` }} />
            </div>

            {/* Tombol Donasi */}
            {!donasiAktif || isOrganizer ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", minHeight: 42 }}>
                {/* Organizer tidak boleh donasi ke campaignnya sendiri */}
                {isOrganizer ? (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 14px", background: "rgba(99,102,241,0.08)",
                    border: "1px solid rgba(99,102,241,0.22)", borderRadius: 12,
                    color: "#a5b4fc", fontSize: 13, fontWeight: 600,
                  }}>
                    <FiLock size={13} /> Anda tidak dapat mendonasi campaign Anda sendiri
                  </div>
                ) : data.isArchived ? (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 14px", background: "rgba(107,114,128,0.1)",
                    border: "1px solid rgba(107,114,128,0.2)", borderRadius: 12,
                    color: "#9ca3af", fontSize: 13, fontWeight: 600,
                  }}>
                    <FiLock size={13} /> Campaign ini telah diarsipkan
                  </div>
                ) : (data.canDonate && !fundraisingBerakhir && data.status === "aktif") ? (
                  <>
                    <button className="dk-btn-donasi" onClick={() => setDonasiAktif(true)} disabled={!data.contractAddress}>
                      <FiZap size={16} /> Donasi Sekarang
                    </button>
                  </>
                ) : (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 14px", background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12,
                    color: "#fca5a5", fontSize: 13, fontWeight: 600,
                  }}>
                    <FiLock size={13} /> Fundraising sudah diselesaikan
                  </div>
                )}
              </div>
            ) : (
              <div className="dk-donasi-form">
                <p className="dk-donasi-label">Masukkan jumlah ETH</p>
                <input type="number" className="dk-donasi-input"
                  placeholder="contoh: 0.01"
                  value={jumlahETH} onChange={e => setJumlahETH(e.target.value)}
                  min="0.001" step="0.001" />
                <div className="dk-donasi-actions">
                  <button className="dk-btn-donasi" onClick={handleDonasi}
                    disabled={txState.loading || !jumlahETH || parseFloat(jumlahETH) <= 0}>
                    {txState.loading ? "Memproses..." : "Konfirmasi via MetaMask"}
                  </button>
                  <button className="dk-btn-batal" onClick={() => setDonasiAktif(false)} disabled={txState.loading}>
                    Batal
                  </button>
                </div>
                {txState.lastTxHash && <p style={{ fontSize: 12, opacity: 0.8 }}>Tx: <code>{txState.lastTxHash}</code></p>}
                {txState.error && <p style={{ fontSize: 12, color: "#fecaca" }}>Error: {txState.error}</p>}
              </div>
            )}
          </div>
        )}

        {/* ── UNIFIED REPORT BANNER ── */}
        {!isVotingMode && data.contractAddress && u.wallet && data.canReport && !isOrganizer && (
          <div style={{
            marginTop: 20,
            marginBottom: 24, // Added margin-bottom
            padding: "20px 24px",
            background: "linear-gradient(90deg, rgba(239,68,68,0.1), rgba(239,68,68,0.03))",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <FiAlertTriangle size={22} color="#fca5a5" style={{ marginTop: 2 }} />
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fca5a5" }}>Punya kecurigaan terhadap campaign ini?</p>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.7)", maxWidth: 600, lineHeight: 1.5 }}>
                  Pencairan terlihat tidak sesuai? Bukti terlihat mencurigakan atau tidak sesuai anggaran? Laporkan di sini.
                </p>
              </div>
            </div>
            <Link
              to={`/laporkan/${id}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 24px",
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.4)",
                borderRadius: 12,
                color: "#fca5a5",
                fontSize: 14,
                fontWeight: 700,
                textDecoration: "none",
                whiteSpace: "nowrap",
                transition: "all 0.2s"
              }}
              title="Laporkan kampanye ini"
            >
              <FiAlertTriangle size={15} /> Laporkan Campaign
            </Link>
          </div>
        )}

        {/* ── GRID LAYOUT ── */}
        <div className={`dk-grid-layout ${isVotingMode ? "dk-2col" : "dk-3col"}`}>

          {/* KIRI — Tentang + Dikelola Oleh + Statistik */}
          <div className="dk-col-left">
              <div className="dk-section-card">
                <h3 className="dk-section-title">Tentang Kampanye</h3>
                <p className="dk-deskripsi">{data.deskripsi}</p>
              </div>

              <div className="dk-organizer-card">
                <div className="dk-organizer-info">
                  <div className="dk-organizer-avatar">{(data.organizer || "??").slice(0, 2).toUpperCase()}</div>
                  <div>
                    <p className="dk-organizer-label">Dikelola oleh</p>
                    <p className="dk-organizer-name">{data.organizer}</p>
                    {data.walletOrganizer && (
                      <p style={{ marginTop: 4, fontSize: 11, opacity: 0.55, fontFamily: "'Courier New',monospace" }}>
                        {shortAddr(data.walletOrganizer)}
                      </p>
                    )}
                  </div>
                </div>
                {data.verified && (
                  <div className="dk-verified-badge"><FiShield size={13} /> Verified</div>
                )}
              </div>

              {/* Statistik */}
              <div className="dk-section-card">
                <h3 className="dk-section-title">Statistik</h3>
                <div className="dk-stats-grid">
                  {[
                    { val: isVotingMode ? `${totalVotes}/${MAX_VOTERS}` : data.donatur, lbl: isVotingMode ? "Voter" : "Donatur" },
                    { val: isVotingMode ? `${yesPercent}%` : data.terkumpulETH, lbl: isVotingMode ? "Vote Yes" : "ETH Terkumpul", orange: true },
                    { val: data.sisaHari, lbl: "Hari Durasi" },
                    { val: isVotingMode ? `${THRESHOLD}%` : `${persen}%`, lbl: isVotingMode ? "Target Vote" : "Tercapai" },
                  ].map(s => (
                    <div key={s.lbl} className="dk-stat-box">
                      <div className="dk-stat-val" style={s.orange ? { color: "#ffa757" } : {}}>
                        {s.val}
                      </div>
                      <div className="dk-stat-lbl">{s.lbl}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          {/* TENGAH — Anggaran + Contract */}
          <div className="dk-col-mid">
            {/* Tabel Anggaran */}
            <div className="dk-section-card">
              <h3 className="dk-section-title">
                <svg width="13" height="13" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" viewBox="0 0 24 24" style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }}>
                  <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
                </svg>
                Rincian Anggaran Dana
              </h3>
              {anggaran.length === 0 ? (
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", fontStyle: "italic" }}>Tidak ada rincian anggaran.</p>
              ) : (
                <div className="dk-tbl-wrap">
                  <table className="dk-tbl">
                    <thead>
                      <tr>
                        <th style={{ width: 32, textAlign: "center" }}>No</th>
                        <th>Nama Barang / Kebutuhan</th>
                        <th>Estimasi (ETH)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {anggaran.slice(0, 5).map((row, i) => (
                        <tr key={i} className="dk-tbl-row">
                          <td style={{ textAlign: "center", color: "rgba(255,255,255,0.28)", fontSize: 11 }}>{i + 1}</td>
                          <td className="dk-tbl-item">{row.barang || "Kebutuhan"}</td>
                          <td className="dk-tbl-harga">{row.harga ? parseFloat(row.harga).toFixed(3) : "0.000"}</td>
                        </tr>
                      ))}
                      {anggaran.length <= 5 && (
                        <tr className="dk-tbl-total">
                          <td></td>
                          <td className="dk-tbl-total-label">Total Estimasi</td>
                          <td className="dk-tbl-harga">{totalAnggaran} ETH</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {anggaran.length > 5 && (
                    <button 
                      onClick={() => setShowAnggaranModal(true)}
                      style={{ 
                        width: "100%", padding: "10px", background: "rgba(255,255,255,0.02)", 
                        border: "none", borderTop: "1px solid rgba(255,255,255,0.06)", 
                        color: "#ffa757", fontSize: 12, fontWeight: 600, cursor: "pointer",
                        fontFamily: "inherit", transition: "background 0.2s"
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                      onMouseOut={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                    >
                      Lihat Selengkapnya ({anggaran.length} item)
                    </button>
                  )}
                </div>
              )}
            </div>

            {!isVotingMode && data.contractAddress && (
                <div className="dk-section-card dk-contract-card">
                  <p className="dk-contract-label"><FiShield size={13} /> Smart Contract Address</p>
                  <div className="dk-contract-row">
                    <code className="dk-contract-address">{data.contractAddress}</code>
                    <button className="dk-copy-btn" onClick={handleCopyContract}>
                      {copied ? <FiCheck size={14} color="#22c55e" /> : <FiCopy size={14} />}
                    </button>
                  </div>
                  <a href={`https://etherscan.io/address/${data.contractAddress}`}
                    target="_blank" rel="noreferrer" className="dk-etherscan-link">
                    Lihat di Etherscan <FiExternalLink size={12} />
                  </a>
                </div>
              )}

              {/* ── Bukti Penggunaan Dana (Proof) dipindahkan ke sini ── */}
              {data.proofUrl && (
                <div className="dk-section-card" style={{ borderColor: "rgba(34,197,94,0.2)", background: "rgba(34,197,94,0.04)" }}>
                  <h3 className="dk-section-title">
                    <FiFileText size={13} style={{ marginRight: 6, verticalAlign: "middle" }} />
                    Bukti Penggunaan Dana
                  </h3>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 12px", lineHeight: 1.5 }}>
                    Organizer telah mengupload laporan penggunaan dana. Verifikasi keasliannya sebelum percaya.
                  </p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <a
                      href={data.proofUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "9px 16px",
                        background: "rgba(34,197,94,0.12)",
                        border: "1px solid rgba(34,197,94,0.3)",
                        borderRadius: 10, color: "#86efac", fontSize: 13,
                        fontWeight: 600, textDecoration: "none",
                      }}
                    >
                      <FiDownload size={13} /> Unduh / Lihat Bukti PDF
                    </a>
                    {data.proofSubmittedAt && (
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                        Disubmit: {new Date(data.proofSubmittedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* ── Jika bukti belum ada ── */}
              {!data.proofUrl && !isVotingMode && data.contractAddress && (
                <div className="dk-section-card" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <h3 className="dk-section-title">
                    <FiLock size={13} style={{ marginRight: 6, verticalAlign: "middle", opacity: 0.4 }} />
                    Bukti Penggunaan Dana
                  </h3>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0 }}>
                    Organizer belum mengupload bukti. Bukti wajib disubmit setelah fundraising berakhir.
                  </p>
                </div>
              )}

              {isVotingMode && (
                <div className="dk-section-card" style={{ borderColor: "rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.04)" }}>
                  <p className="dk-contract-label" style={{ color: "#a78bfa" }}>
                    <FiShield size={13} /> Status Voting
                  </p>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, margin: 0 }}>
                    Campaign ini sedang dalam proses voting komunitas. Smart contract akan otomatis di-deploy setelah ≥{THRESHOLD}% voter menyetujui.
                  </p>
                </div>
              )}
            </div>

            {/* KANAN — Public Ledger (hanya jika aktif) */}
            {!isVotingMode && (
              <div className="dk-col-right">
                <div className="dk-ledger-card">
                  <div className="dk-ledger-header">
                    <div>
                      <h3 className="dk-ledger-title">Public Ledger</h3>
                      <p className="dk-ledger-sub">Transaksi on-chain</p>
                    </div>
                    <div className="dk-live-badge">
                      <span className="dk-live-dot" /> LIVE
                    </div>
                  </div>
                  <div className="dk-ledger-table-wrapper">
                    <table className="dk-ledger-table">
                      <thead>
                        <tr><th>Wallet</th><th>Jumlah</th><th>Waktu</th><th>TX</th></tr>
                      </thead>
                      <tbody>
                        {(data.transaksi || []).length === 0 ? (
                          <tr><td colSpan={4} style={{ opacity: 0.4, padding: "14px 10px" }}>Belum ada transaksi.</td></tr>
                        ) : (
                          (data.transaksi || []).map((tx, i) => (
                            <tr key={i} className="dk-ledger-row">
                              <td><code className="dk-wallet">{shortAddr(tx.wallet)}</code></td>
                              <td><span className="dk-jumlah-eth">{tx.jumlah}</span></td>
                              <td><span className="dk-waktu">{tx.waktu}</span></td>
                              <td>
                                <a href={`https://etherscan.io/tx/${tx.txHash}`}
                                  target="_blank" rel="noreferrer" className="dk-tx-link">
                                  {String(tx.txHash || "").slice(0, 8)}... <FiExternalLink size={10} />
                                </a>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {data.contractAddress && (
                    <div className="dk-ledger-footer">
                      <a href={`https://etherscan.io/address/${data.contractAddress}`}
                        target="_blank" rel="noreferrer" className="dk-etherscan-link">
                        Lihat semua di Etherscan <FiExternalLink size={12} />
                      </a>
                    </div>
                  )}
                </div>

                {/* ── Withdrawal History (Pencairan) ── */}
                {(data.pencairan || []).length > 0 && (
                  <div className="dk-ledger-card" style={{ borderColor: "rgba(251,191,36,0.2)" }}>
                    <div className="dk-ledger-header">
                      <div>
                        <h3 className="dk-ledger-title" style={{ color: "#fbbf24" }}>
                          <FiDollarSign size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
                          Pencairan Dana
                        </h3>
                        <p className="dk-ledger-sub">Riwayat withdrawal oleh organizer</p>
                      </div>
                    </div>
                    <div className="dk-ledger-table-wrapper">
                      <table className="dk-ledger-table">
                        <thead>
                          <tr><th>Tujuan</th><th>Jumlah</th><th>Waktu</th><th>TX</th></tr>
                        </thead>
                        <tbody>
                          {(data.pencairan || []).map((p, i) => (
                            <tr key={i} className="dk-ledger-row">
                              <td><code className="dk-wallet">{shortAddr(p.ke || p.to)}</code></td>
                              <td><span className="dk-jumlah-eth" style={{ color: "#fbbf24" }}>{p.jumlah}</span></td>
                              <td><span className="dk-waktu">{p.waktu}</span></td>
                              <td>
                                {p.txHash ? (
                                  <a href={`https://etherscan.io/tx/${p.txHash}`}
                                    target="_blank" rel="noreferrer" className="dk-tx-link">
                                    {String(p.txHash || "").slice(0, 8)}... <FiExternalLink size={10} />
                                  </a>
                                ) : <span style={{ opacity: 0.3, fontSize: 11 }}>N/A</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </main>

      {/* ── MODAL ANGGARAN ── */}
      {showAnggaranModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20
        }} onClick={() => setShowAnggaranModal(false)}>
          <div style={{
            background: "#0d1f3c", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16, width: "100%", maxWidth: 600,
            maxHeight: "85vh", display: "flex", flexDirection: "column",
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)", overflow: "hidden"
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 16, color: "white" }}>Seluruh Rincian Anggaran</h3>
              <button onClick={() => setShowAnggaranModal(false)} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: 4 }}>
                <FiXCircle size={22} />
              </button>
            </div>
            <div style={{ padding: 24, overflowY: "auto" }}>
              <div className="dk-tbl-wrap">
                <table className="dk-tbl">
                  <thead>
                    <tr>
                      <th style={{ width: 32, textAlign: "center" }}>No</th>
                      <th>Nama Barang / Kebutuhan</th>
                      <th>Estimasi (ETH)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anggaran.map((row, i) => (
                      <tr key={i} className="dk-tbl-row">
                        <td style={{ textAlign: "center", color: "rgba(255,255,255,0.28)", fontSize: 11 }}>{i + 1}</td>
                        <td className="dk-tbl-item">{row.barang || "Kebutuhan"}</td>
                        <td className="dk-tbl-harga">{row.harga ? parseFloat(row.harga).toFixed(3) : "0.000"}</td>
                      </tr>
                    ))}
                    <tr className="dk-tbl-total">
                      <td></td>
                      <td className="dk-tbl-total-label">Total Estimasi Keseluruhan</td>
                      <td className="dk-tbl-harga">{totalAnggaran} ETH</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DetailCampaign;