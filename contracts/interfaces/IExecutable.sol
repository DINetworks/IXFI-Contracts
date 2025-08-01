// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IExecutable {
    error InvalidAddress();
    error NotApprovedByGateway();

    function execute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external;

    function executeWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) external;
}
