const { ethers } = require("hardhat");

async function main() {
  const stakingManagerAddress = process.env.STAKINGMANAGER_ADDRESS;
  if (!stakingManagerAddress) throw new Error("Missing STAKINGMANAGER_ADDRESS");

  const sm = await ethers.getContractAt("StakingManager", stakingManagerAddress);

  const filter = sm.filters.CampaignSubmitted();
  const events = await sm.queryFilter(filter, 0, "latest");

  console.log("Found CampaignSubmitted events:", events.length);
  for (const e of events) {
    const { campaignId, organizer, stakeBond, votingFee, votingContract } = e.args;
    console.log({
      campaignId: campaignId.toString(),
      organizer,
      stakeBond: stakeBond.toString(),
      votingFee: votingFee.toString(),
      votingContract,
      blockNumber: e.blockNumber,
      txHash: e.transactionHash,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});