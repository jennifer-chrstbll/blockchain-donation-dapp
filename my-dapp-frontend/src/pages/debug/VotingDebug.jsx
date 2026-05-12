import React, { useMemo, useState } from "react";
import { ethers } from "ethers";

// ABI minimal untuk fungsi yang kita pakai
const GOVERNANCE_VOTING_ABI = [
  "function getVoters() view returns (address[])",
  "function yesCount() view returns (uint256)",
  "function noCount() view returns (uint256)",
  "function result() view returns (uint8)",
  "function vote(uint8 c)",
];

const STAKING_MANAGER_ABI = [
  "function finalize(uint256 campaignId)",
  "function campaigns(uint256) view returns (address organizer,uint256 stakeBond,uint256 votingFee,uint256 createdAt,uint8 status,address votingContract,bool bondRefunded,bool feeDistributed)"
];

export default function VotingDebug() {
  const [wallet, setWallet] = useState("");
  const [votingAddress, setVotingAddress] = useState("0xE451980132E65465d0a498c53f0b5227326Dd73F"); // dari campaignId=2
  const [campaignId, setCampaignId] = useState("2");
  const [voters, setVoters] = useState([]);
  const [counts, setCounts] = useState({ yes: "0", no: "0", result: "0" });
  const [statusText, setStatusText] = useState("");

  const stakingManagerAddress = process.env.REACT_APP_STAKINGMANAGER_ADDRESS;

  const provider = useMemo(() => {
    if (!window.ethereum) return null;
    return new ethers.BrowserProvider(window.ethereum);
  }, []);

  const connect = async () => {
    if (!provider) return alert("Metamask tidak ada");
    const accs = await provider.send("eth_requestAccounts", []);
    setWallet(accs[0]);
  };

  const votingContract = async () => {
    const signer = await provider.getSigner();
    return new ethers.Contract(votingAddress, GOVERNANCE_VOTING_ABI, signer);
  };

  const stakingContract = async () => {
    const signer = await provider.getSigner();
    return new ethers.Contract(stakingManagerAddress, STAKING_MANAGER_ABI, signer);
  };

  const refresh = async () => {
    try {
      const vc = await votingContract();
      const [vs, yes, no, result] = await Promise.all([
        vc.getVoters(),
        vc.yesCount(),
        vc.noCount(),
        vc.result(),
      ]);
      setVoters(vs);
      setCounts({ yes: yes.toString(), no: no.toString(), result: result.toString() });
      setStatusText("Refreshed");
    } catch (e) {
      console.error(e);
      setStatusText(String(e?.message || e));
    }
  };

  const voteYes = async () => {
    try {
      const vc = await votingContract();
      const tx = await vc.vote(1); // Yes=1
      setStatusText("Voting YES tx: " + tx.hash);
      await tx.wait();
      await refresh();
    } catch (e) {
      console.error(e);
      setStatusText(String(e?.shortMessage || e?.message || e));
    }
  };

  const voteNo = async () => {
    try {
      const vc = await votingContract();
      const tx = await vc.vote(2); // No=2
      setStatusText("Voting NO tx: " + tx.hash);
      await tx.wait();
      await refresh();
    } catch (e) {
      console.error(e);
      setStatusText(String(e?.shortMessage || e?.message || e));
    }
  };

    const finalize = async () => {
    try {
        const sm = await stakingContract();
        // cukup pakai string/number, jangan BigInt
        const tx = await sm.finalize(campaignId); 
        setStatusText("Finalize tx: " + tx.hash);
        await tx.wait();
        setStatusText("Finalized");
    } catch (e) {
        console.error(e);
        setStatusText(String(e?.shortMessage || e?.message || e));
    }
    };

  return (
    <div style={{ padding: 20 }}>
      <h2>Voting Debug (Localhost)</h2>

      <button onClick={connect}>Connect Wallet</button>
      <div>Wallet: {wallet || "-"}</div>

      <hr />

      <div>
        <label>Voting Contract Address</label>
        <input
          style={{ width: "100%" }}
          value={votingAddress}
          onChange={(e) => setVotingAddress(e.target.value)}
        />
      </div>

      <div style={{ marginTop: 10 }}>
        <label>Campaign ID</label>
        <input value={campaignId} onChange={(e) => setCampaignId(e.target.value)} />
      </div>

      <div style={{ marginTop: 10 }}>
        <button onClick={refresh}>Refresh</button>
        <button onClick={voteYes} style={{ marginLeft: 10 }}>Vote YES</button>
        <button onClick={voteNo} style={{ marginLeft: 10 }}>Vote NO</button>
        <button onClick={finalize} style={{ marginLeft: 10 }}>Finalize</button>
      </div>

      <div style={{ marginTop: 10 }}>YES: {counts.yes} | NO: {counts.no} | Result: {counts.result} (0 pending, 1 approved, 2 rejected)</div>

      <h3>Voters</h3>
      <ol>
        {voters.map((v) => <li key={v}>{v}</li>)}
      </ol>

      <pre style={{ background: "#111", color: "#0f0", padding: 10 }}>
        {statusText}
      </pre>

      <p>
        Pastikan kamu switch MetaMask ke wallet yang ada di daftar voter untuk bisa vote.
      </p>
    </div>
  );
}