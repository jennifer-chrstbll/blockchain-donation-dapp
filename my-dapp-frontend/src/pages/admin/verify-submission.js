import { useState, useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  FiArrowLeft,
  FiShield,
  FiUser,
  FiFileText,
  FiExternalLink,
  FiClock,
  FiEye,
  FiDownload,
  FiCopy,
  FiCheck,
  FiThumbsUp,
  FiThumbsDown,
  FiUsers,
  FiRefreshCw,
  FiLock,
  FiXCircle,
} from "react-icons/fi";
import "../../styles/admin/verify-submission.css";
import { useCampaign } from "../../context/CampaignContext";
import { ethers } from "ethers";
import { HARDHAT_CHAIN_ID } from "../../web3/config";
import { supabase } from "../../web3/supabaseClient";

// ===== On-chain ABIs minimal =====
const GOVERNANCE_VOTING_ABI = [
  "function getVoters() view returns (address[])",
  "function yesCount() view returns (uint256)",
  "function noCount() view returns (uint256)",
  "function result() view returns (uint8)",
  "function vote(uint8 c)",
  "function voterInfo(address) view returns (uint64 assignedAt,bool replaced,uint8 choice)",
  "function votingEndsAt() view returns (uint256)",
];

const STAKING_MANAGER_ABI = [
  "event CampaignVotingStarted(uint256 indexed campaignId,address votingContract,bytes32 salt)",
  "function adminStartVoting(uint256 campaignId,bytes32 salt)",
  "function adminRejectPrescreen(uint256 campaignId)",
  "function finalizeAndStartFundraising(uint256 campaignId,uint32 durationDays,uint256 targetEth)",
  "function isAdmin(address) view returns (bool)",
  "error NotAdmin()",
  "error BadStatus()",
  "error InvalidValue()"
];

function getStakingManagerAddress() {
  const addr = process.env.REACT_APP_STAKINGMANAGER_ADDRESS;
  if (!addr) throw new Error("Missing REACT_APP_STAKINGMANAGER_ADDRESS in frontend .env");
  return addr;
}

function getCurrentUser() {
  try {
    return JSON.parse(sessionStorage.getItem("currentUser")) || {};
  } catch {
    return {};
  }
}

async function getProviderChecked() {
  if (!window.ethereum) throw new Error("MetaMask tidak terdeteksi.");
  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== HARDHAT_CHAIN_ID) {
    throw new Error(
      `Network salah. Pindah ke Hardhat Local (chainId ${HARDHAT_CHAIN_ID}). ChainId kamu sekarang: ${chainId}`
    );
  }
  return provider;
}

function DokumenPreview({ dokumen }) {
  if (!dokumen || (!dokumen.url && dokumen.nama === "-")) {
    return <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Tidak ada dokumen</span>;
  }

  const isGambar = dokumen.tipe?.startsWith("image/");
  const url = dokumen.url;

  function handlePreview() {
    if (!url) return;
    window.open(url, "_blank");
  }

  function handleDownload() {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = dokumen.nama || "dokumen";
    a.target = "_blank";
    a.click();
  }

  return (
    <>
      {isGambar && url && (
        <img
          src={url}
          alt={dokumen.nama}
          style={{
            width: "100%",
            maxHeight: 300,
            objectFit: "contain",
            borderRadius: 8,
            marginBottom: 12,
            background: "rgba(0,0,0,0.2)",
          }}
        />
      )}
      <div className="dpa-dokumen-box">
        <div className="dpa-dokumen-icon">
          <FiFileText size={24} color="#ffa757" />
        </div>
        <div className="dpa-dokumen-info">
          <p className="dpa-dokumen-nama">{dokumen.nama || "Dokumen"}</p>
          {isGambar ? <p className="dpa-dokumen-ukuran">Gambar</p> : <p className="dpa-dokumen-ukuran">PDF / Dokumen</p>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="dpa-btn-preview" onClick={handlePreview} disabled={!url}>
            <FiEye size={14} /> Preview
          </button>
          <button
            className="dpa-btn-preview"
            onClick={handleDownload}
            disabled={!url}
            style={{
              background: "rgba(87,163,255,0.12)",
              borderColor: "rgba(87,163,255,0.3)",
            }}
          >
            <FiDownload size={14} /> Unduh
          </button>
        </div>
      </div>
    </>
  );
}

function TabelAnggaran({ anggaran }) {
  const rows = Array.isArray(anggaran) ? anggaran.filter((r) => r.barang || r.harga) : [];
  const total = rows.reduce((s, r) => s + (parseFloat(r.harga) || 0), 0).toFixed(3);

  return (
    <div className="dpa-card">
      <div className="dpa-card-header">
        <svg width="15" height="15" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
        <h3 className="dpa-card-title">Rincian Anggaran Dana</h3>
      </div>
      <div className="dpa-anggaran-wrap">
        <table className="dpa-anggaran-tbl">
          <thead>
            <tr>
              <th style={{ width: 38, textAlign: "center" }}>No</th>
              <th>Nama Barang / Kebutuhan</th>
              <th>Estimasi Harga (ETH)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="dpa-anggaran-empty">
                  Tidak ada rincian anggaran yang diisi.
                </td>
              </tr>
            ) : (
              <>
                {rows.map((row, i) => (
                  <tr key={i} className="dpa-anggaran-row">
                    <td style={{ textAlign: "center", color: "rgba(255,255,255,0.28)", fontSize: 11 }}>{i + 1}</td>
                    <td className="dpa-anggaran-item">{row.barang || "-"}</td>
                    <td className="dpa-anggaran-harga">{row.harga ? parseFloat(row.harga).toFixed(3) : "0.000"}</td>
                  </tr>
                ))}
                <tr className="dpa-anggaran-total">
                  <td></td>
                  <td className="dpa-anggaran-total-label">Total Estimasi</td>
                  <td className="dpa-anggaran-harga">{total} ETH</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const REJECT_REASONS = [
  { code: "DOC_INCOMPLETE", label: "Dokumen tidak lengkap" },
  { code: "DOC_INVALID", label: "Dokumen tidak valid / tidak terbaca" },
  { code: "DATA_MISMATCH", label: "Data organisasi tidak sesuai dokumen" },
  { code: "BUDGET_UNREASONABLE", label: "Anggaran tidak masuk akal / tidak realistis" },
  { code: "CONTENT_VIOLATION", label: "Konten kampanye melanggar aturan" },
  { code: "OTHER", label: "Lainnya (tulis catatan)" },
];

function VerifySubmission() {
  const { id } = useParams();
  const { getPengajuanById, getDokumenById, kampanyeAktif, updateStatus, syncVoterReputation } = useCampaign();

  const pBase = getPengajuanById(id);
  const currentUser = getCurrentUser();
  const isAdmin = currentUser.role === "admin";

  const [dokumen, setDokumen] = useState(pBase?.dokumen || null);
  const [dokumenLoading, setDokumenLoading] = useState(!pBase?.dokumen?.url);
  const [copied, setCopied] = useState(false);

  // Reject modal state
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectCode, setRejectCode] = useState(REJECT_REASONS[0].code);
  const [rejectNote, setRejectNote] = useState("");

  // On-chain state
  const [chainErr, setChainErr] = useState("");
  const [wallet, setWallet] = useState("");
  const [voters, setVoters] = useState([]);
  const [yesCount, setYesCount] = useState("0");
  const [noCount, setNoCount] = useState("0");
  const [result, setResult] = useState("0");
  const [votingEndsAt, setVotingEndsAt] = useState("0");
  const [loadingChain, setLoadingChain] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [isContractAdmin, setIsContractAdmin] = useState(false);

  const votingContractAddr = pBase?.voting_contract || pBase?.votingContract || "";
  const campaignIdOnChain = pBase?.campaign_id ?? pBase?.campaignId ?? null;

  const deployedCampaign = useMemo(() => {
    return (kampanyeAktif || []).find((k) => k.id === id) || null;
  }, [kampanyeAktif, id]);

  const hasVotingContract = Boolean(votingContractAddr && ethers.isAddress(votingContractAddr));

  // Lock UI based on Supabase status (model 1)
  const isRejected = (pBase?.status || "") === "ditolak";
  const isApprovedDb = (pBase?.status || "") === "disetujui";
  const uiLocked = isRejected || isApprovedDb;

  useEffect(() => {
    if (pBase?.dokumen?.url) {
      setDokumen(pBase.dokumen);
      setDokumenLoading(false);
      return;
    }
    if (!id) {
      setDokumenLoading(false);
      return;
    }
    getDokumenById(id).then((backup) => {
      if (backup?.url) setDokumen((prev) => ({ ...(pBase?.dokumen || {}), ...backup }));
      setDokumenLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, pBase?.dokumen]);

  if (!pBase) return <div style={{ minHeight: "100vh", background: "#0a1628" }} />;

  const p = { ...pBase, dokumen };

  function handleCopy(text) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function connectWallet() {
    try {
      setChainErr("");
      const provider = await getProviderChecked();
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      setWallet(addr);

      // Cek apakah wallet ini adalah admin di Smart Contract
      const sm = new ethers.Contract(getStakingManagerAddress(), STAKING_MANAGER_ABI, provider);
      const isSCAdmin = await sm.isAdmin(addr);
      setIsContractAdmin(isSCAdmin);
    } catch (e) {
      setChainErr(e?.message || String(e));
    }
  }

  async function refreshOnChain() {
    if (!hasVotingContract) {
      setChainErr("Voting belum dimulai. Admin harus Start Voting dulu.");
      return null;
    }

    try {
      setLoadingChain(true);
      setChainErr("");

      const provider = await getProviderChecked();
      const signer = await provider.getSigner();
      const currentWallet = await signer.getAddress();
      setWallet(currentWallet);

      // Cek apakah wallet ini adalah admin di Smart Contract
      const sm = new ethers.Contract(getStakingManagerAddress(), STAKING_MANAGER_ABI, provider);
      const isSCAdmin = await sm.isAdmin(currentWallet);
      setIsContractAdmin(isSCAdmin);

      const code = await provider.getCode(votingContractAddr);
      if (!code || code === "0x") {
        throw new Error(
          "Alamat voting_contract tidak ada contract code di chain ini. " +
          "Biasanya karena Hardhat node pernah restart dan Supabase masih menyimpan address lama."
        );
      }


      const vc = new ethers.Contract(votingContractAddr, GOVERNANCE_VOTING_ABI, provider);

      let vs, y, n, r, ends;
      try {
        vs = await vc.getVoters();
        [y, n, r, ends] = await Promise.all([vc.yesCount(), vc.noCount(), vc.result(), vc.votingEndsAt()]);
      } catch (err) {
        console.error("Error calling voting contract:", err);
        if (err.code === "BAD_DATA" || String(err).includes("could not decode result data")) {
          throw new Error(
            "Gagal mengambil data dari voting contract (Empty Result). " +
            "Ini biasanya terjadi jika contract address di database sudah tidak valid di chain ini (Hardhat reset?). " +
            "Silakan hapus/reset data voting_contract di Supabase untuk pengajuan ini."
          );
        }
        throw err;
      }

      setVoters(vs);
      setYesCount(y.toString());
      setNoCount(n.toString());
      setVotingEndsAt(ends.toString());
      const rStr = r.toString();
      setResult(rStr);

      try {
        const info = await vc.voterInfo(currentWallet);
        const choice = Number(info.choice ?? info[2] ?? 0);
        setHasVoted(choice !== 0);
      } catch {
        setHasVoted(false);
      }

      return rStr;
    } catch (e) {
      setChainErr(e?.shortMessage || e?.message || String(e));
      return null;
    } finally {
      setLoadingChain(false);
    }
  }

  async function vote(choice) {
    if (!hasVotingContract) {
      setChainErr("Voting belum dimulai.");
      return;
    }

    try {
      setLoadingChain(true);
      setChainErr("");

      const provider = await getProviderChecked();
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      setWallet(addr);

      const vc = new ethers.Contract(votingContractAddr, GOVERNANCE_VOTING_ABI, signer);
      const tx = await vc.vote(choice);
      await tx.wait();

      setHasVoted(true);
      await refreshOnChain();
    } catch (e) {
      if (e?.message?.toLowerCase().includes("already") || e?.shortMessage?.toLowerCase().includes("already")) {
        setHasVoted(true);
      }
      setChainErr(e?.shortMessage || e?.message || String(e));
    } finally {
      setLoadingChain(false);
    }
  }

  async function startVoting() {
    if (uiLocked) return;

    if (campaignIdOnChain === null || campaignIdOnChain === undefined) {
      setChainErr("campaign_id belum ada di Supabase.");
      return;
    }

    try {
      setLoadingChain(true);
      setChainErr("");

      const provider = await getProviderChecked();
      const signer = await provider.getSigner();
      setWallet(await signer.getAddress());

      const sm = new ethers.Contract(getStakingManagerAddress(), STAKING_MANAGER_ABI, signer);

      const salt = ethers.keccak256(ethers.toUtf8Bytes(`${p.id}:${p.judulKampanye}:${Date.now()}`));
      const tx = await sm.adminStartVoting(String(campaignIdOnChain), salt);
      const receipt = await tx.wait();

      const smAddr = String(sm.target).toLowerCase();
      const topic = ethers.id("CampaignVotingStarted(uint256,address,bytes32)");

      let newVotingAddr = "";
      for (const log of receipt.logs) {
        if (!log?.address) continue;
        if (log.address.toLowerCase() !== smAddr) continue;
        if (!log.topics?.length) continue;
        if (log.topics[0] !== topic) continue;

        const parsed = sm.interface.parseLog(log);
        newVotingAddr = parsed.args.votingContract;
        break;
      }

      if (!newVotingAddr || !ethers.isAddress(newVotingAddr)) {
        throw new Error("Start voting sukses, tapi event CampaignVotingStarted tidak ditemukan.");
      }

      const { error } = await supabase.from("pengajuan_campaign").update({ voting_contract: newVotingAddr, status: "voting" }).eq("id", id);
      if (error) throw error;

      window.location.reload();
    } catch (e) {
      setChainErr(e?.shortMessage || e?.message || String(e));
    } finally {
      setLoadingChain(false);
    }
  }

  async function rejectPrescreenConfirmed() {
    if (uiLocked) return;

    if (campaignIdOnChain === null || campaignIdOnChain === undefined) {
      setChainErr("campaign_id belum ada di Supabase.");
      return;
    }

    const chosen = REJECT_REASONS.find((r) => r.code === rejectCode) || REJECT_REASONS[0];
    const note = (rejectNote || "").trim();

    if (chosen.code === "OTHER" && note.length < 10) {
      setChainErr("Jika memilih 'Lainnya', catatan minimal 10 karakter.");
      return;
    }

    const alasanTolak =
      chosen.code === "OTHER"
        ? `(${chosen.label}) ${note}`
        : note
          ? `(${chosen.label}) ${note}`
          : `(${chosen.label})`;

    try {
      setLoadingChain(true);
      setChainErr("");

      const provider = await getProviderChecked();
      const signer = await provider.getSigner();
      setWallet(await signer.getAddress());

      const sm = new ethers.Contract(getStakingManagerAddress(), STAKING_MANAGER_ABI, signer);

      const tx = await sm.adminRejectPrescreen(String(campaignIdOnChain));
      await tx.wait();

      setRejectOpen(false);
      await updateStatus(id, "ditolak", alasanTolak);

      window.location.reload();
    } catch (e) {
      setChainErr(e?.shortMessage || e?.message || String(e));
    } finally {
      setLoadingChain(false);
    }
  }

  async function finalizeAndPublish() {
    if (uiLocked) return;

    if (campaignIdOnChain === null || campaignIdOnChain === undefined) {
      setChainErr("campaign_id belum ada di Supabase.");
      return;
    }
    if (!hasVotingContract) {
      setChainErr("Voting belum dimulai.");
      return;
    }

    const durationDaysNum = parseInt(String(p.durasiHari ?? "0"), 10);
    if (!Number.isFinite(durationDaysNum) || durationDaysNum <= 0) {
      setChainErr(`Durasi hari invalid dari Supabase: "${String(p.durasiHari)}"`);
      return;
    }

    try {
      setLoadingChain(true);
      setChainErr("");

      const provider = await getProviderChecked();
      const signer = await provider.getSigner();
      const sm = new ethers.Contract(getStakingManagerAddress(), STAKING_MANAGER_ABI, signer);

      // targetEth dari Supabase (targetETH sudah dalam ETH, konversi ke integer)
      const targetEthNum = Math.ceil(parseFloat(p.targetETH ?? "0"));
      if (!targetEthNum || targetEthNum <= 0) {
        setChainErr(`Target ETH invalid dari Supabase: "${String(p.targetETH)}"`);
        setLoadingChain(false);
        return;
      }

      const tx = await sm.finalizeAndStartFundraising(String(campaignIdOnChain), durationDaysNum, targetEthNum);
      const receipt = await tx.wait();

      try {
        await supabase.from("pengajuan_campaign").update({ finalize_tx_hash: tx.hash, finalize_block: receipt.blockNumber }).eq("id", id);

        // --- REPUTATION UPDATE ---
        // Blockchain has finalized the vote and awarded ETH. 
        // Now update Supabase points for validators (+2 on time, -5 missed)
        await syncVoterReputation(id);
      } catch { }

      const rStr = await refreshOnChain();
      if (!rStr) return;

      if (rStr === "2") {
        await updateStatus(id, "ditolak", "Voting validators menolak campaign.");
        window.location.reload();
        return;
      }

      if (rStr === "1") {
        await updateStatus(id, "disetujui");
        window.location.reload();
        return;
      }

      setChainErr("Finalize sudah dipanggil, tapi result masih Pending.");
    } catch (e) {
      console.error(e);
      const errMsg = e?.shortMessage || e?.message || String(e);
      const errData = e?.data || e?.error?.data || e?.info?.error?.data || "";
      if (errMsg.includes("NotAdmin") || String(errData).includes("ed88c68e")) {
        setChainErr("Finalize gagal: Kamu bukan admin.");
      } else {
        setChainErr(errMsg);
      }
    } finally {
      setLoadingChain(false);
    }
  }

  const isVoter = voters.some((v) => wallet && v.toLowerCase() === wallet.toLowerCase());
  const resultText =
    !hasVotingContract ? "Belum Voting" :
      result === "0" ? "Pending" :
        result === "1" ? "Approved" :
          result === "2" ? "Rejected" :
            `Unknown (${result})`;

  const isPublished = Boolean(deployedCampaign?.contractAddress);

  const headerBadge = isPublished ? (
    <div className={"dpa-status-badge dpa-badge-aktif"}>
      <FiCheck size={13} /> Published
    </div>
  ) : isRejected ? (
    <div className={"dpa-status-badge dpa-badge-tolak"}>
      <FiXCircle size={13} /> Ditolak
    </div>
  ) : !hasVotingContract ? (
    <div className={"dpa-status-badge dpa-badge-pending"}>
      <FiClock size={13} /> Menunggu Prescreen Admin
    </div>
  ) : result === "1" ? (
    <div className={"dpa-status-badge dpa-badge-aktif"}>
      <FiCheck size={13} /> Approved On-Chain
    </div>
  ) : result === "2" ? (
    <div className={"dpa-status-badge dpa-badge-tolak"}>
      <FiLock size={13} /> Rejected On-Chain
    </div>
  ) : (
    <div className={"dpa-status-badge dpa-badge-pending"}>
      <FiClock size={13} /> Voting Berlangsung
    </div>
  );

  return (
    <div className="dpa-wrapper">
      <main className="dpa-main">
        <Link to="/admin/pengajuan" className="dpa-back">
          <FiArrowLeft size={16} /> Kembali ke Daftar Pengajuan
        </Link>
        
        <div className="dpa-glowing-line" style={{ marginTop: 0, marginBottom: 20 }} />

        <div className="dpa-header-row" style={{ display: "block" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
            <div>
              <p className="dpa-req-id">{p.id}</p>
              <h1 className="dpa-judul">{p.judulKampanye}</h1>
              <p className="dpa-tanggal">
                <FiClock size={12} /> Masuk pada {p.tanggalMasukFull}
              </p>
            </div>
            {headerBadge}
          </div>
          
          <div className="dpa-glowing-line" style={{ marginTop: 20, marginBottom: 0 }} />
        </div>

        {isRejected && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(239,68,68,0.10)",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "rgba(255,255,255,0.85)",
              fontSize: 13,
            }}
          >
            <strong style={{ color: "#fca5a5" }}>Pengajuan ditolak:</strong> {p.alasanTolak || "(tanpa alasan)"}
          </div>
        )}

        <div className="dpa-content-wrapper">
          <div className="dpa-content">
          {/* KIRI */}
          <div className="dpa-left">
            <div className="dpa-card">
              <div className="dpa-card-header">
                <FiUser size={15} />
                <h3 className="dpa-card-title">Data Organizer</h3>
              </div>
              <div className="dpa-info-grid">
                <div className="dpa-info-item">
                  <span className="dpa-info-label">Nama Organisasi / Individu</span>
                  <span className="dpa-info-value">{p.namaOrganisasi}</span>
                </div>
                <div className="dpa-info-item">
                  <span className="dpa-info-label">Jenis Verifikasi</span>
                  <span className="dpa-info-value">{p.jenisVerifikasi}</span>
                </div>
                <div className="dpa-info-item full">
                  <span className="dpa-info-label">Alamat Wallet</span>
                  <code className="dpa-wallet-value">{p.walletAddress}</code>
                  <a href={"https://etherscan.io/address/" + p.walletAddress} target="_blank" rel="noreferrer" className="dpa-etherscan-link">
                    Cek di Etherscan <FiExternalLink size={11} />
                  </a>
                </div>
                <div className="dpa-info-item full">
                  <span className="dpa-info-label">Alasan Membuka Campaign</span>
                  <p className="dpa-alasan">{p.alasan}</p>
                </div>
              </div>
            </div>

            <TabelAnggaran anggaran={p.anggaran} />

            <div className="dpa-card">
              <div className="dpa-card-header">
                <FiFileText size={15} />
                <h3 className="dpa-card-title">Dokumen Pendukung (KTP/SK)</h3>
                {!isAdmin && (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", background: "rgba(168,85,247,0.2)", borderRadius: 999, color: "#c084fc", marginLeft: 8 }}>ADMIN ONLY</span>
                )}
              </div>
              {!isAdmin ? (
                <div style={{ padding: "16px 0", textAlign: "center" }}>
                  <FiLock size={24} color="rgba(255,255,255,0.2)" style={{ marginBottom: 8 }} />
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Dokumen ini bersifat rahasia dan hanya dapat diakses oleh Admin.</p>
                </div>
              ) : dokumenLoading ? (
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", padding: "8px 0" }}>Memuat dokumen...</p>
              ) : (
                <DokumenPreview dokumen={dokumen} />
              )}
            </div>
          </div>

          {/* KANAN */}
          <div className="dpa-right">
            <div className="dpa-vote-panel" style={{ margin: 0, flex: 1 }}>
              <div className="dpa-vote-header">
                <div className="dpa-vote-shield-icon">
                  <FiShield size={16} color="#ffa757" />
                </div>
                <div style={{ flex: 1 }}>
                  <p className="dpa-vote-title">Voting On-Chain</p>
                  <p className="dpa-vote-sub">Rules: 6 voters. Lolos jika YES ≥ 4.</p>
                </div>
                <div className={`dpa-vote-pill ${result === "1" ? "lolos" : result === "2" ? "gagal" : "berlangsung"}`}>
                  {resultText}
                </div>
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  Connected wallet: <code>{wallet || "-"}</code>{" "}
                  <button className="dpa-btn-preview" style={{ marginLeft: 8 }} onClick={connectWallet}>
                    Connect
                  </button>
                </div>

                {isAdmin && (
                  <>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>
                      campaign_id: <code>{String(campaignIdOnChain ?? "-")}</code>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>
                      voting_contract: <code>{votingContractAddr || "-"}</code>{" "}
                      {votingContractAddr && (
                        <button className="dpa-btn-preview" style={{ marginLeft: 8 }} onClick={() => handleCopy(votingContractAddr)}>
                          {copied ? <FiCheck size={14} /> : <FiCopy size={14} />} Copy
                        </button>
                      )}
                    </div>
                  </>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <button className="dpa-btn-preview" onClick={refreshOnChain} disabled={loadingChain || !hasVotingContract || uiLocked}>
                    <FiRefreshCw size={14} /> Refresh
                  </button>

                  {/* Prescreen actions */}
                  {isAdmin && !hasVotingContract && !uiLocked && (
                    <>
                      <button className="dpa-btn-setujui" onClick={startVoting} disabled={loadingChain}>
                        Approve Prescreen & Start Voting
                      </button>

                      <button
                        className="dpa-btn-preview"
                        onClick={() => setRejectOpen(true)}
                        disabled={loadingChain}
                        style={{
                          background: "rgba(239,68,68,0.12)",
                          borderColor: "rgba(239,68,68,0.35)",
                          color: "rgba(239,68,68,0.9)",
                        }}
                        title="Tolak prescreen dan refund stake+fee ke organizer (on-chain)"
                      >
                        <FiXCircle size={14} /> Reject Prescreen
                      </button>
                    </>
                  )}

                  {/* Vote actions */}
                  {hasVotingContract && result === "0" && !uiLocked && (
                    <>
                      {hasVoted ? (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 14px",
                            borderRadius: 8,
                            background: "rgba(34,197,94,0.08)",
                            border: "1px solid rgba(34,197,94,0.2)",
                            color: "rgba(34,197,94,0.7)",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          <FiCheck size={13} color="#22c55e" />
                          Suara kamu sudah tercatat
                        </div>
                      ) : (
                        <>
                          <button className="dpa-vote-btn yes" onClick={() => vote(1)} disabled={loadingChain || !isVoter}>
                            <FiThumbsUp size={15} /> Vote YES
                          </button>
                          <button className="dpa-vote-btn no" onClick={() => vote(2)} disabled={loadingChain || !isVoter}>
                            <FiThumbsDown size={15} /> Vote NO
                          </button>
                        </>
                      )}
                    </>
                  )}

                  {/* Finalize */}
                  {isAdmin && isContractAdmin && hasVotingContract && !deployedCampaign?.contractAddress && !uiLocked &&
                    (result === "1" || (votingEndsAt !== "0" && Math.floor(Date.now() / 1000) >= parseInt(votingEndsAt))) && (
                      <button className="dpa-btn-setujui" onClick={finalizeAndPublish} disabled={loadingChain}>
                        {result === "1" ? "Finalize & Publish" : "Finalize"}
                      </button>
                    )}
                </div>

                {!isVoter && !hasVoted && voters.length > 0 && result === "0" && hasVotingContract && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      color: "rgba(255,255,255,0.35)",
                      padding: "8px 12px",
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <FiLock size={12} />
                    Wallet kamu bukan validator untuk campaign ini.
                  </div>
                )}

                {hasVotingContract && (
                  <>
                    <div style={{ marginTop: 4, fontSize: 13 }}>
                      YES: <strong style={{ color: "#22c55e" }}>{yesCount}</strong> | NO:{" "}
                      <strong style={{ color: "#f87171" }}>{noCount}</strong>
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <p style={{ marginBottom: 6, opacity: 0.8, fontSize: 13 }}>
                        <FiUsers size={12} /> Voters (6):
                      </p>

                      {isAdmin ? (
                        <ol style={{ marginTop: 0, paddingLeft: 18 }}>
                          {voters.map((v) => (
                            <li key={v} style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.9 }}>
                              {v}{" "}
                              {wallet && v.toLowerCase() === wallet.toLowerCase() ? (
                                <strong style={{ color: "#22c55e" }}>(YOU)</strong>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "10px 14px",
                            borderRadius: 10,
                            background: "rgba(255,255,255,0.03)",
                            border: "1px dashed rgba(255,255,255,0.08)",
                            color: "rgba(255,255,255,0.3)",
                            fontSize: 12,
                          }}
                        >
                          <FiLock size={13} />
                          Identitas validator dirahasiakan demi integritas sistem.
                          {voters.length > 0 && (
                            <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.5)" }}>
                              {voters.length} validator terpilih
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {chainErr && (
                  <pre
                    style={{
                      background: "#111",
                      color: "#fca5a5",
                      padding: 10,
                      borderRadius: 8,
                      whiteSpace: "pre-wrap",
                      fontSize: 11,
                    }}
                  >
                    {chainErr}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* Reject modal */}
        {rejectOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: 16,
            }}
          >
            <div
              style={{
                width: "min(560px, 96vw)",
                background: "#0b1424",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 12,
                padding: 14,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>Reject Prescreen</div>
                <button className="dpa-btn-preview" onClick={() => setRejectOpen(false)} disabled={loadingChain}>
                  Tutup
                </button>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Pilih alasan penolakan. Ini akan tampil ke organizer dan tersimpan di kolom <code>alasan_tolak</code>.
                </div>

                <div>
                  <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.85 }}>Alasan</div>
                  <select
                    value={rejectCode}
                    onChange={(e) => setRejectCode(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 10px",
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "rgba(255,255,255,0.9)",
                    }}
                  >
                    {REJECT_REASONS.map((r) => (
                      <option key={r.code} value={r.code} style={{ color: "#000" }}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.85 }}>Catatan (opsional)</div>
                  <textarea
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    rows={3}
                    placeholder="Contoh: halaman 2 tidak ada tanda tangan, mohon unggah ulang..."
                    style={{
                      width: "100%",
                      padding: "10px 10px",
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "rgba(255,255,255,0.9)",
                      resize: "vertical",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                  <button className="dpa-btn-preview" onClick={() => setRejectOpen(false)} disabled={loadingChain}>
                    Batal
                  </button>
                  <button
                    className="dpa-btn-preview"
                    onClick={rejectPrescreenConfirmed}
                    disabled={loadingChain}
                    style={{
                      background: "rgba(239,68,68,0.12)",
                      borderColor: "rgba(239,68,68,0.35)",
                      color: "rgba(239,68,68,0.9)",
                    }}
                    title="Ini akan mengirim tx on-chain dan mengembalikan stake+fee ke organizer."
                  >
                    <FiXCircle size={14} /> Reject & Refund
                  </button>
                </div>
              </div>

              {chainErr && (
                <pre
                  style={{
                    marginTop: 10,
                    background: "#111",
                    color: "#fca5a5",
                    padding: 10,
                    borderRadius: 8,
                    whiteSpace: "pre-wrap",
                    fontSize: 11,
                  }}
                >
                  {chainErr}
                </pre>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default VerifySubmission;