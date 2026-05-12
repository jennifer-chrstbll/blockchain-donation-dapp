# DonasiChain — Blockchain Crowdfunding DApp

## Overview

DonasiChain is a decentralized crowdfunding platform built on Ethereum that combines smart contracts, decentralized governance, staking mechanisms, and validator-based campaign verification to create a transparent and secure donation ecosystem.

Unlike traditional crowdfunding systems, campaign approval and validation are governed through blockchain-based voting mechanisms involving selected validators instead of relying solely on centralized administrators.

The system was developed as a Web3 decentralized application (DApp) integrating Solidity smart contracts, React.js frontend architecture, Ethereum blockchain interaction, and Supabase-based off-chain storage.

---

## Features

- Decentralized crowdfunding platform
- Ethereum smart contract integration
- Validator-based governance voting
- Stake bond anti-spam mechanism
- Fraud reporting & slashing system
- MetaMask wallet authentication
- Campaign fundraising system
- Real-time blockchain interaction
- Role-based admin dashboard
- Reputation & Top Organizer leaderboard
- Hybrid Web2.5 architecture (On-chain + Off-chain)

---

## Core Governance Mechanism

### Stake Bond System

Campaign organizers are required to lock a stake bond before opening campaigns to reduce spam and Sybil attacks.

### Validator Voting

Campaigns are verified through decentralized voting involving randomly selected validators from the Top Organizer pool.

### Fraud Reporting System

Users can report suspicious campaigns through an on-chain reporting mechanism with staking and slashing logic.

### Reward Distribution

Validators receive ETH-based incentives for participating in governance voting.

---

## Technologies Used

### Blockchain & Smart Contracts

- Solidity ^0.8.x
- Ethereum
- Smart Contracts
- Ethers.js v6
- Hardhat

### Frontend

- React.js 19
- JavaScript
- HTML
- CSS

### Backend & Database

- Supabase
- Prisma ORM
- Node.js

### Wallet Integration

- MetaMask

### Development Environment

- Hardhat Local Network
- npm
- Chain ID 31337

---

## Smart Contract Architecture

The platform consists of multiple interacting smart contracts:

| Smart Contract | Purpose |
|---|---|
| `StakingManager.sol` | Campaign staking & management |
| `ValidatorSet.sol` | Validator selection & management |
| `GovernanceVoting.sol` | Voting session governance |
| `CampaignFactory.sol` | Campaign contract deployment |
| `CampaignDonation.sol` | Donation handling |

---

## System Workflow

```text
Organizer Creates Campaign
            ↓
      Stake Bond Lock
            ↓
 Admin Prescreen Verification
            ↓
 Random Validator Selection
            ↓
   Governance Voting Session
            ↓
 Campaign Approved / Rejected
            ↓
      Fundraising Opens
            ↓
      Donation Collection
            ↓
 Proof Submission & Validation
            ↓
 Campaign Completion
```

---

## Project Architecture

```text
Frontend (React.js)
        ↓
 ethers.js v6
        ↓
 Ethereum Smart Contracts
        ↓
 Hardhat Local Blockchain
        ↓
 Supabase (Off-chain Metadata)
```
---

# Running the Frontend

After cloning or pulling the latest changes from the repository, follow these steps to run the frontend:

## 1. Navigate to Frontend Folder

Open a terminal (#1):

```bash
cd my-dapp-frontend
```

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Install EmailJS

```bash
npm install @emailjs/browser
```

---

## 4. Create Environment Variables

Create a `.env` file inside `my-dapp-frontend/`:

```dotenv
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key
REACT_APP_EMAILJS_SERVICE_ID=your_service_id
REACT_APP_EMAILJS_TEMPLATE_ID=your_template_id
REACT_APP_EMAILJS_PUBLIC_KEY=your_public_key
REACT_APP_RPC_URL=http://127.0.0.1:8545
SUPABASE_SERVICE_KEY=your_service_role_key
```

> `REACT_APP_FACTORY_ADDRESS`, `REACT_APP_VALIDATORSET_ADDRESS`, and `REACT_APP_STAKINGMANAGER_ADDRESS` will be generated automatically during deployment.

---

## 5. Start Local Blockchain

Open terminal (#2):

```bash
npx hardhat node
```

This launches a local Ethereum development blockchain with pre-funded accounts for testing.

---

## 6. Deploy Smart Contracts

Open terminal (#3):

```bash
npx hardhat run scripts/deploy.js --network localhost
```

This deploys:
- StakingManager
- ValidatorSet
- GovernanceVoting
- CampaignFactory
- CampaignDonation

---

## 7. Start Frontend Application

Return to terminal (#1):

```bash
npm start
```

The frontend application should now be running locally.

---

## MetaMask Configuration

### Network Settings

| Parameter | Value |
|---|---|
| Network Name | Hardhat Local |
| RPC URL | http://127.0.0.1:8545 |
| Chain ID | 31337 |
| Currency Symbol | ETH |

### Important Development Note

During local Hardhat development, MetaMask may cache old nonce/activity data, causing transactions to remain pending indefinitely.

Before starting demo/testing sessions:

1. Open MetaMask
2. Go to **Settings**
3. Open **Advanced**
4. Click **Clear activity and nonce data**

Repeat this for each testing account if necessary.

---

## Key Features Demonstrated

- Decentralized campaign governance
- ETH staking mechanisms
- Validator-based voting
- Fraud reporting & slashing
- Campaign donation tracking
- Real-time blockchain synchronization
- Wallet authentication using MetaMask
- On-chain transaction transparency
- Role-based access control
- Hybrid on-chain/off-chain architecture

---

## Security Concepts Implemented

- Checks-Effects-Interactions pattern
- Stake slashing mechanism
- Anti-spam reporting bond
- Role-based access control
- Validator conflict-of-interest prevention
- Pull payment reward distribution
- Campaign fund isolation

---

## Testing Environment

| Component | Specification |
|---|---|
| Blockchain | Ethereum (EVM-compatible) |
| Smart Contract Language | Solidity ^0.8.20 |
| Framework | Hardhat |
| Frontend | React.js 19 |
| Blockchain Library | ethers.js v6 |
| Wallet | MetaMask |
| Node.js | >=18.x |

---

## Research & Documentation

The project includes:
- Smart contract architecture analysis
- Governance mechanism design
- Gas cost analysis
- Fraud prevention strategy
- Validator economics
- Security evaluation
- Decentralized governance discussion

Additional documentation is available in:

```text
paper/paper.pdf
```

---

## Future Improvements

- DAO-based dispute resolution
- Chainlink VRF integration
- Layer-2 deployment (Optimism/Arbitrum)
- IPFS decentralized storage
- Multi-chain support
- Real-time blockchain notifications
- Smart contract security audit
- Mobile wallet integration

---

## Credits

This project was developed collaboratively as a blockchain/Web3 decentralized application research and development project.

Original contributors and repository history are preserved and credited appropriately through GitHub collaboration and fork records.
