// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IIXFIGateway} from "./interfaces/IIXFIGateway.sol";
import {IAxelarExecutable} from "./interfaces/IAxelarExecutable.sol";

/**
 * @title IXFIExecutable
 * @dev Base contract for applications that want to receive GMP calls
 * Similar to Axelar's AxelarExecutable but for IXFI protocol
 */
abstract contract IXFIExecutable is IAxelarExecutable {
    IIXFIGateway public immutable gateway;

    error NotGateway();

    constructor(address gateway_) {
        if (gateway_ == address(0)) revert InvalidAddress();
        gateway = IIXFIGateway(gateway_);
    }

    modifier onlyGateway() {
        if (msg.sender != address(gateway)) revert NotGateway();
        _;
    }

    /**
     * @dev Execute a cross-chain contract call
     * @param commandId Unique identifier for the command
     * @param sourceChain Name of the source chain
     * @param sourceAddress Address of the sender on the source chain
     * @param payload The payload sent from the source chain
     */
    function execute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external override onlyGateway {
        bytes32 payloadHash = keccak256(payload);
        
        if (!gateway.validateContractCall(commandId, sourceChain, sourceAddress, payloadHash)) {
            revert NotApprovedByGateway();
        }
        
        _execute(sourceChain, sourceAddress, payload);
    }

    /**
     * @dev Execute a cross-chain contract call with token transfer
     * @param commandId Unique identifier for the command
     * @param sourceChain Name of the source chain
     * @param sourceAddress Address of the sender on the source chain
     * @param payload The payload sent from the source chain
     * @param tokenSymbol Symbol of the token transferred
     * @param amount Amount of tokens transferred
     */
    function executeWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) external override onlyGateway {
        bytes32 payloadHash = keccak256(payload);
        
        if (!gateway.validateContractCallAndMint(
            commandId, 
            sourceChain, 
            sourceAddress, 
            payloadHash, 
            tokenSymbol, 
            amount
        )) {
            revert NotApprovedByGateway();
        }
        
        _executeWithToken(sourceChain, sourceAddress, payload, tokenSymbol, amount);
    }

    /**
     * @dev Override this function to implement your application logic
     * @param sourceChain Name of the source chain
     * @param sourceAddress Address of the sender on the source chain
     * @param payload The payload sent from the source chain
     */
    function _execute(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal virtual {}

    /**
     * @dev Override this function to implement your application logic with tokens
     * @param sourceChain Name of the source chain
     * @param sourceAddress Address of the sender on the source chain
     * @param payload The payload sent from the source chain
     * @param tokenSymbol Symbol of the token transferred
     * @param amount Amount of tokens transferred
     */
    function _executeWithToken(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) internal virtual {}

    /**
     * @dev Convenience function to call another contract on another chain
     * @param destinationChain Name of the destination chain
     * @param destinationAddress Address of the destination contract
     * @param payload Payload to send
     */
    function _callContract(
        string memory destinationChain,
        string memory destinationAddress,
        bytes memory payload
    ) internal {
        gateway.callContract(destinationChain, destinationAddress, payload);
    }

    /**
     * @dev Convenience function to call another contract on another chain with tokens
     * @param destinationChain Name of the destination chain
     * @param destinationAddress Address of the destination contract
     * @param payload Payload to send
     * @param symbol Token symbol
     * @param amount Token amount
     */
    function _callContractWithToken(
        string memory destinationChain,
        string memory destinationAddress,
        bytes memory payload,
        string memory symbol,
        uint256 amount
    ) internal {
        gateway.callContractWithToken(destinationChain, destinationAddress, payload, symbol, amount);
    }
}
