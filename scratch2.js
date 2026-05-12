const { ethers } = require("ethers");

const STAKING_MANAGER_READ_ABI = [
  "function campaigns(uint256) view returns (address organizer,uint256 stakeBond,uint256 votingFee,uint256 createdAt,uint8 status,address votingContract,bool bondRefunded,bool feeDistributed,uint8 lifecycle,uint256 fundraisingEndAt,uint256 proofDeadlineAt,uint256 disputeEndsAt,bytes32 proofHash,uint256 proofSubmittedAt,uint256 frozenDonationAmount)",
];

async function main() {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const smAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
    const sm = new ethers.Contract(smAddress, STAKING_MANAGER_READ_ABI, provider);
    
    // Just grab campaign id 1
    try {
        const c = await sm.campaigns(1);
        console.log("Campaign 1 data:");
        console.log(c);
        console.log("proofHash:", c.proofHash, typeof c.proofHash);
        console.log("proofSubmittedAt:", c.proofSubmittedAt, typeof c.proofSubmittedAt);
    } catch(e) {
        console.error("Error reading campaign 1:", e.message);
    }
}
main();
