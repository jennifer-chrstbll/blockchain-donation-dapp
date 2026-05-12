import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiMail, FiLock, FiEye, FiEyeOff,
  FiShield, FiAlertCircle, FiArrowLeft
} from "react-icons/fi";
import "../styles/login.css";
import bgImage from "../assets/images/landing-pages.png";
import { ethers } from "ethers";
import { supabase } from "../web3/supabaseClient";

function Login() {
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", password: "" });
  const navigate = useNavigate();

  // TETAP SAMA DENGAN ASLI — connect wallet khusus user
  async function connectWallet() {
    if (!window.ethereum) return null;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      return accounts[0];
    } catch {
      return null;
    }
  }

  // Ganti DUMMY_ACCOUNTS → Supabase, logika admin/user TETAP SAMA
  async function handleMasuk(e) {
    e.preventDefault();
    setError("");

    if (!form.email || !form.password) {
      setError("Email dan password wajib diisi.");
      return;
    }

    setLoading(true);

    try {
      // 1. Login ke Supabase Auth
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (signInError) {
        if (signInError.message.includes("Email not confirmed")) {
          setError("Email belum dikonfirmasi. Cek inbox kamu dulu ya!");
        } else {
          setError("Email atau password salah.");
        }
        setLoading(false);
        return;
      }

      // 2. Ambil profile dari tabel profiles
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, nama, wallet_address")
        .eq("id", data.user.id)
        .single();

      if (profileError || !profile) {
        setError("Gagal mengambil data profil.");
        setLoading(false);
        return;
      }
      // Wajib connect MetaMask
      const wallet = await connectWallet();

      if (!wallet) {
        setError("Wajib connect MetaMask dulu ya!");
        setLoading(false);
        return;
      }

      // Cek peran admin via smart contract (Multi-Admin Override)
      let role = profile.role;
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const smAddr = process.env.REACT_APP_STAKINGMANAGER_ADDRESS;
        if (smAddr) {
          const sm = new ethers.Contract(smAddr, ["function isAdmin(address) view returns (bool)"], provider);
          const isAdm = await sm.isAdmin(wallet);
          if (isAdm) role = "admin";
        }
      } catch (err) {
        console.warn("Gagal cek role admin di contract:", err);
      }

      // Update wallet_address di database setiap login
      await supabase
        .from("profiles")
        .update({ wallet_address: wallet })
        .eq("id", data.user.id);

      const user = {
        id: data.user.id,
        nama: role === "admin" ? (profile.nama === "User" ? "Admin DonasiChain" : profile.nama) : profile.nama,
        email: data.user.email,
        wallet: wallet,
        role: role,
      };

      sessionStorage.setItem("currentUser", JSON.stringify(user));
      setLoading(false);

      if (role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/dashboard");
      }

    } catch (e) {
      setError(e.message || "Terjadi kesalahan.");
      setLoading(false);
    }
  }


async function handleLoginWallet() {
    setError("");
    if (!window.ethereum) {
      setError("MetaMask tidak terdeteksi!");
      return;
    }
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = (await signer.getAddress()).toLowerCase(); // Pakai lowercase agar aman

      // 1. CEK ADMIN VIA SMART CONTRACT
      let role = "user";
      try {
        const smAddr = process.env.REACT_APP_STAKINGMANAGER_ADDRESS;
        if (smAddr) {
          const sm = new ethers.Contract(smAddr, ["function isAdmin(address) view returns (bool)"], provider);
          const isAdm = await sm.isAdmin(address);
          if (isAdm) role = "admin";
        }
      } catch (err) {
        console.warn("Gagal cek role admin di contract:", err);
      }

      // 2. Ambil data profil dari Supabase
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .ilike("wallet_address", address)
        .single();

      // Cek apakah user terdaftar (kecuali dia admin baru yang belum ada di profil)
      if (!profile && role !== "admin") {
        throw new Error("Wallet ini belum terdaftar di DonasiChain.");
      }

      // Gunakan optional chaining (?.) untuk menghindari crash jika profile null
      const finalRole = role === "admin" ? "admin" : (profile?.role || "user");

      const user = {
        id: profile?.id || `admin-${address}`,
        nama: profile?.nama || (finalRole === "admin" ? "Admin DonasiChain" : "User"),
        email: profile?.email || "",
        wallet: address,
        role: finalRole,
      };

      sessionStorage.setItem("currentUser", JSON.stringify(user));

      // Navigasi berdasarkan role yang sudah divalidasi
      if (finalRole === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/dashboard");
      }

    } catch (e) {
      console.error("Login Wallet Error:", e);
      setError(e.message || "Gagal login dengan wallet.");
    } finally {
      setLoading(false);
    }
  }




  return (
    <div
      className="lr-wrapper login-page"
      style={{
        backgroundImage: `linear-gradient(rgba(10, 22, 40, 0.75), rgba(10, 22, 40, 0.92)), url(${bgImage})`,
      }}
    >
      <Link to="/" className="lr-back">
        <FiArrowLeft size={15} /> Kembali ke Beranda
      </Link>

      <div className="lr-logo">Donasi<span>Chain</span></div>

      <div className="lr-card">
        <div className="lr-card-header">
          <p className="lr-form-title">Selamat Datang Kembali</p>
          <p className="lr-form-sub">Masuk ke akun DonasiChain Anda</p>
        </div>

        {error && (
          <div className="lr-alert lr-alert-error">
            <FiAlertCircle size={15} /> {error}
          </div>
        )}

        {/* FORM EMAIL + PASSWORD — sama persis dengan asli */}
        <form className="lr-form" onSubmit={handleMasuk}>
          <div className="lr-field">
            <label className="lr-label">Email</label>
            <div className="lr-input-wrapper">
              <FiMail size={15} className="lr-input-icon" />
              <input
                type="email"
                className="lr-input"
                placeholder="nama@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>

          <div className="lr-field">
            <label className="lr-label">Password</label>
            <div className="lr-input-wrapper">
              <FiLock size={15} className="lr-input-icon" />
              <input
                type={showPass ? "text" : "password"}
                className="lr-input"
                placeholder="Masukkan password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button
                type="button"
                className="lr-eye-btn"
                onClick={() => setShowPass(!showPass)}
              >
                {showPass ? <FiEyeOff size={15} /> : <FiEye size={15} />}
              </button>
            </div>
          </div>

          <button type="submit" className="lr-btn-submit" disabled={loading}>
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>

        {/* DIVIDER + LOGIN WALLET */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.15)" }} />
          <span style={{ fontSize: 12, opacity: 0.5 }}>atau</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.15)" }} />
        </div>

        <button
          className="lr-btn-wallet"
          onClick={handleLoginWallet}
          disabled={loading}
          style={{ width: "100%" }}
        >
          <span></span>
          {loading ? "Mengecek wallet..." : "Masuk dengan MetaMask"}
        </button>

        <p className="lr-switch" style={{ marginTop: 16 }}>
          Belum punya akun?{" "}
          <Link to="/register" className="lr-switch-link">
            Daftar sekarang
          </Link>
        </p>

        <div className="lr-verified-badge">
          <FiShield size={12} color="#22c55e" /> Verified by Smart Contract
        </div>
      </div>
    </div>
  );
}

export default Login;