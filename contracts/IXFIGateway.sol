// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { IERC20 } from "@openzeppelin/contracts/interfaces/IERC20.sol";

contract IXFIGateway is Ownable {

    using ECDSA for bytes32;
    using EnumerableSet for EnumerableSet.AddressSet;

    bytes32 private constant EIP712_DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    bytes32 private constant TRANSFER_TYPEHASH = keccak256(
        "Transfer(address sender,bytes transferData,uint256 nonce)"
    );

    struct TransferData {
        address token;
        address recipient;
        uint256 amount;
    }

    // Storage for relayers and nonces
    mapping(address => bool) public whitelisted;
    mapping(address => uint256) public nonces;
    EnumerableSet.AddressSet private relayers;

    // Events
    event RelayerAdded(address indexed relayer);
    event RelayerRemoved(address indexed relayer);
    event MetaTransactionExecuted(
        address indexed sender, 
        address indexed relayer, 
        address[] targets, 
        address[] recipients, 
        uint256[] amounts
    );

    constructor(address owner_) Ownable(owner_) {}

    // Modifier to restrict actions to whitelisted relayers only
    modifier onlyRelayer() {
        require(whitelisted[msg.sender], "Caller not whitelisted relayers");
        _;
    }

    // Function to add a whitelisted relayer
    function addWhitelistedRelayer(address relayer) external onlyOwner {
        require(relayer != address(0), "Invalid address");
        require(!whitelisted[relayer], "Relayer already whitelisted");

        whitelisted[relayer] = true;
        relayers.add(relayer);

        emit RelayerAdded(relayer);
    }

    // Function to remove a whitelisted relayer
    function removeWhitelistedRelayer(address relayer) external onlyOwner {
        require(whitelisted[relayer], "Relayer not whitelisted");

        whitelisted[relayer] = false;
        relayers.remove(relayer);

        emit RelayerRemoved(relayer);
    }

    // Function to execute a meta-transfer
    function executeMetaTransfer(
        address sender, 
        bytes memory transferData, 
        uint256 nonce, 
        bytes memory signature
    ) 
        external 
        onlyRelayer 
    {
        // Ensure the nonce is valid
        require(nonce == nonces[sender], "Invalid nonce");

        // Recover the signer's address from the signature
        address signer = recoverSigner(sender, transferData, nonce, signature);

        // Verify that the signer is the actual sender
        require(signer == sender, "Invalid signature");

        // Decode transferData
        (address[] memory targets, address[] memory recipients, uint256[] memory amounts) = 
            abi.decode(transferData, (address[], address[], uint256[]));

        // Validate parameters
        require(targets.length == recipients.length, "Targets and recipients length mismatch");
        require(targets.length == amounts.length, "Targets and amounts length mismatch");

        // Execute the transfers
        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, ) = targets[i].call(abi.encodeWithSelector(
                IERC20.transferFrom.selector, 
                sender, 
                recipients[i], 
                amounts[i]
            ));
            require(success, "Meta-transaction failed");
        }

        // Increment the nonce to prevent replay attacks
        nonces[sender]++;

        // Emit the event
        emit MetaTransactionExecuted(sender, msg.sender, targets, recipients, amounts);
    }

    // Function to recover the signer from the signature
    function recoverSigner(
        address sender,
        bytes memory transferData,
        uint256 nonce,
        bytes memory signature
    ) private view returns (address) {
        bytes32 domainSeparator = keccak256(abi.encode(
            EIP712_DOMAIN_TYPEHASH,
            keccak256("IXFIGateway"),
            keccak256("1"), // Version
            block.chainid,
            address(this)
        ));

        bytes32 structHash = keccak256(abi.encode(
            TRANSFER_TYPEHASH,
            sender,
            keccak256(transferData),
            nonce
        ));

        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01", 
            domainSeparator, 
            structHash
        ));

        return digest.recover(signature);
    }

    // Function to get all the whitelisted relayers
    function getWhitelistedRelayers() external view returns (address[] memory) {
        return relayers.values();
    }
}