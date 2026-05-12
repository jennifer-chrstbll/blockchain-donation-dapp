// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Menyimpan pool Top10 organizer (diinput admin) dan memilih 6 validator acak dari Top10.
/// @dev Randomness ini MVP (pseudo-random). Untuk production sebaiknya pakai Chainlink VRF / commit-reveal.
contract ValidatorSet {
    address public admin;

    address[] public top10; // max 10
    mapping(address => bool) public isTop10;

    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);
    event Top10Updated(address[] top10);

    error NotAdmin();
    error InvalidTop10();

    constructor(address _admin) {
        require(_admin != address(0), "admin=0");
        admin = _admin;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    function setAdmin(address _admin) external onlyAdmin {
        require(_admin != address(0), "admin=0");
        emit AdminChanged(admin, _admin);
        admin = _admin;
    }

    /// @notice Admin sync Top10 dari DB (supabase) ke chain.
    /// @dev Minimal 6 address, maksimal 10 address.
    function setTop10(address[] calldata _top10) external onlyAdmin {
        if (_top10.length < 6 || _top10.length > 10) revert InvalidTop10();

        // reset mapping lama
        for (uint256 i = 0; i < top10.length; i++) {
            isTop10[top10[i]] = false;
        }

        // set baru (unik)
        for (uint256 i = 0; i < _top10.length; i++) {
            address a = _top10[i];
            require(a != address(0), "addr=0");
            require(!isTop10[a], "duplicate");
            isTop10[a] = true;
        }

        top10 = _top10;
        emit Top10Updated(_top10);
    }

    function getTop10() external view returns (address[] memory) {
        return top10;
    }

    /// @notice pilih validator unik dari Top10 (tanpa organizer).
    function selectValidators(bytes32 salt, address organizer) external view returns (address[] memory voters) {
        require(top10.length >= 6, "top10<6");

        // Hitung kandidat yang memenuhi syarat (bukan organizer)
        uint256 eligibleCount = 0;
        for (uint256 i = 0; i < top10.length; i++) {
            if (top10[i] != organizer) eligibleCount++;
        }

        // Kalau misalnya dari 6 orang ternyata 1 adalah organizer, kita cuma bisa pilih 5.
        // Walau harusnya di production top10 = 10 orang, jadi pasti ada > 6.
        uint256 maxPick = eligibleCount >= 6 ? 6 : eligibleCount;
        voters = new address[](maxPick);

        uint256 picked = 0;
        uint256 nonce = 0;

        while (picked < maxPick) {
            bytes32 h = keccak256(abi.encodePacked(salt, nonce, address(this)));
            uint256 idx = uint256(h) % top10.length;
            address candidate = top10[idx];

            if (candidate != organizer) {
                bool exists = false;
                for (uint256 j = 0; j < picked; j++) {
                    if (voters[j] == candidate) {
                        exists = true;
                        break;
                    }
                }

                if (!exists) {
                    voters[picked] = candidate;
                    picked++;
                }
            }

            nonce++;
            require(nonce < 10_000, "loop guard");
        }
    }
}