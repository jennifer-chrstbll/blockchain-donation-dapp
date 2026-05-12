// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ValidatorSet.sol";
import "./GovernanceVoting.sol";
import "./CampaignFactory.sol";
import "./CampaignDonation.sol";

contract StakingManager {
    // ===== Enums =====
    enum CampaignStatus  { None, Prescreen, Voting, Approved, Rejected, Frozen }
    enum LifecycleStatus { None, Fundraising, AwaitingProof, AwaitingDispute, Completed, Slashed }
    enum ReportStatus    { None, Submitted, Approved, Rejected }

    struct Campaign {
        address organizer;
        uint256 stakeBond;
        uint256 votingFee;
        uint256 createdAt;
        CampaignStatus status;
        address votingContract;
        bool bondRefunded;
        bool feeDistributed;

        LifecycleStatus lifecycle;
        uint256 fundraisingEndAt;
        uint256 proofDeadlineAt;
        uint256 disputeEndsAt;
        uint256 targetWei;

        bytes32 proofHash;
        uint256 proofSubmittedAt;
        uint256 frozenDonationAmount;
    }

    struct Report {
        address reporter;
        uint256 stakeBond;
        uint256 createdAt;
        ReportStatus status;
        uint256 campaignId;
        bool bondRefunded;
    }

    // ===== Constants =====
    uint256 public constant SHIFT_DEADLINE      = 24 hours;
    uint256 public constant PROOF_GRACE_PERIOD  = 7 days;
    uint256 public constant DISPUTE_PERIOD      = 2 days;
    uint256 public constant PRESCREEN_TIMEOUT   = 2 days;  // refund otomatis jika admin tidak bertindak

    uint256 public constant CAMPAIGN_STAKE_BOND = 0.05 ether;
    uint256 public constant REPORT_STAKE_BOND   = 0.01 ether;

    // Report APPROVED (organizer slashed)
    uint256 public constant REPORTER_REWARD_BPS = 6000; // 60%
    uint256 public constant ADMIN_SLASH_BPS     = 2000; // 20%
    uint256 public constant TREASURY_SLASH_BPS  = 2000; // 20%

    // Report REJECTED (reporter slashed)
    uint256 public constant ORGANIZER_COMP_BPS  = 6000; // 60%
    uint256 public constant ADMIN_PENALTY_BPS   = 4000; // 40%

    // ===== Multi-Admin =====
    mapping(address => bool) public isAdmin;
    address[] public adminList;
    address public primaryAdmin;  // penerima fee (bisa diubah)
    address public treasury;

    ValidatorSet    public validatorSet;
    CampaignFactory public campaignFactory;

    uint256 public nextCampaignId = 1;
    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => address)  public campaignDonationOf;

    uint256 public nextReportId = 1;
    mapping(uint256 => Report) public reports;

    mapping(address => bool) public bannedOrganizers;

    // ===== Events =====
    event CampaignSubmitted(uint256 indexed campaignId, address indexed organizer, uint256 stakeBond, uint256 votingFee);
    event CampaignVotingStarted(uint256 indexed campaignId, address votingContract, bytes32 salt);
    event CampaignPrescreenRejected(uint256 indexed campaignId);
    event PrescreenTimeoutClaimed(uint256 indexed campaignId, address indexed claimedBy);
    event CampaignFinalized(uint256 indexed campaignId, CampaignStatus status);
    event CampaignPublished(uint256 indexed campaignId, address indexed campaignAddress, address indexed organizer);
    event VotingFeeDistributed(uint256 indexed campaignId, uint256 perVoter, uint256 paidCount);
    event BondRefunded(uint256 indexed campaignId, address indexed organizer, uint256 amount);

    event FundraisingStarted(uint256 indexed campaignId, uint256 fundraisingEndAt, uint256 proofDeadlineAt);
    event FundraisingFinishedEarly(uint256 indexed campaignId, uint256 finishedAt, uint256 proofDeadlineAt);
    event ProofSubmitted(uint256 indexed campaignId, bytes32 proofHash, uint256 proofSubmittedAt, uint256 disputeEndsAt);
    event CampaignCompleted(uint256 indexed campaignId);
    event CampaignSlashedNoProof(uint256 indexed campaignId, uint256 amount);

    event ReportSubmitted(uint256 indexed reportId, address indexed reporter, uint256 indexed campaignId, uint256 stakeBond);
    event ReportAccepted(uint256 indexed reportId, uint256 toReporter, uint256 toAdmin, uint256 toTreasury, uint256 donationsDrained);
    event ReportRejected(uint256 indexed reportId, uint256 toOrganizer, uint256 toAdmin);
    event OrganizerBanned(address indexed organizer);
    event OrganizerBanStatusChanged(address indexed organizer, bool isBanned);
    event CampaignFrozen(uint256 indexed campaignId);
    event DonationsDrained(uint256 indexed campaignId, uint256 amount);

    event AdminAdded(address indexed newAdmin, address indexed addedBy);
    event AdminRemoved(address indexed removedAdmin, address indexed removedBy);
    event PrimaryAdminChanged(address indexed oldPrimary, address indexed newPrimary);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // ===== Errors =====
    error NotAdmin();
    error InvalidValue();
    error BadStatus();
    error NotOrganizer();

    constructor(address _admin, address _validatorSet) {
        require(_admin != address(0), "admin=0");
        require(_validatorSet != address(0), "vs=0");
        isAdmin[_admin] = true;
        adminList.push(_admin);
        primaryAdmin = _admin;
        treasury = _admin;
        validatorSet = ValidatorSet(_validatorSet);
    }

    modifier onlyAdmin() {
        if (!isAdmin[msg.sender]) revert NotAdmin();
        _;
    }

    // ===== Admin Management =====

    function setBanStatus(address _organizer, bool _status) external onlyAdmin {
        bannedOrganizers[_organizer] = _status;
        emit OrganizerBanStatusChanged(_organizer, _status);
    }

    function addAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "admin=0");
        require(!isAdmin[_newAdmin], "already admin");
        isAdmin[_newAdmin] = true;
        adminList.push(_newAdmin);
        emit AdminAdded(_newAdmin, msg.sender);
    }

    function removeAdmin(address _adminToRemove) external onlyAdmin {
        require(isAdmin[_adminToRemove], "not admin");
        require(adminList.length > 1, "cannot remove last admin");
        isAdmin[_adminToRemove] = false;
        // Remove from list
        for (uint256 i = 0; i < adminList.length; i++) {
            if (adminList[i] == _adminToRemove) {
                adminList[i] = adminList[adminList.length - 1];
                adminList.pop();
                break;
            }
        }
        // If removed was primaryAdmin, reassign to first in list
        if (primaryAdmin == _adminToRemove) {
            primaryAdmin = adminList[0];
            emit PrimaryAdminChanged(_adminToRemove, primaryAdmin);
        }
        emit AdminRemoved(_adminToRemove, msg.sender);
    }

    function setPrimaryAdmin(address _primary) external onlyAdmin {
        require(isAdmin[_primary], "not an admin");
        address old = primaryAdmin;
        primaryAdmin = _primary;
        emit PrimaryAdminChanged(old, _primary);
    }

    function setTreasury(address _treasury) external onlyAdmin {
        require(_treasury != address(0), "treasury=0");
        emit TreasuryUpdated(treasury, _treasury);
        treasury = _treasury;
    }

    function setCampaignFactory(address _factory) external onlyAdmin {
        require(_factory != address(0), "factory=0");
        campaignFactory = CampaignFactory(_factory);
    }

    function getAdminList() external view returns (address[] memory) {
        return adminList;
    }

    /// @notice Digunakan oleh CampaignDonation untuk cek status kampanye sebelum terima donasi
    function getCampaignLifecycle(uint256 id) external view returns (
        uint8 lifecycle, uint256 fundraisingEndAt,
        uint256 proofDeadlineAt, uint256 disputeEndsAt, uint256 targetWei,
        bytes32 proofHash, uint256 proofSubmittedAt, uint256 frozenDonationAmount
    ) {
        Campaign storage c = campaigns[id];
        return (
            uint8(c.lifecycle),
            c.fundraisingEndAt,
            c.proofDeadlineAt,
            c.disputeEndsAt,
            c.targetWei,
            c.proofHash,
            c.proofSubmittedAt,
            c.frozenDonationAmount
        );
    }

    // ===== Step 1: Submit + Prescreen + Voting =====

    function submitCampaign(uint256 votingFee)
        external
        payable
        returns (uint256 campaignId)
    {
        if (bannedOrganizers[msg.sender]) revert("organizer banned");
        if (votingFee == 0) revert InvalidValue();
        if (msg.value != CAMPAIGN_STAKE_BOND + votingFee) revert InvalidValue();

        campaignId = nextCampaignId++;
        campaigns[campaignId] = Campaign({
            organizer:            msg.sender,
            stakeBond:            CAMPAIGN_STAKE_BOND,
            votingFee:            votingFee,
            createdAt:            block.timestamp,
            status:               CampaignStatus.Prescreen,
            votingContract:       address(0),
            bondRefunded:         false,
            feeDistributed:       false,
            lifecycle:            LifecycleStatus.None,
            fundraisingEndAt:     0,
            proofDeadlineAt:      0,
            disputeEndsAt:        0,
            targetWei:            0,
            proofHash:            bytes32(0),
            proofSubmittedAt:     0,
            frozenDonationAmount: 0
        });

        emit CampaignSubmitted(campaignId, msg.sender, CAMPAIGN_STAKE_BOND, votingFee);
    }

    /// @notice Siapapun bisa klaim refund jika admin tidak bertindak dalam PRESCREEN_TIMEOUT.
    function claimPrescreenTimeout(uint256 campaignId) external {
        Campaign storage c = campaigns[campaignId];
        if (c.status != CampaignStatus.Prescreen) revert BadStatus();
        if (c.organizer == address(0)) revert BadStatus();
        if (c.bondRefunded || c.feeDistributed) revert BadStatus();
        require(block.timestamp >= c.createdAt + PRESCREEN_TIMEOUT, "timeout not reached");

        c.status = CampaignStatus.Rejected;
        c.bondRefunded = true;
        c.feeDistributed = true;

        uint256 refund = c.stakeBond + c.votingFee;
        (bool ok, ) = c.organizer.call{value: refund}("");
        require(ok, "refund timeout failed");

        emit PrescreenTimeoutClaimed(campaignId, msg.sender);
        emit BondRefunded(campaignId, c.organizer, c.stakeBond);
    }

    function adminStartVoting(uint256 campaignId, bytes32 salt) external onlyAdmin {
        Campaign storage c = campaigns[campaignId];
        if (c.status != CampaignStatus.Prescreen) revert BadStatus();
        if (c.organizer == address(0)) revert BadStatus();
        if (c.votingContract != address(0)) revert BadStatus();

        address[] memory voters = validatorSet.selectValidators(salt, c.organizer);
        GovernanceVoting voting = new GovernanceVoting(address(this), c.organizer, voters);

        c.votingContract = address(voting);
        c.status = CampaignStatus.Voting;

        emit CampaignVotingStarted(campaignId, address(voting), salt);
    }

    function adminRejectPrescreen(uint256 campaignId) external onlyAdmin {
        Campaign storage c = campaigns[campaignId];
        if (c.status != CampaignStatus.Prescreen) revert BadStatus();
        if (c.organizer == address(0)) revert BadStatus();
        if (c.bondRefunded || c.feeDistributed) revert BadStatus();

        c.status = CampaignStatus.Rejected;
        c.bondRefunded = true;
        c.feeDistributed = true;

        uint256 refund = c.stakeBond + c.votingFee;
        (bool ok, ) = c.organizer.call{value: refund}("");
        require(ok, "refund prescreen failed");

        emit CampaignPrescreenRejected(campaignId);
        emit BondRefunded(campaignId, c.organizer, c.stakeBond);
    }

    function replaceMissingVoter(uint256 campaignId, address oldVoter, address newVoter) external {
        Campaign storage c = campaigns[campaignId];
        if (c.status != CampaignStatus.Voting) revert BadStatus();

        require(validatorSet.isTop10(newVoter), "new not top10");
        GovernanceVoting(c.votingContract).replaceVoter(oldVoter, newVoter);
    }

    // ===== Step 2: finalize + publish + fundraising =====

    function finalizeAndStartFundraising(uint256 campaignId, uint32 durationDays, uint256 targetEth)
        external
        onlyAdmin
    {
        if (durationDays == 0 || durationDays > 3650) revert InvalidValue();
        if (targetEth == 0) revert InvalidValue();

        Campaign storage c = campaigns[campaignId];
        if (c.status != CampaignStatus.Voting) revert BadStatus();
        if (c.votingContract == address(0)) revert BadStatus();

        GovernanceVoting gv = GovernanceVoting(c.votingContract);

        try gv.finalize() {} catch {}

        GovernanceVoting.Result r = gv.result();
        if (r == GovernanceVoting.Result.Pending) revert("still pending");

        if (r == GovernanceVoting.Result.Approved) c.status = CampaignStatus.Approved;
        else c.status = CampaignStatus.Rejected;

        emit CampaignFinalized(campaignId, c.status);
        _distributeVotingFee(campaignId);

        if (c.status == CampaignStatus.Rejected) {
            _refundBond(campaignId);
            return;
        }

        // Approved → publish donation contract
        if (campaignDonationOf[campaignId] == address(0)) {
            require(address(campaignFactory) != address(0), "factory not set");
            address campaignAddr = campaignFactory.createCampaign(c.organizer, address(this), campaignId);
            campaignDonationOf[campaignId] = campaignAddr;
            emit CampaignPublished(campaignId, campaignAddr, c.organizer);
        }

        // Start fundraising
        if (c.lifecycle == LifecycleStatus.None) {
            c.lifecycle = LifecycleStatus.Fundraising;
            c.targetWei = targetEth * 1 ether;

            uint256 endAt = block.timestamp + (uint256(durationDays) * 1 days);
            c.fundraisingEndAt = endAt;
            c.proofDeadlineAt  = endAt + PROOF_GRACE_PERIOD;

            emit FundraisingStarted(campaignId, c.fundraisingEndAt, c.proofDeadlineAt);
        }
    }

    // ===== Step 2: Early finish fundraising =====

    function finishFundraisingEarly(uint256 campaignId) external {
        Campaign storage c = campaigns[campaignId];
        if (c.organizer == address(0)) revert BadStatus();
        if (msg.sender != c.organizer) revert NotOrganizer();
        if (c.status != CampaignStatus.Approved) revert BadStatus();
        if (c.lifecycle != LifecycleStatus.Fundraising) revert BadStatus();

        require(block.timestamp < c.fundraisingEndAt, "fundraising already ended");

        address donAddr = campaignDonationOf[campaignId];
        require(donAddr != address(0), "not published");
        require(donAddr.balance >= c.targetWei, "target not met yet");

        c.fundraisingEndAt = block.timestamp;
        c.proofDeadlineAt  = block.timestamp + PROOF_GRACE_PERIOD;
        c.lifecycle        = LifecycleStatus.AwaitingProof;

        emit FundraisingFinishedEarly(campaignId, block.timestamp, c.proofDeadlineAt);
    }

    // ===== Step 2: proof & completion =====

    function submitProof(uint256 campaignId, bytes32 proofHash) external {
        Campaign storage c = campaigns[campaignId];
        if (c.organizer == address(0)) revert BadStatus();
        if (msg.sender != c.organizer) revert NotOrganizer();
        if (c.status != CampaignStatus.Approved) revert BadStatus();

        if (c.lifecycle != LifecycleStatus.Fundraising && c.lifecycle != LifecycleStatus.AwaitingProof) revert BadStatus();

        if (c.fundraisingEndAt == 0) revert BadStatus();
        if (block.timestamp < c.fundraisingEndAt) revert("fundraising not ended");
        if (block.timestamp > c.proofDeadlineAt) revert("proof deadline passed");

        require(proofHash != bytes32(0), "proof=0");
        require(c.proofHash == bytes32(0), "proof already");

        c.proofHash        = proofHash;
        c.proofSubmittedAt = block.timestamp;
        c.lifecycle        = LifecycleStatus.AwaitingDispute;
        c.disputeEndsAt    = block.timestamp + DISPUTE_PERIOD;

        emit ProofSubmitted(campaignId, proofHash, c.proofSubmittedAt, c.disputeEndsAt);
    }

    function completeCampaign(uint256 campaignId) external {
        Campaign storage c = campaigns[campaignId];
        if (c.organizer == address(0)) revert BadStatus();
        if (c.status != CampaignStatus.Approved) revert BadStatus();
        if (c.lifecycle != LifecycleStatus.AwaitingDispute) revert BadStatus();
        if (c.proofHash == bytes32(0)) revert("no proof");
        if (block.timestamp < c.disputeEndsAt) revert("dispute not ended");

        c.lifecycle = LifecycleStatus.Completed;
        _refundBond(campaignId);

        emit CampaignCompleted(campaignId);
    }

    function slashNoProof(uint256 campaignId) external {
        Campaign storage c = campaigns[campaignId];
        if (c.organizer == address(0)) revert BadStatus();
        if (c.status != CampaignStatus.Approved) revert BadStatus();
        if (c.fundraisingEndAt == 0) revert BadStatus();
        if (block.timestamp < c.proofDeadlineAt) revert("too early");
        if (c.proofHash != bytes32(0)) revert("proof exists");
        if (c.lifecycle == LifecycleStatus.Completed || c.lifecycle == LifecycleStatus.Slashed) revert BadStatus();

        c.lifecycle = LifecycleStatus.Slashed;

        if (!c.bondRefunded) {
            c.bondRefunded = true;
            uint256 amount = c.stakeBond;
            (bool ok, ) = treasury.call{value: amount}("");
            require(ok, "slash transfer failed");
            emit CampaignSlashedNoProof(campaignId, amount);
        }

        // Auto-ban organizer on-chain
        if (!bannedOrganizers[c.organizer]) {
            bannedOrganizers[c.organizer] = true;
            emit OrganizerBanned(c.organizer);
            emit OrganizerBanStatusChanged(c.organizer, true);
        }
    }

    // ===== Reports: Admin Accept / Reject =====

    function submitReport(uint256 campaignId)
        external
        payable
        returns (uint256 reportId)
    {
        Campaign storage c = campaigns[campaignId];
        if (c.status != CampaignStatus.Approved) revert BadStatus();
        if (msg.sender == c.organizer) revert("organizer cannot report own campaign");
        if (msg.value != REPORT_STAKE_BOND) revert InvalidValue();

        reportId = nextReportId++;
        reports[reportId] = Report({
            reporter:     msg.sender,
            stakeBond:    REPORT_STAKE_BOND,
            createdAt:    block.timestamp,
            status:       ReportStatus.Submitted,
            campaignId:   campaignId,
            bondRefunded: false
        });

        emit ReportSubmitted(reportId, msg.sender, campaignId, REPORT_STAKE_BOND);
    }

    function acceptReport(uint256 reportId) external onlyAdmin {
        Report storage r = reports[reportId];
        if (r.status != ReportStatus.Submitted) revert BadStatus();

        r.status = ReportStatus.Approved;

        Campaign storage c = campaigns[r.campaignId];
        c.status = CampaignStatus.Frozen;
        bannedOrganizers[c.organizer] = true;
        emit OrganizerBanned(c.organizer);
        emit OrganizerBanStatusChanged(c.organizer, true);
        emit CampaignFrozen(r.campaignId);

        // 1) Return reporter stake
        if (!r.bondRefunded) {
            r.bondRefunded = true;
            (bool ok1, ) = r.reporter.call{value: r.stakeBond}("");
            require(ok1, "reporter bond refund failed");
        }

        // 2) Slash organizer stake 60/20/20
        uint256 toReporter = 0;
        uint256 toAdmin    = 0;
        uint256 toTreasury = 0;
        if (!c.bondRefunded && c.stakeBond > 0) {
            c.bondRefunded = true;
            uint256 stake  = c.stakeBond;
            toReporter     = stake * REPORTER_REWARD_BPS / 10000;
            toAdmin        = stake * ADMIN_SLASH_BPS / 10000;
            toTreasury     = stake - toReporter - toAdmin;

            (bool ok2, ) = r.reporter.call{value: toReporter}("");
            require(ok2, "slash->reporter failed");
            if (toAdmin > 0) {
                (bool ok3, ) = primaryAdmin.call{value: toAdmin}("");
                require(ok3, "slash->admin failed");
            }
            if (toTreasury > 0) {
                (bool ok4, ) = treasury.call{value: toTreasury}("");
                require(ok4, "slash->treasury failed");
            }
        }

        // 3) Drain donations for off-chain refund
        address donAddr = campaignDonationOf[r.campaignId];
        uint256 drained = 0;
        if (donAddr != address(0)) {
            uint256 balBefore = address(this).balance;
            try CampaignDonation(payable(donAddr)).drainToStakingManager() {} catch {}
            uint256 balAfter = address(this).balance;
            drained = balAfter > balBefore ? balAfter - balBefore : 0;
            c.frozenDonationAmount = drained;
            emit DonationsDrained(r.campaignId, drained);
        }

        emit ReportAccepted(reportId, toReporter, toAdmin, toTreasury, drained);
    }

    function rejectReport(uint256 reportId) external onlyAdmin {
        Report storage r = reports[reportId];
        if (r.status != ReportStatus.Submitted) revert BadStatus();

        r.status = ReportStatus.Rejected;

        Campaign storage c = campaigns[r.campaignId];

        uint256 toOrganizer = 0;
        uint256 toAdmin     = 0;
        if (!r.bondRefunded && r.stakeBond > 0) {
            r.bondRefunded = true;
            uint256 stake  = r.stakeBond;
            toOrganizer    = stake * ORGANIZER_COMP_BPS / 10000;
            toAdmin        = stake - toOrganizer;

            (bool ok1, ) = c.organizer.call{value: toOrganizer}("");
            require(ok1, "penalty->organizer failed");
            if (toAdmin > 0) {
                (bool ok2, ) = primaryAdmin.call{value: toAdmin}("");
                require(ok2, "penalty->admin failed");
            }
        }

        emit ReportRejected(reportId, toOrganizer, toAdmin);
    }

    // ===== Internal =====

    function _refundBond(uint256 campaignId) internal {
        Campaign storage c = campaigns[campaignId];
        if (c.bondRefunded) return;
        c.bondRefunded = true;

        (bool ok, ) = c.organizer.call{value: c.stakeBond}("");
        require(ok, "refund failed");

        emit BondRefunded(campaignId, c.organizer, c.stakeBond);
    }

    function _distributeVotingFee(uint256 campaignId) internal {
        Campaign storage c = campaigns[campaignId];
        if (c.feeDistributed) return;
        c.feeDistributed = true;

        GovernanceVoting gv = GovernanceVoting(c.votingContract);
        address[] memory vs = gv.getVoters();

        uint256 eligible = 0;
        for (uint256 i = 0; i < vs.length; i++) {
            (, bool replaced, GovernanceVoting.Choice choice) = gv.voterInfo(vs[i]);
            bool voted  = (choice == GovernanceVoting.Choice.Yes || choice == GovernanceVoting.Choice.No);
            if (!replaced && voted) eligible++;
        }

        if (eligible == 0) {
            (bool ok, ) = primaryAdmin.call{value: c.votingFee}("");
            require(ok, "admin fee transfer failed");
            emit VotingFeeDistributed(campaignId, 0, 0);
            return;
        }

        uint256 perVoter = c.votingFee / eligible;
        uint256 paid = 0;

        for (uint256 i = 0; i < vs.length; i++) {
            (, bool replaced, GovernanceVoting.Choice choice) = gv.voterInfo(vs[i]);
            bool voted  = (choice == GovernanceVoting.Choice.Yes || choice == GovernanceVoting.Choice.No);
            if (!replaced && voted) {
                (bool ok, ) = vs[i].call{value: perVoter}("");
                require(ok, "pay voter failed");
                paid++;
            }
        }

        emit VotingFeeDistributed(campaignId, perVoter, paid);

        uint256 remainder = c.votingFee - (perVoter * paid);
        if (remainder > 0) {
            (bool ok2, ) = primaryAdmin.call{value: remainder}("");
            require(ok2, "remainder transfer failed");
        }
    }

    receive() external payable {}
}