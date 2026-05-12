const { ethers } = require("hardhat");

async function main() {
  const votingAddress = process.env.VOTING_ADDRESS;
  const voterIndex = Number(process.env.VOTER_INDEX || "2");
  const choice = (process.env.CHOICE || "yes").toLowerCase();

  if (!votingAddress) throw new Error("Missing VOTING_ADDRESS");
  if (!ethers.isAddress(votingAddress)) {
    throw new Error(`VOTING_ADDRESS is not a valid address: ${votingAddress}`);
  }

  const signers = await ethers.getSigners();
  const voter = signers[voterIndex];
  if (!voter) throw new Error(`No signer at index ${voterIndex}`);

  const gv = await ethers.getContractAt("GovernanceVoting", votingAddress);

  const c = choice === "yes" ? 1 : 2; // None=0, Yes=1, No=2
  const tx = await gv.connect(voter).vote(c);

  console.log(`vote(${choice}) from signer[${voterIndex}] ${voter.address} tx:`, tx.hash);
  await tx.wait();

  console.log("yesCount:", (await gv.yesCount()).toString());
  console.log("noCount:", (await gv.noCount()).toString());
  console.log("result:", (await gv.result()).toString());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});