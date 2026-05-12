import { createContext, useContext, useEffect, useState } from "react";

const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [wallet, setWallet] = useState("");

  // 🔹 Ambil dari session saat reload
  useEffect(() => {
    const saved = sessionStorage.getItem("connectedWallet");
    if (saved) setWallet(saved);
  }, []);

  // 🔹 Sync dengan MetaMask
  useEffect(() => {
    if (!window.ethereum) return;

    const syncWallet = async () => {
      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });

      const acc = accounts?.[0] || "";
      setWallet(acc);

      if (acc) {
        sessionStorage.setItem("connectedWallet", acc);
      } else {
        sessionStorage.removeItem("connectedWallet");
      }
    };

    syncWallet();

    const handleAccountsChanged = (accounts) => {
      const acc = accounts?.[0] || "";
      setWallet(acc);

      if (acc) {
        sessionStorage.setItem("connectedWallet", acc);
      } else {
        sessionStorage.removeItem("connectedWallet");
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, []);

  return (
    <WalletContext.Provider value={{ wallet, setWallet }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);