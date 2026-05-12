import { ethers } from "ethers";
import { FACTORY_ADDRESS } from "./config";
import FactoryArtifact from "./abi/CampaignFactory.json";
import CampaignArtifact from "./abi/CampaignDonation.json";

export function getBrowserProvider() {
  if (!window.ethereum) throw new Error("MetaMask tidak terdeteksi");
  return new ethers.BrowserProvider(window.ethereum);
}

export async function getSigner() {
  const provider = getBrowserProvider();
  await provider.send("eth_requestAccounts", []);
  return provider.getSigner();
}

export async function getFactoryContractWithSigner() {
  const signer = await getSigner();
  return new ethers.Contract(FACTORY_ADDRESS, FactoryArtifact.abi, signer);
}

export function getCampaignContract(address, signerOrProvider) {
  return new ethers.Contract(address, CampaignArtifact.abi, signerOrProvider);
}