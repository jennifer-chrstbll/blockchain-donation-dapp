const { ethers } = require("hardhat");

async function main() {
  const stakingManagerAddress = process.env.STAKINGMANAGER_ADDRESS;
  const campaignId = BigInt(process.env.CAMPAIGN_ID || "1");

  if (!stakingManagerAddress) throw new Error("Missing STAKINGMANAGER_ADDRESS");

  const [admin] = await ethers.getSigners();

  const StakingManager = await ethers.getContractFactory("StakingManager");
  const sm = StakingManager.attach(stakingManagerAddress);

  const tx = await sm.connect(admin).finalize(campaignId);
  console.log("finalize tx:", tx.hash);
  await tx.wait();

  const c = await sm.campaigns(campaignId);
  console.log("status:", c.status.toString(), "(1=Submitted,2=Approved,3=Rejected)");
  console.log("votingContract:", c.votingContract);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});