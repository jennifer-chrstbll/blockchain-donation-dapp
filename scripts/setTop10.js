const { ethers } = require("hardhat");

async function main() {
  const validatorSetAddress = process.env.VALIDATORSET_ADDRESS;
  if (!validatorSetAddress) throw new Error("Missing VALIDATORSET_ADDRESS env");

  const top10 = [
    "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720",
    "0xdD2FD4581271e230360230F9337D5c0430Bf44C0",
    "0xBcd4042DE499D14e55001CcbB24a551F3b954096",
    "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
    "0xFABB0ac9d68B0B445fB7357272Ff202C5651694a",
    "0x71bE63f3384f5fb98995898A86B02Fb2426c5788",
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec",
    "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
  ];

  const ValidatorSet = await ethers.getContractFactory("ValidatorSet");
  const vs = ValidatorSet.attach(validatorSetAddress);

  const tx = await vs.setTop10(top10);
  console.log("setTop10 tx:", tx.hash);
  await tx.wait();
  console.log("Top10 updated!");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});