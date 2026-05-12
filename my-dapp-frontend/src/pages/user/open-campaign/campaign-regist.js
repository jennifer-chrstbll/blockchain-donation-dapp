import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiPlusCircle,
  FiSearch,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiChevronRight,
  FiTarget,
  FiUsers,
  FiShield,
  FiLock,
  FiRefreshCw,
  FiAlertTriangle,
} from "react-icons/fi";
import NavbarUser from "../../../components/navbar-user";
import { useCampaign } from "../../../context/CampaignContext";
import "../../../styles/user/open-campaign/campaign-regist.css";

import { ethers } from "ethers";
import { HARDHAT_CHAIN_ID } from "../../../web3/config";

function getCurrentUser() {
  try {
    return JSON.parse(sessionStorage.getItem("currentUser")) || {};
  } catch {
    return {};
  }
}
function getInisial(nama = "") {
  return (
    nama
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "??"
  );
}

const STATUS_CONFIG = {
  aktif: { label: "Aktif", icon: <FiCheckCircle size={12} />, className: "dc-badge-aktif" },
  menunggu: { label: "Menunggu Verifikasi", icon: <FiClock size={12} />, className: "dc-badge-menunggu" },
  ditolak: { label: "Ditolak", icon: <FiXCircle size={12} />, className: "dc-badge-ditolak" },
  selesai: { label: "Selesai", icon: <FiCheckCircle size={12} />, className: "dc-badge-selesai" },
  ditutup: { label: "Ditutup", icon: <FiXCircle size={12} />, className: "dc-badge-ditolak" },
  arsip: { label: "Diarsipkan", icon: <FiXCircle size={12} />, className: "dc-badge-ditolak" },
  voting: { label: "Proses Voting", icon: <FiShield size={12} />, className: "dc-badge-voting" },
};

// ─── Helper: format detik → "Xj Ym" ───────────────────────────────────────────
function formatSisa(detik) {
  if (detik <= 0) return "Waktu Habis";
  const jam = Math.floor(detik / 3600);
  const menit = Math.floor((detik % 3600) / 60);
  if (jam >= 24) {
    const hari = Math.floor(jam / 24);
    const sisaJam = jam % 24;
    return `${hari}h ${sisaJam}j`;
  }
  return jam > 0 ? `${jam}j ${menit}m` : `${menit}m`;
}

// ─── Komponen VotingOnChainPanel ──────────────────────────────────────────────
// Organizer melihat status voting langsung dari blockchain.
// Alamat validator disembunyikan — hanya ditampilkan sebagai "Validator 1" dst.
function VotingOnChainPanel({ kampanyeDbId }) {
  const { getVotingStateOnChain, getTop10ValidatorsOnChain, replaceMissingVoterOnChain } = useCampaign();

  const [state, setState] = useState(null);   // { votingEndsAt, voterInfoList, campaignIdOnChain }
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [replaceMsg, setReplaceMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const result = await getVotingStateOnChain(kampanyeDbId);
      setState(result);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [kampanyeDbId, getVotingStateOnChain]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="dc-vote-panel">
        <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.7, padding: "12px 0" }}>
          <FiRefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 13 }}>Memuat data voting dari blockchain...</span>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="dc-vote-panel">
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fecaca", fontSize: 13 }}>
          <FiAlertTriangle size={14} />
          <span>{err}</span>
        </div>
        <button onClick={load} style={{ marginTop: 8, fontSize: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Coba Lagi</button>
      </div>
    );
  }

  if (!state) return null;

  const { votingEndsAt, voterInfoList, campaignIdOnChain } = state;
  const nowSec = Math.floor(Date.now() / 1000);
  const sisaVotingDetik = Math.max(0, votingEndsAt - nowSec);
  const votingEndsDate = new Date(votingEndsAt * 1000).toLocaleString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  // Validator yang lalai (belum vote, belum replaced, sudah >24 jam)
  const lalaiList = voterInfoList.filter((v) => v.isLalai);
  const sudahVoteCount = voterInfoList.filter((v) => v.hasVoted).length;

  async function handleGantiAcak() {
    if (replacing) return;
    setReplacing(true);
    setReplaceMsg("");
    try {
      const { votingContractAddr } = state;

      // 1. Ambil top10 dari chain
      const top10 = await getTop10ValidatorsOnChain();

      // 2. Ambil SEMUA alamat yang pernah ada di voters[] contract (aktif + yang sudah replaced)
      //    Smart contract require: !isVoter[newVoter], jadi newVoter harus benar-benar fresh
      let allPastVoterAddrs;
      try {
        const GOV_ABI_VOTERS = ["function getVoters() external view returns (address[] memory)"];
        const prov = new ethers.BrowserProvider(window.ethereum);
        const gv = new ethers.Contract(votingContractAddr, GOV_ABI_VOTERS, prov);
        const allVoters = await gv.getVoters();
        allPastVoterAddrs = new Set(allVoters.map((a) => a.toLowerCase()));
      } catch {
        // Fallback: pakai daftar yang tampil di panel
        allPastVoterAddrs = new Set(voterInfoList.map((v) => v.addr.toLowerCase()));
      }

      // 3. Ganti tiap validator lalai (belum vote, sudah >24 jam) satu per satu
      for (const lalai of lalaiList) {
        // Kandidat: top10 yang BELUM PERNAH jadi voter di contract ini
        const kandidat = top10.filter((a) => !allPastVoterAddrs.has(a.toLowerCase()));
        if (kandidat.length === 0) {
          setReplaceMsg("Tidak ada kandidat pengganti tersisa di Top 10. Hubungi Admin.");
          setReplacing(false);
          return;
        }
        const idx = Math.floor(Math.random() * kandidat.length);
        const newVoter = kandidat[idx];

        await replaceMissingVoterOnChain(campaignIdOnChain, lalai.addr, newVoter);
        // Tandai newVoter sebagai terpakai agar iterasi berikutnya tidak dobel
        allPastVoterAddrs.add(newVoter.toLowerCase());
      }

      setReplaceMsg("Berhasil! Validator telah diganti. Memuat ulang...");
      setTimeout(() => { load(); setReplaceMsg(""); }, 2000);
    } catch (e) {
      console.error("Gagal ganti validator:", e);
      setReplaceMsg("Gagal: " + (e?.shortMessage || e?.reason || e?.message || String(e)));
    } finally {
      setReplacing(false);
    }
  }



  return (
    <div className="dc-vote-panel">
      {/* Header */}
      <div className="dc-vote-header">
        <div className="dc-vote-shield"><FiShield size={16} color="#ffa757" /></div>
        <div>
          <p className="dc-vote-title">Proses Voting Komunitas</p>
          <p className="dc-vote-sub">Dibutuhkan minimal 4 suara Yes dari 6 validator untuk campaign disetujui</p>
        </div>
      </div>

      {/* ⏰ Batas Tutup Voting Keseluruhan (2 hari) — tampil di atas */}
      <div style={{
        marginBottom: 14,
        padding: "8px 12px",
        borderRadius: 8,
        background: sisaVotingDetik > 0 ? "rgba(255,167,87,0.1)" : "rgba(239,68,68,0.1)",
        border: `1px solid ${sisaVotingDetik > 0 ? "rgba(255,167,87,0.3)" : "rgba(239,68,68,0.4)"}`,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <FiClock size={13} color={sisaVotingDetik > 0 ? "#ffa757" : "#ef4444"} />
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: sisaVotingDetik > 0 ? "#ffa757" : "#ef4444" }}>
            Batas Tutup Voting:{" "}
          </span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
            {votingEndsDate}
          </span>
          {sisaVotingDetik > 0 && (
            <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.6 }}>
              (sisa {formatSisa(sisaVotingDetik)})
            </span>
          )}
          {sisaVotingDetik <= 0 && (
            <span style={{ fontSize: 11, marginLeft: 6, color: "#ef4444" }}>
              — Waktu voting telah berakhir
            </span>
          )}
        </div>
      </div>

      {/* Status tiap Validator */}
      <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, opacity: 0.8 }}>Status Validator:</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {voterInfoList.map((v) => (
          <div key={v.label} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "7px 10px", borderRadius: 8,
            background: v.hasVoted
              ? "rgba(34,197,94,0.08)"
              : v.isLalai
                ? "rgba(239,68,68,0.08)"
                : "rgba(255,255,255,0.04)",
            border: `1px solid ${v.hasVoted ? "rgba(34,197,94,0.2)" : v.isLalai ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.08)"
              }`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {v.hasVoted ? (
                <FiCheckCircle size={13} color="#22c55e" />
              ) : v.isLalai ? (
                <FiXCircle size={13} color="#ef4444" />
              ) : (
                <FiClock size={13} color="rgba(255,255,255,0.4)" />
              )}
              <span style={{ fontSize: 13, fontWeight: 500 }}>{v.label}</span>
            </div>
            <span style={{
              fontSize: 11,
              color: v.hasVoted ? "#22c55e" : v.isLalai ? "#ef4444" : "rgba(255,255,255,0.5)",
            }}>
              {v.hasVoted
                ? "Sudah Vote"
                : v.isLalai
                  ? "Waktu Habis"
                  : `Menunggu (sisa ${formatSisa(v.sisaDetik)})`}
            </span>
          </div>
        ))}
      </div>

      {/* Info progres */}
      <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 10 }}>
        {sudahVoteCount} dari {voterInfoList.length} validator telah memberikan suara
      </p>

      {/* Peringatan & Tombol Ganti Acak — muncul hanya jika ada yang lalai */}
      {lalaiList.length > 0 && (
        <div style={{
          padding: "10px 12px",
          borderRadius: 8,
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.3)",
          marginBottom: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
            <FiAlertTriangle size={13} color="#ef4444" />
            <span style={{ fontSize: 12, color: "#fecaca", fontWeight: 600 }}>
              Ada {lalaiList.length} validator yang tidak merespon (waktu habis)
            </span>
          </div>
          <button
            id="btn-ganti-validator-acak"
            onClick={handleGantiAcak}
            disabled={replacing}
            style={{
              width: "100%",
              padding: "9px 0",
              borderRadius: 8,
              background: replacing ? "rgba(239,68,68,0.3)" : "linear-gradient(135deg,#ef4444,#dc2626)",
              color: "#fff",
              border: "none",
              cursor: replacing ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              transition: "opacity 0.2s",
            }}
          >
            {replacing ? (
              <><FiRefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Mengganti Validator...</>
            ) : (
              <><FiRefreshCw size={13} /> Ganti Validator Acak Sekaligus</>
            )}
          </button>
          {replaceMsg && (
            <p style={{ marginTop: 7, fontSize: 12, color: replaceMsg.includes("Berhasil") ? "#22c55e" : "#fecaca" }}>
              {replaceMsg}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

async function connectWalletChecked() {
  if (!window.ethereum) throw new Error("MetaMask tidak terdeteksi.");
  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x7A69" }],
    });
  } catch (err) {
    throw new Error("Gagal switch ke Hardhat Local (31337).");
  }
  const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
  const chainId = parseInt(chainIdHex, 16);
  if (chainId !== HARDHAT_CHAIN_ID) {
    throw new Error(
      `Network salah. Pindah ke Hardhat Local (chainId ${HARDHAT_CHAIN_ID}). ChainId kamu sekarang: ${chainId}`
    );
  }
  const signer = await provider.getSigner();
  return signer.getAddress();
}

function DaftarCampaign() {
  const navigate = useNavigate();
  const { pengajuanList, kampanyeAktif, kampanyeArsip, notifUser, claimPrescreenTimeoutOnChain } = useCampaign();

  const [expandTolak, setExpandTolak] = useState(null);
  const [search, setSearch] = useState("");
  const [walletErr, setWalletErr] = useState("");
  const [statusFilter, setStatusFilter] = useState("semua");
  const [claimLoading, setClaimLoading] = useState(null);
  const [claimErr, setClaimErr] = useState("");

  const u = getCurrentUser();
  const inisial = getInisial(u.nama || "");
  const hasNotif = notifUser.some((n) => !n.dibaca);
  const walletMM = u.wallet || "";

  async function handleConnectWallet() {
    setWalletErr("");
    try {
      const addr = await connectWalletChecked();
      const user = getCurrentUser();
      if (user.wallet && addr.toLowerCase() !== user.wallet.toLowerCase()) {
        setWalletErr(`Wallet salah! Gunakan wallet yang terdaftar: ${user.wallet.slice(0, 10)}...${user.wallet.slice(-6)}`);
        return;
      }
      setWalletErr("");
    } catch (e) {
      setWalletErr(e?.message || String(e));
    }
  }

  useEffect(() => {
    if (!window.ethereum) return;
    const handleChainChanged = () => {
      setWalletErr("Network berubah. Pastikan kamu pakai Hardhat Local (chainId 31337).");
    };
    window.ethereum.on("chainChanged", handleChainChanged);
    return () => {
      try {
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      } catch { }
    };
  }, []);

  const aktifById = useMemo(() => {
    const m = new Map();
    (kampanyeAktif || []).forEach((k) => m.set(k.id, k));
    (kampanyeArsip || []).forEach((k) => m.set(k.id, k));
    return m;
  }, [kampanyeAktif, kampanyeArsip]);

  const kampanyeSaya = useMemo(() => {
    if (!walletMM) return [];

    return (pengajuanList || [])
      .filter((p) => String(p.walletAddress || "").toLowerCase() === walletMM.toLowerCase())
      .map((p) => {
        const aktif = aktifById.get(p.id);

        // ✅ Source of truth:
        // - Jika sudah ada di kampanye_aktif => sudah published & aktif (walaupun pengajuan masih punya status/votes lama)
        // - Jika belum ada => ikuti status pengajuan
        let statusUI;
        if (aktif) {
          statusUI = aktif.status; // bisa 'aktif', 'selesai', 'ditutup', atau 'arsip'
        } else if (p.status === "voting") {
          statusUI = "voting";
        } else if (p.status === "pending") {
          statusUI = "menunggu";
        } else if (p.status === "ditolak") {
          statusUI = "ditolak";
        } else if (p.status === "disetujui") {
          // disetujui tapi belum masuk kampanye_aktif (mis. deploy belum kebaca) => treat as menunggu
          statusUI = "menunggu";
        } else {
          statusUI = "selesai";
        }

        // Default dari pengajuan
        let merged = {
          raw: p,
          id: p.id,
          foto: p.fotoCover,
          judul: p.judulKampanye,
          status: statusUI,
          terkumpul: 0,
          target: parseFloat(p.targetETH) || 0,
          donatur: 0,
          sisaHari: parseInt(p.durasiHari) || 0,
          tanggalDibuat: p.tanggalMasuk,
          alasanTolak: p.alasanTolak || "",
          contractAddress: null,
          votes: p.votes || { yes: 0, no: 0, voters: [] },
        };

        // Kalau sudah aktif, merge data kampanye_aktif (progress & contract)
        if (aktif) {
          merged = {
            ...merged,
            foto: aktif.foto || merged.foto,
            judul: aktif.judul || merged.judul,
            terkumpul: Number(aktif.terkumpulETH || 0),
            target: Number(aktif.targetETH || merged.target || 0),
            donatur: Number(aktif.donatur || 0),
            sisaHari: Number(aktif.sisaHari || merged.sisaHari || 0),
            contractAddress: aktif.contractAddress || null,
          };
        }

        return merged;
      });
  }, [aktifById, pengajuanList, walletMM]);

  const kampanyeFiltered = useMemo(() => {
    let list = kampanyeSaya.filter((k) => k.judul.toLowerCase().includes(search.toLowerCase()));

    if (statusFilter !== "semua") {
      list = list.filter((k) => k.status === statusFilter);
    }

    // Sort: Terbaru ke terlama (berdasarkan raw.tanggal_masuk)
    return list.sort((a, b) => {
      const dateA = new Date(a.raw.tanggal_masuk || 0);
      const dateB = new Date(b.raw.tanggal_masuk || 0);
      return dateB - dateA;
    });
  }, [kampanyeSaya, search, statusFilter]);


  return (
    <div className="dc-wrapper">
      <NavbarUser inisial={inisial} hasNotif={hasNotif} searchValue={search} onSearch={setSearch} />

      <main className="dc-main">
        <div className="dc-page-header">
          <div>
            <h1 className="dc-page-title">Campaign Saya</h1>
            <p className="dc-page-sub">Kelola kampanye yang pernah Anda ajukan</p>

            <div className="dc-wallet-tag">
              <span className={`dc-wallet-dot ${walletMM ? "connected" : ""}`} />
              <code className="dc-wallet-txt">
                {walletMM ? `${walletMM.slice(0, 10)}...${walletMM.slice(-6)}` : "(tidak ada data wallet)"}
              </code>
              {walletMM && <span className="dc-wallet-badge">Terhubung</span>}
            </div>

            {walletErr && <p style={{ marginTop: 6, fontSize: 12, color: "#fecaca" }}>{walletErr}</p>}
          </div>

          <div className="dc-btn-group">
            <button className="dc-btn-outline" onClick={handleConnectWallet}>
              <svg width="13" height="13" fill="none" stroke="#ffa757" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h11v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
              </svg>
              Verifikasi Wallet
            </button>
            <button className="dc-btn-buat" onClick={() => navigate("/buat-campaign")}>
              <FiPlusCircle size={15} /> Buat Campaign Baru
            </button>
          </div>
        </div>

        <div className="dc-filters">
          {[
            { id: "semua", label: "Semua" },
            { id: "aktif", label: "Aktif" },
            { id: "menunggu", label: "Menunggu" },
            { id: "voting", label: "Voting" },
            { id: "selesai", label: "Selesai" },
            { id: "ditolak", label: "Ditolak" },
            { id: "arsip", label: "Arsip" },
          ].map((f) => (
            <button
              key={f.id}
              className={`dc-filter-btn ${statusFilter === f.id ? "active" : ""}`}
              onClick={() => setStatusFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="dc-info-banner">
          <FiAlertCircle size={15} color="#ffa757" style={{ flexShrink: 0, marginTop: 1 }} />
          <p>
            Setiap kampanye baru memerlukan <b>verifikasi admin</b> lalu <b>persetujuan komunitas (≥ 80% vote Yes)</b>{" "}
            sebelum bisa menerima donasi. Setelah lolos voting, smart contract akan otomatis di-deploy di blockchain Ethereum.
          </p>
        </div>

        {!walletMM && (
          <div className="dc-empty">
            <div className="dc-orbit">
              <div className="dc-orbit-r1" />
              <div className="dc-orbit-r2" />
              <div className="dc-orbit-core">
                <div className="dc-orbit-icon">
                  <svg width="20" height="20" fill="none" stroke="#ffa757" strokeWidth="1.8" viewBox="0 0 24 24">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
              </div>
            </div>
            <p className="dc-empty-title">Data Wallet Tidak Ditemukan</p>
            <p className="dc-empty-sub">Sesi login tidak memiliki data wallet. Silakan logout dan login kembali.</p>
          </div>
        )}

        {walletMM && kampanyeFiltered.length === 0 && (
          <div className="dc-empty">
            <FiSearch size={32} color="rgba(255,255,255,0.2)" />
            <p className="dc-empty-sub">
              {kampanyeSaya.length === 0
                ? "Anda belum memiliki kampanye. Buat kampanye pertama Anda!"
                : "Tidak ada kampanye yang cocok dengan pencarian."}
            </p>
          </div>
        )}

        {walletMM && kampanyeFiltered.length > 0 && (
          <div className="dc-list">
            {kampanyeFiltered.map((k) => {
              const sc = STATUS_CONFIG[k.status] || STATUS_CONFIG["menunggu"];
              const persen = k.target > 0 ? Math.min((k.terkumpul / k.target) * 100, 100).toFixed(0) : 0;
              const isActive = k.status === "aktif";
              const isVoting = k.status === "voting";
              const canManage = isActive && !!k.contractAddress;

              return (
                <div key={k.id} className="dc-item">
                  <img src={k.foto} alt={k.judul} className="dc-item-foto" />
                  <div className="dc-item-info">
                    <div className="dc-item-top">
                      <div>
                        <h3 className="dc-item-judul">{k.judul}</h3>
                        <p className="dc-item-tanggal">Dibuat {k.tanggalDibuat}</p>
                      </div>
                      <div className={`dc-badge ${sc.className}`}>
                        {sc.icon} {sc.label}
                      </div>
                    </div>

                    {isVoting && <VotingOnChainPanel kampanyeDbId={k.id} />}

                    {(k.status === "aktif" || k.status === "selesai" || k.status === "arsip" || k.status === "ditutup") && (
                      <>
                        <div className="dc-item-progress-bg">
                          <div className="dc-item-progress-fill" style={{ width: persen + "%" }} />
                        </div>
                        <div className="dc-item-stats">
                          <span className="dc-item-eth">
                            <FiTarget size={12} /> {k.terkumpul} / {k.target} ETH
                          </span>
                          <span className="dc-item-donatur">
                            <FiUsers size={12} /> {k.donatur} donatur
                          </span>
                          <span className="dc-item-hari">
                            <FiClock size={12} /> {(k.status === "aktif") ? `${k.sisaHari} hari lagi` : "Selesai"}
                          </span>
                          <span className="dc-item-persen">{persen}%</span>
                        </div>

                        {isActive && !k.contractAddress && (
                          <p style={{ marginTop: 8, fontSize: 12, opacity: 0.8, color: "#ffa757" }}>
                            Contract belum tersedia. Coba refresh atau tunggu beberapa detik.
                          </p>
                        )}
                        {k.contractAddress && (
                          <p style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                            Contract:{" "}
                            <code>
                              {String(k.contractAddress).slice(0, 12)}...{String(k.contractAddress).slice(-6)}
                            </code>
                          </p>
                        )}
                      </>
                    )}

                    {k.status === "menunggu" &&
                      (() => {
                        const votes = k.votes || { yes: 0, no: 0, voters: [] };
                        const maxVoters = 6;
                        const totalVote = votes.yes + votes.no;
                        const votePct = Math.round((totalVote / maxVoters) * 100);
                        return (
                          <div className="dc-item-pending-info">
                            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                              <FiClock size={13} color="#ffa757" />
                              <span>
                                Menunggu proses admin / voting... ({totalVote}/{maxVoters} voter)
                              </span>
                            </div>

                            <div className="dc-pending-steps">
                              <div className="dc-pending-step done">
                                <div className="dc-pending-step-dot">
                                  <FiCheckCircle size={10} />
                                </div>
                                <span>Pengajuan</span>
                              </div>
                              <div className="dc-pending-step-line done" />
                              <div className="dc-pending-step active">
                                <div className="dc-pending-step-dot pulse">
                                  <FiShield size={10} />
                                </div>
                                <span>Voting</span>
                              </div>
                              <div className="dc-pending-step-line" />
                              <div className="dc-pending-step">
                                <div className="dc-pending-step-dot">
                                  <FiCheckCircle size={10} />
                                </div>
                                <span>Aktif</span>
                              </div>
                            </div>

                            <div className="dc-pending-progress-wrap">
                              <div className="dc-pending-progress-bar">
                                <div className="dc-pending-progress-fill" style={{ width: `${votePct}%` }} />
                              </div>
                              <span className="dc-pending-progress-pct">{votePct}%</span>
                            </div>

                            {/* Cek Timeout Prescreen (2 hari) */}
                            {(() => {
                              const rawDate = k.raw.rawTanggalMasuk || k.raw.tanggalMasuk;
                              if (!rawDate) return null;
                              
                              const createdMs = new Date(rawDate).getTime();
                              const now = Date.now();
                              const isTimeout = !isNaN(createdMs) && now > createdMs + (2 * 24 * 60 * 60 * 1000);
                              
                              if (isTimeout && k.raw.campaign_id) {
                                return (
                                  <div style={{ marginTop: 15, padding: 12, borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                                      <FiAlertCircle size={14} color="#ef4444" />
                                      <span style={{ fontSize: 12, color: "#fecaca", fontWeight: 600 }}>
                                        Admin tidak merespon lebih dari 2 hari.
                                      </span>
                                    </div>
                                    <button
                                      onClick={async () => {
                                        if (claimLoading) return;
                                        setClaimLoading(k.id);
                                        setClaimErr("");
                                        try {
                                          await claimPrescreenTimeoutOnChain(k.raw.campaign_id);
                                          window.location.reload();
                                        } catch (err) {
                                          setClaimErr(err?.shortMessage || err?.message || String(err));
                                        } finally {
                                          setClaimLoading(null);
                                        }
                                      }}
                                      disabled={claimLoading === k.id}
                                      style={{
                                        width: "100%", padding: "8px 0", borderRadius: 6, background: "#ef4444", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: claimLoading === k.id ? "not-allowed" : "pointer",
                                      }}
                                    >
                                      {claimLoading === k.id ? "Memproses Refund..." : "Batalkan & Refund 0.65 ETH"}
                                    </button>
                                    {claimErr && claimLoading === null && <p style={{ marginTop: 6, fontSize: 11, color: "#fca5a5" }}>{claimErr}</p>}
                                  </div>
                                );
                              }
                              return null;
                            })()}

                          </div>
                        );
                      })()}

                    {k.status === "ditolak" && (
                      <div className="dc-item-tolak-info">
                        <div className="dc-item-tolak-row">
                          <FiXCircle size={13} color="#ef4444" />
                          <span>Pengajuan ditolak</span>
                          <button
                            className="dc-item-tolak-toggle"
                            onClick={() => setExpandTolak(expandTolak === k.id ? null : k.id)}
                          >
                            {expandTolak === k.id ? "Sembunyikan" : "Lihat alasan"}
                          </button>
                        </div>
                        {expandTolak === k.id && <p className="dc-item-tolak-alasan">{k.alasanTolak}</p>}
                      </div>
                    )}

                    <div className="dc-item-actions">
                      {k.status !== "ditolak" && (
                        <Link to={"/campaign/saya/" + k.id} className="dc-item-btn-primary">
                          {k.status === "aktif" && !!k.contractAddress ? "Kelola Campaign" : "Lihat Detail"} <FiChevronRight size={14} />
                        </Link>
                      )}
                      {k.status === "ditolak" && (
                        <button className="dc-item-btn-primary" onClick={() => navigate("/buat-campaign", { state: { prefill: k.raw } })}>
                          Ajukan Ulang <FiChevronRight size={14} />
                        </button>
                      )}
                      
                      {k.status === "aktif" && !k.contractAddress && <span className="dc-item-btn-disabled">Deploying contract...</span>}
                      {isVoting && (
                        <span className="dc-item-btn-disabled">
                          <FiLock size={12} /> Terkunci (Voting)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default DaftarCampaign;