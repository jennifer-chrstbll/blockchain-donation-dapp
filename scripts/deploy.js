const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../my-dapp-frontend/.env") });
const { ethers } = require("hardhat");
const fs = require("fs");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Path .env frontend relatif dari folder hardhat project
// Sesuaikan jika struktur folder kamu berbeda
const FRONTEND_ENV_PATH = path.resolve(__dirname, "../my-dapp-frontend/.env");

// ============================================================
// Admin yang diotorisasi (hardcoded, Hardhat default accounts)
// ============================================================
const MAIN_ADMIN = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // accounts[0] = deployer
const BACKUP_ADMIN = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // accounts[1]

async function main() {
  const signers = await ethers.getSigners();
  const [deployer, account1, ...rest] = signers;

  console.log("Deploying with account:", deployer.address);
  console.log("Main admin  :", MAIN_ADMIN);
  console.log("Backup admin:", BACKUP_ADMIN);

  if (deployer.address.toLowerCase() !== MAIN_ADMIN.toLowerCase()) {
    throw new Error(`Deployer (${deployer.address}) bukan MAIN_ADMIN (${MAIN_ADMIN}). Pastikan akun pertama Hardhat.`);
  }

  // 1) CampaignFactory
  const CampaignFactory = await ethers.getContractFactory("CampaignFactory");
  const factory = await CampaignFactory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("CampaignFactory deployed:", factoryAddress);

  // 2) ValidatorSet
  const ValidatorSet = await ethers.getContractFactory("ValidatorSet");
  const validatorSet = await ValidatorSet.deploy(deployer.address);
  await validatorSet.waitForDeployment();
  const validatorSetAddress = await validatorSet.getAddress();
  console.log("ValidatorSet deployed:", validatorSetAddress);

  // --- SEED TOP10 (DEV LOCAL) ---
  const top10 = rest.slice(0, 10).map((s) => s.address);
  if (top10.length < 6) {
    throw new Error(`Not enough signers to seed top10. Need >= 6, got ${top10.length}`);
  }

  console.log("Seeding top10 validators:", top10);
  const txTop10 = await validatorSet.setTop10(top10);
  await txTop10.wait();
  console.log("Top10 seeded");

  // 3) StakingManager
  const StakingManager = await ethers.getContractFactory("StakingManager");
  const stakingManager = await StakingManager.deploy(deployer.address, validatorSetAddress);
  await stakingManager.waitForDeployment();
  const stakingManagerAddress = await stakingManager.getAddress();
  console.log("StakingManager deployed:", stakingManagerAddress);

  // 4) Tambah backup admin ke StakingManager
  console.log("Adding backup admin...");
  const txAddAdmin = await stakingManager.addAdmin(BACKUP_ADMIN);
  await txAddAdmin.wait();
  console.log("Backup admin added:", BACKUP_ADMIN);

  // 5) Set CampaignFactory di StakingManager
  console.log("Setting CampaignFactory in StakingManager...");
  const txSetFactory = await stakingManager.setCampaignFactory(factoryAddress);
  await txSetFactory.wait();
  console.log("StakingManager setCampaignFactory done");

  // 6) Transfer CampaignFactory ownership ke StakingManager
  console.log("Transferring CampaignFactory ownership to StakingManager...");
  const txTransferOwner = await factory.transferOwnership(stakingManagerAddress);
  await txTransferOwner.wait();
  console.log("CampaignFactory ownership transferred");

  // ============================================================
  // 7) Auto-update .env frontend (AMAN - tidak menghapus variable lain)
  // ============================================================
  console.log("\nUpdating frontend .env...");

  const newVars = {
    REACT_APP_FACTORY_ADDRESS: factoryAddress,
    REACT_APP_VALIDATORSET_ADDRESS: validatorSetAddress,
    REACT_APP_STAKINGMANAGER_ADDRESS: stakingManagerAddress,
  };

  // Baca .env lama kalau ada
  let envLines = [];
  if (fs.existsSync(FRONTEND_ENV_PATH)) {
    envLines = fs.readFileSync(FRONTEND_ENV_PATH, "utf8").split("\n");
  }

  // Update atau tambah tiap variable
  for (const [key, val] of Object.entries(newVars)) {
    const idx = envLines.findIndex((l) => l.startsWith(key + "="));
    const line = `${key}=${val}`;
    if (idx >= 0) {
      envLines[idx] = line; // update baris yang sudah ada
    } else {
      envLines.push(line);  // tambah kalau belum ada
    }
  }

  fs.writeFileSync(FRONTEND_ENV_PATH, envLines.join("\n"), "utf8");
  console.log(".env updated ->", FRONTEND_ENV_PATH);

  // ============================================================
  // 8) Auto-reset Supabase (hapus referensi blockchain lama)
  // ============================================================
  console.log("\nResetting Supabase data...");
  try {
    const { createClient } = require("@supabase/supabase-js");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { error: err1 } = await supabase
      .from("pengajuan_campaign")
      .update({ voting_contract: null, campaign_id: null })
      .not("id", "is", null);
    if (err1) throw err1;
    console.log("pengajuan_campaign reset");

    const { error: err2 } = await supabase
      .from("kampanye_aktif")
      .update({ contract_address: null })
      .not("id", "is", null);

    if (err2) throw err2;
    console.log("kampanye_aktif reset");

  } catch (e) {
    console.warn("Supabase reset gagal (lanjutkan manual):", e.message);
  }

  console.log("\n======================================");
  console.log("DEPLOY SELESAI");
  console.log("======================================");
  console.log("REACT_APP_FACTORY_ADDRESS=", factoryAddress);
  console.log("REACT_APP_VALIDATORSET_ADDRESS=", validatorSetAddress);
  console.log("REACT_APP_STAKINGMANAGER_ADDRESS=", stakingManagerAddress);
  console.log("");
  console.log("Admin aktif:");
  console.log(" - Main   :", MAIN_ADMIN);
  console.log(" - Backup :", BACKUP_ADMIN);
  console.log("======================================");
  console.log("Jangan lupa restart frontend: npm start");
  console.log("======================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});