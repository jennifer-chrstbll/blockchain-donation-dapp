import { useState, useEffect, useMemo } from "react";
import {
  FiHeart, FiCheckCircle, FiXCircle, FiTrendingUp,
  FiChevronRight, FiShield, FiAward
} from "react-icons/fi";
import { useCampaign } from "../../context/CampaignContext";
import NavbarUser from "../../components/navbar-user";
import "../../styles/user/notification.css";
import { ethers } from "ethers";
import { supabase } from "../../web3/supabaseClient";

function getCurrentUser() {
  try { return JSON.parse(sessionStorage.getItem("currentUser")) || {}; } catch { return {}; }
}
function getInisial(nama = "") {
  return nama.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "??";
}

// ===== ABI Untuk Membaca Hasil Acakan dari Blockchain =====
const GOVERNANCE_VOTING_ABI = [
  "function getVoters() view returns (address[])",
  "function result() view returns (uint8)"
];

/* Warna icon per tipe */
const TYPE_CONFIG = {
  "disetujui":       { icon: <FiCheckCircle size={17} />, color: "#22c55e", bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.22)"   },
  "ditolak":         { icon: <FiXCircle size={17} />,     color: "#ef4444", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.2)"    },
  "donasi-masuk":    { icon: <FiTrendingUp size={17} />,  color: "#ffa757", bg: "rgba(255,167,87,0.12)",  border: "rgba(255,167,87,0.22)"  },
  "donasi-berhasil": { icon: <FiHeart size={17} />,       color: "#57a3ff", bg: "rgba(87,163,255,0.12)",  border: "rgba(87,163,255,0.2)"   },
  "voting-request":  { icon: <FiShield size={17} />,      color: "#a78bfa", bg: "rgba(139,92,246,0.12)",  border: "rgba(139,92,246,0.22)"  },
};

const FILTER_TABS = [
  { key: "semua",           label: "Semua"          },
  { key: "voting-request",  label: "Vote Kampanye"  },
  { key: "disetujui",       label: "Disetujui"      },
  { key: "ditolak",         label: "Ditolak"        },
  { key: "donasi-berhasil", label: "Donasi Saya"    },
  { key: "donasi-masuk",    label: "Donasi Masuk"   },
];

function groupByDay(notifs) {
  const groups = [];
  const seen   = {};

  notifs.forEach(n => {
    const label = n.dayLabel || "Lainnya";
    if (!seen[label]) {
      seen[label] = true;
      groups.push({ label, items: [] });
    }
    groups[groups.length - 1].items.push(n);
  });

  return groups;
}

function NotificationUser() {
  const { notifUser, tandaiDibacaUser, tandaiSemuaDibacaUser } = useCampaign();
  const [filter, setFilter] = useState("semua");

  const [onChainTasks, setOnChainTasks] = useState([]);
  const [isVoterActive, setIsVoterActive] = useState(false);

  const u         = getCurrentUser();
  const inisial   = getInisial(u.nama || "");

  const provider = useMemo(() => {
    if (!window.ethereum) return null;
    return new ethers.BrowserProvider(window.ethereum);
  }, []);

  // ===== Menarik 5 Validator Acak Langsung Dari Blockchain =====
  useEffect(() => {
    async function fetchOnChainVotes() {
      if (!provider) return;
      try {
        const signer = await provider.getSigner();
        const wallet = await signer.getAddress();

        const { data: campaigns } = await supabase
          .from("pengajuan_campaign")
          .select("*")
          .not("voting_contract", "is", null);

        if (!campaigns) return;

        const tasks = [];
        for (let c of campaigns) {
          try {
            const vc = new ethers.Contract(c.voting_contract, GOVERNANCE_VOTING_ABI, provider);
            const res = await vc.result();
            
            // Jika campaign masih pending (butuh vote)
            if (res.toString() === "0") {
              const voters = await vc.getVoters(); // Mengambil 6 voter (Admin + 5 Acak dari Top 10)
              const isVoter = voters.some(v => v.toLowerCase() === wallet.toLowerCase());
              
              if (isVoter) {
                tasks.push({
                  id: "vote-" + c.id,
                  type: "voting-request",
                  judul: "Tugas Validator Baru",
                  pesan: `Anda terpilih secara acak sebagai validator untuk campaign "${c.judul_kampanye || c.judul}". Berikan suara Anda segera.`,
                  dayLabel: "Hari Ini",
                  waktu: "Baru saja",
                  dibaca: false,
                  reqId: c.id,
                  kampanye: c.judul_kampanye || c.judul
                });
              }
            }
          } catch (e) {
            console.warn("Gagal cek kontrak:", c.voting_contract);
          }
        }
        setOnChainTasks(tasks);
        setIsVoterActive(tasks.length > 0);
      } catch (error) {
        console.error(error);
      }
    }
    fetchOnChainVotes();
  }, [provider]);

  // Gabungkan notif on-chain dengan notif biasa dari database
  const cleanNotifDB = notifUser.filter(n => n.type !== "voting-request"); // Buang notif palsu lama
  const allNotifs = [...onChainTasks, ...cleanNotifDB];

  const filtered = allNotifs.filter(n => filter === "semua" || n.type === filter);
  const unread   = allNotifs.filter(n => !n.dibaca).length;
  const groups   = groupByDay(filtered);

  return (
    <div className="nt-wrapper">
      <NavbarUser inisial={inisial} showSearch={false} hasNotif={unread > 0} />

      <main className="nt-main">
        <div className="nt-page-header">
          <div>
            <h1 className="nt-page-title">Notifikasi</h1>
            <p className="nt-page-sub">
              {unread > 0
                ? <><span className="nt-unread-count">{unread} notifikasi</span> belum dibaca</>
                : "Semua notifikasi sudah dibaca"}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            {isVoterActive && (
              <div className="nt-top5-badge">
                <FiAward size={12} /> Validator Terpilih
              </div>
            )}
            {cleanNotifDB.filter(n => !n.dibaca).length > 0 && (
              <button className="nt-btn-baca-semua" onClick={tandaiSemuaDibacaUser}>
                <FiCheckCircle size={13} /> Tandai semua dibaca
              </button>
            )}
          </div>
        </div>

        <div className="nt-tabs">
          {FILTER_TABS.map(t => {
            if (t.key === "voting-request" && !isVoterActive) return null;
            return (
              <button key={t.key}
                className={"nt-tab" + (filter === t.key ? " active" : "") + (t.key === "voting-request" ? " voting" : "")}
                onClick={() => setFilter(t.key)}>
                {t.key === "voting-request" && <FiShield size={11} />}
                {t.label}
                {t.key === "semua" && unread > 0 && (
                  <span className="nt-tab-badge">{unread}</span>
                )}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="nt-empty">
            <div className="nt-empty-orbit">
              <div className="nt-empty-r1" />
              <div className="nt-empty-r2" />
              <div className="nt-empty-core">
                <div className="nt-empty-icon-box">
                  <svg width="18" height="18" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3z"/>
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                  </svg>
                </div>
              </div>
            </div>
            <p className="nt-empty-title">Tidak ada notifikasi</p>
            <p className="nt-empty-sub">Notifikasi aktivitas kampanye dan donasi kamu akan muncul di sini.</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="nt-list">
            {groups.map(group => (
              <div key={group.label}>
                <div className="nt-day-label">{group.label}</div>
                {group.items.map(n => {
                  const tc = TYPE_CONFIG[n.type] || TYPE_CONFIG["disetujui"];
                  const isVotingNotif = n.type === "voting-request";
                  return (
                    <div key={n.id}
                      className={"nt-item" + (!n.dibaca ? " unread" : "") + (isVotingNotif ? " voting-item" : "")}
                      onClick={() => { if(!isVotingNotif) tandaiDibacaUser(n.id); }}
                      style={{ marginBottom: 8 }}>
                      {!n.dibaca && <span className="nt-item-dot" />}

                      <div className="nt-item-icon"
                        style={{ background: tc.bg, border: `1px solid ${tc.border}` }}>
                        <span style={{ color: tc.color }}>{tc.icon}</span>
                      </div>

                      <div className="nt-item-content">
                        <div className="nt-item-top">
                          <p className="nt-item-judul">{n.judul}</p>
                          <span className="nt-item-waktu">{n.waktu}</span>
                        </div>

                        <p className="nt-item-pesan">
                          {n.type === "donasi-masuk" && n.wallet && n.jumlah ? (
                            <>Wallet <code>{n.wallet.slice(0,8)}...{n.wallet.slice(-4)}</code> berdonasi{" "}
                            <span className="nt-eth">{n.jumlah} ETH</span>
                            {n.kampanye && <> ke <strong>{n.kampanye}</strong></>}.</>
                          ) : n.type === "donasi-berhasil" && n.jumlah ? (
                            <>Donasi <span className="nt-eth">{n.jumlah} ETH</span> kamu
                            {n.kampanye && <> ke <strong>{n.kampanye}</strong></>} telah dikonfirmasi on-chain.</>
                          ) : (
                            n.pesan
                          )}
                        </p>

                        {n.type === "disetujui"       && n.reqId && <a href={"/campaign/saya/" + n.reqId} className="nt-item-link">Kelola Campaign <FiChevronRight size={12} /></a>}
                        {n.type === "donasi-masuk"    && n.reqId && <a href={"/campaign/saya/" + n.reqId} className="nt-item-link">Lihat Donasi Masuk <FiChevronRight size={12} /></a>}
                        {n.type === "donasi-berhasil" && n.reqId && <a href={"/donasi/" + n.reqId}        className="nt-item-link">Lihat Kampanye <FiChevronRight size={12} /></a>}
                        {n.type === "ditolak"                    && <a href="/daftar-campaign"            className="nt-item-link">Ajukan Ulang <FiChevronRight size={12} /></a>}
                        {n.type === "voting-request"  && n.reqId && (
                          <a href={"/admin/pengajuan/" + n.reqId} className="nt-item-link voting">
                            <FiShield size={11} /> Vote Sekarang <FiChevronRight size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default NotificationUser;