# 📚 Comprehensive Project Summary: Blockchain Campaign DApp

Dokumen ini adalah rangkuman lengkap dari seluruh arsitektur, aturan bisnis, kontrak, dan ekonomi dari proyek **Decentralized Campaign DApp** yang telah kita bangun.

---

## 1. 🏗️ Arsitektur & Tools yang Digunakan

Proyek ini menggunakan arsitektur **Web2.5 (Hybrid)**. Mengapa hybrid? Karena menaruh *semua* data di Blockchain (seperti foto dan deskripsi panjang) akan memakan biaya (Gas Fee) yang sangat mahal dan lambat.

*   **Frontend:** React.js
*   **Web3 Library:** Ethers.js v6 (Untuk jembatan komunikasi antara React dan Blockchain).
*   **Wallet:** MetaMask (Sebagai identitas user, manajemen *private key*, dan persetujuan transaksi).
*   **Blockchain Network:** Hardhat Localhost (EVM Compatible).
*   **Smart Contracts:** Solidity (Sebagai *backend logic* utama untuk mengamankan uang dan aturan mutlak).
*   **Database Off-chain:** Supabase (PostgreSQL, Storage, & Auth). Digunakan untuk menyimpan metadata ringan (Judul, Deskripsi, Foto, KTP) agar UI website tetap cepat dan murah tanpa biaya gas.

### 🛡️ Keamanan Data Sensitif & Trustless
*   **Trustless (Tanpa Percaya Pihak Ketiga):** Uang donasi **TIDAK** dipegang oleh Admin website. Uang dikunci secara mutlak di dalam *Smart Contract*. Admin tidak bisa kabur membawa lari uang donatur.
*   **Data Privasi (KTP dll):** Disimpan di Supabase, **bukan di Blockchain**. Blockchain itu 100% transparan, jadi menaruh KTP di Blockchain adalah pelanggaran privasi tingkat fatal. Supabase dilengkapi dengan **Row Level Security (RLS)** sehingga hanya Admin yang bisa melihat dokumen sensitif.

---

## 2. 📜 Smart Contracts & Kegunaannya

Sistem ini dipecah menjadi beberapa kontrak agar lebih aman dan modular:

1.  **`StakingManager.sol` (The Core Brain):** Pusat dari segala logika. Kontrak ini menyimpan status/lifecycle campaign, menyimpan jaminan uang (Stake Bond) dari Organizer dan Pelapor, serta membagikan hadiah (Fee) ke Validator.
2.  **`CampaignFactory.sol`:** Pabrik pencetak kontrak. Bertugas untuk men-deploy `CampaignDonation` baru setiap kali ada campaign yang lolos verifikasi.
3.  **`CampaignDonation.sol`:** Brankas uang. Setiap campaign memiliki alamat kontrak donasinya sendiri-sendiri. Kontrak ini memastikan uang hanya bisa masuk jika statusnya sedang *Fundraising* (Gembok Donasi Otomatis), dan hanya bisa ditarik oleh Organizer jika statusnya sudah *Completed*.
4.  **`ValidatorSet.sol`:** Kontrak yang menyimpan daftar Top 10 Validator (berdasarkan poin reputasi dari Supabase). Kontrak ini juga bertugas mengocok dan memilih 6 validator secara acak untuk sebuah voting.
5.  **`GovernanceVoting.sol`:** Kontrak khusus yang dibuat per-voting. Mengatur tenggat waktu 3 hari dan sistem shift 24 jam untuk tiap validator.

---

## 3. 💸 Ekonomi Sistem (Siapa Bayar Apa & Berapa)

Setiap aksi yang mengubah data di Blockchain membutuhkan biaya **Gas Fee**. Di luar Gas Fee, ini adalah perputaran uang (ETH) di dalam sistem:

| Action / Peristiwa | Siapa yang Membayar? | Jumlah | Catatan |
| :--- | :--- | :--- | :--- |
| **Membuat Campaign** | Organizer | **0.65 ETH** | 0.05 ETH dikunci sebagai jaminan (*Stake Bond*). 0.6 ETH diberikan ke sistem untuk upah (*Voting Fee*) bagi validator. |
| **Campaign Ditolak (Voting)** | Sistem | **0.05 ETH** | Jika divoting NO, jaminan 0.05 ETH dikembalikan ke Organizer. Uang 0.6 ETH hangus dibagi ke validator yang bekerja. |
| **Voting Campaign** | Validator | Hanya Gas Fee | Validator yang nge-vote tepat waktu akan mendapat bagian dari *Voting Fee* (0.6 ETH dibagi rata) + 2 Poin Reputasi. |
| **Donasi** | Donatur | **Bebas (ETH)** | Uang masuk murni ke brankas `CampaignDonation.sol`. |
| **Lapor Penipuan** | Pelapor (User) | **0.01 ETH** | Uang jaminan (*Report Bond*) agar orang tidak iseng melapor. |
| **Laporan Terbukti Benar** | Sistem | **0.04 ETH** | Pelapor mendapat kembali 0.01 ETH miliknya + merebut 60% (0.03 ETH) jaminan milik Organizer penipu! Sisanya masuk ke kas sistem/admin. |
| **Laporan Terbukti Palsu**| Sistem | **0.006 ETH** | Pelapor kehilangan jaminan 0.01 ETH miliknya. 60% (0.006 ETH) diberikan kepada Organizer sebagai kompensasi pencemaran nama baik, sisanya masuk ke Admin. |
| **Withdraw Donasi** | Organizer | Hanya Gas Fee | Hanya bisa dilakukan setelah campaign berstatus *Completed*. Jaminan 0.05 ETH juga akan ikut cair. |

---

## 4. ⚖️ Aturan (Rules) & Mengapa Harus Ada?

1.  **Rule: Organizer Wajib Bayar Jaminan (Stake Bond 0.05 ETH)**
    *   *Kenapa?* Mencegah spam (Sybil Attack). Membuat organizer punya "Skin in the game" agar tidak berniat menipu, karena jika menipu, jaminannya akan disita.
2.  **Rule: Pelapor Wajib Bayar Jaminan (Report Bond 0.01 ETH)**
    *   *Kenapa?* Mencegah kompetitor atau *troll* melaporkan campaign orang lain secara iseng. Hanya orang yang punya bukti valid yang berani mengambil risiko mempertaruhkan uangnya.
3.  **Rule: Pemilihan 6 Validator Secara Acak & Organizer Tidak Boleh Memilih Diri Sendiri**
    *   *Kenapa?* Mencegah *Conflict of Interest* (Konflik Kepentingan). Jika organizer membuat campaign, dia tidak boleh ikut mem-voting campaign-nya sendiri meskipun dia adalah Top 10 Validator. Acak berfungsi agar tidak ada kongkalikong antar validator.
4.  **Rule: Syarat Lulus Voting Minimal 4 YES (Supermajority)**
    *   *Kenapa?* Karena ini menyangkut uang donasi publik, persetujuan harus mutlak (mayoritas tinggi), bukan sekadar 50:50.
5.  **Rule: Reward Voting yang Besar (Total 0.6 ETH)**
    *   *Kenapa?* Untuk menarik validator Top 10 agar aktif berpartisipasi. Uniknya, jika ada validator yang tidak nge-vote (telat), jatah uang mereka akan **dibagi rata ke validator yang aktif**. Jadi, jika hanya 1 orang yang bekerja, dia bisa mengantongi seluruh 0.6 ETH tersebut!
6.  **Rule: Admin Remainder**
    *   *Kenapa?* Sisa pembagian uang (karena pembulatan angka) akan dikirim ke *Primary Admin* sebagai biaya operasional sistem.

---

## 5. ⏱️ Lifecycle & Tenggat Waktu (Time Rules)

Sistem ini diatur secara ketat oleh waktu blok di Blockchain (`block.timestamp`).

### A. Fase Voting (Max 3 Hari)
*   **Aturan:** 6 Validator terpilih masing-masing memiliki waktu **24 Jam** (1 Hari/Shift) dari waktu mereka ditugaskan.
*   **Jika YES:** Poin Reputasi Supabase +2.
*   **Jika NO:** Poin Reputasi Supabase +2. (Menolak juga berarti bekerja).
*   **Jika TIDAK VOTE (Lewat 24 Jam):** Poin Reputasi Supabase **-5 (Minus)**. Uang *Voting Fee*-nya hangus, dan dia bisa digantikan oleh validator cadangan.
*   **Prescreen Timeout (2 Hari):** Admin memiliki waktu 2 hari untuk memproses pengajuan. Jika Admin diam saja (AFK), Organizer bisa menarik kembali seluruh uangnya (0.65 ETH) secara otomatis melalui tombol refund.
*   *Hasil Akhir:* Jika YES $\ge$ 4 $\rightarrow$ Approved. Jika tidak $\rightarrow$ Rejected.

### B. Fase Fundraising (Ditentukan Organizer)
*   **Aturan:** Donasi hanya bisa masuk sebelum *Deadline* yang ditentukan Organizer saat membuat campaign tercapai.
*   **Opsi:* Organizer bisa menekan tombol "Selesai Lebih Awal" jika uang yang terkumpul sudah cukup sebelum deadline.
*   Jika masa fundraising habis, donasi otomatis ditolak oleh Smart Contract (*Reverted*).

### C. Fase Bukti & Dispute (Laporan)
*   **Aturan:** Setelah fundraising selesai (baik lewat deadline atau selesai awal), Organizer memiliki **Grace Period selama 7 Hari** untuk mengunggah bukti penggunaan dana. Jika dalam 7 hari bukti tidak diunggah, Organizer akan otomatis di-*Slash* dan jaminan 0.05 ETH disita oleh sistem.
*   **Dispute Window:** Selama **48 Jam** (2 Hari) setelah bukti diunggah, masa *Dispute* terbuka. Selama masa ini, Organizer **TIDAK BISA** menarik uang donasi. Uang ditahan oleh Smart Contract.
*   **Jika Ada Laporan:** Campaign otomatis *Frozen*. Admin turun tangan menginvestigasi secara manual.
    *   Jika Laporan Benar: Organizer di-Slash (-50 poin reputasi, jaminan 0.05 ETH dirampas), campaign ditutup, dana dikembalikan ke donatur (opsional/manual refund).
    *   Jika Laporan Salah: Uang Pelapor disita, campaign kembali lanjut.
*   **Jika Tidak Ada Laporan (Lewat 48 Jam):** Campaign otomatis berstatus **Completed**. Organizer mendapat +10 poin Reputasi dan fitur *Withdraw* terbuka.

---

## 6. 💡 Kesimpulan: Apakah App Ini Bener-Bener Butuh Blockchain?

**JAWABAN: SANGAT BUTUH.**

Aplikasi donasi Web2 konvensional (seperti Kitabisa / GoFundMe) memiliki kelemahan:
1.  **Sentralisasi Dana:** Uang donatur masuk ke rekening bank perusahaan platform. Jika perusahaan tersebut korup atau bangkrut, uang donasi bisa hilang.
2.  **Transparansi Palsu:** Angka "Terkumpul Rp100.000.000" di layar hanya sekadar angka di database yang bisa diubah oleh programmer kapan saja.

Dengan menggunakan arsitektur **Smart Contract** di DApp ini:
1.  **Custody:** Tidak ada manusia yang memegang uang. Kode komputer (Smart Contract) yang memegang uang tersebut secara matematis.
2.  **Immutability:** Ketika donatur mengirim 1 ETH, transaksi itu tertulis abadi di buku besar Ethereum. Tidak ada Admin yang bisa menghapus atau memalsukan catatan donasi tersebut.
3.  **Otomatisasi Hukuman:** Jika organizer menipu, jaminannya dipotong detik itu juga tanpa perlu melewati sidang pengadilan yang panjang.

Ini adalah bentuk evolusi *crowdfunding* di mana **"Trust" (Kepercayaan) digantikan oleh "Truth" (Kebenaran Matematis)**.
