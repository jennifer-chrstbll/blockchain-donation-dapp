import { Link, useLocation } from "react-router-dom";
import { FiHome, FiFileText, FiGrid, FiBell, FiAlertTriangle, FiSettings } from "react-icons/fi";
import { useCampaign } from "../context/CampaignContext";
import "../styles/admin/navbar-admin.css";

// NavbarAdmin membaca langsung dari CampaignContext —
// tidak perlu props countPengajuan/hasNotif, angka selalu konsisten di semua halaman.
function NavbarAdmin() {
  const { pathname } = useLocation();
  const { pengajuanList, laporan } = useCampaign();
  const countPending  = pengajuanList.filter(p => p.status === "pending").length;
  const countLaporan  = (laporan || []).filter(l => l.status === "submitted").length;
  const active = (path) => pathname === path ? " nba-active" : "";

  return (
    <nav className="nba-navbar">
      {/* LOGO */}
      <div className="nba-logo">
        Donasi<span>Chain</span>
        <span className="nba-admin-tag">Admin</span>
      </div>

      {/* SPACER */}
      <div className="nba-spacer" />

      {/* NAV LINKS */}
      <div className="nba-nav-links">
        <Link to="/admin/dashboard" className={"nba-nav-link" + active("/admin/dashboard")}>
          <FiHome size={15} /> Home
        </Link>
        <Link to="/admin/pengajuan" className={"nba-nav-link nba-nav-link--pengajuan" + active("/admin/pengajuan")}>
          <FiFileText size={15} /> Pengajuan
          <span className="nba-nav-badge-slot">
            {countPending > 0 && <span className="nba-nav-badge">{countPending}</span>}
          </span>
        </Link>
        <Link to="/admin/campaign" className={"nba-nav-link" + active("/admin/campaign")}>
          <FiGrid size={15} /> Campaign
        </Link>
        <Link to="/admin/laporan" className={"nba-nav-link nba-nav-link--pengajuan" + active("/admin/laporan")}>
          <FiAlertTriangle size={15} /> Laporan
          <span className="nba-nav-badge-slot">
            {countLaporan > 0 && <span className="nba-nav-badge" style={{ background: "#ef4444" }}>{countLaporan}</span>}
          </span>
        </Link>
        <Link to="/admin/kelola-admin" className={"nba-nav-link" + active("/admin/kelola-admin")}>
          <FiSettings size={15} /> Pengelolaan Admin
        </Link>
      </div>

      {/* RIGHT */}
      <div className="nba-nav-right">
        <Link to="/admin/notifikasi" className={"nba-notif-btn" + active("/admin/notifikasi")}>
          <FiBell size={18} />
          {countPending > 0 && <span className="nba-notif-dot" />}
        </Link>
        <Link to="/admin/akun" className={"nba-avatar" + active("/admin/akun")}>
          AD
        </Link>
      </div>
    </nav>
  );
}

export default NavbarAdmin;