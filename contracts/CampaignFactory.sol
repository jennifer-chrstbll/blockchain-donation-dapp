// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./CampaignDonation.sol";

/// @title CampaignFactory - Hanya admin (owner) yang boleh deploy kontrak kampanye baru
contract CampaignFactory {
    address public owner;

    event CampaignCreated(
        address indexed campaignAddress,
        address indexed organizer,
        address indexed createdBy,
        uint256 timestamp
    );

    error NotOwner();

    constructor() {
        owner = msg.sender; // wallet admin = deployer factory
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "newOwner=0");
        owner = newOwner;
    }

    /// @notice StakingManager deploy kontrak campaign baru
    function createCampaign(address organizer, address stakingManager, uint256 campaignId) external onlyOwner returns (address campaignAddr) {
        CampaignDonation campaign = new CampaignDonation(organizer, stakingManager, campaignId);
        campaignAddr = address(campaign);

        emit CampaignCreated(campaignAddr, organizer, msg.sender, block.timestamp);
    }
}