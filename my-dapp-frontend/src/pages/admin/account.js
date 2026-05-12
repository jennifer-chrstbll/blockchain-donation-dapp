import { useState } from "react";
import {
  FiLock, FiLogOut, FiEdit2,
  FiCheckCircle, FiAlertCircle, FiShield, FiUser
} from "react-icons/fi";
import NavbarAdmin from "../../components/navbar-admin";
import "../../styles/admin/account.css";

function AccountAdmin() {
  const [form, setForm]   = useState({ lama: "", baru: "", konfirmasi: "" });
  const [pwMsg, setPwMsg] = useState(null);
  const [menu, setMenu]   = useState("password"); // "password" | "profil"

  // 1. Ambil data pengguna asli yang disimpan saat proses Login
  const currentUser = JSON.parse(sessionStorage.getItem("currentUser") || "{}");
  
  const namaAdmin = currentUser.nama || "Administrator";
  // Gunakan email asli dari database
  const emailAdmin = currentUser.email || "Email tidak ditemukan"; 
  const roleAdmin = currentUser.role === "admin" ? "Super Admin" : (currentUser.role || "Admin");

  // 2. Buat inisial otomatis berdasarkan nama asli
  const inisialAdmin = namaAdmin
    .split(" ")
    .map(kata => kata[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "AD";

  const a = {
    nama: namaAdmin,
    inisial: inisialAdmin,
    email: emailAdmin,
    role: roleAdmin,
    bergabung: "Tahun ini",
  };

  function handleGantiPassword(e) {
    e.preventDefault();
    if (!form.lama || !form.baru || !form.konfirmasi) {
      setPwMsg({ type: "error", text: "Semua field wajib diisi." }); return;
    }
    if (form.baru !== form.konfirmasi) {
      setPwMsg({ type: "error", text: "Password baru tidak cocok." }); return;
    }
    if (form.baru.length < 8) {
      setPwMsg({ type: "error", text: "Password minimal 8 karakter." }); return;
    }
    setPwMsg({ type: "success", text: "Password berhasil diperbarui!" });
    setForm({ lama: "", baru: "", konfirmasi: "" });
  }

  function handleLogout() {
    sessionStorage.removeItem("currentUser");
    window.location.href = "/login";
  }

  return (
    <div className="aa-wrapper">
      <NavbarAdmin hasNotif={true} />

      <main className="aa-main">
        <div className="aa-split">

          {/* ── SIDEBAR ── */}
          <div className="aa-sidebar">

            {/* Profile Card */}
            <div className="aa-profile-card">
              <div className="aa-profile-avatar">{a.inisial}</div>
              <div className="aa-role-badge">
                <FiShield size={11} /> {a.role}
              </div>
              <h2 className="aa-profile-nama">{a.nama}</h2>
              <p className="aa-profile-email">{a.email}</p>
              <p className="aa-bergabung">Bergabung sejak {a.bergabung}</p>
            </div>

            {/* Menu */}
            <div className="aa-menu">
              <div
                className={"aa-menu-item" + (menu === "password" ? " active" : "")}
                onClick={() => setMenu("password")}
              >
                <FiLock size={13} /> Ganti Password
              </div>
              <div
                className={"aa-menu-item" + (menu === "profil" ? " active" : "")}
                onClick={() => setMenu("profil")}
              >
                <FiUser size={13} /> Profil Admin
              </div>
              <div className="aa-menu-item danger" onClick={handleLogout}>
                <FiLogOut size={13} /> Keluar dari Akun
              </div>
            </div>

          </div>

          {/* ── KONTEN KANAN ── */}
          <div className="aa-right">

            {/* Ganti Password */}
            {menu === "password" && (
              <div className="aa-card">
                <div className="aa-card-header">
                  <FiLock size={15} color="#ffa757" />
                  <h3 className="aa-card-title">Ganti Password</h3>
                </div>

                {pwMsg && (
                  <div className={"aa-pw-msg " + (pwMsg.type === "success" ? "success" : "error")}>
                    {pwMsg.type === "success"
                      ? <FiCheckCircle size={15} />
                      : <FiAlertCircle size={15} />}
                    {pwMsg.text}
                  </div>
                )}

                <div className="aa-form">
                  <div className="aa-field">
                    <label className="aa-label">Password Lama *</label>
                    <input type="password" className="aa-input"
                      value={form.lama}
                      onChange={e => setForm({ ...form, lama: e.target.value })}
                      placeholder="Masukkan password lama" />
                  </div>
                  <div className="aa-field">
                    <label className="aa-label">Password Baru *</label>
                    <input type="password" className="aa-input"
                      value={form.baru}
                      onChange={e => setForm({ ...form, baru: e.target.value })}
                      placeholder="Minimal 8 karakter" />
                  </div>
                  <div className="aa-field">
                    <label className="aa-label">Konfirmasi Password Baru *</label>
                    <input type="password" className="aa-input"
                      value={form.konfirmasi}
                      onChange={e => setForm({ ...form, konfirmasi: e.target.value })}
                      placeholder="Ulangi password baru" />
                  </div>
                  <button className="aa-btn-submit" onClick={handleGantiPassword}>
                    <FiEdit2 size={14} /> Perbarui Password
                  </button>
                </div>
              </div>
            )}

            {/* Profil Admin */}
            {menu === "profil" && (
              <div className="aa-card">
                <div className="aa-card-header">
                  <FiUser size={15} color="#ffa757" />
                  <h3 className="aa-card-title">Profil Admin</h3>
                </div>
                <div className="aa-form">
                  <div className="aa-field">
                    <label className="aa-label">Nama</label>
                    <input className="aa-input" value={a.nama} disabled
                      style={{ opacity: 0.5, cursor: "not-allowed" }} />
                  </div>
                  <div className="aa-field">
                    <label className="aa-label">Email</label>
                    <input className="aa-input" value={a.email} disabled
                      style={{ opacity: 0.5, cursor: "not-allowed" }} />
                  </div>
                  <div className="aa-field">
                    <label className="aa-label">Role</label>
                    <input className="aa-input" value={a.role} disabled
                      style={{ opacity: 0.5, cursor: "not-allowed" }} />
                  </div>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>
                    Untuk mengubah profil, hubungi developer.
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}

export default AccountAdmin;