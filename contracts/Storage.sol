//SPDX-License-Identifier: MIT 
pragma solidity ^0.8.20; 
contract Storage { 
uint256 private number; 
// Fungsi untuk menyimpan angka (Write to blockchain) 
function store(uint256 _number) public { 
number = _number; 
} 
// Fungsi untuk mengambil angka (Read from blockchain) 
function retrieve() public view returns (uint256) { 
return number; 
    } 
}