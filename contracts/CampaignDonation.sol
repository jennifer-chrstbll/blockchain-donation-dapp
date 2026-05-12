// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IStakingManager {
    function getCampaignLifecycle(uint256 id) external view returns (
        uint8 lifecycle, uint256 fundraisingEndAt,
        uint256 proofDeadlineAt, uint256 disputeEndsAt, uint256 targetWei,
        bytes32 proofHash, uint256 proofSubmittedAt, uint256 frozenDonationAmount
    );
}

/// @title CampaignDonation - Kontrak donasi per kampanye (1 campaign = 1 contract)
contract CampaignDonation {
    uint256 public immutable campaignId;
    address public immutable organizer;
    address public immutable factory;
    address public immutable stakingManager; // bisa drain saat campaign di-freeze

    event DonationReceived(address indexed donor, uint256 amount, uint256 timestamp);
    event Withdrawn(address indexed to, uint256 amount, uint256 timestamp);
    event Drained(address indexed to, uint256 amount, uint256 timestamp);

    error NotOrganizer();
    error ZeroDonation();
    error NoBalance();
    error NotStakingManager();
    error NotFundraising();

    constructor(address _organizer, address _stakingManager, uint256 _campaignId) {
        require(_organizer != address(0), "organizer=0");
        require(_stakingManager != address(0), "sm=0");
        organizer = _organizer;
        factory = msg.sender; // address CampaignFactory yang deploy kontrak ini
        stakingManager = _stakingManager;
        campaignId = _campaignId;
    }

    modifier onlyActiveFundraising() {
        (uint8 lifecycle, uint256 fundraisingEndAt, , , , , , ) = IStakingManager(stakingManager).getCampaignLifecycle(campaignId);
        if (lifecycle != 1) revert NotFundraising(); // 1 = LifecycleStatus.Fundraising
        if (block.timestamp > fundraisingEndAt) revert NotFundraising();
        _;
    }

    /// @notice Donasi ETH ke kampanye
    function donate() external payable onlyActiveFundraising {
        if (msg.value == 0) revert ZeroDonation();
        emit DonationReceived(msg.sender, msg.value, block.timestamp);
    }

    /// @notice Organizer menarik dana campaign.
    /// Bisa dilakukan kapan saja setelah fundraising dimulai (target terpenuhi atau tidak).
    function withdraw() external {
        if (msg.sender != organizer) revert NotOrganizer();

        uint256 bal = address(this).balance;
        if (bal == 0) revert NoBalance();

        (bool ok, ) = organizer.call{value: bal}("");
        require(ok, "transfer failed");

        emit Withdrawn(organizer, bal, block.timestamp);
    }

    /// @notice StakingManager drain semua dana jika campaign dibekukan (report benar).
    /// Dana akan dikumpulkan di StakingManager untuk proses refund ke donatur off-chain.
    function drainToStakingManager() external {
        if (msg.sender != stakingManager) revert NotStakingManager();

        uint256 bal = address(this).balance;
        if (bal == 0) return; // tidak ada dana, tidak apa-apa

        (bool ok, ) = stakingManager.call{value: bal}("");
        require(ok, "drain failed");

        emit Drained(stakingManager, bal, block.timestamp);
    }

    /// @notice Receive ETH langsung tanpa panggil donate()
    receive() external payable onlyActiveFundraising {
        if (msg.value == 0) revert ZeroDonation();
        emit DonationReceived(msg.sender, msg.value, block.timestamp);
    }
}