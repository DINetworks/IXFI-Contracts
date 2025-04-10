// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IGasOracle {
    function getPrice() external view returns (uint256);
}