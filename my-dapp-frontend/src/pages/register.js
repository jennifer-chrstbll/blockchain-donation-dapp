import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiMail, FiLock, FiUser, FiEye, FiEyeOff,
  FiShield, FiAlertCircle, FiCheckCircle, FiArrowLeft
} from "react-icons/fi";
import emailjs from "@emailjs/browser";
import "../styles/register.css";
import bgImage from "../assets/images/landing-pages.png";
import { ethers } from "ethers";
import { HARDHAT_CHAIN_ID } from "../web3/config";
import { supabase } from "../web3/supabaseClient";

// ── Konfigurasi EmailJS ──────────────────────────────────────────
const EMAILJS_SERVICE_ID = "service_188s79n";
const EMAILJS_TEMPLATE_ID = "template_4sv2yti";
const EMAILJS_PUBLIC_KEY = "l0Rip2Yk6TklckB0W";

// ── Email yang diizinkan ─────────────────────────────────────────
const ALLOWED_EMAIL_DOMAINS = [
  "gmail.com", "googlemail.com",
  "student.uph.edu",
  "hotmail.com", "hotmail.co.id",
  "live.com", "live.co.id", "msn.com",
  "yahoo.com", "yahoo.co.id", "yahoo.co.uk", "ymail.com",
];

function isEmailDomainAllowed(email) {
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2) return false;
  return ALLOWED_EMAIL_DOMAINS.includes(parts[1]);
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Kirim OTP via EmailJS ────────────────────────────────────────
async function sendOTPEmail(email, otp, nama) {
  const result = await emailjs.send(
    EMAILJS_SERVICE_ID,
    EMAILJS_TEMPLATE_ID,
    {
      to_email: email,
      otp_code: otp,
      nama: nama,
    },
    EMAILJS_PUBLIC_KEY
  );

  if (result.status !== 200) {
    throw new Error("Gagal mengirim email OTP. Coba lagi.");
  }
}

// ── Komponen Utama ───────────────────────────────────────────────
function Register() {
  const [showPass, setShowPass] = useState(false);
  const [showPassConfirm, setShowPassConfirm] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Tahap: "form" | "otp"
  const [step, setStep] = useState("form");
  const [otpInput, setOtpInput] = useState("");
  const [pendingData, setPendingData] = useState(null);

  const [form, setForm] = useState({
    nama: "", email: "", password: "", konfirmasi: "",
  });

  const navigate = useNavigate();

  // ── Wallet helpers ─────────────────────────────────────────────
  function resetWalletState() {
    setWalletConnected(false);
    setWalletAddress("");
  }

  async function getProviderChecked() {
    if (!window.ethereum) throw new Error("MetaMask tidak terdeteksi.");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== HARDHAT_CHAIN_ID) {
      throw new Error(
        `Network salah. Pindah ke Hardhat Local (chainId ${HARDHAT_CHAIN_ID}).`
      );
    }
    return provider;
  }

  async function handleConnectWallet() {
    setError("");
    setLoading(true);
    try {
      if (!window.ethereum) throw new Error("MetaMask tidak terdeteksi.");
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const checkedProvider = await getProviderChecked();
      const signer = await checkedProvider.getSigner();
      const address = await signer.getAddress();
      setWalletConnected(true);
      setWalletAddress(address);
      sessionStorage.setItem("connectedWallet", address);
    } catch (e) {
      resetWalletState();
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!window.ethereum) return;
    const onAccountsChanged = (accounts) => {
      if (!accounts || accounts.length === 0) { resetWalletState(); return; }
      setWalletConnected(true);
      setWalletAddress(accounts[0]);
    };
    const onChainChanged = () => {
      resetWalletState();
      setError("Network berubah. Silakan connect MetaMask lagi.");
    };
    window.ethereum.on("accountsChanged", onAccountsChanged);
    window.ethereum.on("chainChanged", onChainChanged);
    return () => {
      try {
        window.ethereum.removeListener("accountsChanged", onAccountsChanged);
        window.ethereum.removeListener("chainChanged", onChainChanged);
      } catch { }
    };
  }, []);

  // ── STEP 1: Validasi form → simpan OTP → kirim email ──────────
  async function handleDaftar(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validasi form
    if (!form.nama || !form.email || !form.password || !form.konfirmasi) {
      setError("Semua field wajib diisi."); return;
    }
    if (!isEmailDomainAllowed(form.email)) {
      setError("Email tidak valid. Gunakan Gmail, Hotmail, Yahoo, atau email kampus."); return;
    }
    if (form.password !== form.konfirmasi) {
      setError("Password dan konfirmasi tidak cocok."); return;
    }
    if (form.password.length < 8) {
      setError("Password minimal 8 karakter."); return;
    }
    if (!walletConnected) {
      setError("Wajib hubungkan wallet MetaMask terlebih dahulu."); return;
    }

    setLoading(true);
    try {
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // Hapus OTP lama untuk email ini
      await supabase
        .from("otp_verifications")
        .delete()
        .eq("email", form.email);

      // Simpan OTP baru ke Supabase
      const { error: otpError } = await supabase
        .from("otp_verifications")
        .insert({ email: form.email, otp, expires_at: expiresAt });

      if (otpError) throw new Error("Gagal menyimpan OTP ke database.");

      // Kirim email via EmailJS
      await sendOTPEmail(form.email, otp, form.nama);

      // Simpan data sementara untuk dipakai setelah OTP verified
      setPendingData({
        email: form.email,
        password: form.password,
        nama: form.nama,
        walletAddress: walletAddress,
      });

      setSuccess(`Kode OTP dikirim ke ${form.email}. Cek inbox (atau folder spam).`);
      setStep("otp");

    } catch (e) {
      console.error("ERROR handleDaftar:", e);
      setError(e.message || "Gagal mengirim OTP. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }






  async function handleVerifyOTP(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Ambil OTP dari Supabase
      const { data: otpRecord, error: fetchError } = await supabase
        .from("otp_verifications")
        .select("*")
        .eq("email", pendingData.email)
        .eq("otp", otpInput.trim())
        .eq("used", false)
        .single();

      if (fetchError || !otpRecord) {
        setError("Kode OTP salah. Periksa kembali.");
        setLoading(false);
        return;
      }

      // 2. Cek expired
      if (new Date() > new Date(otpRecord.expires_at)) {
        setError("Kode OTP sudah kedaluwarsa. Silakan daftar ulang.");
        setLoading(false);
        return;
      }

      // 3. Tandai OTP sebagai sudah dipakai
      await supabase
        .from("otp_verifications")
        .update({ used: true })
        .eq("id", otpRecord.id);

      // 4. Daftar ke Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: pendingData.email,
        password: pendingData.password,
        options: {
          data: {
            nama: pendingData.nama,
            wallet_address: pendingData.walletAddress,
          },
        },
      });

      if (signUpError) throw signUpError;

      // ❗ Kalau email sudah terdaftar
      if (data?.user?.identities?.length === 0) {
        setError("Email sudah terdaftar. Silakan login.");
        setLoading(false);
        return;
      }

      // UPSERT KE PROFILES (Gunakan upsert untuk menghindari bentrok dengan trigger database)
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: data.user.id,
          nama: pendingData.nama,
          email: pendingData.email,
          wallet_address: pendingData.walletAddress,
          role: "user",
        }, { onConflict: "id" });

      if (profileError) {
        console.error("Profile Error:", profileError);
        throw new Error("Gagal menyimpan profil: " + profileError.message);
      }

      setSuccess("Verifikasi berhasil! Akun dibuat. Mengarahkan ke halaman login...");
      setTimeout(() => navigate("/login"), 3000);

    } catch (e) {
      console.error("ERROR handleVerifyOTP:", e);
      setError(e.message || "Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }





  // ── RENDER: Halaman OTP ────────────────────────────────────────
  if (step === "otp") {
    return (
      <div
        className="lr-wrapper register-page"
        style={{
          backgroundImage: `linear-gradient(rgba(10,22,40,0.75),rgba(10,22,40,0.92)),url(${bgImage})`,
        }}
      >
        <div className="lr-logo">Donasi<span>Chain</span></div>
        <div className="lr-card">
          <div className="lr-card-header">
            <p className="lr-form-title">Verifikasi Email</p>
            <p className="lr-form-sub">
              Masukkan kode 6 digit yang dikirim ke<br />
              <strong>{pendingData?.email}</strong>
            </p>
          </div>

          {error && <div className="lr-alert lr-alert-error">  <FiAlertCircle size={15} /> {error}   </div>}
          {success && <div className="lr-alert lr-alert-success"><FiCheckCircle size={15} /> {success} </div>}

          <form className="lr-form" onSubmit={handleVerifyOTP}>
            <div className="lr-field">
              <label className="lr-label">Kode OTP</label>
              <div className="lr-input-wrapper">
                <FiShield size={15} className="lr-input-icon" />
                <input
                  type="text"
                  className="lr-input"
                  placeholder="Contoh: 482910"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>

            <button
              type="submit"
              className="lr-btn-submit"
              disabled={loading || otpInput.length !== 6}
            >
              {loading
                ? <span className="lr-loading"><span className="lr-spinner" /> Memverifikasi...</span>
                : "Verifikasi & Buat Akun"
              }
            </button>

            <button
              type="button"
              className="lr-switch-link"
              style={{ background: "none", border: "none", cursor: "pointer", marginTop: 8 }}
              onClick={() => { setStep("form"); setError(""); setSuccess(""); }}
            >
              ← Kembali ke form
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── RENDER: Halaman Form Daftar ────────────────────────────────
  return (
    <div
      className="lr-wrapper register-page"
      style={{
        backgroundImage: `linear-gradient(rgba(10,22,40,0.75),rgba(10,22,40,0.92)),url(${bgImage})`,
      }}
    >
      <Link to="/" className="lr-back"><FiArrowLeft size={15} /> Kembali ke Beranda</Link>
      <div className="lr-logo">Donasi<span>Chain</span></div>
      <div className="lr-card">
        <div className="lr-card-header">
          <p className="lr-form-title">Buat Akun Baru</p>
          <p className="lr-form-sub">Bergabung dan mulai berdonasi secara transparan</p>
        </div>

        {error && <div className="lr-alert lr-alert-error">  <FiAlertCircle size={15} /> {error}   </div>}
        {success && <div className="lr-alert lr-alert-success"><FiCheckCircle size={15} /> {success} </div>}

        <form className="lr-form" onSubmit={handleDaftar}>

          {/* Nama */}
          <div className="lr-field">
            <label className="lr-label">Nama Lengkap</label>
            <div className="lr-input-wrapper">
              <FiUser size={15} className="lr-input-icon" />
              <input
                type="text" className="lr-input"
                placeholder="Masukkan nama lengkap"
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
              />
            </div>
          </div>

          {/* Email */}
          <div className="lr-field">
            <label className="lr-label">Email</label>
            <div className="lr-input-wrapper">
              <FiMail size={15} className="lr-input-icon" />
              <input
                type="email" className="lr-input"
                placeholder="nama@gmail.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <p style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>
              Gmail, Hotmail, Yahoo, atau email kampus (@student.uph.edu)
            </p>
          </div>

          {/* Password */}
          <div className="lr-field">
            <label className="lr-label">Password</label>
            <div className="lr-input-wrapper">
              <FiLock size={15} className="lr-input-icon" />
              <input
                type={showPass ? "text" : "password"} className="lr-input"
                placeholder="Minimal 8 karakter"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button type="button" className="lr-eye-btn" onClick={() => setShowPass(!showPass)}>
                {showPass ? <FiEyeOff size={15} /> : <FiEye size={15} />}
              </button>
            </div>
          </div>

          {/* Konfirmasi Password */}
          <div className="lr-field">
            <label className="lr-label">Konfirmasi Password</label>
            <div className="lr-input-wrapper">
              <FiLock size={15} className="lr-input-icon" />
              <input
                type={showPassConfirm ? "text" : "password"} className="lr-input"
                placeholder="Ulangi password"
                value={form.konfirmasi}
                onChange={(e) => setForm({ ...form, konfirmasi: e.target.value })}
              />
              <button type="button" className="lr-eye-btn" onClick={() => setShowPassConfirm(!showPassConfirm)}>
                {showPassConfirm ? <FiEyeOff size={15} /> : <FiEye size={15} />}
              </button>
            </div>
            {form.konfirmasi && (
              <p className={`lr-match-hint ${form.password === form.konfirmasi ? "match" : "nomatch"}`}>
                {form.password === form.konfirmasi ? "Password cocok" : "Password tidak cocok"}
              </p>
            )}
          </div>

          {/* Wallet MetaMask */}
          <div className="lr-wallet-section">
            <div className="lr-wallet-label-row">
              <label className="lr-label">Wallet MetaMask</label>
              <span className="lr-wallet-required">Wajib</span>
            </div>
            {!walletConnected ? (
              <button
                type="button" className="lr-btn-wallet"
                onClick={handleConnectWallet} disabled={loading}
              >
                {loading
                  ? <span className="lr-loading"><span className="lr-spinner" /> Menghubungkan...</span>
                  : <><span className="lr-metamask-icon"></span> Hubungkan MetaMask</>
                }
              </button>
            ) : (
              <div className="lr-wallet-connected">
                <div className="lr-wallet-dot-green" />
                <div className="lr-wallet-info">
                  <p className="lr-wallet-connected-label">Wallet terhubung</p>
                  <code className="lr-wallet-addr">
                    {walletAddress.slice(0, 12)}...{walletAddress.slice(-6)}
                  </code>
                </div>
                <FiCheckCircle size={18} color="#22c55e" />
              </div>
            )}
            <p className="lr-wallet-note">
              <FiShield size={11} /> Wallet digunakan untuk transaksi donasi. Tidak ada akses ke aset tanpa konfirmasi.
            </p>
          </div>

          <button type="submit" className="lr-btn-submit" disabled={loading}>
            {loading
              ? <span className="lr-loading"><span className="lr-spinner" /> Mengirim OTP...</span>
              : "Kirim Kode Verifikasi"
            }
          </button>

          <p className="lr-switch">
            Sudah punya akun?{" "}
            <Link to="/login" className="lr-switch-link">Masuk di sini</Link>
          </p>
        </form>

        <div className="lr-verified-badge">
          <FiShield size={12} color="#22c55e" /> Verified by Smart Contract
        </div>
      </div>
    </div>
  );
}

export default Register;