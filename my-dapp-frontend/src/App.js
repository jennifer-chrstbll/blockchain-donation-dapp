import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CampaignProvider } from "./context/CampaignContext";
import { useEffect } from "react"; // penting

// PUBLIC
import Landing  from "./pages/landing";
import Login    from "./pages/login";
import Register from "./pages/register";

// USER
import HomeUser     from "./pages/user/home-user";
import AccountUser  from "./pages/user/account";
import NotifUser    from "./pages/user/notification";
import TopOrganizer from "./pages/user/top-organizer";

// USER: Donation
import PageDonation   from "./pages/user/donation/page-donation";
import DetailCampaign from "./pages/user/donation/campaign-detail";

// USER: open campaign
import DaftarCampaign     from "./pages/user/open-campaign/campaign-regist";
import DetailCampaignSaya from "./pages/user/open-campaign/campaign-detail";
import CampaignForm       from "./pages/user/open-campaign/campaign-form";
import LaporkanCampaign   from "./pages/user/laporkan-campaign";

// ADMIN
import HomeAdmin          from "./pages/admin/home-admin";
import AccountAdmin       from "./pages/admin/account";
import NotifAdmin         from "./pages/admin/notification";
import ListPengajuan      from "./pages/admin/submission-list";
import VerifySubmission   from "./pages/admin/verify-submission";
import ListCampaign       from "./pages/admin/campaign-list";
import CampaignDetailAdmin from "./pages/admin/campaign-detail";
import LaporanList        from "./pages/admin/laporan-list";
import KelolaAdmin        from "./pages/admin/kelola-admin";

import VotingDebug from "./pages/debug/VotingDebug";

import ProtectedRoute from "./components/ProtectedRoute";

function App() {

  // GLOBAL WALLET SYNC
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length > 0) {
        sessionStorage.setItem("connectedWallet", accounts[0]);

        console.log("Wallet berubah ke:", accounts[0]);

        // FORCE SYNC SEMUA HALAMAN
        window.location.reload();
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);

    // CLEANUP
    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, []);

  return (
    <CampaignProvider>
      <BrowserRouter>
        <Routes>

          {/* PUBLIC */}
          <Route path="/"         element={<Landing />} />
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* USER */}
          <Route path="/dashboard"   element={<ProtectedRoute allowedRole="user"><HomeUser /></ProtectedRoute>} />
          <Route path="/akun"        element={<ProtectedRoute allowedRole="user"><AccountUser /></ProtectedRoute>} />
          <Route path="/notifikasi"  element={<ProtectedRoute allowedRole="user"><NotifUser /></ProtectedRoute>} />
          <Route path="/top-organizer" element={<ProtectedRoute allowedRole="user"><TopOrganizer /></ProtectedRoute>} />
          {/* USER: donation */}
          <Route path="/donasi"      element={<ProtectedRoute allowedRole="user"><PageDonation /></ProtectedRoute>} />
          <Route path="/donasi/:id"  element={<ProtectedRoute allowedRole="user"><DetailCampaign /></ProtectedRoute>} />

          {/* USER: open campaign */}
          <Route path="/daftar-campaign"   element={<ProtectedRoute allowedRole="user"><DaftarCampaign /></ProtectedRoute>} />
          <Route path="/campaign/saya/:id" element={<ProtectedRoute allowedRole="user"><DetailCampaignSaya /></ProtectedRoute>} />
          <Route path="/buat-campaign"     element={<ProtectedRoute allowedRole="user"><CampaignForm /></ProtectedRoute>} />
          <Route path="/laporkan/:id"      element={<ProtectedRoute allowedRole="user"><LaporkanCampaign /></ProtectedRoute>} />

          {/* ADMIN */}
          <Route path="/admin/dashboard"     element={<ProtectedRoute allowedRole="admin"><HomeAdmin /></ProtectedRoute>} />
          <Route path="/admin/akun"          element={<ProtectedRoute allowedRole="admin"><AccountAdmin /></ProtectedRoute>} />
          <Route path="/admin/notifikasi"    element={<ProtectedRoute allowedRole="admin"><NotifAdmin /></ProtectedRoute>} />
          <Route path="/admin/pengajuan"     element={<ProtectedRoute allowedRole="admin"><ListPengajuan /></ProtectedRoute>} />
          <Route path="/admin/pengajuan/:id" element={<ProtectedRoute allowedRole={["admin", "user"]}><VerifySubmission /></ProtectedRoute>} />
          <Route path="/admin/campaign"      element={<ProtectedRoute allowedRole="admin"><ListCampaign /></ProtectedRoute>} />
          <Route path="/admin/campaign/:id"  element={<ProtectedRoute allowedRole="admin"><CampaignDetailAdmin /></ProtectedRoute>} />
          <Route path="/admin/laporan"       element={<ProtectedRoute allowedRole="admin"><LaporanList /></ProtectedRoute>} />
          <Route path="/admin/kelola-admin"  element={<ProtectedRoute allowedRole="admin"><KelolaAdmin /></ProtectedRoute>} />

          {/* DEBUG */}
          <Route path="/debug/voting" element={<VotingDebug />} />

        </Routes>
      </BrowserRouter>
    </CampaignProvider>
  );
}

export default App;