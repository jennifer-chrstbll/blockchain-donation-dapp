const { ethers } = require("hardhat");

async function main() {
  const votingAddress = process.env.VOTING_ADDRESS;
  if (!votingAddress) throw new Error("Missing VOTING_ADDRESS");

  if (!ethers.isAddress(votingAddress)) {
    throw new Error(`VOTING_ADDRESS is not a valid address: ${votingAddress}`);
  }

  const gv = await ethers.getContractAt("GovernanceVoting", votingAddress);

  const voters = await gv.getVoters();
  console.log("Voters (initial + any replacements):");
  voters.forEach((v, i) => console.log(i, v));

  console.log("createdAt:", (await gv.createdAt()).toString());
  console.log("votingEndsAt:", (await gv.votingEndsAt()).toString());
  console.log("yesCount:", (await gv.yesCount()).toString());
  console.log("noCount:", (await gv.noCount()).toString());
  console.log("result:", (await gv.result()).toString(), "(0=pending,1=approved,2=rejected)");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});