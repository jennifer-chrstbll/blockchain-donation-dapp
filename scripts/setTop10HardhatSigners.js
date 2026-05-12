const { ethers } = require("hardhat");

async function main() {
  const validatorSetAddress = process.env.VALIDATORSET_ADDRESS;
  if (!validatorSetAddress) throw new Error("Missing VALIDATORSET_ADDRESS");

  const signers = await ethers.getSigners();

  // ambil signer[1..10] untuk jadi Top10 (biar admin signer[0] tidak ikut pool)
  const top10 = signers.slice(1, 11).map((s) => s.address);

  console.log("Using these addresses as Top10:");
  top10.forEach((a, i) => console.log(i + 1, a));

  const vs = await ethers.getContractAt("ValidatorSet", validatorSetAddress);
  const tx = await vs.setTop10(top10);

  console.log("setTop10 tx:", tx.hash);
  await tx.wait();
  console.log("Top10 updated (hardhat signers)!");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});