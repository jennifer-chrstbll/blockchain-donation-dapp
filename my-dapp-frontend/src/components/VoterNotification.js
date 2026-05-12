import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { supabase } from "../web3/supabaseClient";

const GOVERNANCE_VOTING_ABI = [
  "function getVoters() view returns (address[])",
  "function result() view returns (uint8)"
];

export default function VoterNotification() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const provider = useMemo(() => {
    if (!window.ethereum) return null;
    return new ethers.BrowserProvider(window.ethereum);
  }, []);

  useEffect(() => {
    async function fetchTasks() {
      if (!provider) {
        setLoading(false);
        return;
      }

      try {
        const signer = await provider.getSigner();
        const wallet = await signer.getAddress();

        // 1. Ambil semua pengajuan yang sudah ada di blockchain (punya voting_contract)
        const { data: campaigns, error } = await supabase
          .from("pengajuan_campaign")
          .select("*")
          .not("voting_contract", "is", null);

        if (error || !campaigns) throw error;

        const myTasks = [];

        // 2. Cek ke blockchain satu per satu, apakah wallet ini berhak ngevote
        for (let c of campaigns) {
          try {
            const vc = new ethers.Contract(c.voting_contract, GOVERNANCE_VOTING_ABI, provider);
            
            // Cek apakah status masih pending (0)
            const res = await vc.result();
            if (res.toString() === "0") { 
              const voters = await vc.getVoters();
              // Jika wallet aktif ada di daftar voters on-chain
              const isVoter = voters.some(v => v.toLowerCase() === wallet.toLowerCase());
              
              if (isVoter) {
                myTasks.push(c);
              }
            }
          } catch (e) {
            console.warn("Gagal cek kontrak:", c.voting_contract, e);
          }
        }
        setTasks(myTasks);
      } catch (e) {
        console.error("Error fetching voter tasks:", e);
      } finally {
        setLoading(false);
      }
    }
    
    fetchTasks();
  }, [provider]);

  if (loading) return null;
  if (tasks.length === 0) return null;

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(168,77,44,0.15) 0%, rgba(255,167,87,0.08) 100%)",
      border: "1px solid rgba(255,167,87,0.25)",
      borderRadius: "24px", 
      padding: "22px 28px", 
      marginBottom: "24px",
      boxShadow: "0 8px 32px -8px rgba(168,77,44,0.25)"
    }}>
      <h3 style={{ color: "#ffa757", margin: "0 0 8px", fontSize: "18px", fontFamily: "'Playfair Display', serif", fontWeight: 800 }}>
        🔔 Tugas Validator Anda ({tasks.length})
      </h3>
      <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", margin: "0 0 16px", fontFamily: "'DM Sans', sans-serif" }}>
        Selamat! Anda terpilih secara acak dari Top 10 Organizer untuk memvalidasi campaign berikut.
      </p>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {tasks.map(t => (
          <div key={t.id} style={{
            background: "rgba(255,255,255,0.04)", 
            border: "1px solid rgba(255,255,255,0.08)",
            padding: "14px 18px", 
            borderRadius: "14px", 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            fontFamily: "'DM Sans', sans-serif"
          }}>
            <div>
            <div style={{ fontSize: "15px", fontWeight: "700", color: "white" }}>
                {t.judul_kampanye || t.judulKampanye || "Campaign tanpa judul"}
            </div>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginTop: "4px" }}>
                {t.nama_org || t.namaOrganisasi || ""}
            </div>
            </div>
            
            {/* Tombol ini akan melempar user ke panel voting yang sudah Anda buat */}
            <Link to={`/admin/pengajuan/${t.id}`} style={{
              background: "linear-gradient(to right, #a84d2c, #ffa757)", 
              color: "white",
              padding: "10px 20px", 
              borderRadius: "100px", 
              fontSize: "12px", 
              fontWeight: "700", 
              textDecoration: "none",
              boxShadow: "0 4px 12px rgba(168,77,44,0.3)"
            }}>
              Lakukan Voting
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}