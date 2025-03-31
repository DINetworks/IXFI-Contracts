// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";

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
        address receipient;
        uint256 amount;
    }

    mapping(address => bool) public whitelisted;
    mapping(address => uint256) public nonces;

    EnumerableSet.AddressSet private relayers;

    event RelayerAdded(address index);
    event RelayerRemoved(address index);
    event MetaTransactionExecuted(address indexed sender, address indexed relayerAddress, address[] targets, address[] receipients, uint256[] amounts);

    constructor(address owner_) 
        Ownable(owner_) 
    { 
    }

    modifier onlyRelayer() {
        require(whitelisted[msg.sender], "Caller not whitelisted realyers");
        _;
    }

    function addWhitelistedRelayer(address relayer) public onlyOwner {
        require(relayer != address(0), 'address is not valid');
        require(!whitelisted[relayer], 'Already relayer');

        whitelisted[relayer] = true;
        relayers.add(relayer);

        emit RelayerAdded(relayer);
    }

    // remove current whitelisted relayer
    function removeWhitelistedRelayer(address relayer) public onlyOwner {
        require(whitelisted[relayer], 'Relayer not whitelisted');
        
        whitelisted[relayer] = false;
        relayers.remove(relayer);

        emit RelayerRemoved(relayer);
    }

    function executeMetaTransfer(
        address sender, 
        bytes memory transferData, 
        uint256 nonce, 
        bytes memory signature
    ) 
        public 
        onlyRelayer 
    {
        // 1. Nonce check should come first (security best practice)
        require(nonce == nonces[sender], "Invalid nonce");
        
        // 2. Recover signer BEFORE using the nonce (critical fix)
        address signer = recoverSigner(sender, transferData, nonce, signature);
        
        // 3. Validate signature before processing
        require(signer == sender, "Invalid signature");
        
        // 4. Decode and validate parameters
        (
            address[] memory targets,
            address[] memory recipients,
            uint256[] memory amounts
        ) = abi.decode(transferData, (address[], address[], uint256[]));
        
        require(targets.length == recipients.length, "Invalid Parameters");
        require(targets.length == amounts.length, "Invalid Parameters");

        // 5. Process transfers
        for (uint i = 0; i < targets.length; ++i) {
            (bool success, ) = targets[i].call(abi.encodeWithSelector(
                IERC20.transferFrom.selector, 
                sender, 
                recipients[i], 
                amounts[i]
            ));
            require(success, "Meta-transaction failed");
        }
        
        // 6. Increment nonce AFTER all checks pass (security critical)
        nonces[sender]++;
        
        emit MetaTransactionExecuted(sender, msg.sender, targets, recipients, amounts);
    }


    function recoverSigner(
        address sender,
        bytes memory transferData,
        uint256 nonce,
        bytes memory signature
    ) private view returns (address) {
        bytes32 domainSeparator = keccak256(abi.encode(
            EIP712_DOMAIN_TYPEHASH,
            keccak256("IXFIGateway"),
            keccak256("1"),
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

}