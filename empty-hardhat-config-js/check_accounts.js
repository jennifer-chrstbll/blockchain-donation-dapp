// scripts/check_accounts.js
async function main() {
  const accounts = await ethers.getSigners();
  console.log("Jumlah akun yang tersedia:", accounts.length);
  
  // Cetak alamat akun ke-99 (indeks 98) sebagai bukti
  console.log("Alamat akun ke-99:", accounts[98].address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
