import { createContext, useContext, useState, useEffect } from "react";
import { ethers } from "ethers";
import { HARDHAT_CHAIN_ID } from "../web3/config";
import { supabase } from "../web3/supabaseClient";

function getCurrentUser() {
  try {
    return JSON.parse(sessionStorage.getItem("currentUser")) || {};
  } catch {
    return {};
  }
}

export const DUMMY_ACCOUNTS = [
  {
    id: "USR-001",
    nama: "Joko Cahyono",
    email: "joko@email.com",
    password: "password123",
    wallet: "0xAb3f9C2d1E4f5B6a7c8D9e0F1a2B3c4D5e6F7a8B",
    role: "user",
  },
  {
    id: "USR-002",
    nama: "Gojosituru",
    email: "gojosituru@email.com",
    password: "password123",
    wallet: "0x9Fc2e1B3d4A5f6C7e8D9a0B1c2D3e4F5a6B7c8D9",
    role: "user",
  },
  {
    id: "ADM-001",
    nama: "Admin DonasiChain",
    email: "admin@donasichain.id",
    password: "admin2026",
    wallet: "0x0000000000000000000000000000000000000000",
    role: "admin",
  },
];

function mapPengajuan(p) {
  return {
    id: p.id,
    judulKampanye: p.judul_kampanye,
    kategori: p.kategori || "Lainnya",
    namaOrganisasi: p.nama_org,
    jenisVerifikasi: p.jenis_verif,
    walletAddress: p.wallet_address,
    alasan: p.alasan,
    deskripsiKampanye: p.deskripsi,
    targetETH: String(p.target_eth ?? ""),
    durasiHari: String(p.durasi_hari ?? ""),
    fotoCover: p.foto_cover || "https://images.unsplash.com/photo-1593113598332-cd288d649433?w=600&q=80",
    dokumen: {
      url: p.dokumen_url || "",
      nama: p.dokumen_nama || "N/A",
      tipe: p.dokumen_tipe || "",
    },
    anggaran: p.anggaran || [],
    votes: p.votes || { yes: 0, no: 0, voters: [], voterChoices: {} },
    status: p.status || "pending",
    alasanTolak: p.alasan_tolak || "",
    campaign_id: p.campaign_id,
    voting_contract: p.voting_contract,
    submit_tx_hash: p.submit_tx_hash,
    stake_bond_wei: p.stake_bond_wei,
    voting_fee_wei: p.voting_fee_wei,
    finalize_tx_hash: p.finalize_tx_hash,
    finalize_block: p.finalize_block,
    tanggalMasuk: p.tanggal_masuk
      ? new Date(p.tanggal_masuk).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
      : "",
    tanggalMasukFull: p.tanggal_masuk
      ? new Date(p.tanggal_masuk).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" }) + " WIB"
      : "",
    rawTanggalMasuk: p.tanggal_masuk || "",
  };
}

// Helper: Calculate campaign lifecycle status
function getCampaignLifecycleStatus(k) {
  const durasiAwal = Number(k.sisa_hari || 0); // di DB ini menyimpan durasi awal
  const createdAtTime = k.created_at ? new Date(k.created_at).getTime() : Date.now();
  const nowTime = Date.now();

  // Hitung sisa hari dinamis
  const endTime = createdAtTime + (durasiAwal * 24 * 60 * 60 * 1000);
  const sisaHari = Math.max(0, Math.ceil((endTime - nowTime) / (24 * 60 * 60 * 1000)));

  const completedAt = k.completed_at ? new Date(k.completed_at).getTime() : null;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  // Fundraising dianggap berakhir jika:
  // 1. Sisa hari habis (durasi terlewat)
  // 2. Ada completed_at di DB
  // 3. Organizer sudah klik "selesaikan fundraising" (status_lifecycle maju ke fase berikutnya)
  // 4. Sudah ada pencairan dana (berarti fundraising sudah pasti selesai)
  const hasWithdraw = k.pencairan && Array.isArray(k.pencairan) && k.pencairan.length > 0;
  const earlyFinished = ["awaiting_proof", "proof_submitted", "completed", "frozen"].includes(
    k.status_lifecycle || ""
  ) || hasWithdraw;

  const isRaisingFinished = sisaHari <= 0 || completedAt !== null || earlyFinished;

  // Campaign completed jika ada completed_at atau status_lifecycle === "completed"
  const isCompleted = completedAt !== null || k.status_lifecycle === "completed";

  // Campaign should be archived jika:
  // 1. is_archived sudah di-set true di DB, ATAU
  // 2. isCompleted dan sudah lebih dari 30 hari
  const isArchived = k.is_archived === true;
  const shouldArchive = !isArchived && isCompleted && completedAt !== null && (nowTime - completedAt) > thirtyDaysMs;

  return { sisaHari, isRaisingFinished, isCompleted, shouldArchive, isArchived };
}

function mapKampanye(k) {
  const { sisaHari, isRaisingFinished, isCompleted, isArchived, shouldArchive } = getCampaignLifecycleStatus(k);

  // Tentukan status display
  let displayStatus = "aktif";
  if (isArchived) displayStatus = "arsip";
  else if (isCompleted) displayStatus = "selesai";
  else if (k.status_lifecycle === "frozen") displayStatus = "ditutup";
  else if (isRaisingFinished) displayStatus = "selesai";

  return {
    id: k.id,
    judul: k.judul,
    kategori: k.kategori || "Lainnya",
    foto: k.foto || "https://images.unsplash.com/photo-1593113598332-cd288d649433?w=600&q=80",
    targetETH: Number(k.target_eth || 0),
    terkumpulETH: Number(k.terkumpul_eth || 0),
    donatur: Number(k.donatur || 0),
    sisaHari: sisaHari,
    contractAddress: k.contract_address || null,
    walletOrganizer: k.wallet_address || "",
    status: displayStatus,
    transaksi: k.transaksi || [],
    pencairan: k.pencairan || [],
    anggaran: k.anggaran || [],
    deskripsi: k.deskripsi || "",
    organizer: k.organizer || "",
    deployTxHash: k.deploy_tx_hash || null,
    deployBlock: k.deploy_block || null,
    tanggalAktif: k.created_at
      ? new Date(k.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
      : "",
    // Lifecycle fields
    completedAt: k.completed_at || null,
    isCompleted,
    isRaisingFinished,
    isArchived,
    proofUrl: k.proof_url || "",
    proofHash: k.proof_hash || "",
    proofSubmittedAt: k.proof_submitted_at || null,
    completeTxHash: k.complete_tx_hash || "",
    stakeRefundTxHash: k.stake_refund_tx_hash || "",
    statusLifecycle: k.status_lifecycle || "",
    canDonate: !isRaisingFinished && !isCompleted && !isArchived && !shouldArchive && k.status_lifecycle !== "frozen",
    canReport: !isArchived && !shouldArchive && k.status_lifecycle !== "frozen",
    
    // NEW FIELDS for timeout tracking
    fundraisingEndAt: k.fundraising_end_at || null,
    proofDeadlineAt: k.proof_deadline_at || null,
  };
}

async function getProviderChecked() {
  if (!window.ethereum) throw new Error("MetaMask tidak terdeteksi. Install ekstensi MetaMask dulu.");
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

function getStakingManagerAddress() {
  const addr = process.env.REACT_APP_STAKINGMANAGER_ADDRESS;
  if (!addr) throw new Error("Missing REACT_APP_STAKINGMANAGER_ADDRESS in frontend .env");
  return addr;
}

const STAKING_MANAGER_READ_ABI = [
  "function campaignDonationOf(uint256) view returns (address)",
  // getter otomatis untuk public mapping(uint256 => Campaign) campaigns (16 fields)
  "function campaigns(uint256) view returns (address organizer,uint256 stakeBond,uint256 votingFee,uint256 createdAt,uint8 status,address votingContract,bool bondRefunded,bool feeDistributed,uint8 lifecycle,uint256 fundraisingEndAt,uint256 proofDeadlineAt,uint256 disputeEndsAt,uint256 targetWei,bytes32 proofHash,uint256 proofSubmittedAt,uint256 frozenDonationAmount)",
];

const STAKING_MANAGER_PROOF_ABI = [
  "function submitProof(uint256 campaignId, bytes32 proofHash)",
  "function completeCampaign(uint256 campaignId)",
];

const STAKING_MANAGER_REPORT_ABI = [
  "function submitReport(uint256 campaignId) payable returns (uint256 reportId)",
  "function acceptReport(uint256 reportId)",
  "function rejectReport(uint256 reportId)",
  "function finishFundraisingEarly(uint256 campaignId)",
  "function REPORT_STAKE_BOND() view returns (uint256)",
  "function CAMPAIGN_STAKE_BOND() view returns (uint256)",
  "function reports(uint256) view returns (address reporter,uint256 stakeBond,uint256 createdAt,uint8 status,uint256 campaignId,bool bondRefunded)",
  "event ReportSubmitted(uint256 indexed reportId,address indexed reporter,uint256 indexed campaignId,uint256 stakeBond)",
  "event ReportAccepted(uint256 indexed reportId,uint256 toReporter,uint256 toAdmin,uint256 toTreasury,uint256 donationsDrained)",
  "event ReportRejected(uint256 indexed reportId,uint256 toOrganizer,uint256 toAdmin)",
  "event FundraisingFinishedEarly(uint256 indexed campaignId,uint256 finishedAt,uint256 proofDeadlineAt)",
];

const MULTI_ADMIN_ABI = [
  "function isAdmin(address) view returns (bool)",
  "function adminList(uint256) view returns (address)",
  "function getAdminList() view returns (address[])",
  "function primaryAdmin() view returns (address)",
  "function addAdmin(address _newAdmin) external",
  "function removeAdmin(address _adminToRemove) external",
  "function setPrimaryAdmin(address _primary) external",
  "function setBanStatus(address _organizer, bool _status) external",
  "function claimPrescreenTimeout(uint256 campaignId) external",
  "function PRESCREEN_TIMEOUT() view returns (uint256)",
  "event AdminAdded(address indexed newAdmin, address indexed addedBy)",
  "event AdminRemoved(address indexed removedAdmin, address indexed removedBy)",
  "event PrescreenTimeoutClaimed(uint256 indexed campaignId, address indexed claimedBy)",
];

const VALIDATOR_SET_ABI = [
  "function setTop10(address[] calldata _top10) external",
  "function getTop10() external view returns (address[] memory)",
  "function admin() external view returns (address)",
  "function isTop10(address) external view returns (bool)",
];

const GOV_VOTING_ABI = [
  "function getVoters() external view returns (address[] memory)",
  "function voterInfo(address) external view returns (uint64 assignedAt, bool replaced, uint8 choice)",
  "function votingEndsAt() external view returns (uint256)",
  "function isVotingOpen() external view returns (bool)",
  "function SHIFT_DEADLINE() external view returns (uint256)",
];

const STAKING_MANAGER_REPLACE_ABI = [
  "function replaceMissingVoter(uint256 campaignId, address oldVoter, address newVoter) external",
  "function campaigns(uint256) view returns (address organizer,uint256 stakeBond,uint256 votingFee,uint256 createdAt,uint8 status,address votingContract,bool bondRefunded,bool feeDistributed,uint8 lifecycle,uint256 fundraisingEndAt,uint256 proofDeadlineAt,uint256 disputeEndsAt,uint256 targetWei,bytes32 proofHash,uint256 proofSubmittedAt,uint256 frozenDonationAmount)",
];

function getValidatorSetAddress() {
  const addr = process.env.REACT_APP_VALIDATORSET_ADDRESS;
  if (!addr) throw new Error("Missing REACT_APP_VALIDATORSET_ADDRESS in frontend .env");
  return addr;
}

function getNow() {
  const now = new Date();
  const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][now.getMonth()];
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return {
    short: `${now.getDate()} ${bulan} ${now.getFullYear()}`,
    full: `${now.getDate()} ${bulan} ${now.getFullYear()}, ${h}:${m} WIB`,
    iso: now.toISOString(),
  };
}

const CampaignContext = createContext(null);

export function CampaignProvider({ children }) {
  const [pengajuanList, setPengajuanList] = useState([]);
  const [kampanyeAktif, setKampanyeAktif] = useState([]);
  const [kampanyeArsip, setKampanyeArsip] = useState([]);
  const [notifAdmin, setNotifAdmin] = useState([]);
  const [notifUser, setNotifUser] = useState([]);
  const [topOrganizer, setTopOrganizer] = useState([]);
  const [laporan, setLaporan] = useState([]);
  const [reputation, setReputation] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchPengajuan() {
    const { data, error } = await supabase.from("pengajuan_campaign").select("*").order("tanggal_masuk", { ascending: false });
    if (error) {
      console.error("fetchPengajuan:", error);
      return;
    }
    setPengajuanList((data || []).map(mapPengajuan));
  }

  async function fetchKampanye() {
    const { data, error } = await supabase.from("kampanye_aktif").select("*").order("created_at", { ascending: false });
    if (error) {
      console.error("fetchKampanye:", error);
      return;
    }

    // Auto-archive campaigns yang sudah completed lebih dari 30 hari
    const nowTime = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const toAutoArchive = (data || []).filter(k => {
      if (k.is_archived) return false;
      const completedAt = k.completed_at ? new Date(k.completed_at).getTime() : null;
      return completedAt !== null && (nowTime - completedAt) > thirtyDaysMs;
    });
    if (toAutoArchive.length > 0) {
      let updatedSomething = false;
      for (const k of toAutoArchive) {
        const { error: e1 } = await supabase.from("kampanye_aktif").update({ is_archived: true }).eq("id", k.id);
        const { error: e2 } = await supabase.from("pengajuan_campaign").update({ is_archived: true }).eq("id", k.id);
        if (!e1 && !e2) updatedSomething = true;
      }
      if (updatedSomething) {
        const { data: data2 } = await supabase.from("kampanye_aktif").select("*").order("created_at", { ascending: false });
        const activeData2 = (data2 || []).filter(p => p.is_archived !== true);
        const archivedData2 = (data2 || []).filter(p => p.is_archived === true);
        setKampanyeAktif(activeData2.map(mapKampanye));
        setKampanyeArsip(archivedData2.map(mapKampanye));
        return;
      }
    }

    const activeData = (data || []).filter(p => p.is_archived !== true);
    const archivedData = (data || []).filter(p => p.is_archived === true);
    setKampanyeAktif(activeData.map(mapKampanye));
    setKampanyeArsip(archivedData.map(mapKampanye));
  }

  async function fetchNotifAdmin() {
    const { data } = await supabase.from("notif_admin").select("*").order("created_at", { ascending: false });
    setNotifAdmin(data || []);
  }

  async function fetchNotifUser() {
    const user = getCurrentUser();
    if (!user.id) return;
    const { data } = await supabase.from("notif_user").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setNotifUser(data || []);
  }

  async function fetchTopOrganizer() {
    const { data, error } = await supabase.from("top_organizer").select("*").order("rank", { ascending: true }).limit(10);
    if (error) {
      console.error("fetchTopOrganizer:", error);
      return;
    }
    setTopOrganizer(data || []);
  }

  async function fetchLaporan() {
    const { data, error } = await supabase
      .from("laporan")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("fetchLaporan:", error);
      return;
    }
    setLaporan(data || []);
  }

  useEffect(() => {
    Promise.all([
      fetchPengajuan(),
      fetchKampanye(),
      fetchNotifAdmin(),
      fetchNotifUser(),
      fetchTopOrganizer(),
      fetchLaporan(),
    ]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 
  // DISABLED: Auto-timeout detector for admins
  useEffect(() => {
    const user = getCurrentUser();
    if (user.role !== "admin") return;

    const interval = setInterval(() => {
      checkAndHandleTimeouts();
    }, 30000); // check every 30s

    // Run once on load after data is fetched
    if (!loading) {
      checkAndHandleTimeouts();
    }

    return () => clearInterval(interval);
  }, [loading, kampanyeAktif]);
  */

  async function checkAndHandleTimeouts() {
    const nowSec = Math.floor(Date.now() / 1000);
    const toAutoBan = kampanyeAktif.filter(k => {
      // Hanya proses yang statusnya sedang menunggu bukti
      const isAwaiting = k.statusLifecycle === "awaiting_proof" || k.statusLifecycle === "fundraising";
      const hasDeadline = k.proofDeadlineAt && k.proofDeadlineAt > 0;
      const isExpired = hasDeadline && nowSec > k.proofDeadlineAt;
      const noProof = !k.proofHash || k.proofHash === ethers.ZeroHash;
      return isAwaiting && isExpired && noProof;
    });

    if (toAutoBan.length === 0) return;

    console.log(`[AutoTimeout] Found ${toAutoBan.length} campaigns to auto-ban.`);

    for (const k of toAutoBan) {
      try {
        // 1. Update Supabase status kampanye menjadi frozen (ditutup)
        await supabase.from("kampanye_aktif").update({ 
          status_lifecycle: "frozen",
          catatan_admin: "Otomatis: Batas waktu unggah bukti telah lewat."
        }).eq("id", k.id);

        // 2. Ban Organizer di Supabase
        if (k.walletOrganizer) {
          await updateReputation(k.walletOrganizer, -50, "slashed_count");
          
          const w = k.walletOrganizer.toLowerCase();
          await supabase.from("organizer_reputation").update({
            is_banned: true,
            ban_reason: "Otomatis: Gagal melampirkan bukti penggunaan dana hingga batas waktu."
          }).eq("wallet", w);
          
          const { data: prof } = await supabase.from("profiles").select("id").ilike("wallet_address", w).maybeSingle();
          if (prof?.id) {
            await supabase.from("notif_user").insert([{
              user_id: prof.id,
              type: "banned",
              judul: "⛔ Akun Anda Telah Di-Ban",
              pesan: "Akun Anda di-ban otomatis karena gagal mengunggah bukti penggunaan dana tepat waktu.",
              dibaca: false
            }]);
          }
        }
      } catch (e) {
        console.error(`[AutoTimeout] Failed to process ${k.id}:`, e);
      }
    }

    if (toAutoBan.length > 0) {
      await fetchKampanye();
      await fetchReputation();
    }
  }

  useEffect(() => {
    const chanPengajuan = supabase
      .channel("pengajuan_campaign")
      .on("postgres_changes", { event: "*", schema: "public", table: "pengajuan_campaign" }, fetchPengajuan)
      .subscribe();

    const chanKampanye = supabase
      .channel("kampanye_aktif")
      .on("postgres_changes", { event: "*", schema: "public", table: "kampanye_aktif" }, fetchKampanye)
      .subscribe();

    const chanLaporan = supabase
      .channel("laporan")
      .on("postgres_changes", { event: "*", schema: "public", table: "laporan" }, fetchLaporan)
      .subscribe();

    return () => {
      supabase.removeChannel(chanPengajuan);
      supabase.removeChannel(chanKampanye);
      supabase.removeChannel(chanLaporan);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function syncTop10ToChain() {
    const { data, error } = await supabase
      .from("top_organizer")
      .select("wallet_address, rank")
      .order("rank", { ascending: true })
      .limit(10);

    if (error) throw error;

    const list = (data || [])
      .map((r) => r.wallet_address)
      .filter(Boolean)
      .map((a) => ethers.getAddress(a));

    if (list.length < 6) {
      throw new Error(`Top organizer valid kurang dari 6. Sekarang: ${list.length}. (Butuh >= 6 untuk voters 6)`);
    }

    const provider = await getProviderChecked();
    const signer = await provider.getSigner();

    const vs = new ethers.Contract(getValidatorSetAddress(), VALIDATOR_SET_ABI, signer);

    const adminOnChain = await vs.admin();
    const caller = await signer.getAddress();
    if (adminOnChain.toLowerCase() !== caller.toLowerCase()) {
      throw new Error(`Wallet kamu bukan admin ValidatorSet.\nAdmin on-chain: ${adminOnChain}\nWallet kamu: ${caller}`);
    }

    const tx = await vs.setTop10(list);
    await tx.wait();

    const onChain = await vs.getTop10();
    console.log("Synced top10 to chain:", onChain);

    await fetchTopOrganizer();
    return onChain;
  }

  async function submitPengajuan(form, wallet) {
    const now = getNow();

    const fotoCover =
      typeof form.foto === "string" && form.foto
        ? form.foto
        : form.fotoPreview || "https://images.unsplash.com/photo-1593113598332-cd288d649433?w=600&q=80";

    const dokumenUrl = form.dokumen?.url || "";
    const dokumenNama = form.dokumen?.nama || "-";
    const dokumenTipe = form.dokumen?.tipe || "";

    const anggaranBersih = (form.anggaran || []).filter((r) => r.barang || r.harga);

    const { data, error } = await supabase
      .from("pengajuan_campaign")
      .insert([
        {
          judul_kampanye: form.judul,
          kategori: form.kategori || "Lainnya",
          deskripsi: form.deskripsi,
          target_eth: parseFloat(form.target) || 0,
          durasi_hari: parseInt(form.durasi) || 0,
          foto_cover: fotoCover,
          nama_org: form.namaOrg,
          jenis_verif: form.jenisVerif,
          alasan: form.alasan,
          dokumen_url: dokumenUrl,
          dokumen_nama: dokumenNama,
          dokumen_tipe: dokumenTipe,
          anggaran: anggaranBersih,
          wallet_address: wallet,
          status: "pending",
          tanggal_masuk: now.iso,
          campaign_id: form.campaign_id || null,
          voting_contract: form.voting_contract || null,
          submit_tx_hash: form.submit_tx_hash || null,
          stake_bond_wei: form.stake_bond_wei || null,
          voting_fee_wei: form.voting_fee_wei || null,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    await supabase.from("notif_admin").insert([
      {
        type: "pengajuan_baru",
        judul: "Pengajuan Baru Masuk",
        pesan: `${form.namaOrg} mengajukan kampaye "${form.judul}".`,
        dibaca: false,
        ref_id: data.id,
      },
    ]);

    await fetchPengajuan();
    await fetchNotifAdmin();

    return data.id;
  }

  async function updateStatus(id, status, alasanTolak = "") {
    const pengajuan = pengajuanList.find((p) => p.id === id);
    if (!pengajuan) return null;

    const isSetujui = status === "disetujui";

    if (!isSetujui) {
      const { error } = await supabase.from("pengajuan_campaign").update({ status: "ditolak", alasan_tolak: alasanTolak }).eq("id", id);
      if (error) throw error;

      const user = DUMMY_ACCOUNTS.find((a) => a.wallet?.toLowerCase() === pengajuan.walletAddress?.toLowerCase());
      if (user) {
        await supabase.from("notif_user").insert([
          {
            user_id: user.id,
            type: "ditolak",
            judul: "Pengajuan Ditolak",
            pesan: `Pengajuan "${pengajuan.judulKampanye}" ditolak. Alasan: ${alasanTolak}`,
            dibaca: false,
            ref_id: id,
          },
        ]);
      }

      await fetchPengajuan();
      await fetchNotifAdmin();
      await fetchNotifUser();
      return { status, id };
    }

    if (pengajuan.campaign_id === null || pengajuan.campaign_id === undefined) {
      throw new Error("campaign_id belum ada di Supabase. Pastikan submitCampaign on-chain sudah terjadi.");
    }

    const provider = await getProviderChecked();
    const sm = new ethers.Contract(getStakingManagerAddress(), STAKING_MANAGER_READ_ABI, provider);

    const onChainAddr = await sm.campaignDonationOf(String(pengajuan.campaign_id));
    if (!onChainAddr || onChainAddr === ethers.ZeroAddress) {
      throw new Error("campaignDonationOf(campaign_id) masih 0x0. Pastikan admin sudah finalize dan voting Approved.");
    }

    const campaignAddr = onChainAddr.toLowerCase();

    const { data: existingK, error: errFind } = await supabase
      .from("kampanye_aktif")
      .select("id, contract_address")
      .eq("id", id)
      .maybeSingle();
    if (errFind) throw errFind;

    const { error: errP } = await supabase.from("pengajuan_campaign").update({ status: "disetujui", alasan_tolak: "" }).eq("id", id);
    if (errP) throw errP;

    if (!existingK) {
      const { error: errK } = await supabase.from("kampanye_aktif").insert([
        {
          id,
          judul: pengajuan.judulKampanye,
          kategori: pengajuan.kategori,
          foto: pengajuan.fotoCover,
          organizer: pengajuan.namaOrganisasi,
          deskripsi: pengajuan.deskripsiKampanye,
          target_eth: parseFloat(pengajuan.targetETH) || 0,
          terkumpul_eth: 0,
          donatur: 0,
          sisa_hari: parseInt(pengajuan.durasiHari) || 30,
          contract_address: campaignAddr,
          wallet_address: pengajuan.walletAddress,
          anggaran: pengajuan.anggaran || [],
          transaksi: [],
          pencairan: [],
          deploy_tx_hash: null,
          deploy_block: null,

          proof_url: "",
          proof_hash: "",
          proof_submitted_at: null,
          complete_tx_hash: "",
          stake_refund_tx_hash: "",
          
          // Initial placeholders, will be synced by Admin in VerifySubmission
          fundraising_end_at: null,
          proof_deadline_at: null,
        },
      ]);
      if (errK) throw errK;
    } else {
      if ((existingK.contract_address || "").toLowerCase() !== campaignAddr.toLowerCase()) {
        await supabase.from("kampanye_aktif").update({ contract_address: campaignAddr }).eq("id", id);
      }
    }

    const user = DUMMY_ACCOUNTS.find((a) => a.wallet?.toLowerCase() === pengajuan.walletAddress?.toLowerCase());
    if (user) {
      await supabase.from("notif_user").insert([
        {
          user_id: user.id,
          type: "disetujui",
          judul: "Kampanye Disetujui!",
          pesan: `Kampanye "${pengajuan.judulKampanye}" telah disetujui. Smart contract sudah dipublish!`,
          dibaca: false,
          ref_id: id,
        },
      ]);
    }

    await fetchPengajuan();
    await fetchKampanye();
    await fetchNotifAdmin();
    await fetchNotifUser();

    return { status: "disetujui", id, campaignAddr };
  }

  async function tolakPengajuan(id, alasan) {
    const { error } = await supabase.from("pengajuan_campaign").update({ status: "Rejected", catatan_admin: alasan }).eq("id", id);
    if (error) throw error;
    await fetchPengajuan();
  }

  async function archiveCampaign(id) {
    const { error: err1 } = await supabase.from("pengajuan_campaign").update({ is_archived: true }).eq("id", id);
    if (err1) throw err1;
    const { error: err2 } = await supabase.from("kampanye_aktif").update({ is_archived: true }).eq("id", id);
    if (err2 && err2.code !== "PGRST116") throw err2;
    await fetchPengajuan();
    await fetchKampanye();
  }

  async function voteKampanye(id, pilihan, voterId) {
    console.warn("[voteKampanye disabled] Voting approval dipindah ke on-chain GovernanceVoting. Abaikan vote Supabase ini.", {
      id,
      pilihan,
      voterId,
    });
    return;
  }

  async function applyDonationToCampaign(campaignId, { donor, amountEth, txHash, waktu }) {
    const kampanye = kampanyeAktif.find((k) => k.id === campaignId);
    if (!kampanye) return;

    const transaksiBaru = [{ wallet: donor, jumlah: `${amountEth} ETH`, waktu, txHash }, ...(kampanye.transaksi || [])];

    await supabase
      .from("kampanye_aktif")
      .update({
        terkumpul_eth: Number(kampanye.terkumpulETH) + Number(amountEth),
        donatur: Number(kampanye.donatur) + 1,
        transaksi: transaksiBaru,
      })
      .eq("id", campaignId);

    await fetchKampanye();
  }

  async function applyWithdrawToCampaign(campaignId, { to, amountEth, txHash, waktu }) {
    // Cari dari state lokal dulu, fallback ke Supabase langsung
    // (penting untuk Sync flow di mana state lokal mungkin stale)
    let kampanye = kampanyeAktif.find((k) => k.id === campaignId);

    if (!kampanye) {
      const { data, error } = await supabase
        .from("kampanye_aktif")
        .select("id, pencairan")
        .eq("id", campaignId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error(`Campaign tidak ditemukan di database: ${campaignId}`);
      kampanye = { id: data.id, pencairan: data.pencairan || [] };
    }

    const pencairanBaru = [{ ke: to, jumlah: `${amountEth} ETH`, waktu, txHash }, ...(kampanye.pencairan || [])];

    const { error: updateError } = await supabase
      .from("kampanye_aktif")
      .update({ pencairan: pencairanBaru })
      .eq("id", campaignId);

    if (updateError) throw updateError;

    await fetchKampanye();
  }

  function getPengajuanById(id) {
    return pengajuanList.find((p) => p.id === id) || null;
  }

  function getKampanyeById(id) {
    return kampanyeAktif.find((k) => k.id === id)
      || kampanyeArsip.find((k) => k.id === id)
      || null;
  }

  async function getDokumenById(id) {
    const p = pengajuanList.find((p) => p.id === id);
    return p?.dokumen || null;
  }

  // =========
  // On-chain state (baru)
  // =========
  async function getCampaignIdOnChainByDbId(dbId) {
    const { data, error } = await supabase
      .from("pengajuan_campaign")
      .select("id, campaign_id, wallet_address")
      .eq("id", dbId)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Pengajuan tidak ditemukan untuk id: " + dbId);
    if (data.campaign_id === null || data.campaign_id === undefined) throw new Error("campaign_id belum ada di Supabase untuk id: " + dbId);
    return data.campaign_id;
  }

  async function getCampaignOnChainStateByDbId(dbId) {
    const provider = await getProviderChecked();
    const sm = new ethers.Contract(getStakingManagerAddress(), STAKING_MANAGER_READ_ABI, provider);

    const campaignIdOnChain = await getCampaignIdOnChainByDbId(dbId);
    const c = await sm.campaigns(String(campaignIdOnChain));

    // c fields (sesuai ABI):
    const lifecycle = Number(c.lifecycle);
    const status = Number(c.status);

    return {
      campaignIdOnChain: Number(campaignIdOnChain),
      organizer: c.organizer,
      status, // CampaignStatus enum number
      lifecycle, // LifecycleStatus enum number
      fundraisingEndAt: Number(c.fundraisingEndAt || 0),
      proofDeadlineAt: Number(c.proofDeadlineAt || 0),
      disputeEndsAt: Number(c.disputeEndsAt || 0),
      targetWei: c.targetWei,
      proofHash: c.proofHash,
      proofSubmittedAt: Number(c.proofSubmittedAt || 0),
    };
  }

  // =========
  // Proof upload + submit + complete (tetap)
  // =========

  async function uploadProofToStorage(dbId, file, walletAddr) {
    if (!file) throw new Error("File proof kosong.");
    const maxMb = 10;
    if (file.size > maxMb * 1024 * 1024) throw new Error(`Ukuran file terlalu besar. Maks ${maxMb}MB.`);

    const safeName = String(file.name || "proof.pdf").replace(/[^\w.-]+/g, "_");
    const filePath = `${dbId}/${Date.now()}_${String(walletAddr || "wallet").slice(0, 10)}_${safeName}`;

    const { error: uploadError } = await supabase.storage.from("bukti-campaign").upload(filePath, file, {
      upsert: true,
      contentType: file.type || "application/pdf",
    });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from("bukti-campaign").getPublicUrl(filePath);
    const publicUrl = urlData?.publicUrl || "";
    if (!publicUrl) throw new Error("Gagal mendapatkan public URL proof.");
    return { publicUrl, filePath };
  }

  async function submitProofForCampaign(dbId, file) {
    const kampanye = kampanyeAktif.find((k) => k.id === dbId);
    if (!kampanye) throw new Error("Campaign belum ada di kampanye_aktif atau belum aktif.");

    const provider = await getProviderChecked();
    const signer = await provider.getSigner();
    const signerAddr = await signer.getAddress();

    if (kampanye.walletOrganizer && kampanye.walletOrganizer.toLowerCase() !== signerAddr.toLowerCase()) {
      throw new Error(`Wallet aktif bukan organizer.\nOrganizer: ${kampanye.walletOrganizer}\nWallet kamu: ${signerAddr}`);
    }

    const campaignIdOnChain = await getCampaignIdOnChainByDbId(dbId);

    const { publicUrl } = await uploadProofToStorage(dbId, file, signerAddr);

    const proofHash = ethers.keccak256(ethers.toUtf8Bytes(publicUrl));

    const sm = new ethers.Contract(getStakingManagerAddress(), STAKING_MANAGER_PROOF_ABI, signer);
    const tx = await sm.submitProof(String(campaignIdOnChain), proofHash);
    await tx.wait();

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("kampanye_aktif")
      .update({
        proof_url: publicUrl,
        proof_hash: proofHash,
        proof_submitted_at: nowIso,
      })
      .eq("id", dbId);

    if (error) throw error;

    await fetchKampanye();

    return { publicUrl, proofHash, txHash: tx.hash };
  }

  async function completeCampaignForCampaign(dbId) {
    const kampanye = kampanyeAktif.find((k) => k.id === dbId);
    if (!kampanye) throw new Error("Campaign belum ada di kampanye_aktif atau belum aktif.");

    const provider = await getProviderChecked();
    const signer = await provider.getSigner();
    const signerAddr = await signer.getAddress();

    if (kampanye.walletOrganizer && kampanye.walletOrganizer.toLowerCase() !== signerAddr.toLowerCase()) {
      throw new Error(`Wallet aktif bukan organizer.\nOrganizer: ${kampanye.walletOrganizer}\nWallet kamu: ${signerAddr}`);
    }

    const campaignIdOnChain = await getCampaignIdOnChainByDbId(dbId);

    const sm = new ethers.Contract(getStakingManagerAddress(), STAKING_MANAGER_PROOF_ABI, signer);
    const tx = await sm.completeCampaign(String(campaignIdOnChain));
    await tx.wait();

    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("kampanye_aktif").update({
      complete_tx_hash: tx.hash,
      completed_at: nowIso,         // ← tandai waktu completed
      status_lifecycle: "completed", // ← update lifecycle status
    }).eq("id", dbId);
    if (error) throw error;

    // +10 rep untuk organizer yang campaign-nya sukses
    const walletOrg = (kampanye.walletOrganizer || "").toLowerCase();
    if (walletOrg) {
      await updateReputation(walletOrg, 10, "campaigns_completed");
      autoSyncTop10().catch(() => { }); // fire-and-forget, tidak perlu await
    }

    await fetchKampanye();
    return { txHash: tx.hash };
  }

  async function tandaiDibacaAdmin(id) {
    await supabase.from("notif_admin").update({ dibaca: true }).eq("id", id);
    setNotifAdmin((prev) => prev.map((n) => (n.id === id ? { ...n, dibaca: true } : n)));
  }

  async function tandaiSemuaDibacaAdmin() {
    await supabase.from("notif_admin").update({ dibaca: true }).eq("dibaca", false);
    setNotifAdmin((prev) => prev.map((n) => ({ ...n, dibaca: true })));
  }

  async function tandaiDibacaUser(id) {
    await supabase.from("notif_user").update({ dibaca: true }).eq("id", id);
    setNotifUser((prev) => prev.map((n) => (n.id === id ? { ...n, dibaca: true } : n)));
  }

  async function tandaiSemuaDibacaUser() {
    const user = getCurrentUser();
    if (!user.id) return;
    await supabase.from("notif_user").update({ dibaca: true }).eq("user_id", user.id).eq("dibaca", false);
    setNotifUser((prev) => prev.map((n) => ({ ...n, dibaca: true })));
  }

  async function resetData() {
    await supabase.from("kampanye_aktif").delete().neq("id", "x");
    await supabase.from("pengajuan_campaign").delete().neq("id", "x");
    await supabase.from("notif_admin").delete().neq("id", "x");
    await supabase.from("notif_user").delete().neq("id", "x");
    await supabase.from("laporan").delete().neq("id", 0);
    await fetchPengajuan();
    await fetchKampanye();
    await fetchNotifAdmin();
    await fetchNotifUser();
    await fetchLaporan();
  }

  // =========
  // Reputation helpers
  // =========

  /** Fetch semua rep dari Supabase */
  async function fetchReputation() {
    const { data } = await supabase
      .from("organizer_reputation")
      .select("*")
      .order("rep_score", { ascending: false });

    const repData = data || [];

    // Batch-fetch nama dari profiles berdasarkan wallet_address
    if (repData.length > 0) {
      const wallets = repData.map((r) => r.wallet).filter(Boolean);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("wallet_address, nama, id")
        .in("wallet_address", wallets);

      const profileMap = {};
      (profilesData || []).forEach((p) => {
        if (p.wallet_address) {
          profileMap[p.wallet_address.toLowerCase()] = { nama: p.nama, id: p.id };
        }
      });

      const merged = repData.map((r) => ({
        ...r,
        display_name:
          r.display_name ||
          profileMap[(r.wallet || "").toLowerCase()]?.nama ||
          null,
        profile_id: profileMap[(r.wallet || "").toLowerCase()]?.id || null,
      }));

      setReputation(merged);
      return merged;
    }

    setReputation(repData);
    return repData;
  }

  /**
   * Update rep score satu wallet di Supabase.
   * @param {string} wallet - alamat wallet (lowercase)
   * @param {number} delta - perubahan skor (+10, -50, dll)
   * @param {'campaigns_completed'|'votes_on_time'|'votes_missed'|'slashed_count'} field - kolom counter
   */
  async function updateReputation(wallet, delta, field) {
    if (!wallet) return;
    const w = wallet.toLowerCase();

    // Upsert: kalau belum ada, buat baru dengan score=delta
    const { data: existing } = await supabase
      .from("organizer_reputation")
      .select("rep_score, campaigns_completed, votes_on_time, votes_missed, slashed_count, is_banned")
      .eq("wallet", w)
      .maybeSingle();

    const current = existing || {
      rep_score: 0, campaigns_completed: 0, votes_on_time: 0,
      votes_missed: 0, slashed_count: 0, is_banned: false,
    };

    const updates = {
      wallet: w,
      rep_score: current.rep_score + delta,
      campaigns_completed: current.campaigns_completed + (field === "campaigns_completed" ? 1 : 0),
      votes_on_time: current.votes_on_time + (field === "votes_on_time" ? 1 : 0),
      votes_missed: current.votes_missed + (field === "votes_missed" ? 1 : 0),
      slashed_count: current.slashed_count + (field === "slashed_count" ? 1 : 0),
      is_banned: current.is_banned, // preserve
      needs_chain_sync: true,
    };

    await supabase.from("organizer_reputation").upsert([updates], { onConflict: "wallet" });
  }

  /**
   * Hitung ulang top10 dari Supabase rep, lalu sync ke ValidatorSet on-chain.
   * Hanya bisa dilakukan jika wallet aktif adalah admin.
   * @returns {{ synced: boolean, top10: string[] }}
   */
  async function autoSyncTop10() {
    try {
      // Ambil top 10 terbaik dari Supabase
      const { data } = await supabase
        .from("organizer_reputation")
        .select("wallet")
        .order("rep_score", { ascending: false })
        .limit(10);

      if (!data || data.length === 0) return { synced: false, top10: [] };

      const top10 = data.map((r) => r.wallet);
      if (top10.length < 6) return { synced: false, top10 }; // perlu min 6

      // Coba sync ke chain (hanya berhasil jika wallet = admin)
      await syncTop10ToChain(top10);

      // Reset needs_chain_sync flag
      await supabase
        .from("organizer_reputation")
        .update({ needs_chain_sync: false })
        .in("wallet", top10);

      await fetchReputation();
      return { synced: true, top10 };
    } catch {
      // Bukan admin atau chain tidak tersedia — tidak apa-apa, sync pending
      return { synced: false, top10: [] };
    }
  }

  /**
   * Sync reputation points for voters after voting is finalized.
   * +2 for votes_on_time, -5 for votes_missed.
   */
  async function syncVoterReputation(dbId) {
    try {
      const campaignIdOnChain = await getCampaignIdOnChainByDbId(dbId);
      const provider = await getProviderChecked();
      const sm = new ethers.Contract(getStakingManagerAddress(), STAKING_MANAGER_READ_ABI, provider);

      const core = await sm.getCampaignCore(String(campaignIdOnChain));
      const votingContractAddr = core.votingContract;

      if (!votingContractAddr || votingContractAddr === ethers.ZeroAddress) return;

      const GOV_VOTING_ABI = [
        "function getVoters() view returns (address[])",
        "function voterInfo(address) view returns (uint64 assignedAt, bool replaced, uint8 choice)"
      ];

      const gv = new ethers.Contract(votingContractAddr, GOV_VOTING_ABI, provider);
      const voters = await gv.getVoters();

      for (const v of voters) {
        const info = await gv.voterInfo(v);
        const replaced = info.replaced;
        const choice = Number(info.choice);

        if (!replaced) {
          if (choice === 1 || choice === 2) {
            await updateReputation(v, 2, "votes_on_time");
          } else {
            await updateReputation(v, -5, "votes_missed");
          }
        }
      }

      // Fire-and-forget sync Top 10 just in case
      autoSyncTop10().catch(() => { });
    } catch (e) {
      console.error("Failed to sync voter reputation:", e);
    }
  }

  // =========
  // Report on-chain functions
  // =========

  /**
   * Submit laporan ke on-chain + simpan ke Supabase.
   * Stake fixed = REPORT_STAKE_BOND (0.01 ETH) — tidak bisa dipilih reporter.
   * @param {string} campaignDbId - ID Supabase kampanye yang dilaporkan
   * @param {string} alasan - teks alasan laporan (disimpan di Supabase)
   * @returns {{ reportId, txHash }}
   */
  async function submitReportOnChain(campaignDbId, alasan) {
    const campaignIdOnChain = await getCampaignIdOnChainByDbId(campaignDbId);

    const provider = await getProviderChecked();
    const signer = await provider.getSigner();
    const reporterAddr = await signer.getAddress();

    const sm = new ethers.Contract(getStakingManagerAddress(), STAKING_MANAGER_REPORT_ABI, signer);

    // Baca fixed stake amount dari contract
    const stakeBondWei = await sm.REPORT_STAKE_BOND();

    const tx = await sm.submitReport(
      String(campaignIdOnChain),
      { value: stakeBondWei }
    );
    const receipt = await tx.wait();

    // Parse event ReportSubmitted untuk dapat reportId
    const smAddr = String(sm.target).toLowerCase();
    let reportId = null;

    for (const log of receipt.logs) {
      if (!log?.address) continue;
      if (log.address.toLowerCase() !== smAddr) continue;
      try {
        const parsed = sm.interface.parseLog(log);
        if (parsed?.name === "ReportSubmitted") {
          reportId = parsed.args.reportId.toString();
          break;
        }
      } catch { }
    }

    if (!reportId) throw new Error("ReportSubmitted event tidak ditemukan di receipt.");

    // Simpan ke Supabase tabel laporan
    const { error } = await supabase.from("laporan").insert([{
      campaign_db_id: campaignDbId,
      campaign_id_onchain: Number(campaignIdOnChain),
      report_id_onchain: Number(reportId),
      reporter_wallet: reporterAddr.toLowerCase(),
      stake_bond_wei: stakeBondWei.toString(),
      voting_fee_wei: "0",
      voting_contract: "",
      alasan: alasan || "",
      status: "submitted",
      submit_tx_hash: tx.hash,
      created_at: new Date().toISOString(),
    }]);
    if (error) throw error;

    await fetchLaporan();
    await fetchNotifAdmin();

    return { reportId, txHash: tx.hash };
  }

  /**
   * Admin MENERIMA laporan → organizer slashed, dana donatur di-drain.
   */
  async function acceptReportOnChain(reportIdOnChain, laporanDbId) {
    const provider = await getProviderChecked();
    const signer = await provider.getSigner();
    const sm = new ethers.Contract(getStakingManagerAddress(), STAKING_MANAGER_REPORT_ABI, signer);
    const tx = await sm.acceptReport(String(reportIdOnChain));
    await tx.wait();

    if (laporanDbId) {
      await supabase.from("laporan").update({
        status: "approved",
        finalize_tx_hash: tx.hash,
        finalized_at: new Date().toISOString(),
      }).eq("id", laporanDbId);
    }

    // Update status kampanye menjadi frozen
    const lap = laporanDbId ? laporan.find((l) => String(l.id) === String(laporanDbId)) : null;
    if (lap?.campaign_db_id) {
      await supabase.from("kampanye_aktif").update({ status_lifecycle: "frozen" }).eq("id", lap.campaign_db_id);
      await fetchKampanye();
    }

    // -50 rep untuk organizer yang di-slash + BAN
    if (lap?.campaign_db_id) {
      const camp = kampanyeAktif.find((k) => k.id === lap.campaign_db_id);
      const orgWallet = (camp?.walletOrganizer || "").toLowerCase();
      if (orgWallet) {
        // Update rep score
        await updateReputation(orgWallet, -50, "slashed_count");
        
        // Update BAN status di Supabase
        await supabase
          .from("organizer_reputation")
          .update({ is_banned: true, ban_reason: `Dilaporkan: Campaign dipaksa tutup oleh Admin (Report #${reportIdOnChain}).` })
          .eq("wallet", orgWallet);

        autoSyncTop10().catch(() => { });
      }
    }

    await fetchLaporan();
    return { txHash: tx.hash, statusStr: "approved" };
  }

  /**
   * Admin MENOLAK laporan → reporter slashed, campaign normal kembali.
   */
  async function rejectReportOnChain(reportIdOnChain, laporanDbId) {
    const provider = await getProviderChecked();
    const signer = await provider.getSigner();
    const sm = new ethers.Contract(getStakingManagerAddress(), STAKING_MANAGER_REPORT_ABI, signer);
    const tx = await sm.rejectReport(String(reportIdOnChain));
    await tx.wait();

    if (laporanDbId) {
      await supabase.from("laporan").update({
        status: "rejected",
        finalize_tx_hash: tx.hash,
        finalized_at: new Date().toISOString(),
      }).eq("id", laporanDbId);
    }

    await fetchLaporan();
    return { txHash: tx.hash, statusStr: "rejected" };
  }

  /**
   * Organizer selesaikan fundraising lebih awal (hanya jika target terpenuhi).
   */
  async function finishFundraisingEarlyOnChain(campaignDbId) {
    const campaignIdOnChain = await getCampaignIdOnChainByDbId(campaignDbId);
    const provider = await getProviderChecked();
    const signer = await provider.getSigner();
    const sm = new ethers.Contract(getStakingManagerAddress(), STAKING_MANAGER_REPORT_ABI, signer);
    const tx = await sm.finishFundraisingEarly(String(campaignIdOnChain));
    await tx.wait();

    await supabase.from("kampanye_aktif").update({
      status_lifecycle: "awaiting_proof",
      fundraising_finished_early_at: new Date().toISOString(),
    }).eq("id", campaignDbId);

    await fetchKampanye();
    return { txHash: tx.hash };
  }

  // =========
  // Multi-Admin on-chain functions
  // =========

  async function getAdminListOnChain() {
    const provider = await getProviderChecked();
    const sm = new ethers.Contract(getStakingManagerAddress(), MULTI_ADMIN_ABI, provider);
    const list = await sm.getAdminList();
    const primary = await sm.primaryAdmin();
    return { list, primary };
  }

  async function addAdminOnChain(newAdminAddr) {
    const provider = await getProviderChecked();
    const signer = await provider.getSigner();
    const sm = new ethers.Contract(getStakingManagerAddress(), MULTI_ADMIN_ABI, signer);
    const tx = await sm.addAdmin(newAdminAddr);
    await tx.wait();
    // Sync ke Supabase
    const callerAddr = (await signer.getAddress()).toLowerCase();
    await supabase.from("admins").upsert([{
      wallet: newAdminAddr.toLowerCase(),
      added_by: callerAddr,
      is_active: true,
    }], { onConflict: "wallet" });
    return { txHash: tx.hash };
  }

  async function removeAdminOnChain(adminAddr) {
    const provider = await getProviderChecked();
    const signer = await provider.getSigner();
    const sm = new ethers.Contract(getStakingManagerAddress(), MULTI_ADMIN_ABI, signer);
    const tx = await sm.removeAdmin(adminAddr);
    await tx.wait();
    await supabase.from("admins").update({ is_active: false }).eq("wallet", adminAddr.toLowerCase());
    return { txHash: tx.hash };
  }

  async function setPrimaryAdminOnChain(adminAddr) {
    const provider = await getProviderChecked();
    const signer = await provider.getSigner();
    const sm = new ethers.Contract(getStakingManagerAddress(), MULTI_ADMIN_ABI, signer);
    const tx = await sm.setPrimaryAdmin(adminAddr);
    await tx.wait();
    // Update Supabase flags
    await supabase.from("admins").update({ is_primary: false }).neq("wallet", "x");
    await supabase.from("admins").update({ is_primary: true }).eq("wallet", adminAddr.toLowerCase());
    return { txHash: tx.hash };
  }

  async function claimPrescreenTimeoutOnChain(campaignIdOnChain) {
    const provider = await getProviderChecked();
    const signer = await provider.getSigner();
    const sm = new ethers.Contract(getStakingManagerAddress(), MULTI_ADMIN_ABI, signer);
    const tx = await sm.claimPrescreenTimeout(String(campaignIdOnChain));
    await tx.wait();
    
    // Update ke Supabase agar UI langsung berubah
    await supabase.from("pengajuan_campaign").update({
      status: "ditolak",
      alasan_tolak: "Sistem: Admin tidak memproses pengajuan selama lebih dari 2 hari.",
    }).eq("campaign_id", Number(campaignIdOnChain));

    return { txHash: tx.hash };
  }

  /**
   * Ambil status voting on-chain untuk sebuah campaign.
   * Return daftar validator (label saja, tanpa alamat asli) beserta statusnya.
   * Juga return votingEndsAt (unix seconds) dan shiftDeadline (detik).
   */
  async function getVotingStateOnChain(campaignDbId) {
    // 1. Ambil voting_contract dari Supabase
    const { data, error } = await supabase
      .from("pengajuan_campaign")
      .select("campaign_id, voting_contract")
      .eq("id", campaignDbId)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Pengajuan tidak ditemukan: " + campaignDbId);

    let votingContractAddr = data.voting_contract;

    // Fallback: ambil dari on-chain jika Supabase belum sync
    if (!votingContractAddr && data.campaign_id) {
      const provider = await getProviderChecked();
      const sm = new ethers.Contract(getStakingManagerAddress(), STAKING_MANAGER_READ_ABI, provider);
      const c = await sm.campaigns(String(data.campaign_id));
      votingContractAddr = c.votingContract;
    }

    if (!votingContractAddr || votingContractAddr === ethers.ZeroAddress) {
      throw new Error("Voting contract belum tersedia untuk campaign ini.");
    }

    const provider = await getProviderChecked();
    const gv = new ethers.Contract(votingContractAddr, GOV_VOTING_ABI, provider);

    const [voters, votingEndsAtRaw, shiftDeadlineRaw] = await Promise.all([
      gv.getVoters(),
      gv.votingEndsAt(),
      gv.SHIFT_DEADLINE(),
    ]);

    const nowSec = Math.floor(Date.now() / 1000);
    const votingEndsAt = Number(votingEndsAtRaw);
    const shiftDeadlineSec = Number(shiftDeadlineRaw); // 86400 (24 jam)

    // Ambil info tiap voter — hanya tampilkan status, BUKAN alamat asli
    // voters[] bisa tumbuh karena penggantian, tapi yang aktif (replaced=false) maksimal 6
    const voterInfoList = [];
    let labelCounter = 1;
    for (const addr of voters) {
      if (voterInfoList.length >= 6) break; // hard cap — aktif maksimal 6

      const info = await gv.voterInfo(addr);
      // Akses by index untuk reliabilitas di ethers v6 (struct field order: assignedAt, replaced, choice)
      const assignedAt = Number(info[0]);  // uint64 assignedAt
      const replaced = Boolean(info[1]); // bool replaced
      const choice = Number(info[2]);  // uint8 choice (0=None, 1=Yes, 2=No)

      if (replaced) continue; // skip validator yang sudah diganti

      const hasVoted = choice === 1 || choice === 2;
      const isLalai = !hasVoted && (nowSec > assignedAt + shiftDeadlineSec);
      const sisaDetik = hasVoted ? 0 : Math.max(0, assignedAt + shiftDeadlineSec - nowSec);

      voterInfoList.push({
        label: `Validator ${labelCounter}`,
        addr,       // disimpan internal, TIDAK boleh ditampilkan ke Organizer
        hasVoted,
        isLalai,
        sisaDetik,
        assignedAt,
      });
      labelCounter++;
    }

    return {
      votingEndsAt,
      shiftDeadlineSec,
      voterInfoList,
      votingContractAddr,
      campaignIdOnChain: data.campaign_id,
    };
  }

  /**
   * Ambil daftar Top10 validator dari ValidatorSet on-chain.
   * Return array of address.
   */
  async function getTop10ValidatorsOnChain() {
    const provider = await getProviderChecked();
    const vs = new ethers.Contract(getValidatorSetAddress(), VALIDATOR_SET_ABI, provider);
    const top10 = await vs.getTop10();
    return top10.map((a) => a.toLowerCase());
  }

  /**
   * Ganti validator lalai dengan validator acak dari sisa Top10.
   * Dipanggil oleh Organizer — alamat validator tidak ditampilkan di UI.
   * @param {number} campaignIdOnChain
   * @param {string} oldVoterAddr - alamat validator yang lalai
   * @param {string} newVoterAddr - alamat validator pengganti (dipilih acak oleh frontend)
   */
  async function replaceMissingVoterOnChain(campaignIdOnChain, oldVoterAddr, newVoterAddr) {
    const provider = await getProviderChecked();
    const signer = await provider.getSigner();
    const sm = new ethers.Contract(getStakingManagerAddress(), STAKING_MANAGER_REPLACE_ABI, signer);
    const tx = await sm.replaceMissingVoter(
      String(campaignIdOnChain),
      oldVoterAddr,
      newVoterAddr
    );
    await tx.wait();
    return { txHash: tx.hash };
  }

  /**
   * Sync top10 dari Supabase ke ValidatorSet on-chain.
   * Bisa dipanggil manual atau otomatis setelah rep berubah.
   */
  async function withdrawFromCampaignOnChain(campaignContractAddress) {
    const CAMPAIGN_DONATION_ABI = [
      "function withdraw() external",
      "event Withdrawn(address indexed to, uint256 amount, uint256 timestamp)",
    ];
    const provider = await getProviderChecked();
    const signer = await provider.getSigner();
    const campaign = new ethers.Contract(campaignContractAddress, CAMPAIGN_DONATION_ABI, signer);
    const tx = await campaign.withdraw();
    await tx.wait();
    return { txHash: tx.hash };
  }

  /**
   * Admin set/unset ban status untuk organizer — on-chain + Supabase.
   * @param {string} organizerAddr - wallet address organizer
   * @param {boolean} banStatus - true = ban, false = unban
   * @param {string} reason - alasan ban
   */
  async function setBanStatusOnChain(organizerAddr, banStatus, reason = "") {
    const provider = await getProviderChecked();
    const signer = await provider.getSigner();
    const sm = new ethers.Contract(getStakingManagerAddress(), MULTI_ADMIN_ABI, signer);
    
    let txHash = null;
    try {
      const tx = await sm.setBanStatus(organizerAddr, banStatus);
      await tx.wait();
      txHash = tx.hash;
    } catch (onChainErr) {
      console.warn("[setBanStatus] on-chain gagal, lanjut update Supabase:", onChainErr.message);
    }

    const w = organizerAddr.toLowerCase();

    // 1. Dapatkan profil
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, nama")
      .ilike("wallet_address", w)
      .maybeSingle();

    // 2. Cek apakah row rep ada
    const { data: existing } = await supabase
      .from("organizer_reputation")
      .select("wallet")
      .ilike("wallet", w)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("organizer_reputation")
        .update({
          is_banned: banStatus,
          ban_reason: banStatus ? (reason || "Dibanned oleh admin.") : null,
          display_name: prof?.nama || null,
        })
        .eq("wallet", existing.wallet);
    } else {
      await supabase.from("organizer_reputation").insert([{
        wallet: w,
        is_banned: banStatus,
        ban_reason: banStatus ? (reason || "Dibanned oleh admin.") : null,
        display_name: prof?.nama || null,
        rep_score: 0,
        campaigns_completed: 0,
        votes_on_time: 0,
        votes_missed: 0,
        slashed_count: 0,
        needs_chain_sync: false,
      }]);
    }

    // Notifikasi
    if (prof?.id) {
      const banMsg = banStatus
        ? `Akun Anda telah di-ban oleh admin.${reason ? ` Alasan: ${reason}` : ""} Anda tidak dapat melakukan aktivitas di platform ini selama masa ban.`
        : "Akun Anda telah di-unban oleh admin. Anda sekarang dapat menggunakan platform kembali seperti biasa.";
      supabase.from("notif_user").insert([{
        user_id: prof.id,
        type: banStatus ? "banned" : "unbanned",
        judul: banStatus ? "⛔ Akun Anda Telah Di-Ban" : "✅ Akun Anda Telah Di-Unban",
        pesan: banMsg,
        dibaca: false,
      }]).then(({ error }) => error && console.warn("notif_user:", error.message));
    }

    await fetchReputation();
    return { txHash };
  }

  /**
   * Admin trigger slash untuk organizer yang gagal submit proof pada waktunya.
   */
  async function slashOrganizerNoProofOnChain(campaignDbId) {
    const campaignIdOnChain = await getCampaignIdOnChainByDbId(campaignDbId);
    const provider = await getProviderChecked();
    const signer = await provider.getSigner();

    const STAKING_MANAGER_SLASH_ABI = [
      "function slashNoProof(uint256 campaignId) external"
    ];
    const sm = new ethers.Contract(getStakingManagerAddress(), STAKING_MANAGER_SLASH_ABI, signer);
    
    const tx = await sm.slashNoProof(String(campaignIdOnChain));
    await tx.wait();

    // Update campaign status to frozen (Ditutup)
    await supabase.from("kampanye_aktif").update({
      status_lifecycle: "frozen",
      slashed_at: new Date().toISOString(),
    }).eq("id", campaignDbId);

    // Dapatkan wallet organizer untuk di-ban
    const { data: campData } = await supabase.from("kampanye_aktif").select("wallet_organizer").eq("id", campaignDbId).single();
    if (campData?.wallet_organizer) {
      // updateReputation slash -50
      await updateReputation(campData.wallet_organizer, -50, "slashed_count");
      
      // Auto-ban
      await setBanStatusOnChain(campData.wallet_organizer, true, "Gagal melampirkan bukti penggunaan dana hingga batas waktu yang ditentukan.");
    }

    await fetchKampanye();
    return { txHash: tx.hash };
  }

  return (
    <CampaignContext.Provider
      value={{
        pengajuanList,
        kampanyeAktif,
        kampanyeArsip,
        notifAdmin,
        notifUser,
        topOrganizer,
        laporan,
        reputation,
        loading,

        submitPengajuan,
        updateStatus,
        tolakPengajuan,
        archiveCampaign,
        voteKampanye,

        syncTop10ToChain,
        autoSyncTop10,
        fetchReputation,
        updateReputation,

        // multi-admin
        getAdminListOnChain,
        addAdminOnChain,
        removeAdminOnChain,
        setPrimaryAdminOnChain,
        claimPrescreenTimeoutOnChain,

        getPengajuanById,
        getDokumenById,
        getKampanyeById,

        applyDonationToCampaign,
        applyWithdrawToCampaign,

        // proof APIs
        submitProofForCampaign,
        completeCampaignForCampaign,

        // report APIs
        submitReportOnChain,
        acceptReportOnChain,
        rejectReportOnChain,
        setBanStatusOnChain,
        slashOrganizerNoProofOnChain,
        fetchLaporan,

        syncVoterReputation,

        // organizer APIs
        finishFundraisingEarlyOnChain,
        withdrawFromCampaignOnChain,

        // on-chain read
        getCampaignOnChainStateByDbId,

        // voting on-chain (untuk Organizer)
        getVotingStateOnChain,
        getTop10ValidatorsOnChain,
        replaceMissingVoterOnChain,

        tandaiDibacaAdmin,
        tandaiSemuaDibacaAdmin,
        tandaiDibacaUser,
        tandaiSemuaDibacaUser,

        fetchTopOrganizer,
        resetData,
      }}
    >
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaign() {
  return useContext(CampaignContext);
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsDataURL(file);
  });
}

export function compressImage(file, maxSize = 400, quality = 0.65) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca gambar"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Gagal memuat gambar"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}