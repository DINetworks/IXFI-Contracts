// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IIXFICaller {
    function multicall(bytes calldata callData) external;
}