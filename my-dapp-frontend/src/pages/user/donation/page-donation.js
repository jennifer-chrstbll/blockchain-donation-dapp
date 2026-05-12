import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FiFilter, FiUsers, FiClock, FiShield, FiChevronDown, FiHeart, FiSearch,
  FiCheckCircle, FiXCircle, FiArchive
} from "react-icons/fi";
import NavbarUser from "../../../components/navbar-user";
import BanGuard from "../../../components/BanGuard";
import { useCampaign } from "../../../context/CampaignContext";
import "../../../styles/user/donation/page-donation.css";

function getCurrentUser() {
  try { return JSON.parse(sessionStorage.getItem("currentUser")) || {}; } catch { return {}; }
}
function getInisial(nama = "") {
  return nama.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "??";
}

const KATEGORI_LIST = ["Semua", "Bencana Alam", "Pendidikan", "Kesehatan", "Keagamaan", "Lingkungan", "Lainnya"];
const SORT_LIST = ["Terbaru", "Terpopuler", "Hampir Selesai", "Progress Tertinggi", "Arsip"];

// Helper: konfigurasi tampilan status donasi pada card
function getStatusButton(k, isArsipView) {
  if (isArsipView || k.isArchived) return { icon: <FiArchive size={14} />, label: "Diarsipkan", cls: "hd-card-btn--arsip" };
  if (k.status === "selesai" || k.isCompleted) return { icon: <FiCheckCircle size={14} />, label: "Fundraising Selesai", cls: "hd-card-btn--selesai" };
  if (k.status === "ditutup") return { icon: <FiXCircle size={14} />, label: "Campaign Ditutup", cls: "hd-card-btn--ditutup" };
  return { icon: <FiHeart size={14} />, label: "Donasi Sekarang", cls: "" };
}

function PageDonation() {
  const { kampanyeAktif, kampanyeArsip, notifUser } = useCampaign();
  const [search, setSearch] = useState("");
  const [kategori, setKategori] = useState("Semua");
  const [sort, setSort] = useState("Terbaru");
  const [showSort, setShowSort] = useState(false);

  const u = getCurrentUser();
  const inisial = getInisial(u.nama || "");
  const hasNotif = notifUser.some(n => !n.dibaca);
  const myWallet = (u.wallet || "").toLowerCase();

  const isArsipView = sort === "Arsip";
  // Arsip: ambil dari kampanyeArsip; aktif: ambil semua kampanyeAktif yang belum diarsip (termasuk yang selesai)
  const sourceData = isArsipView ? kampanyeArsip : kampanyeAktif.filter(k => !k.isArchived);

  let hasil = sourceData.filter((k) => {
    // Sembunyikan campaign milik sendiri dari daftar donasi
    if (myWallet && (k.walletOrganizer || "").toLowerCase() === myWallet) return false;
    const matchSearch = k.judul.toLowerCase().includes(search.toLowerCase()) ||
      k.organizer.toLowerCase().includes(search.toLowerCase());
    const matchKategori = kategori === "Semua" || k.kategori === kategori;
    return matchSearch && matchKategori;
  });

  if (sort === "Terpopuler") hasil = [...hasil].sort((a, b) => b.donatur - a.donatur);
  if (sort === "Hampir Selesai") hasil = [...hasil].sort((a, b) => a.sisaHari - b.sisaHari);
  if (sort === "Progress Tertinggi") hasil = [...hasil].sort((a, b) => (b.terkumpulETH / b.targetETH) - (a.terkumpulETH / a.targetETH));

  return (
    <div className="hd-wrapper">
      <NavbarUser
        inisial={inisial}
        hasNotif={hasNotif}
        searchValue={search}
        onSearch={setSearch}
      />

      <main className="hd-main">
        <BanGuard />
        <div className="hd-page-header">
          <div>
            <h1 className="hd-page-title">
              {isArsipView ? "Arsip Kampanye" : "Daftar Kampanye"}
            </h1>
            <p className="hd-page-sub">
              {isArsipView
                ? "Kampanye yang telah selesai dan diarsipkan"
                : "Semua kampanye terverifikasi dan transparan di blockchain Ethereum"}
            </p>
          </div>
          <div className="hd-total-badge">
            <FiShield size={13} />
            {isArsipView
              ? `${hasil.length} kampanye diarsipkan`
              : `${hasil.length} kampanye aktif`}
          </div>
        </div>

        <div className="hd-filter-bar">
          <div className="hd-kategori-tabs">
            {KATEGORI_LIST.map((k) => (
              <button key={k}
                className={`hd-kategori-tab ${kategori === k ? "active" : ""}`}
                onClick={() => setKategori(k)}>
                {k}
              </button>
            ))}
          </div>
          <div className="hd-sort-wrapper">
            <button className="hd-sort-btn" onClick={() => setShowSort(!showSort)}>
              <FiFilter size={13} /> {sort} <FiChevronDown size={13} />
            </button>
            {showSort && (
              <div className="hd-sort-dropdown">
                {SORT_LIST.map((s) => (
                  <button key={s}
                    className={`hd-sort-option ${sort === s ? "active" : ""}`}
                    onClick={() => { setSort(s); setShowSort(false); }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {hasil.length === 0 ? (
          <div className="hd-empty">
            <FiSearch size={32} color="rgba(255,255,255,0.2)" />
            <p>
              {isArsipView
                ? "Belum ada kampanye yang diarsipkan."
                : "Tidak ada kampanye yang cocok dengan pencarian."}
            </p>
            <button className="hd-reset-btn" onClick={() => { setSearch(""); setKategori("Semua"); }}>
              Reset Filter
            </button>
          </div>
        ) : (
          <div className="hd-grid">
            {hasil.map((k) => {
              const persen = Math.min((k.terkumpulETH / k.targetETH) * 100, 100).toFixed(0);
              const urgent = k.sisaHari <= 7 && k.status === "aktif";
              const statusBtn = getStatusButton(k, isArsipView);

              return (
                <Link to={`/donasi/${k.id}`} key={k.id} className="hd-card">
                  <div className="hd-card-foto-wrapper">
                    <img src={k.foto} alt={k.judul} className="hd-card-foto" />
                    <div className="hd-card-foto-overlay" />
                    <span className="hd-card-kategori">{k.kategori}</span>

                    {/* Badge status di atas foto — tampil kalau bukan aktif */}
                    {(k.status !== "aktif" || isArsipView) && (
                      <span className={`hd-card-status-badge hd-card-status-badge--${isArsipView ? "arsip" : k.status}`}>
                        {statusBtn.icon} {isArsipView ? "Arsip" : k.status === "selesai" ? "Selesai" : "Ditutup"}
                      </span>
                    )}

                    {urgent && <span className="hd-card-urgent"><FiClock size={10} /> {k.sisaHari} hari lagi!</span>}
                  </div>
                  <div className="hd-card-body">
                    <div className="hd-card-org-row">
                      <span className="hd-card-org">{k.organizer}</span>
                      {k.verified && <span className="hd-card-verified"><FiShield size={10} /> Verified</span>}
                    </div>
                    <h3 className="hd-card-judul">{k.judul}</h3>
                    <p className="hd-card-desc">{k.deskripsi}</p>
                    <div className="hd-card-progress-bg">
                      <div className="hd-card-progress-fill" style={{ width: `${persen}%` }} />
                    </div>
                    <div className="hd-card-stats">
                      <div className="hd-card-stat-left">
                        <span className="hd-card-eth">{k.terkumpulETH} ETH</span>
                        <span className="hd-card-target">dari {k.targetETH} ETH</span>
                      </div>
                      <span className="hd-card-persen">{persen}%</span>
                    </div>
                    <div className="hd-card-meta">
                      <span className="hd-card-meta-item"><FiUsers size={11} /> {k.donatur} donatur</span>
                      {!isArsipView && k.status === "aktif" && (
                        <span className="hd-card-meta-item"><FiClock size={11} /> {k.sisaHari} hari lagi</span>
                      )}
                      {isArsipView && (
                        <span className="hd-card-meta-item"><FiArchive size={11} /> Diarsipkan</span>
                      )}
                    </div>

                    {/* Tombol aksi — menyesuaikan status */}
                    <div className={`hd-card-btn ${statusBtn.cls}`}>
                      {statusBtn.icon} {statusBtn.label}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default PageDonation;