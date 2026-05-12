import { Link } from "react-router-dom";
import "../styles/landing.css";
import bgImage from "../assets/images/landing-pages.png";

import { FiShield, FiBarChart2, FiLock, FiZap } from "react-icons/fi";

function Landing() {
  return (
    <div
      className="landing-page-wrapper"
      style={{
        backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.6), rgba(15, 23, 42, 0.8)), url(${bgImage})`
      }}
    >
      <nav className="landing-navbar">
        <div className="landing-logo">
          Donasi<span>Chain</span>
        </div>
        <div className="landing-nav-right">
          {/* Masuk → /login | Daftar → /register */}
          <Link to="/login" className="landing-btn-login">Masuk</Link>
          <Link to="/register" className="landing-btn-daftar">Daftar</Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-badge">
          <FiShield size={24} color="#005438" /> Verified by Smart Contract
        </div>

        <h1 className="landing-title">
          Masa Depan Filantropi<br />
          yang Transparan
        </h1>

        <p className="landing-subtitle">
          Hapus keraguan dalam berdonasi. Dengan teknologi <b>Blockchain</b>,
          setiap koin yang Anda berikan terlacak secara <i>end-to-end</i> dan tidak dapat dimanipulasi oleh siapapun.
        </p>

        <div className="landing-features">
          <div className="landing-feature-card">
            <div className="landing-icon-box">
              <FiBarChart2 size={22} color="#89ff57" />
            </div>
            <h3>Eksplorasi Real-time</h3>
            <p>Pantau alokasi dana detik demi detik melalui <i>Public Ledger</i> yang bisa diakses siapa saja.</p>
          </div>

          <div className="landing-feature-card">
            <div className="landing-icon-box">
              <FiLock size={22} color="#e45235" />
            </div>
            <h3>Immutability</h3>
            <p>Data transaksi yang sudah masuk ke jaringan tidak akan bisa diubah atau dihapus oleh pihak manapun.</p>
          </div>

          <div className="landing-feature-card">
            <div className="landing-icon-box">
              <FiZap size={22} color="#57a3ff" />
            </div>
            <h3>Tanpa Perantara</h3>
            <p>Donasi langsung sampai ke organizer dengan biaya administrasi yang jauh lebih rendah dan efisien.</p>
          </div>
        </div>

        <div className="landing-cta">
          {/* Kedua tombol CTA → ke /login dulu sebelum bisa akses fitur */}
          <Link to="/login" className="landing-btn landing-btn-donatur">
            Mulai Berdonasi Sekarang
          </Link>
          <Link to="/login" className="landing-btn landing-btn-organizer">
            Daftarkan Campaign Anda
          </Link>
        </div>
      </section>
    </div>
  );
}

export default Landing;