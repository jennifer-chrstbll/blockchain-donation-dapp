import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom"; 
import { FiArrowLeft, FiAward, FiInfo } from "react-icons/fi"; 
import { useCampaign } from "../../context/CampaignContext";
import NavbarUser from "../../components/navbar-user";
import "../../styles/user/top-organizer.css";

// Helper untuk mengambil data user & inisial
function getCurrentUser() {
  try { return JSON.parse(sessionStorage.getItem("currentUser")) || {}; } catch { return {}; }
}
function getInisial(nama = "") {
  return nama.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "??";
}

export default function TopOrganizer() {
  const { reputation, fetchReputation } = useCampaign();
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  // Data user untuk Navbar agar inisial muncul benar
  const user = getCurrentUser();
  const inisial = getInisial(user.nama || "");

useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    async function load() {
      if (fetchReputation) await fetchReputation();
      setLoading(false);
    }
    load();
  }, [fetchReputation]); 

  const safeList = Array.isArray(reputation)
    ? [...reputation].sort((a, b) => b.rep_score - a.rep_score).slice(0, 10)
    : [];

  const getName  = (u) => u.display_name || u.nama || u.nama_organisasi || "Anonim";
  const getWallet= (u) => u.wallet || u.wallet_address || u.wallet_organizer || "";
  const getCount = (u) => u.campaigns_completed ?? u.total_campaign_sukses ?? u.jumlah_campaign_sukses ?? 0;
  const shortWallet = (w) => (w ? `${w.slice(0, 6)}...${w.slice(-4)}` : "-");

  const tierInfo = (count) => {
    if (count >= 10) return { label: "Legend", cls: "tier-legend" };
    if (count >= 5)  return { label: "Elite",  cls: "tier-elite"  };
    if (count >= 3)  return { label: "Pro",     cls: "tier-pro"    };
    return                  { label: "Rising", cls: "tier-rising" };
  };

  const medal = (rank) => rank === 1 ? "1st" : rank === 2 ? "2nd" : rank === 3 ? "3rd" : null;

  return (
    <div className="top-organizer-page">
      <NavbarUser showSearch={false} inisial={inisial} />

      <div className="to-container" style={{ maxWidth: "860px", margin: "0 auto" }}>

        <div className="to-header">
          <div>
            <h1 className="to-title">Top Organizer</h1>
            <p className="to-subtitle">10 organizer terbaik berdasarkan campaign yang berhasil</p>
          </div>
          <div className="to-badge-info"><FiAward size={12}/> Hall of Fame</div>
        </div>

        {loading ? (
          <div className="to-loading"><div className="to-spinner" /></div>
        ) : (
          <>
            <div className="to-leaderboard">
              <div className="to-lb-head">
                <span className="col-rank">Rank</span>
                <span className="col-name">Organizer</span>
                <span className="col-count">Campaign Sukses</span>
                <span className="col-tier">Tier</span>
              </div>

              {safeList.map((user, idx) => {
                const rank  = user.rank ?? idx + 1;
                const name  = getName(user);
                const count = getCount(user);
                const tier  = tierInfo(count);
                const m     = medal(rank);

                return (
                  <div key={getWallet(user) || name} className={`to-lb-row${rank <= 3 ? ` rank-${rank}` : ""}`}>
                    <div className="col-rank">
                      {m ? <span className="medal">{m}</span> : <span className="rank-num">#{rank}</span>}
                    </div>
                    <div className="col-name">
                      <div className={`to-avatar avatar-rank-${Math.min(rank, 4)}`}>{name.charAt(0)}</div>
                      <div className="to-name-block">
                        <span className="to-name">{name}</span>
                        <span className="to-wallet">{shortWallet(getWallet(user))}</span>
                      </div>
                    </div>
                    <div className="col-count">
                      <span className="count-num">{count}</span>
                      <span className="count-label">campaign</span>
                    </div>
                    <div className="col-tier"><span className={`to-tier-badge ${tier.cls}`}>{tier.label}</span></div>
                  </div>
                );
              })}
            </div>

            <div className="to-info-box">
              <FiInfo className="to-info-icon" />
              <span>Top 10 organizer ini terpilih menjadi kandidat validator untuk memverifikasi campaign baru secara acak di blockchain.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}