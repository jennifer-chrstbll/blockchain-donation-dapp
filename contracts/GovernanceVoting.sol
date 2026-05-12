// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Voting contract per campaign submission.
/// - Voting window total 2 hari.
/// - Setiap voter punya 24 jam dari waktu assigned.
/// - Jika lewat 24 jam belum vote: bisa diganti (oleh organizer), dan dia tidak dapat reward.
/// - Campaign approved hanya jika YES >= 4 (dari sistem voter).
contract GovernanceVoting {
    enum Choice { None, Yes, No }
    enum Result { Pending, Approved, Rejected }

    struct VoterInfo {
        uint64 assignedAt;
        bool replaced;
        Choice choice;
    }

    address public immutable stakingManager;
    address public immutable organizer;

    uint256 public immutable createdAt;

    uint256 public constant VOTING_PERIOD = 2 days;
    uint256 public constant SHIFT_DEADLINE = 24 hours;

    uint256 public yesCount;
    uint256 public noCount;

    // voters bisa bertambah karena substitusi, tapi yang dianggap "aktif" adalah yang replaced=false
    address[] public voters;
    mapping(address => bool) public isVoter;
    mapping(address => VoterInfo) public voterInfo;

    Result public result;

    event VoterAssigned(address indexed voter, uint256 indexed ts);
    event VoterReplaced(address indexed oldVoter, address indexed newVoter, uint256 indexed ts);
    event Voted(address indexed voter, Choice choice, uint256 indexed ts);
    event Finalized(Result result, uint256 yesCount, uint256 noCount, uint256 indexed ts);

    error NotStakingManager();
    error NotVoter();
    error VotingEnded();
    error AlreadyVoted();
    error ShiftExpired();

    modifier onlyStakingManager() {
        if (msg.sender != stakingManager) revert NotStakingManager();
        _;
    }

    constructor(address _stakingManager, address _organizer, address[] memory _voters) {
        require(_stakingManager != address(0), "sm=0");
        require(_organizer != address(0), "org=0");
        require(_voters.length == 6, "voters!=6");

        stakingManager = _stakingManager;
        organizer = _organizer;
        createdAt = block.timestamp;

        for (uint256 i = 0; i < _voters.length; i++) {
            address v = _voters[i];
            require(v != address(0), "voter=0");
            require(!isVoter[v], "dup voter");

            voters.push(v);
            isVoter[v] = true;
            voterInfo[v] = VoterInfo({
                assignedAt: uint64(block.timestamp),
                replaced: false,
                choice: Choice.None
            });

            emit VoterAssigned(v, block.timestamp);
        }

        result = Result.Pending;
    }

    function votingEndsAt() public view returns (uint256) {
        return createdAt + VOTING_PERIOD;
    }

    function isVotingOpen() public view returns (bool) {
        return block.timestamp < votingEndsAt() && result == Result.Pending;
    }

    function vote(Choice c) external {
        if (!isVotingOpen()) revert VotingEnded();
        if (!isVoter[msg.sender]) revert NotVoter();
        if (c != Choice.Yes && c != Choice.No) revert("bad choice");

        VoterInfo storage info = voterInfo[msg.sender];
        if (info.replaced) revert NotVoter();
        if (info.choice != Choice.None) revert AlreadyVoted();

        // voter punya 24 jam dari assignedAt untuk melakukan vote
        if (block.timestamp > uint256(info.assignedAt) + SHIFT_DEADLINE) {
            revert ShiftExpired();
        }

        info.choice = c;
        if (c == Choice.Yes) yesCount++;
        else noCount++;

        emit Voted(msg.sender, c, block.timestamp);

        // kalau YES sudah 4, langsung finalize Approved
        if (yesCount >= 4) {
            _finalize(Result.Approved);
        }
    }

    /// @notice StakingManager mengganti voter yang mangkir (>24h belum vote).
    function replaceVoter(address oldVoter, address newVoter) external onlyStakingManager {
        if (!isVotingOpen()) revert VotingEnded();
        require(isVoter[oldVoter], "old not voter");
        require(!isVoter[newVoter], "new already voter");

        VoterInfo storage oldInfo = voterInfo[oldVoter];
        require(!oldInfo.replaced, "already replaced");
        require(oldInfo.choice == Choice.None, "already voted");
        require(block.timestamp > uint256(oldInfo.assignedAt) + SHIFT_DEADLINE, "not expired");

        oldInfo.replaced = true;

        voters.push(newVoter);
        isVoter[newVoter] = true;
        voterInfo[newVoter] = VoterInfo({
            assignedAt: uint64(block.timestamp),
            replaced: false,
            choice: Choice.None
        });

        emit VoterReplaced(oldVoter, newVoter, block.timestamp);
        emit VoterAssigned(newVoter, block.timestamp);
    }

    /// @notice dipanggil StakingManager setelah 3 hari untuk final keputusan jika belum Approved.
    function finalize() external onlyStakingManager {
        if (result != Result.Pending) return;

        // kalau belum 3 hari dan YES belum 4, jangan finalize
        if (block.timestamp < votingEndsAt() && yesCount < 4) revert("too early");

        if (yesCount >= 4) _finalize(Result.Approved);
        else _finalize(Result.Rejected);
    }

    function _finalize(Result r) internal {
        if (result != Result.Pending) return;
        result = r;
        emit Finalized(r, yesCount, noCount, block.timestamp);
    }

    function getVoters() external view returns (address[] memory) {
        return voters;
    }
}