import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiShield,
  FiExternalLink,
  FiCopy,
  FiCheck,
  FiAlertCircle,
  FiUploadCloud,
  FiFileText,
  FiSend,
  FiCheckCircle,
  FiClock,
  FiLock,
  FiDollarSign,
  FiZap,
} from "react-icons/fi";
import { ethers } from "ethers";
import { HARDHAT_CHAIN_ID } from "../../../web3/config";
import { useCampaign } from "../../../context/CampaignContext";
import { supabase } from "../../../web3/supabaseClient";
import "../../../styles/user/open-campaign/campaign-detail.css";

async function getHardhatSigner() {
  if (!window.ethereum) throw new Error("MetaMask tidak terdeteksi.");
  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== HARDHAT_CHAIN_ID) {
    throw new Error(`Network salah. Pindah ke Hardhat Local (chainId ${HARDHAT_CHAIN_ID}). ChainId kamu sekarang: ${chainId}`);
  }
  return provider.getSigner();
}

function shortAddr(addr = "") {
  if (!addr || typeof addr !== "string") return "-";
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function fmtLocalFromSec(sec) {
  if (!sec || Number(sec) <= 0) return "-";
  try {
    return new Date(Number(sec) * 1000).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });
  } catch {
    return String(sec);
  }
}

function fmtCountdownSec(secLeft) {
  const s = Math.max(0, Math.floor(Number(secLeft || 0)));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (d > 0) return `${d} hari ${h} jam ${m} menit`;
  if (h > 0) return `${h} jam ${m} menit`;
  if (m > 0) return `${m} menit ${ss} detik`;
  return `${ss} detik`;
}

function lifecycleLabel(code) {
  const map = {
    0: "None",
    1: "Fundraising",
    2: "AwaitingProof",
    3: "AwaitingDispute",
    4: "Completed",
    5: "Slashed",
  };
  return map[Number(code)] ?? `Unknown(${code})`;
}

function OrganizerBadge({ ok }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 999,
        border: `1px solid ${ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
        background: ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
        color: ok ? "#86efac" : "#fecaca",
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {ok ? <FiCheckCircle size={14} /> : <FiLock size={14} />}
      {ok ? "Anda Organizer" : "Bukan Organizer"}
    </div>
  );
}

export default function DetailKampanyeOrganizer() {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    getKampanyeById,
    getPengajuanById,
    submitProofForCampaign,
    completeCampaignForCampaign,
    getCampaignOnChainStateByDbId,
    finishFundraisingEarlyOnChain,
    withdrawFromCampaignOnChain,
    applyWithdrawToCampaign,
  } = useCampaign();

  const kContext = useMemo(() => {
    let result = getKampanyeById(id);
    if (!result) {
      const p = getPengajuanById(id);
      if (p) {
        result = {
          id: p.id,
          judul: p.judulKampanye,
          organizer: p.namaOrganisasi,
          walletOrganizer: p.walletAddress,
          targetETH: p.targetETH,
          terkumpulETH: 0,
          donatur: 0,
          status: p.status,
          contractAddress: null,
          votingContract: p.voting_contract,
          dokumen: p.dokumen || [],
          transaksi: [],
          pencairan: [],
          isArchived: false,
          foto: p.fotoCover,
        };
      }
    }
    return result;
  }, [getKampanyeById, getPengajuanById, id]);
  const [fallbackK, setFallbackK] = useState(null);
  const [fallbackLoading, setFallbackLoading] = useState(false);

  useEffect(() => {
    if (!kContext) {
      // Try to fetch from Supabase (in case it's archived)
      setFallbackLoading(true);
      supabase.from("kampanye_aktif").select("*").eq("id", id).maybeSingle()
        .then(({ data }) => {
          if (data) {
            // Map data to match Context format
            setFallbackK({
              id: data.id,
              judul: data.judul,
              organizer: data.nama_organizer,
              walletOrganizer: data.wallet_address,
              targetETH: data.target_eth,
              terkumpulETH: data.terkumpul_eth,
              donatur: data.donatur,
              status: data.status,
              contractAddress: data.campaign_contract_address,
              votingContract: data.voting_contract_address,
              dokumen: data.dokumen || [],
              transaksi: data.transaksi || [],
              pencairan: data.pencairan || [],
              isArchived: data.is_archived
            });
          }
          setFallbackLoading(false);
        })
        .catch(() => setFallbackLoading(false));
    }
  }, [kContext, id]);

  const k = kContext || fallbackK;

  const [copied, setCopied] = useState(false);

  const [proofFile, setProofFile] = useState(null);
  const [proofErr, setProofErr] = useState("");
  const [proofOk, setProofOk] = useState("");
  const [loadingProof, setLoadingProof] = useState(false);

  const [completeErr, setCompleteErr] = useState("");
  const [completeOk, setCompleteOk] = useState("");
  const [loadingComplete, setLoadingComplete] = useState(false);

  // Finish Early state
  const [finishErr, setFinishErr] = useState("");
  const [finishOk, setFinishOk] = useState("");
  const [loadingFinish, setLoadingFinish] = useState(false);

  // Withdraw state
  const [withdrawErr, setWithdrawErr] = useState("");
  const [withdrawOk, setWithdrawOk] = useState("");
  const [loadingWithdraw, setLoadingWithdraw] = useState(false);
  const [contractBalance, setContractBalance] = useState(null); // in ETH string

  const [isOrganizer, setIsOrganizer] = useState(false);
  const [walletActive, setWalletActive] = useState("");

  const [chainErr, setChainErr] = useState("");
  const [chainLoading, setChainLoading] = useState(false);
  const [chain, setChain] = useState(null);

  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const t = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const signer = await getHardhatSigner();
        const addr = await signer.getAddress();
        if (!mounted) return;
        setWalletActive(addr);

        const ok =
          k?.walletOrganizer &&
          addr &&
          String(k.walletOrganizer).toLowerCase() === String(addr).toLowerCase();

        setIsOrganizer(Boolean(ok));
      } catch {
        if (!mounted) return;
        setWalletActive("");
        setIsOrganizer(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [k?.walletOrganizer]);

  async function refreshOnChain() {
    setChainErr("");
    setChainLoading(true);
    try {
      const st = await getCampaignOnChainStateByDbId(id);
      setChain(st);

      // Baca saldo contract jika ada
      if (k?.contractAddress && ethers.isAddress(k.contractAddress)) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const balWei = await provider.getBalance(k.contractAddress);
          setContractBalance(parseFloat(ethers.formatEther(balWei)).toFixed(6));
        } catch { setContractBalance(null); }
      }
    } catch (e) {
      setChain(null);
      setChainErr(e?.message || String(e));
    } finally {
      setChainLoading(false);
    }
  }

  useEffect(() => {
    if (!k) return;
    refreshOnChain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k?.id]);

  if (!k) {
    if (fallbackLoading) return <div style={{color:"white", textAlign:"center", padding:"4rem"}}>Loading...</div>;
    return (
      <div className="dko-wrapper">
        <main className="dko-main">
          <Link to="/daftar-campaign" className="dko-back-link">
            <FiArrowLeft size={14} /> Kembali
          </Link>
          <div style={{ textAlign: "center", marginTop: "4rem", color: "rgba(255,255,255,0.55)" }}>
            <FiAlertCircle size={40} />
            <p style={{ marginTop: "1rem" }}>Kampanye tidak ditemukan atau telah dihapus permanen.</p>
            <p style={{ opacity: 0.7 }}>
              ID: <code>{id}</code>
            </p>
            <button
              onClick={() => navigate("/daftar-campaign")}
              style={{
                marginTop: "1rem",
                background: "none",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff",
                padding: "0.5rem 1.5rem",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              Kembali
            </button>
          </div>
        </main>
      </div>
    );
  }

  function handleCopyContract() {
    if (!k.contractAddress) return;
    navigator.clipboard.writeText(k.contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function onPickFile(e) {
    setProofErr("");
    setProofOk("");
    const f = e.target.files?.[0] || null;
    if (!f) {
      setProofFile(null);
      return;
    }

    const isPdf =
      String(f.type).toLowerCase() === "application/pdf" ||
      String(f.name || "").toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setProofFile(null);
      setProofErr("File harus PDF.");
      return;
    }

    const maxMb = 10;
    if (f.size > maxMb * 1024 * 1024) {
      setProofFile(null);
      setProofErr(`Ukuran file terlalu besar. Maks ${maxMb}MB.`);
      return;
    }

    setProofFile(f);
  }

  // ─── Derived conditions ───
  const proofAlreadySubmitted = Boolean(
    chain?.proofHash && 
    chain.proofHash !== ethers.ZeroHash && 
    chain.proofHash !== "0x0000000000000000000000000000000000000000000000000000000000000000"
  ) || Boolean(chain?.proofSubmittedAt > 0);
  
  const fundraisingEndAt  = Number(chain?.fundraisingEndAt  || 0);
  const proofDeadlineAt   = Number(chain?.proofDeadlineAt   || 0);
  const disputeEndsAt     = Number(chain?.disputeEndsAt     || 0);
  
  // TargetWei didapat dari Supabase (k.targetETH), bukan dari on-chain karena struct Campaign tidak menyimpannya
  const targetWei = k?.targetETH ? ethers.parseEther(k.targetETH.toString()) : 0n;

  const fundraisingEnded   = fundraisingEndAt > 0 && nowSec >= fundraisingEndAt;
  const withinProofWindow  = fundraisingEndAt > 0 && proofDeadlineAt > 0 && nowSec >= fundraisingEndAt && nowSec <= proofDeadlineAt;
  const disputeEnded       = disputeEndsAt > 0 && nowSec >= disputeEndsAt;

  // Lifecycle numeric: 1 = Fundraising
  const isLifecycleFundraising = Number(chain?.lifecycle) === 1;
  const contractBalanceWei     = contractBalance !== null ? ethers.parseEther(contractBalance) : 0n;
  const targetMet              = targetWei > 0n && contractBalanceWei >= targetWei;

  // Bisa finish early jika: organizer + fundraising masih jalan + target terpenuhi
  const canFinishEarly =
    Boolean(chain) &&
    isOrganizer &&
    isLifecycleFundraising &&
    !fundraisingEnded &&
    targetMet;

  // Bisa withdraw jika: organizer + fundraising sudah selesai (ended atau lifecycle > 1)
  const canWithdraw =
    Boolean(chain) &&
    isOrganizer &&
    Boolean(k.contractAddress) &&
    contractBalance !== null &&
    parseFloat(contractBalance) > 0 &&
    (fundraisingEnded || Number(chain?.lifecycle) > 1);

  const canSubmitProof =
    Boolean(chain) &&
    isOrganizer &&
    Boolean(k.contractAddress) &&
    withinProofWindow &&
    !proofAlreadySubmitted &&
    (k.pencairan || []).length > 0; // Hanya bisa submit proof SETELAH withdraw

  const canComplete =
    Boolean(chain) &&
    isOrganizer &&
    Boolean(k.contractAddress) &&
    Number(chain.lifecycle) === 3 &&
    proofAlreadySubmitted &&
    disputeEnded;

  async function handleSubmitProof() {
    setProofErr("");
    setProofOk("");
    setCompleteErr("");
    setCompleteOk("");

    if (!isOrganizer) return setProofErr("Wallet aktif bukan organizer.");
    if (!k.contractAddress) return setProofErr("Contract address belum tersedia.");
    if (!proofFile) return setProofErr("Pilih file proof (PDF) dulu.");
    if (!withinProofWindow) return setProofErr("Belum dalam window submit proof / sudah lewat deadline.");
    if (proofAlreadySubmitted) return setProofErr("Proof sudah pernah disubmit.");
    if ((k.pencairan || []).length === 0) return setProofErr("Harap withdraw dana dulu sebelum submit proof.");

    try {
      setLoadingProof(true);
      const res = await submitProofForCampaign(id, proofFile);
      setProofOk(`Proof berhasil disubmit! Tx: ${res.txHash}`);
      setProofFile(null);
      await refreshOnChain();
    } catch (e) {
      setProofErr(e?.message || String(e));
    } finally {
      setLoadingProof(false);
    }
  }

  async function handleCompleteCampaign() {
    setCompleteErr(""); setCompleteOk("");
    setProofErr(""); setProofOk("");
    if (!isOrganizer) return setCompleteErr("Wallet aktif bukan organizer.");
    if (!k.contractAddress) return setCompleteErr("Contract address belum tersedia.");
    if (!proofAlreadySubmitted) return setCompleteErr("Belum ada proof di on-chain.");
    if (!disputeEnded) return setCompleteErr("Dispute period belum selesai.");
    try {
      setLoadingComplete(true);
      const res = await completeCampaignForCampaign(id);
      setCompleteOk(`Complete berhasil! Tx: ${res.txHash}`);
      await refreshOnChain();
    } catch (e) {
      setCompleteErr(e?.message || String(e));
    } finally { setLoadingComplete(false); }
  }

  async function handleFinishEarly() {
    setFinishErr(""); setFinishOk("");
    if (!isOrganizer) return setFinishErr("Wallet aktif bukan organizer.");
    if (!targetMet) return setFinishErr("Target donasi belum tercapai. Selesaikan fundraising lebih awal hanya bisa jika target terpenuhi.");
    try {
      setLoadingFinish(true);
      const res = await finishFundraisingEarlyOnChain(id);
      setFinishOk(`Fundraising diselesaikan! Proof deadline dimulai 7 hari dari sekarang. Tx: ${res.txHash}`);
      await refreshOnChain();
    } catch (e) {
      setFinishErr(e?.shortMessage || e?.message || String(e));
    } finally { setLoadingFinish(false); }
  }

  async function handleWithdraw() {
    setWithdrawErr(""); setWithdrawOk("");
    if (!isOrganizer) return setWithdrawErr("Wallet aktif bukan organizer.");
    if (!k.contractAddress) return setWithdrawErr("Contract address belum tersedia.");
    try {
      setLoadingWithdraw(true);
      
      // Simpan balance SEBELUM withdraw (karena setelah withdraw akan jadi 0)
      const amountEth = contractBalance || "0";
      
      const res = await withdrawFromCampaignOnChain(k.contractAddress);
      
      // Simpan riwayat pencairan ke database
      await applyWithdrawToCampaign(id, {
        to: walletActive,
        amountEth: amountEth,
        txHash: res.txHash,
        waktu: new Date().toISOString()
      });
      
      setWithdrawOk(`Withdraw berhasil! Dana terkirim ke wallet kamu. Tx: ${res.txHash}`);
      await refreshOnChain();
    } catch (e) {
      setWithdrawErr(e?.shortMessage || e?.message || String(e));
    } finally { setLoadingWithdraw(false); }
  }

  // Sync status withdraw dari on-chain ke database (untuk campaign yang sudah withdraw tapi belum tercatat)
  async function handleSyncWithdraw() {
    setWithdrawErr(""); setWithdrawOk("");
    if (!isOrganizer) return setWithdrawErr("Wallet aktif bukan organizer.");
    if (!k.contractAddress) return setWithdrawErr("Contract address belum tersedia.");
    
    // Cek apakah sudah ada record pencairan
    if ((k.pencairan || []).length > 0) {
      return setWithdrawOk("Status withdraw sudah tercatat.");
    }
    
    // Cek apakah saldo contract sudah 0 (berarti sudah withdraw)
    if (contractBalance !== null && parseFloat(contractBalance) > 0) {
      return setWithdrawErr("Saldo masih ada. Silakan klik Withdraw untuk menarik dana.");
    }
    
    try {
      setLoadingWithdraw(true);
      
      // Ambil terkumpul ETH dari data campaign
      const amountEth = k.terkumpulETH ? String(k.terkumpulETH) : "0";
      
      // Simpan riwayat pencairan ke database
      await applyWithdrawToCampaign(id, {
        to: walletActive,
        amountEth: amountEth,
        txHash: "sync_manual_" + Date.now(), // TX placeholder
        waktu: new Date().toISOString()
      });
      
      setWithdrawOk(`Status withdraw berhasil disync! Sekarang bisa submit proof.`);
      await refreshOnChain();
    } catch (e) {
      setWithdrawErr(e?.message || String(e));
    } finally { setLoadingWithdraw(false); }
  }

  return (
    <div className="dko-wrapper">
      <main className="dko-main">
        <Link to="/daftar-campaign" className="dko-back-link">
          <FiArrowLeft size={14} /> Kembali
        </Link>

        <div className="dko-glowing-line" style={{ marginTop: 0, marginBottom: 20 }} />

        <div className="dko-header-row" style={{ display: "block" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
            <div>
              <h1 className="dko-judul">{k.judul}</h1>
              <p className="dko-sub">Kelola campaign & submit proof (on-chain)</p>
            </div>
            <div className="dko-status-badge dko-badge-aktif">
              <FiCheckCircle size={13} /> Aktif
            </div>
          </div>

          <div className="dko-glowing-line" />

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <OrganizerBadge ok={isOrganizer} />
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.75)",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              <FiClock size={14} />
              Wallet aktif: <code style={{ fontWeight: 800 }}>{walletActive ? shortAddr(walletActive) : "Not Connected"}</code>
            </div>

            {chain && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(255,255,255,0.75)",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                <FiShield size={14} />
                Lifecycle: <code style={{ fontWeight: 900 }}>{lifecycleLabel(chain.lifecycle)}</code>
              </div>
            )}
          </div>
        </div>

        <div className="dko-content-wrapper">
          <div className="dko-content">
          <div className="dko-left">
            <div className="dko-foto-wrapper" style={{ margin: 0 }}>
              <img src={k.foto} alt={k.judul} className="dko-foto" />
            </div>

            <div className="dko-contract-card" style={{ margin: 0 }}>
              <p className="dko-contract-label">
                <FiShield size={12} /> Smart Contract
              </p>

              {!k.contractAddress ? (
                <p className="dko-contract-pending">Belum di-deploy / belum tersinkron.</p>
              ) : (
                <>
                  <div className="dko-contract-row">
                    <span className="dko-contract-address">{k.contractAddress}</span>
                    <button className="dko-copy-btn" onClick={handleCopyContract}>
                      {copied ? <FiCheck size={13} /> : <FiCopy size={13} />}
                    </button>
                  </div>

                  <a
                    href={`https://etherscan.io/address/${k.contractAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    className="dko-etherscan-link"
                  >
                    Lihat di Etherscan <FiExternalLink size={12} />
                  </a>
                </>
              )}
            </div>

            <div className="dko-card" style={{ margin: 0 }}>
              <h3 className="dko-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FiClock size={15} /> Timeline On-chain
              </h3>

              <div style={{ marginTop: 10 }}>
                <button
                  onClick={refreshOnChain}
                  disabled={chainLoading}
                  style={{
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(255,255,255,0.05)",
                    color: "#fff",
                    borderRadius: 10,
                    padding: "8px 12px",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {chainLoading ? "Memuat..." : "Refresh On-chain"}
                </button>

                {chainErr && (
                  <p style={{ marginTop: 10, fontSize: 12, color: "#fecaca" }}>
                    <FiAlertCircle size={13} /> {chainErr}
                  </p>
                )}

                {chain && (
                  <div style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>
                    <div>
                      CampaignId (on-chain): <code>{chain.campaignIdOnChain}</code>
                    </div>
                    <div>
                      Fundraising end: <strong>{fmtLocalFromSec(fundraisingEndAt)}</strong>
                      {fundraisingEndAt > 0 && !fundraisingEnded && (
                        <span style={{ marginLeft: 8, color: "#ffa757", fontWeight: 900 }}>
                          (sisa {fmtCountdownSec(fundraisingEndAt - nowSec)})
                        </span>
                      )}
                      {fundraisingEnded && (
                        <span style={{ marginLeft: 8, color: "#86efac", fontWeight: 900 }}>(sudah selesai)</span>
                      )}
                    </div>
                    <div>
                      Proof deadline: <strong>{fmtLocalFromSec(proofDeadlineAt)}</strong>
                      {proofDeadlineAt > 0 && nowSec > proofDeadlineAt && (
                        <span style={{ marginLeft: 8, color: "#fecaca", fontWeight: 900 }}>(deadline lewat)</span>
                      )}
                    </div>
                    <div>
                      Dispute ends: <strong>{fmtLocalFromSec(disputeEndsAt)}</strong>
                      {disputeEndsAt > 0 && !disputeEnded && (
                        <span style={{ marginLeft: 8, color: "#ffa757", fontWeight: 900 }}>
                          (sisa {fmtCountdownSec(disputeEndsAt - nowSec)})
                        </span>
                      )}
                      {disputeEnded && disputeEndsAt > 0 && (
                        <span style={{ marginLeft: 8, color: "#86efac", fontWeight: 900 }}>(sudah selesai)</span>
                      )}
                    </div>

                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                      ProofHash (on-chain):{" "}
                      <code>{proofAlreadySubmitted ? String(chain.proofHash).slice(0, 18) + "..." : "No Proof"}</code>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="dko-card" style={{ margin: 0, flex: 1 }}>
              <h3 className="dko-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FiFileText size={15} /> Status Proof
              </h3>

              {proofAlreadySubmitted ? (
                <div
                  style={{
                    marginTop: 10,
                    padding: 14,
                    borderRadius: 14,
                    border: "1px solid rgba(34,197,94,0.25)",
                    background: "rgba(34,197,94,0.06)",
                    color: "rgba(255,255,255,0.8)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <FiCheckCircle size={18} color="#22c55e" />
                    <strong>Proof sudah disubmit (on-chain)</strong>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.6 }}>
                    Proof URL (database):{" "}
                    {k.proofUrl ? (
                      <a href={k.proofUrl} target="_blank" rel="noreferrer" className="dko-etherscan-link">
                        Buka file <FiExternalLink size={11} />
                      </a>
                    ) : (
                      "No File"
                    )}
                  </div>
                </div>
              ) : (
                <p style={{ marginTop: 10, fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
                  Proof belum disubmit. Tombol submit terbuka setelah fundraising selesai dan sebelum proof deadline.
                </p>
              )}
            </div>
          </div>

          <div className="dko-right">
            <div className="dko-stats-card" style={{ paddingTop: 18, margin: 0 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>
                <FiUploadCloud size={16} style={{ marginRight: 8, verticalAlign: "-2px" }} />
                Submit Proof (PDF)
              </h3>
              <p style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
                Proof hanya bisa disubmit <b>setelah fundraising selesai</b> dan <b>sebelum proof deadline</b>.
                {(k.pencairan || []).length === 0 && <span style={{ color: "#fca5a5" }}> Harap withdraw dana dulu sebelum submit proof.</span>}
              </p>

              <div style={{ marginTop: 14 }}>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={onPickFile}
                  disabled={loadingProof || !isOrganizer || !chain}
                  style={{ width: "100%" }}
                />

                {proofFile && (
                  <p style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                    File dipilih: <strong>{proofFile.name}</strong> ({Math.round(proofFile.size / 1024)} KB)
                  </p>
                )}

                {!withinProofWindow && chain && !proofAlreadySubmitted && (
                  <p style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                    <FiLock size={13} /> Submit proof terkunci (belum masuk window / sudah lewat deadline).
                  </p>
                )}

                {proofErr && (
                  <p style={{ marginTop: 10, fontSize: 12, color: "#fecaca" }}>
                    <FiAlertCircle size={13} /> {proofErr}
                  </p>
                )}
                {proofOk && (
                  <p style={{ marginTop: 10, fontSize: 12, color: "#86efac" }}>
                    <FiCheckCircle size={13} /> {proofOk}
                  </p>
                )}

                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    className="dko-btn-cair"
                    onClick={handleSubmitProof}
                    disabled={loadingProof || !proofFile || !canSubmitProof}
                    style={{ minWidth: 220, opacity: canSubmitProof ? 1 : 0.6 }}
                    title={!canSubmitProof ? "Belum memenuhi syarat submit proof" : ""}
                  >
                    {loadingProof ? "Memproses..." : (
                      <>
                        <FiSend size={15} /> Submit Proof
                      </>
                    )}
                  </button>

                  {!isOrganizer && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", alignSelf: "center" }}>
                      <FiLock size={12} /> Switch wallet ke organizer untuk submit.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="dko-ledger-card" style={{ padding: 18, margin: 0 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>
                Complete Campaign (Refund Stake)
              </h3>
              <p style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
                Tombol complete terbuka setelah <b>dispute period selesai</b> dan lifecycle berada di <code>AwaitingDispute</code>.
              </p>

              {!canComplete && chain && (
                <p style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                  <FiLock size={13} /> Complete terkunci (belum memenuhi syarat).
                </p>
              )}

              {completeErr && (
                <p style={{ marginTop: 10, fontSize: 12, color: "#fecaca" }}>
                  <FiAlertCircle size={13} /> {completeErr}
                </p>
              )}
              {completeOk && (
                <p style={{ marginTop: 10, fontSize: 12, color: "#86efac" }}>
                  <FiCheckCircle size={13} /> {completeOk}
                </p>
              )}

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  className="dko-btn-cair"
                  onClick={handleCompleteCampaign}
                  disabled={loadingComplete || !canComplete}
                  style={{ opacity: canComplete ? 1 : 0.6 }}
                >
                  {loadingComplete ? "Memproses..." : "Complete Campaign"}
                </button>

                {k.completeTxHash && (
                  <a
                    href={`https://etherscan.io/tx/${k.completeTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="dko-etherscan-link"
                    style={{ alignSelf: "center" }}
                  >
                    Lihat tx complete <FiExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>
            {/* ─── Finish Fundraising Early ─── */}
            {isOrganizer && (
              <div className="dko-ledger-card" style={{ padding: 18, border: "1px solid rgba(251,191,36,0.25)", background: "rgba(251,191,36,0.04)", margin: 0 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, display: "flex", alignItems: "center", gap: 8 }}>
                  <FiZap size={16} color="#fbbf24" /> Selesaikan Fundraising Lebih Awal
                </h3>
                <p style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
                  Hanya bisa dilakukan jika <b>target donasi sudah terpenuhi</b>.
                  Setelah diselesaikan, proof deadline dimulai (7 hari dari sekarang).
                </p>

                {contractBalance !== null && (
                  <div style={{ marginTop: 10, fontSize: 13 }}>
                    <span style={{ color: "rgba(255,255,255,0.5)" }}>Terkumpul: </span>
                    <strong style={{ color: "#fbbf24" }}>{contractBalance} ETH</strong>
                    {targetMet && (
                      <span style={{ marginLeft: 8, color: "#86efac", fontSize: 12, fontWeight: 700 }}>✓ Target terpenuhi</span>
                    )}
                    {!targetMet && (
                      <span style={{ marginLeft: 8, color: "#fca5a5", fontSize: 12 }}>Target belum tercapai</span>
                    )}
                  </div>
                )}

                {finishErr && (
                  <p style={{ marginTop: 10, fontSize: 12, color: "#fecaca" }}>
                    <FiAlertCircle size={13} /> {finishErr}
                  </p>
                )}
                {finishOk && (
                  <p style={{ marginTop: 10, fontSize: 12, color: "#86efac" }}>
                    <FiCheckCircle size={13} /> {finishOk}
                  </p>
                )}

                <button
                  className="dko-btn-cair"
                  style={{
                    marginTop: 14,
                    opacity: loadingFinish || !canFinishEarly ? 0.6 : 1,
                  }}
                  onClick={handleFinishEarly}
                  disabled={!canFinishEarly || loadingFinish}
                >
                  <FiZap size={14} />
                  {loadingFinish ? "Memproses..." : (!isLifecycleFundraising || fundraisingEnded ? "Sudah diselesaikan" : "Selesaikan Fundraising Sekarang")}
                </button>
              </div>
            )}

            {/* ─── Withdraw Dana ─── */}
            {isOrganizer && (
              <div className="dko-ledger-card" style={{ padding: 18, border: "1px solid rgba(34,197,94,0.25)", background: "rgba(34,197,94,0.03)", margin: 0 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, display: "flex", alignItems: "center", gap: 8 }}>
                  <FiDollarSign size={16} color="#22c55e" /> Withdraw Dana Campaign
                </h3>
                <p style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
                  Tarik semua saldo dari smart contract ke wallet kamu.
                  Tersedia setelah fundraising selesai (target terpenuhi <i>atau</i> waktu habis).
                </p>

                <div style={{ marginTop: 10, fontSize: 13 }}>
                  <span style={{ color: "rgba(255,255,255,0.5)" }}>Saldo contract saat ini: </span>
                  <strong style={{ color: contractBalance && parseFloat(contractBalance) > 0 ? "#22c55e" : "rgba(255,255,255,0.4)" }}>
                    {contractBalance !== null ? `${contractBalance} ETH` : "Membaca..."}
                  </strong>
                </div>

                {!canWithdraw && chain && (
                  <p style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                    <FiLock size={12} /> Withdraw terkunci — fundraising belum selesai atau saldo kosong.
                  </p>
                )}

                {withdrawErr && (
                  <p style={{ marginTop: 10, fontSize: 12, color: "#fecaca" }}>
                    <FiAlertCircle size={13} /> {withdrawErr}
                  </p>
                )}
                {withdrawOk && (
                  <p style={{ marginTop: 10, fontSize: 12, color: "#86efac" }}>
                    <FiCheckCircle size={13} /> {withdrawOk}
                  </p>
                )}

                <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    className="dko-btn-cair"
                    style={{
                      opacity: loadingWithdraw ? 0.6 : 1,
                    }}
                    onClick={handleWithdraw}
                    disabled={!canWithdraw || loadingWithdraw}
                  >
                    <FiDollarSign size={14} />
                    {loadingWithdraw ? "Memproses..." : `Withdraw ${contractBalance !== null ? contractBalance + " ETH" : ""}`}
                  </button>

                  {/* Tombol Sync: muncul jika saldo contract sudah 0 tapi belum ada record pencairan */}
                  {isOrganizer &&
                    contractBalance !== null &&
                    parseFloat(contractBalance) === 0 &&
                    (k.pencairan || []).length === 0 && (
                    <button
                      className="dko-btn-cair"
                      style={{
                        opacity: loadingWithdraw ? 0.6 : 1,
                      }}
                      onClick={handleSyncWithdraw}
                      disabled={loadingWithdraw}
                      title="Sudah withdraw tapi belum tercatat? Klik ini untuk sync status ke database."
                    >
                      <FiCheckCircle size={14} />
                      {loadingWithdraw ? "Menyync..." : "Sync Status Withdraw"}
                    </button>
                  )}
                </div>
              </div>
            )}

            <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
              Tips: Jika countdown aneh, pastikan node Hardhat tidak reset.
            </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}