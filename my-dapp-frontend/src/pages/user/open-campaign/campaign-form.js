import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FiCheckCircle, FiArrowLeft, FiChevronRight, FiSlash, FiChevronLeft } from "react-icons/fi";
import { useCampaign } from "../../../context/CampaignContext";
import "../../../styles/user/open-campaign/campaign-form.css";
import { uploadImageToCloudinary } from "../../../web3/cloudinaryClient";
import { supabase } from "../../../web3/supabaseClient";
import { ethers } from "ethers";
import { HARDHAT_CHAIN_ID } from "../../../web3/config";

const INITIAL_FORM = {
  judul: "",
  kategori: "",
  deskripsi: "",
  target: "",
  durasi: "",
  foto: null,
  fotoPreview: null,
  namaOrg: "",
  jenisVerif: "",
  alasan: "",
  dokumen: null,
};

const INITIAL_ANGGARAN = [
  { barang: "", harga: "" },
  { barang: "", harga: "" },
  { barang: "", harga: "" },
];

const DEFAULT_VOTING_FEE_ETH = 0.6; // fee untuk voter — bebas ditentukan organizer
const CAMPAIGN_STAKE_BOND_ETH = 0.05; // fixed di contract, tidak perlu diinput user

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

function getCurrentUser() {
  try {
    return JSON.parse(sessionStorage.getItem("currentUser")) || {};
  } catch {
    return {};
  }
}

function Sidebar({ step }) {
  const steps = [
    { label: "Info Kampanye", desc: "Judul, deskripsi, target" },
    { label: "Data Organizer", desc: "Identitas, wallet & anggaran" },
  ];
  return (
    <div className="cf-sidebar">
      <div className="cf-sidebar-top">
        <h2>
          Daftar
          <br />
          Campaign
          <br />
          Baru
        </h2>
        <p className="cf-sidebar-desc">
          Isi form ini untuk mengajukan kampanye donasi. Admin akan memverifikasi sebelum campaign aktif.
        </p>
        <div className="cf-steps">
          {steps.map((s, i) => {
            const num = i + 1;
            const state = step > num ? "done" : step === num ? "active" : "idle";
            const last = i === steps.length - 1;
            return (
              <div key={num} className="cf-step-item">
                <div className="cf-step-rail">
                  <div className={`cf-step-num ${state}`}>
                    {state === "done" ? (
                      <svg width="12" height="12" fill="none" stroke="#22c55e" strokeWidth="2.5" viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      num
                    )}
                  </div>
                  {!last && <div className="cf-step-vline" />}
                </div>
                <div className="cf-step-text">
                  <p className={`cf-step-name ${state}`}>{s.label}</p>
                  <p className="cf-step-desc">{state === "done" ? "Selesai" : s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="cf-sidebar-tip">Dokumen KTP/SK diperlukan untuk proses verifikasi oleh admin.</div>
      </div>
    </div>
  );
}

// ====== ON-CHAIN SUBMIT (STAKING MANAGER) ======
const STAKING_MANAGER_ABI = [
  // Contract baru: submitCampaign hanya butuh votingFee, stakeBond sudah fixed (0.05 ETH) di contract
  "event CampaignSubmitted(uint256 indexed campaignId,address indexed organizer,uint256 stakeBond,uint256 votingFee)",
  "function submitCampaign(uint256 votingFee) payable returns (uint256)",
  "function CAMPAIGN_STAKE_BOND() view returns (uint256)",
];

function getStakingManagerAddress() {
  const addr = process.env.REACT_APP_STAKINGMANAGER_ADDRESS;
  if (!addr) throw new Error("Missing REACT_APP_STAKINGMANAGER_ADDRESS in frontend .env");
  return addr;
}

async function submitCampaignOnChain({ votingFeeEth }) {
  const provider = await getProviderChecked();
  const signer = await provider.getSigner();

  const sm = new ethers.Contract(getStakingManagerAddress(), STAKING_MANAGER_ABI, signer);

  // Baca fixed stake bond dari contract
  const stakeBondWei = await sm.CAMPAIGN_STAKE_BOND();
  const votingFee = ethers.parseEther(String(votingFeeEth));
  // value = stakeBond (fixed 0.05 ETH) + votingFee
  const value = stakeBondWei + votingFee;

  // Contract baru: submitCampaign(uint256 votingFee)
  const tx = await sm.submitCampaign(votingFee, { value });
  const receipt = await tx.wait();

  let campaignId = null;

  const smAddr = String(sm.target).toLowerCase();
  // Event: CampaignSubmitted(uint256 indexed campaignId, address indexed organizer, uint256 stakeBond, uint256 votingFee)
  const eventTopic = ethers.id("CampaignSubmitted(uint256,address,uint256,uint256)");

  for (const log of receipt.logs) {
    if (!log?.address) continue;
    if (log.address.toLowerCase() !== smAddr) continue;
    if (!log.topics?.length) continue;
    if (log.topics[0] !== eventTopic) continue;

    const parsed = sm.interface.parseLog(log);
    campaignId = parsed.args.campaignId.toString();
    break;
  }

  if (!campaignId) {
    console.log("DEBUG txHash:", tx.hash);
    console.log("DEBUG smAddr:", smAddr);
    console.log("DEBUG receipt.logs:", receipt.logs);
    throw new Error("Tx submitCampaign sukses, tapi event CampaignSubmitted tidak ditemukan.");
  }

  return {
    txHash: tx.hash,
    campaignId,
    stakeBondWei: stakeBondWei.toString(),
    votingFeeWei: votingFee.toString(),
  };
}

// helper: parse anggaran dari supabase (kadang sudah array, kadang string json)
function parseAnggaranMaybe(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function CampaignForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { submitPengajuan, reputation } = useCampaign();

  const [step, setStep] = useState(1);
  const [submittedId, setSubmittedId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [anggaran, setAnggaran] = useState(INITIAL_ANGGARAN);
  const [chainErr, setChainErr] = useState("");

  const fotoInputRef = useRef(null);
  const dokumenInputRef = useRef(null);

  const user = getCurrentUser();
  const walletMM = user.wallet || "";

  const userRep = reputation.find(r => r.wallet.toLowerCase() === walletMM.toLowerCase());
  const isBanned = userRep?.is_banned || false;

  // ===== Prefill dari tombol "Ajukan Ulang" =====
  useEffect(() => {
    const prefill = location?.state?.prefill;
    if (!prefill) return;

    setForm((prev) => ({
      ...prev,
      // support supabase snake_case + kemungkinan camelCase
      judul: prefill.judul_kampanye ?? prefill.judulKampanye ?? prefill.judul ?? "",
      deskripsi: prefill.deskripsi ?? "",
      target: String(prefill.target_eth ?? prefill.targetETH ?? prefill.target ?? ""),
      durasi: String(prefill.durasi_hari ?? prefill.durasiHari ?? prefill.sisaHari ?? prefill.durasi ?? ""),

      foto: null,
      fotoPreview: prefill.foto_cover ?? prefill.fotoCover ?? prefill.foto ?? prefill.fotoPreview ?? null,

      namaOrg: prefill.nama_org ?? prefill.namaOrg ?? prefill.namaOrganisasi ?? "",
      jenisVerif: prefill.jenis_verif ?? prefill.jenisVerif ?? prefill.jenisVerifikasi ?? "",
      alasan: prefill.alasan ?? "",
      dokumen: null, // wajib upload ulang dokumen pendukung
    }));

    const ang = parseAnggaranMaybe(prefill.anggaran);
    if (ang && ang.length) setAnggaran(ang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(e) {
    const { name, value, files } = e.target;
    if (files) {
      const file = files[0];
      if (name === "foto") setForm((p) => ({ ...p, foto: file, fotoPreview: URL.createObjectURL(file) }));
      else setForm((p) => ({ ...p, [name]: file }));
    } else {
      setForm((p) => ({ ...p, [name]: value }));
    }
  }

  async function handleVerifyWallet() {
    setChainErr("");
    try {
      await getProviderChecked();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      if (walletMM && addr.toLowerCase() !== walletMM.toLowerCase()) {
        setChainErr(`Wallet salah! Gunakan wallet terdaftar: ${walletMM.slice(0, 10)}...${walletMM.slice(-6)}`);
        return;
      }
      setChainErr("");
    } catch (e) {
      setChainErr(e?.message || String(e));
    }
  }

  useEffect(() => {
    if (!window.ethereum) return;
    const onChainChanged = () => setChainErr(`Network berubah. Pastikan kamu pakai Hardhat Local (chainId ${HARDHAT_CHAIN_ID}).`);
    window.ethereum.on("chainChanged", onChainChanged);
    return () => {
      try {
        window.ethereum.removeListener("chainChanged", onChainChanged);
      } catch { }
    };
  }, []);

  function handleAnggaranChange(index, field, value) {
    setAnggaran((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }
  function addAnggaranRow() {
    setAnggaran((prev) => [...prev, { barang: "", harga: "" }]);
  }
  function removeAnggaranRow(index) {
    if (anggaran.length <= 1) return;
    setAnggaran((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await getProviderChecked();

      const wallet = walletMM;
      if (!wallet) {
        alert("Data wallet tidak ditemukan. Silakan logout dan login kembali.");
        return;
      }

      // Pastikan wallet yang aktif di MetaMask SAMA dengan wallet session
      const providerBrowser = new ethers.BrowserProvider(window.ethereum);
      const signer = await providerBrowser.getSigner();
      const addr = await signer.getAddress();
      if (wallet && addr.toLowerCase() !== wallet.toLowerCase()) {
        alert("Wallet MetaMask aktif berbeda dengan wallet akun. Harap gunakan wallet terdaftar!");
        setIsSubmitting(false);
        return;
      }

      let fotoUrl = "";

      // jika user tidak upload foto baru tapi ada preview url lama, kita pakai url lama (prefill)
      if (!form.foto && typeof form.fotoPreview === "string" && form.fotoPreview.startsWith("http")) {
        fotoUrl = form.fotoPreview;
      } else if (form.foto) {
        fotoUrl = await uploadImageToCloudinary(form.foto);
      }

      let dokumenUrl = "";
      let dokumenNama = "";
      if (form.dokumen) {
        const fileExt = form.dokumen.name.split(".").pop();
        const fileName = `${Date.now()}_${wallet}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("dokumen-pengajuan").upload(fileName, form.dokumen);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("dokumen-pengajuan").getPublicUrl(fileName);
        dokumenUrl = urlData.publicUrl;
        dokumenNama = form.dokumen.name;
      }

      // 2) on-chain submit — hanya perlu votingFee, stakeBond sudah fixed (0.05 ETH) di contract
      const onChainData = await submitCampaignOnChain({
        votingFeeEth: DEFAULT_VOTING_FEE_ETH,
      });

      // Tampilkan info stake yang dibayar
      console.log(`💰 Stake dibayar: ${CAMPAIGN_STAKE_BOND_ETH} ETH (fixed) + ${DEFAULT_VOTING_FEE_ETH} ETH (voting fee) = ${CAMPAIGN_STAKE_BOND_ETH + DEFAULT_VOTING_FEE_ETH} ETH total`);

      // 3) simpan supabase (pending prescreen)
      const id = await submitPengajuan(
        {
          ...form,
          foto: fotoUrl,
          fotoPreview: fotoUrl,
          dokumen: { url: dokumenUrl, nama: dokumenNama, tipe: form.dokumen?.type || "" },
          anggaran,
        },
        wallet
      );

      // 4) update blockchain fields (voting_contract masih null)
      const { error: updateError } = await supabase
        .from("pengajuan_campaign")
        .update({
          campaign_id: onChainData.campaignId,
          voting_contract: null,
          submit_tx_hash: onChainData.txHash,
          stake_bond_wei: onChainData.stakeBondWei,
          voting_fee_wei: onChainData.votingFeeWei,
          status: "pending",
        })
        .eq("id", id);

      if (updateError) {
        console.error("Gagal update data on-chain ke Supabase:", updateError);
        alert("Campaign terbuat di blockchain, tapi gagal sinkron ke database. Hubungi admin.");
      } else {
        setSubmittedId(id);
      }
    } catch (err) {
      console.error("Gagal submit:", err);
      alert(err?.shortMessage || err?.message || "Gagal mengajukan campaign.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleAjukanLagi() {
    if (fotoInputRef.current) fotoInputRef.current.value = "";
    if (dokumenInputRef.current) dokumenInputRef.current.value = "";
    setStep(1);
    setSubmittedId(null);
    setIsSubmitting(false);
    setForm(INITIAL_FORM);
    setAnggaran(INITIAL_ANGGARAN);
  }

  if (submittedId) {
    return (
      <div className="cf-wrapper cf-success-wrap">
        <div className="cf-success">
          <div className="cf-success-icon">
            <FiCheckCircle size={34} color="#22c55e" />
          </div>
          <h3 className="cf-success-title">Pengajuan Terkirim!</h3>
          <p className="cf-success-desc">
            Kampanye Anda sedang ditinjau admin.
            <br />
            ID Pengajuan: <code style={{ color: "#ffa757" }}>{submittedId}</code>
          </p>
          <div className="cf-success-actions">
            <button className="cf-success-btn" onClick={() => navigate("/daftar-campaign")}>
              Kembali ke Daftar Campaign
            </button>
            <button className="cf-success-btn-outline" onClick={handleAjukanLagi}>
              Ajukan Campaign Lain
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cf-wrapper">
      <button className="cf-back-top" onClick={() => navigate("/daftar-campaign")}>
        <FiArrowLeft size={14} /> Kembali ke Daftar Campaign
      </button>
      <div className="cf-split">
        <Sidebar step={step} />

        <div className="cf-form-area">
          {step === 1 && (
            <>
              <div className="cf-form-head">
                <h3>Info Kampanye</h3>
                <p>Langkah 1 dari 2, isi data kampanye kamu</p>
              </div>

              <div style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                padding: "12px 16px",
                borderRadius: "8px",
                marginBottom: "24px",
                fontSize: "13px",
                color: "#fca5a5",
                lineHeight: "1.5"
              }}>
                <strong>Penting:</strong> Proof hanya bisa disubmit setelah fundraising selesai. Durasi submit adalah 1 minggu, jadi perhatikan proof deadline Anda. Jika proof tidak disubmit maka akun Anda akan di ban.
              </div>

              <div className="cf-fields">
                <div className="cf-field">
                  <label className="cf-label">Judul Kampanye *</label>
                  <input
                    name="judul"
                    value={form.judul}
                    onChange={handleChange}
                    className="cf-input"
                    placeholder="Contoh: Bantu Korban Banjir Jawa Barat"
                  />
                </div>

                <div className="cf-field">
                  <label className="cf-label">Kategori *</label>
                  <select name="kategori" value={form.kategori} onChange={handleChange} className="cf-select">
                    <option value="">Pilih kategori...</option>
                    <option value="Bencana Alam">Bencana Alam</option>
                    <option value="Pendidikan">Pendidikan</option>
                    <option value="Kesehatan">Kesehatan</option>
                    <option value="Keagamaan">Keagamaan</option>
                    <option value="Lingkungan">Lingkungan</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div className="cf-field">
                  <label className="cf-label">Deskripsi Kampanye *</label>
                  <textarea
                    name="deskripsi"
                    value={form.deskripsi}
                    onChange={handleChange}
                    className="cf-textarea"
                    rows={4}
                    placeholder="Jelaskan tujuan kampanye..."
                  />
                </div>

                <div className="cf-field-row">
                  <div className="cf-field">
                    <label className="cf-label">Target Dana (ETH) *</label>
                    <input
                      name="target"
                      type="number"
                      value={form.target}
                      onChange={handleChange}
                      className="cf-input"
                      placeholder="Contoh: 5.0"
                      min="0.1"
                      step="0.1"
                    />
                  </div>
                  <div className="cf-field">
                    <label className="cf-label">Durasi (Hari) *</label>
                    <input
                      name="durasi"
                      type="number"
                      value={form.durasi}
                      onChange={handleChange}
                      className="cf-input"
                      placeholder="Contoh: 30"
                      min="7"
                      max="180"
                    />
                  </div>
                </div>

                <div className="cf-field">
                  <label className="cf-label">Foto Cover *</label>
                  <div className="cf-upload-box">
                    <input
                      ref={fotoInputRef}
                      type="file"
                      name="foto"
                      accept="image/*"
                      onChange={handleChange}
                      className="cf-file-input"
                      id="foto-upload"
                    />
                    <label htmlFor="foto-upload" className="cf-upload-label">
                      {form.foto ? (
                        <span className="cf-upload-filename">
                          <svg width="13" height="13" fill="none" stroke="#22c55e" strokeWidth="2.5" viewBox="0 0 24 24">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          {form.foto.name}
                        </span>
                      ) : (
                        <>
                          <div className="cf-upload-icon">
                            <svg width="15" height="15" fill="none" stroke="#ffa757" strokeWidth="2" viewBox="0 0 24 24">
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                          </div>
                          <span>Klik untuk upload foto</span>
                          <span className="cf-upload-hint">PNG, JPG maks 5MB</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              <div className="cf-form-footer cf-form-footer-single">
                <button
                  className="cf-btn-next"
                  onClick={() => setStep(2)}
                  disabled={!form.judul || !form.kategori || !form.deskripsi || !form.target || !form.durasi || (!form.foto && !form.fotoPreview) || isBanned}
                >
                  {isBanned ? (
                    <><FiSlash size={14} /> Akun Anda Di ban</>
                  ) : (
                    <>Selanjutnya <FiChevronRight size={15} /></>
                  )}
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="cf-form-head">
                <h3>Data Organizer</h3>
                <p>Langkah 2 dari 2 — identitas, wallet & rincian anggaran</p>
              </div>

              <div className="cf-fields">
                <div className="cf-field">
                  <label className="cf-label">Nama Organisasi / Individu *</label>
                  <input
                    name="namaOrg"
                    value={form.namaOrg}
                    onChange={handleChange}
                    className="cf-input"
                    placeholder="Masukkan nama resmi..."
                  />
                </div>

                <div className="cf-field">
                  <label className="cf-label">Alamat Wallet (MetaMask)</label>
                  <div className="cf-wallet-row">
                    <input
                      className="cf-input cf-input-disabled"
                      value={walletMM || "(tidak ada data wallet — login ulang)"}
                      disabled
                      style={{
                        fontFamily: "'Courier New', monospace",
                        fontSize: "11.5px",
                        color: "rgba(255,200,160,0.6)",
                      }}
                    />
                    <button className="cf-connect-btn" type="button" onClick={handleVerifyWallet} disabled={isSubmitting}>
                      Verifikasi
                    </button>
                  </div>
                  {chainErr && <p style={{ marginTop: 6, fontSize: 12, color: "#fecaca" }}>{chainErr}</p>}
                  <p className="cf-field-note">
                    Wallet diambil dari data registrasi Anda. Pastikan MetaMask aktif di chainId {HARDHAT_CHAIN_ID}.
                  </p>
                </div>

                <div className="cf-field">
                  <label className="cf-label">Jenis Verifikasi *</label>
                  <select name="jenisVerif" value={form.jenisVerif} onChange={handleChange} className="cf-select">
                    <option value="">Pilih jenis verifikasi...</option>
                    <option value="KTP (Individu)">KTP (Individu)</option>
                    <option value="SK Kemenkumham">SK Kemenkumham (Yayasan/LSM)</option>
                    <option value="SK Sekolah">SK Sekolah / Universitas</option>
                    <option value="SK Masjid">SK Masjid / Lembaga Keagamaan</option>
                  </select>
                </div>

                <div className="cf-field">
                  <label className="cf-label">Dokumen Pendukung (KTP/SK) *</label>
                  <div className="cf-upload-box">
                    <input
                      ref={dokumenInputRef}
                      type="file"
                      name="dokumen"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleChange}
                      className="cf-file-input"
                      id="dokumen-upload"
                    />
                    <label htmlFor="dokumen-upload" className="cf-upload-label">
                      {form.dokumen ? (
                        <span className="cf-upload-filename">
                          <svg width="13" height="13" fill="none" stroke="#22c55e" strokeWidth="2.5" viewBox="0 0 24 24">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          {form.dokumen.name}
                        </span>
                      ) : (
                        <>
                          <div className="cf-upload-icon">
                            <svg width="15" height="15" fill="none" stroke="#ffa757" strokeWidth="2" viewBox="0 0 24 24">
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                          </div>
                          <span>Upload dokumen</span>
                          <span className="cf-upload-hint">PDF, JPG, PNG maks 10MB</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                <div className="cf-field">
                  <label className="cf-label">Alasan Membuka Campaign *</label>
                  <textarea
                    name="alasan"
                    value={form.alasan}
                    onChange={handleChange}
                    className="cf-textarea"
                    rows={3}
                    placeholder="Jelaskan mengapa Anda membuka campaign ini..."
                  />
                </div>
              </div>

              <div className="cf-table-section">
                <div className="cf-table-header">
                  <span className="cf-table-label">Rincian Anggaran Dana</span>
                  <button className="cf-add-row-btn" type="button" onClick={addAnggaranRow}>
                    Tambah Baris
                  </button>
                </div>
                <div className="cf-table-wrap">
                  <table className="cf-table">
                    <thead>
                      <tr>
                        <th>No</th>
                        <th>Nama Barang / Kebutuhan</th>
                        <th>Estimasi Harga (ETH)</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {anggaran.map((row, i) => (
                        <tr key={i} className="cf-table-row">
                          <td>{i + 1}</td>
                          <td>
                            <input
                              className="cf-t-inp"
                              placeholder="Contoh: Sembako"
                              value={row.barang}
                              onChange={(e) => handleAnggaranChange(i, "barang", e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              className="cf-t-inp"
                              placeholder="0.05"
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.harga}
                              onChange={(e) => handleAnggaranChange(i, "harga", e.target.value)}
                            />
                          </td>
                          <td>
                            <button className="cf-del-btn" type="button" onClick={() => removeAnggaranRow(i)}>
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="cf-form-footer">
                <button className="cf-btn-next" onClick={() => setStep(1)}>
                  <FiChevronLeft size={15} /> Sebelumnya
                </button>
                <button
                  className="cf-btn-next"
                  onClick={handleSubmit}
                  disabled={!form.namaOrg || !form.jenisVerif || !form.alasan || !form.dokumen || isSubmitting}
                >
                  {isSubmitting ? (
                    <>Mengirim...</>
                  ) : (
                    <>
                      <FiCheckCircle size={15} /> Ajukan Verifikasi
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CampaignForm;