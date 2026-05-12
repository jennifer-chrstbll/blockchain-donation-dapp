import { useEffect, useState } from "react";
import { FiSlash, FiAlertTriangle, FiMail, FiX, FiShield } from "react-icons/fi";
import { supabase } from "../web3/supabaseClient";

function getCurrentUser() {
  try {
    return JSON.parse(sessionStorage.getItem("currentUser")) || {};
  } catch {
    return {};
  }
}

export default function BanGuard() {
  const [banData, setBanData]   = useState(null); // { is_banned, ban_reason }
  const [checked, setChecked]   = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    const wallet = (user.wallet || "").toLowerCase();

    if (!wallet || user.role === "admin") {
      setChecked(true);
      return;
    }

    // Initial fetch
    supabase
      .from("organizer_reputation")
      .select("is_banned, ban_reason")
      .eq("wallet", wallet)
      .maybeSingle()
      .then(({ data }) => {
        setBanData(data || null);
        setChecked(true);
      });

    // Realtime: update langsung kalau status ban berubah
    const channel = supabase
      .channel(`ban-guard-${wallet}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "organizer_reputation",
          filter: `wallet=eq.${wallet}`,
        },
        (payload) => {
          setBanData({
            is_banned: payload.new?.is_banned,
            ban_reason: payload.new?.ban_reason,
          });
          // Reset dismiss ketika status ban berubah
          if (payload.new?.is_banned) setDismissed(false);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  if (!checked || !banData?.is_banned || dismissed) return null;

  const reason = banData.ban_reason;

  return (
    <>
      <style>{`
        @keyframes banGuardIn {
          from { opacity: 0; transform: translateY(-16px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes banPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.3); }
          50%       { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
        }
        .ban-guard-icon-pulse {
          animation: banPulse 2s ease infinite;
        }
      `}</style>

      <div style={{
        width: "100%",
        background: "linear-gradient(135deg, #1a0505 0%, #2d0a0a 60%, #1f0606 100%)",
        border: "1.5px solid rgba(239,68,68,0.45)",
        borderRadius: 18,
        padding: "20px 22px",
        marginBottom: 24,
        animation: "banGuardIn 0.35s cubic-bezier(0.22,1,0.36,1)",
        position: "relative",
        overflow: "hidden",
      }}>

        {/* Decorative glow */}
        <div style={{
          position: "absolute", top: -30, right: -30,
          width: 120, height: 120,
          background: "radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Dismiss button */}
        <button
          onClick={() => setDismissed(true)}
          style={{
            position: "absolute", top: 14, right: 14,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6, width: 26, height: 26,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "rgba(255,255,255,0.35)",
            transition: "all 0.15s",
          }}
          title="Tutup peringatan (status ban tetap aktif)"
        >
          <FiX size={13} />
        </button>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>

          {/* Icon */}
          <div
            className="ban-guard-icon-pulse"
            style={{
              background: "linear-gradient(135deg, rgba(239,68,68,0.25), rgba(220,38,38,0.15))",
              border: "1.5px solid rgba(239,68,68,0.5)",
              borderRadius: "50%",
              width: 52, height: 52,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <FiSlash size={24} color="#f87171" />
          </div>

          {/* Content */}
          <div style={{ flex: 1, paddingRight: 24 }}>

            {/* Title row */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <FiAlertTriangle size={13} color="#f87171" />
              <span style={{
                fontWeight: 900, fontSize: 15,
                color: "#fca5a5", letterSpacing: 0.2,
                textTransform: "uppercase", fontSize: 13,
              }}>
                ⛔ Akun Anda Sedang Di-Ban
              </span>
            </div>

            {/* Reason */}
            {reason && (
              <div style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: 10, padding: "10px 14px",
                marginBottom: 12,
              }}>
                <p style={{ margin: 0, fontSize: 13, color: "#fca5a5", lineHeight: 1.6, fontWeight: 600 }}>
                  📋 Alasan: <span style={{ fontWeight: 400, color: "rgba(252,165,165,0.9)" }}>{reason}</span>
                </p>
              </div>
            )}

            {/* What is blocked */}
            <div style={{ marginBottom: 12 }}>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
                Aktivitas yang diblokir selama masa ban:
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[
                  "❌ Buat Campaign Baru",
                  "❌ Donasi",
                  "❌ Ajukan Laporan",
                ].map((item) => (
                  <span key={item} style={{
                    fontSize: 11, fontWeight: 600,
                    padding: "3px 10px",
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    borderRadius: 999,
                    color: "rgba(252,165,165,0.8)",
                  }}>
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <FiMail size={12} color="rgba(252,165,165,0.4)" />
              <span style={{ fontSize: 12, color: "rgba(252,165,165,0.45)" }}>
                Jika Anda merasa ini adalah kesalahan, hubungi admin platform.
              </span>
            </div>

          </div>
        </div>

        {/* Bottom badge */}
        <div style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: "1px solid rgba(239,68,68,0.15)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <FiShield size={11} color="rgba(239,68,68,0.5)" />
          <span style={{ fontSize: 11, color: "rgba(239,68,68,0.45)", fontWeight: 600 }}>
            Status ban ditegakkan oleh Smart Contract · Tidak dapat melewati pembatasan ini
          </span>
        </div>

      </div>
    </>
  );
}
