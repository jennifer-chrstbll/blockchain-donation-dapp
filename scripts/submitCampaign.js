const { ethers } = require("hardhat");

async function main() {
  const stakingManagerAddress = process.env.STAKINGMANAGER_ADDRESS;
  if (!stakingManagerAddress) throw new Error("Missing STAKINGMANAGER_ADDRESS");

  // Hardhat accounts:
  // [0] admin/deployer
  // [1] organizer
  // [2..] nanti dipakai voter untuk vote
  const [admin, organizer] = await ethers.getSigners();

  const StakingManager = await ethers.getContractFactory("StakingManager");
  const sm = StakingManager.attach(stakingManagerAddress);

  const stakeBond = ethers.parseEther("1");   // 1 ETH jaminan
  const votingFee  = ethers.parseEther("0.6"); // 0.6 ETH reward pool (dibagi)
  const salt = ethers.keccak256(ethers.toUtf8Bytes("campaign-1"));

  const tx = await sm.connect(organizer).submitCampaign(stakeBond, votingFee, salt, {
    value: stakeBond + votingFee,
  });

  console.log("submit tx:", tx.hash);
  const receipt = await tx.wait();

  // Cari event CampaignSubmitted
  const iface = sm.interface;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === "CampaignSubmitted") {
        console.log("CampaignSubmitted:", {
          campaignId: parsed.args.campaignId.toString(),
          organizer: parsed.args.organizer,
          stakeBond: parsed.args.stakeBond.toString(),
          votingFee: parsed.args.votingFee.toString(),
          votingContract: parsed.args.votingContract,
        });
      }
    } catch (e) {}
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});