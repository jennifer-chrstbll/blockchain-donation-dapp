import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FiSearch, FiClock, FiCheckCircle, FiXCircle, FiChevronRight, FiFilter
} from "react-icons/fi";
import NavbarAdmin from "../../components/navbar-admin";
import "../../styles/admin/submission-list.css";
import { useCampaign } from "../../context/CampaignContext";

const STATUS_CONFIG = {
  pending:   { label: "Menunggu Review", icon: <FiClock size={12} />,       className: "lp-badge-pending",  cardWrap: "pending",  cardClass: "lp-kcard-pending" },
  disetujui: { label: "Disetujui",       icon: <FiCheckCircle size={12} />, className: "lp-badge-approved", cardWrap: "approved", cardClass: "lp-kcard-approved" },
  ditolak:   { label: "Ditolak",         icon: <FiXCircle size={12} />,     className: "lp-badge-rejected", cardWrap: "rejected", cardClass: "lp-kcard-rejected" },
};

function ListPengajuan() {
  const { pengajuanList } = useCampaign();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // 1. Filter berdasarkan Search + Status
  // 2. Sort berdasarkan Waktu (Terbaru paling atas/awal)
  const filteredAndSorted = pengajuanList
    .filter((p) => {
      const matchSearch = p.namaOrganisasi.toLowerCase().includes(search.toLowerCase()) ||
                          p.judulKampanye.toLowerCase().includes(search.toLowerCase()) ||
                          p.id.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === "all" || p.status === filterStatus;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      const dateA = new Date(a.rawTanggalMasuk || 0).getTime();
      const dateB = new Date(b.rawTanggalMasuk || 0).getTime();
      return dateB - dateA;
    });

  const countPending = pengajuanList.filter(p => p.status === "pending").length;

  return (
    <div className="lp-wrapper">
      <NavbarAdmin countPengajuan={countPending} hasNotif={countPending > 0} />

      <main className="lp-main">

        {/* PAGE HEADER */}
        <div className="lp-page-header">
          <div>
            <h1 className="lp-page-title">Daftar Pengajuan</h1>
            <p className="lp-page-sub">
              {countPending > 0
                ? <><span className="lp-pending-count">{countPending} pengajuan</span> menunggu review</>
                : "Semua pengajuan sudah ditinjau"}
            </p>
          </div>
        </div>

        {/* TOOLBAR: Search & Filter */}
        <div className="lp-toolbar">
          <div className="lp-search-bar">
            <FiSearch size={14} color="rgba(255,255,255,0.3)" />
            <input
              type="text"
              placeholder="Cari nama, kampanye, atau ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="lp-search-input"
            />
          </div>

          {/* FILTER BUTTONS */}
          <div className="lp-filter-group">
            <FiFilter size={14} color="rgba(255,255,255,0.3)" />
            <button 
              className={`lp-filter-btn ${filterStatus === "all" ? "active" : ""}`}
              onClick={() => setFilterStatus("all")}
            >
              Semua
            </button>
            <button 
              className={`lp-filter-btn ${filterStatus === "pending" ? "active" : ""}`}
              onClick={() => setFilterStatus("pending")}
            >
              Menunggu Review
            </button>
            <button 
              className={`lp-filter-btn ${filterStatus === "disetujui" ? "active" : ""}`}
              onClick={() => setFilterStatus("disetujui")}
            >
              Disetujui
            </button>
            <button 
              className={`lp-filter-btn ${filterStatus === "ditolak" ? "active" : ""}`}
              onClick={() => setFilterStatus("ditolak")}
            >
              Ditolak
            </button>
          </div>
        </div>

        {/* HORIZONTAL GRID BOARD */}
        <div className="lp-grid">
          {filteredAndSorted.length === 0 ? (
            <div className="lp-empty">Tidak ada pengajuan yang sesuai dengan filter.</div>
          ) : (
            filteredAndSorted.map(p => {
              // Ambil konfigurasi visual berdasarkan status
              const statusInfo = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;

              return (
                <div key={p.id} className={`lp-kcard-wrap ${statusInfo.cardWrap}`}>
                  
                  {/* Layer 2 — Konten Utama Card */}
                  <div className={`lp-kcard ${statusInfo.cardClass}`}>
                    
                   {/* Header Card (ID & Badge) diletakkan sejajar */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", gap: "8px" }}>
                      <div className="lp-kcard-id" title={p.id}>{p.id}</div>
                      <div className={`lp-badge ${statusInfo.className}`}>
                        {statusInfo.icon} {statusInfo.label}
                      </div>
                    </div>

                    <div className="lp-kcard-org">{p.namaOrganisasi}</div>
                    <div className="lp-kcard-judul">{p.judulKampanye}</div>
                    <div className="lp-kcard-footer">
                      <span className="lp-kcard-jenis">{p.jenisVerifikasi}</span>
                      <span className="lp-kcard-tgl">{p.tanggalMasuk}</span>
                    </div>

                    {/* 👈 PINDAHKAN TOMBOL KE SINI (Di dalam lp-kcard) */}
                    {p.status === "pending" ? (
                      <Link to={"/admin/pengajuan/" + p.id} className="lp-kcard-btn-review">
                        Review <FiChevronRight size={12} />
                      </Link>
                    ) : (
                      <Link to={"/admin/pengajuan/" + p.id} className="lp-kcard-btn-lihat">
                        Lihat Detail <FiChevronRight size={12} />
                      </Link>
                    )}

                  </div> {/* 👈 INI PENUTUP .lp-kcard */}
                </div>
              );
            })
          )}
        </div>

      </main>
    </div>
  );
}

export default ListPengajuan;