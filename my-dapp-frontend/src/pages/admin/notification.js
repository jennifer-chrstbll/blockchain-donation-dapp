import { FiUser, FiCheckCircle, FiXCircle, FiChevronRight, FiInbox } from "react-icons/fi";
import { useCampaign } from "../../context/CampaignContext";
import NavbarAdmin from "../../components/navbar-admin";
import "../../styles/admin/notification.css";

const TYPE_CONFIG = {
  "pengajuan_baru": {
    icon: <FiUser size={18} />,
    color: "#ffa757",
    bg: "rgba(255,167,87,0.1)",
    border: "rgba(255,167,87,0.2)",
  },
  "disetujui": {
    icon: <FiCheckCircle size={18} />,
    color: "#22c55e",
    bg: "rgba(34,197,94,0.1)",
    border: "rgba(34,197,94,0.2)",
  },
  "ditolak": {
    icon: <FiXCircle size={18} />,
    color: "#ef4444",
    bg: "rgba(239,68,68,0.1)",
    border: "rgba(239,68,68,0.2)",
  },
};

function NotificationAdmin() {
  const {
    notifAdmin,
    tandaiDibacaAdmin,
    tandaiSemuaDibacaAdmin,
  } = useCampaign();

  const unread = notifAdmin.filter(n => !n.dibaca).length;

  return (
    <div className="na-wrapper">
      <NavbarAdmin />

      <main className="na-main">
        <div className="na-page-header">
          <div>
            <h1 className="na-page-title">Notifikasi</h1>
            <p className="na-page-sub">
              {unread > 0
                ? <><span className="na-unread-count">{unread} notifikasi</span> belum dibaca</>
                : "Semua notifikasi sudah dibaca"}
            </p>
          </div>
          {unread > 0 && (
            <button className="na-btn-baca-semua" onClick={tandaiSemuaDibacaAdmin}>
              <FiCheckCircle size={14} /> Tandai semua dibaca
            </button>
          )}
        </div>

        {notifAdmin.length === 0 ? (
          <div className="na-empty">
            <FiInbox size={36} color="rgba(255,255,255,0.15)" />
            <p>Tidak ada notifikasi.</p>
          </div>
        ) : (
          <div className="na-list">
            {notifAdmin.map(n => {
              const tc = TYPE_CONFIG[n.type] || TYPE_CONFIG["pengajuan_baru"];
              return (
                <div
                  key={n.id}
                  className={"na-item" + (!n.dibaca ? " unread" : "")}
                  onClick={() => tandaiDibacaAdmin(n.id)}
                >
                  {!n.dibaca && <span className="na-item-dot" />}
                  <div className="na-item-icon" style={{ background: tc.bg, border: "1px solid " + tc.border }}>
                    <span style={{ color: tc.color }}>{tc.icon}</span>
                  </div>
                  <div className="na-item-content">
                    <div className="na-item-top">
                      <p className="na-item-judul">{n.judul}</p>
                      <span className="na-item-waktu">{n.waktu}</span>
                    </div>
                    <p className="na-item-pesan">{n.pesan}</p>
                    {n.refId && (
                      <a href={"/admin/pengajuan/" + n.refId} className="na-item-link">
                        Review Sekarang <FiChevronRight size={13} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default NotificationAdmin;