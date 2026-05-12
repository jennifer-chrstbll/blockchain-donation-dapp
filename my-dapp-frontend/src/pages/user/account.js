import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiHeart, FiLock, FiLogOut, FiExternalLink,
  FiEdit2, FiCheckCircle, FiAlertCircle
} from "react-icons/fi";
import NavbarUser from "../../components/navbar-user";
import "../../styles/user/account.css";

// ================= HELPER =================
function getCurrentUser() {
  try {
    return JSON.parse(sessionStorage.getItem("currentUser")) || {};
  } catch {
    return {};
  }
}

function getInisial(nama = "") {
  return nama
    .split(" ")
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "??";
}

// ================= DUMMY DATA =================
const DUMMY_RIWAYAT = [
  { id:1, kampanye: "Bantu Korban Banjir Jawa Barat", jumlah: "0.15 ETH", tanggal: "14 Feb 2026", txHash: "0xdef456abc789" },
  { id:2, kampanye: "Bantu Korban Banjir Jawa Barat", jumlah: "0.10 ETH", tanggal: "1 Mar 2026",  txHash: "0xabc123def456" },
  { id:3, kampanye: "Beasiswa Anak Yatim Sulawesi",   jumlah: "0.05 ETH", tanggal: "25 Feb 2026", txHash: "0xbcd234efa567" },
  { id:4, kampanye: "Renovasi Masjid Al-Ikhlas",      jumlah: "0.08 ETH", tanggal: "20 Feb 2026", txHash: "0xcde345fab678" },
];

function AccountUser() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("riwayat");
  const [form, setForm] = useState({ lama: "", baru: "", konfirmasi: "" });
  const [pwMsg, setPwMsg] = useState(null);

  const u = getCurrentUser();
  const nama = u.nama || "User";
  const email = u.email || "-";
  const inisial = getInisial(nama);

  // 🔥 WALLET STATE (REAL SOURCE)
  const [wallet, setWallet] = useState(u.wallet || "");

  // ================= SYNC METAMASK =================
  useEffect(() => {
    async function syncWallet() {
      if (!window.ethereum) return;

      try {
        const accounts = await window.ethereum.request({
          method: "eth_accounts",
        });

        if (accounts.length > 0) {
          const activeWallet = accounts[0];

          setWallet(activeWallet);

          //UPDATE SESSION BIAR SEMUA PAGE SAMA
          const user = getCurrentUser();
          user.wallet = activeWallet;
          sessionStorage.setItem("currentUser", JSON.stringify(user));

        console.log("[SYNC] Wallet synced:", activeWallet);
        }
      } catch (err) {
        console.log("[ERROR] Gagal sync wallet:", err);
      }
    }

    syncWallet();
  }, []);

  // ================= PASSWORD =================
  function handleGantiPassword(e) {
    e.preventDefault();

    if (!form.lama || !form.baru || !form.konfirmasi) {
      setPwMsg({ type: "error", text: "Semua field wajib diisi." });
      return;
    }

    if (form.baru !== form.konfirmasi) {
      setPwMsg({ type: "error", text: "Password baru tidak cocok." });
      return;
    }

    if (form.baru.length < 8) {
      setPwMsg({ type: "error", text: "Password minimal 8 karakter." });
      return;
    }

    setPwMsg({ type: "success", text: "Password berhasil diperbarui!" });
    setForm({ lama: "", baru: "", konfirmasi: "" });
  }

  // ================= LOGOUT =================
  function handleLogout() {
    sessionStorage.removeItem("currentUser");
    navigate("/login");
  }

  // ================= UI =================
  return (
    <div className="ac-wrapper">
      <NavbarUser inisial={inisial} showSearch={false} />

      <main className="ac-main">

        {/* PROFILE */}
        <div className="ac-profile-card">
          <div className="ac-profile-left">
            <div className="ac-profile-avatar">{inisial}</div>

            <div className="ac-profile-info">
              <h1 className="ac-profile-nama">{nama}</h1>
              <p className="ac-profile-email">{email}</p>

              <div className="ac-wallet-row">
                <span className="ac-wallet-dot" />

                <code className="ac-wallet-addr">
                  {wallet
                    ? `${wallet.slice(0, 10)}...${wallet.slice(-6)}`
                    : "Belum connect"}
                </code>

                <span className="ac-wallet-badge">
                  {wallet ? "Terhubung" : "Tidak Terhubung"}
                </span>
              </div>

              <p className="ac-bergabung">
                Bergabung sejak Maret 2026
              </p>
            </div>
          </div>

          {/* STATS */}
          <div className="ac-profile-stats">
            <div className="ac-stat">
              <p className="ac-stat-value">0.38 ETH</p>
              <p className="ac-stat-label">Total Donasi</p>
            </div>

            <div className="ac-stat-divider" />

            <div className="ac-stat">
              <p className="ac-stat-value">4</p>
              <p className="ac-stat-label">Kampanye Didukung</p>
            </div>

            <div className="ac-stat-divider" />

            <div className="ac-stat">
              <p className="ac-stat-value">{DUMMY_RIWAYAT.length}</p>
              <p className="ac-stat-label">Total Transaksi</p>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="ac-tabs">
          <button
            className={"ac-tab" + (activeTab === "riwayat" ? " active" : "")}
            onClick={() => setActiveTab("riwayat")}
          >
            <FiHeart size={14} /> Riwayat Donasi
          </button>

          <button
            className={"ac-tab" + (activeTab === "password" ? " active" : "")}
            onClick={() => setActiveTab("password")}
          >
            <FiLock size={14} /> Ganti Password
          </button>
        </div>

        {/* RIWAYAT */}
        {activeTab === "riwayat" && (
          <div className="ac-card">
            <div className="ac-card-header">
              <FiHeart size={15} color="#ffa757" />
              <h3 className="ac-card-title">Riwayat Donasi Saya</h3>
            </div>

            <div className="ac-riwayat-list">
              {DUMMY_RIWAYAT.map((r) => (
                <div key={r.id} className="ac-riwayat-item">
                  <div className="ac-riwayat-info">
                    <p className="ac-riwayat-kampanye">{r.kampanye}</p>
                    <p className="ac-riwayat-tanggal">{r.tanggal}</p>
                  </div>

                  <div className="ac-riwayat-right">
                    <p className="ac-riwayat-jumlah">{r.jumlah}</p>
                    <a
                      href={"https://etherscan.io/tx/" + r.txHash}
                      target="_blank"
                      rel="noreferrer"
                      className="ac-riwayat-tx"
                    >
                      TX <FiExternalLink size={10} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PASSWORD */}
        {activeTab === "password" && (
          <div className="ac-card ac-card-narrow">

            <div className="ac-card-header">
              <FiLock size={15} color="#ffa757" />
              <h3 className="ac-card-title">Ganti Password</h3>
            </div>

            {pwMsg && (
              <div className={"ac-pw-msg " + pwMsg.type}>
                {pwMsg.type === "success"
                  ? <FiCheckCircle size={15} />
                  : <FiAlertCircle size={15} />}
                {pwMsg.text}
              </div>
            )}

            <div className="ac-form">

              <input
                type="password"
                className="ac-input"
                placeholder="Password Lama"
                value={form.lama}
                onChange={(e) => setForm({ ...form, lama: e.target.value })}
              />

              <input
                type="password"
                className="ac-input"
                placeholder="Password Baru"
                value={form.baru}
                onChange={(e) => setForm({ ...form, baru: e.target.value })}
              />

              <input
                type="password"
                className="ac-input"
                placeholder="Konfirmasi Password"
                value={form.konfirmasi}
                onChange={(e) => setForm({ ...form, konfirmasi: e.target.value })}
              />

              <button className="ac-btn-submit" onClick={handleGantiPassword}>
                <FiEdit2 size={15} /> Perbarui Password
              </button>

            </div>
          </div>
        )}

        <button className="ac-btn-logout" onClick={handleLogout}>
          <FiLogOut size={16} /> Keluar dari Akun
        </button>

      </main>
    </div>
  );
}

export default AccountUser;