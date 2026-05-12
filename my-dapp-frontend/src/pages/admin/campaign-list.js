import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FiSearch, FiXCircle, FiClock, FiFilter,
  FiUsers, FiAlertCircle, FiExternalLink, FiEye,
  FiCheckCircle, FiChevronRight
} from "react-icons/fi";
import NavbarAdmin from "../../components/navbar-admin";
import { useCampaign } from "../../context/CampaignContext";
import "../../styles/admin/campaign-list.css";

const STATUS_CONFIG = {
  aktif:   { label: "Aktif",      icon: <FiCheckCircle size={11} />, className: "lc-badge-aktif"   },
  selesai: { label: "Selesai",    icon: <FiCheckCircle size={11} />, className: "lc-badge-selesai" },
  ditutup: { label: "Ditutup",    icon: <FiXCircle size={11} />,     className: "lc-badge-ditutup" },
  arsip:   { label: "Diarsipkan", icon: <FiXCircle size={11} />,     className: "lc-badge-ditutup" },
};

function ListCampaign() {
  const { kampanyeAktif, kampanyeArsip, archiveCampaign } = useCampaign();
  const [search, setSearch]               = useState("");
  const [filterStatus, setFilterStatus]   = useState("semua");
  const [selected, setSelected]           = useState(null); // kampanye yang dipilih di panel
  const [showNonaktifModal, setShowNonaktifModal] = useState(null);
  const [localOverride, setLocalOverride] = useState({});

  // Source: arsip filter pakai kampanyeArsip, yang lain pakai kampanyeAktif
  const activeSource = filterStatus === "arsip" ? kampanyeArsip : kampanyeAktif;

  const campaigns = activeSource.map(k => ({
    id:           k.id,
    foto:         k.foto,
    judul:        k.judul,
    organizer:    k.organizer,
    wallet:       k.walletOrganizer,
    targetETH:    k.targetETH,
    terkumpulETH: k.terkumpulETH,
    donatur:      k.donatur,
    sisaHari:     k.sisaHari,
    tanggalAktif: k.tanggalAktif,
    deskripsi:    k.deskripsi || "",
    contractAddress: k.contractAddress || "",
    status:       k.status, // gunakan status dari context (aktif/selesai/ditutup/arsip)
  }));

  const filtered = campaigns.filter((c) => {
    const matchSearch =
      c.judul.toLowerCase().includes(search.toLowerCase()) ||
      c.organizer.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase());
    // "semua" menampilkan semua non-arsip; "arsip" sudah pakai sourceData berbeda
    const matchFilter = filterStatus === "semua" || filterStatus === "arsip" || c.status === filterStatus;
    return matchSearch && matchFilter;
  });

  // Update selected jika data berubah
  const selectedCampaign = selected
    ? campaigns.find(c => c.id === selected) || null
    : null;

  function handleNonaktifkan(id) {
    setLocalOverride(prev => ({ ...prev, [id]: "ditutup" }));
    setShowNonaktifModal(null);
  }

  async function handleArchive(id) {
    if (window.confirm("Yakin ingin mengarsipkan campaign ini? Campaign ini tidak akan muncul lagi di daftar, tapi masih bisa diakses via link langsung.")) {
      try {
        await archiveCampaign(id);
        setSelected(null);
        alert("Campaign berhasil diarsipkan!");
      } catch (err) {
        alert("Gagal mengarsipkan: " + err.message);
      }
    }
  }

  return (
    <div className="lc-wrapper">
      <NavbarAdmin />

      <main className="lc-main">
        {/* PAGE HEADER */}
        <div className="lc-page-header">
          <div>
            <h1 className="lc-page-title">Monitor Kampanye</h1>
            <p className="lc-page-sub">
              Total <span className="lc-highlight">
                {campaigns.filter(c => c.status === "aktif").length} kampanye aktif
              </span> dari {campaigns.length} kampanye
            </p>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="lc-toolbar">
          <div className="lc-search-bar">
            <FiSearch size={14} color="rgba(255,255,255,0.35)" />
            <input type="text" placeholder="Cari kampanye atau organizer..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="lc-search-input" />
          </div>
          <div className="lc-filter-group">
            <FiFilter size={14} color="rgba(255,255,255,0.4)" />
            {["semua","aktif","selesai","ditutup","arsip"].map(f => (
              <button key={f}
                className={"lc-filter-btn" + (filterStatus === f ? " active" : "")}
                onClick={() => setFilterStatus(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* LAYOUT TABEL + PANEL */}
        <div className={"lc-layout" + (selectedCampaign ? " has-panel" : "")}>

          {/* TABEL */}
          <div className="lc-tbl-wrap">
            {filtered.length === 0 ? (
              <div className="lc-empty">Tidak ada kampanye yang cocok.</div>
            ) : (
              <table className="lc-tbl">
                <thead>
                  <tr>
                    <th>Organizer / Judul</th>
                    <th>Progress</th>
                    <th>Donatur</th>
                    <th>Sisa</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const sc = STATUS_CONFIG[c.status];
                    const persen = c.targetETH > 0
                      ? Math.min((c.terkumpulETH / c.targetETH) * 100, 100).toFixed(0)
                      : 0;
                    const isSel = selectedCampaign?.id === c.id;
                    return (
                      <tr key={c.id}
                        className={"lc-row" + (isSel ? " selected" : "")}
                        onClick={() => setSelected(isSel ? null : c.id)}>
                        <td>
                          <div className="lc-tbl-org">{c.organizer}</div>
                          <div className="lc-tbl-jdl">{c.judul}</div>
                        </td>
                        <td>
                          <div className="lc-tbl-eth">
                            <span className="lc-eth-val">{c.terkumpulETH}</span>
                            <span className="lc-eth-target">/{c.targetETH} ETH</span>
                          </div>
                          <div className="lc-prog-bg">
                            <div className="lc-prog-fill" style={{ width: persen + "%" }} />
                          </div>
                        </td>
                        <td>
                          <div className="lc-tbl-stat">
                            <FiUsers size={11} /> {c.donatur}
                          </div>
                        </td>
                        <td>
                          <div className="lc-tbl-stat">
                            <FiClock size={11} />
                            {c.sisaHari > 0 ? c.sisaHari + " hari" : "Berakhir"}
                          </div>
                        </td>
                        <td>
                          <span className={"lc-badge " + sc.className}>
                            {sc.icon} {sc.label}
                          </span>
                        </td>
                        <td>
                          <FiChevronRight size={14}
                            color={isSel ? "#ffa757" : "rgba(255,255,255,0.2)"}
                            style={{ transition: "transform 0.2s", transform: isSel ? "rotate(90deg)" : "none" }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* SIDE PANEL */}
          {selectedCampaign && (() => {
            const c = selectedCampaign;
            const sc = STATUS_CONFIG[c.status];
            const persen = c.targetETH > 0
              ? Math.min((c.terkumpulETH / c.targetETH) * 100, 100).toFixed(0)
              : 0;
            return (
              <div className="lc-panel">
                {/* Foto */}
                <div className="lc-panel-img-wrap">
                  {c.foto
                    ? <img src={c.foto} alt={c.judul} className="lc-panel-img" />
                    : <div className="lc-panel-img-placeholder">
                        <svg width="28" height="28" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      </div>
                  }
                  <span className={"lc-panel-badge " + sc.className}>{sc.icon} {sc.label}</span>
                </div>

                {/* Info */}
                <div className="lc-panel-body">
                  <div className="lc-panel-id">{c.id}</div>
                  <h3 className="lc-panel-judul">{c.judul}</h3>
                  <p className="lc-panel-org">{c.organizer}</p>

                  {/* Progress */}
                  <div className="lc-prog-bg" style={{ height: 6, marginBottom: 6 }}>
                    <div className="lc-prog-fill" style={{ width: persen + "%" }} />
                  </div>

                  {/* Stats rows */}
                  {[
                    { key: "Terkumpul", val: <span style={{ color: "#ffa757", fontFamily: "'Exo 2',sans-serif", fontWeight: 700 }}>{c.terkumpulETH} / {c.targetETH} ETH</span> },
                    { key: "Donatur",   val: c.donatur + " orang" },
                    { key: "Sisa Hari", val: c.sisaHari > 0 ? c.sisaHari + " hari" : "Berakhir" },
                    { key: "Aktif sejak", val: c.tanggalAktif },
                  ].map(row => (
                    <div key={row.key} className="lc-panel-row">
                      <span className="lc-panel-key">{row.key}</span>
                      <span className="lc-panel-val">{row.val}</span>
                    </div>
                  ))}

                  {/* Contract */}
                  {c.contractAddress && (
                    <div className="lc-panel-contract">
                      <span className="lc-panel-contract-lbl">Contract</span>
                      <code className="lc-panel-contract-addr">
                        {c.contractAddress.slice(0, 10)}...{c.contractAddress.slice(-6)}
                      </code>
                    </div>
                  )}

                  {/* Tombol */}
                  <div className="lc-panel-btns">
                    <Link to={"/admin/campaign/" + c.id} className="lc-panel-btn-detail">
                      <FiEye size={13} /> Detail Lengkap
                    </Link>
                    <a href={"https://etherscan.io/address/" + c.wallet}
                      target="_blank" rel="noreferrer" className="lc-panel-btn-eth">
                      <FiExternalLink size={13} /> Etherscan
                    </a>
                  </div>

                  {(c.status === "selesai" || c.status === "ditutup") && (
                    <button className="lc-panel-btn-nonaktif" style={{ marginTop: "10px", borderColor: "rgba(255,255,255,0.3)", color: "#aaa" }}
                      onClick={() => handleArchive(c.id)}>
                      Arsipkan Campaign
                    </button>
                  )}

                  {c.status === "aktif" && (
                    <button className="lc-panel-btn-nonaktif"
                      onClick={() => setShowNonaktifModal(c)}>
                      <FiAlertCircle size={13} /> Nonaktifkan Campaign
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </main>

      {/* MODAL NONAKTIFKAN — tidak ada perubahan logika */}
      {showNonaktifModal && (
        <div className="lc-modal-overlay" onClick={() => setShowNonaktifModal(null)}>
          <div className="lc-modal" onClick={e => e.stopPropagation()}>
            <div className="lc-modal-icon"><FiAlertCircle size={28} color="#ffa757" /></div>
            <h3 className="lc-modal-title">Nonaktifkan Campaign?</h3>
            <p className="lc-modal-desc">
              Kampanye <strong>"{showNonaktifModal.judul}"</strong> akan ditutup dan tidak bisa menerima donasi baru.
            </p>
            <div className="lc-modal-actions">
              <button className="lc-btn-nonaktif-confirm"
                onClick={() => handleNonaktifkan(showNonaktifModal.id)}>
                <FiXCircle size={15} /> Ya, Nonaktifkan
              </button>
              <button className="lc-modal-batal" onClick={() => setShowNonaktifModal(null)}>
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ListCampaign;