import { Link, useLocation } from "react-router-dom";
import { FiHome, FiHeart, FiPlusCircle, FiBell, FiSearch, FiAward } from "react-icons/fi";
import "../styles/user/navbar-user.css";

// inisial      → 2 huruf nama user, misal "JC" (opsional, default "U")
// hasNotif     → tampilkan titik oranye di lonceng (opsional, default false)
// searchValue  → nilai search yang dikontrol dari luar (opsional)
// onSearch     → callback saat search berubah, misal (val) => setSearch(val) (opsional)
function NavbarUser({ inisial = "U", hasNotif = false, searchValue, onSearch, showSearch = true }) {
  const { pathname } = useLocation();
  const active = (path) => pathname === path ? " nbu-active" : "";

  return (
    <nav className="nbu-navbar">

      {/* 1. LOGO */}
      <div className="nbu-logo">Donasi<span>Chain</span></div>

      {/* 2. SEARCH */}
      <div 
        className="nbu-search-bar" 
        style={{ visibility: showSearch ? "visible" : "hidden" }}
      >
        <FiSearch size={15} color="rgba(255,255,255,0.35)" />
        <input
          type="text"
          placeholder="Pencarian..."
          className="nbu-search-input"
          value={searchValue !== undefined ? searchValue : undefined}
          onChange={onSearch ? (e) => onSearch(e.target.value) : undefined}
          disabled={!showSearch} 
        />
      </div>

      {/* 3. NAV LINKS */}
      <div className="nbu-nav-links">
        <Link to="/dashboard" className={"nbu-nav-link" + active("/dashboard")}>
          <FiHome size={15} /> Home
        </Link>
        <Link to="/donasi" className={"nbu-nav-link" + active("/donasi")}>
          <FiHeart size={15} /> Donasi
        </Link>
        <Link to="/daftar-campaign" className={"nbu-nav-link" + active("/daftar-campaign")}>
          <FiPlusCircle size={15} /> Daftar Campaign
        </Link>
        <Link to="/top-organizer" className={"nbu-nav-link" + active("/top-organizer")}>
          <FiAward size={15} /> Top Organizer
        </Link>
      </div>

      {/* 4. RIGHT */}
      <div className="nbu-nav-right">
        <Link to="/notifikasi" className={"nbu-notif-btn" + active("/notifikasi")}>
          <FiBell size={18} />
          {hasNotif && <span className="nbu-notif-dot" />}
        </Link>
        <Link to="/akun" className={"nbu-avatar" + active("/akun")}>
          {inisial}
        </Link>
      </div>

    </nav>
  );
}

export default NavbarUser;