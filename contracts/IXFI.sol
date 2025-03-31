// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {IIXFICaller} from "./interfaces/IIXFICaller.sol";

contract IXFI is ERC20, Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;
    using SignatureChecker for address;
    using MessageHashUtils for bytes32;
    using ECDSA for bytes32;

    uint256 crossfi_chainid = 4157; // 4158 is in mainnet 
    EnumerableSet.AddressSet private relayers;

    mapping(address => bool) public whitelisted;
    mapping(address => uint256) public nonces;

    IIXFICaller caller;

    struct BridgedData {
        uint256 sourceChainId; 
        uint256 sourceNonce;
        uint256 destinationChainId;
        uint256 destinationNonce;
        bytes callData;
    }

    event RelayerAdded(address index);
    event RelayerRemoved(address index);

    event BridgeRequested(address index, uint256, bytes, bytes);
    event BridgedSuccess(address index, uint256, bytes, bytes);

    constructor(address owner_, IIXFICaller caller_) 
        ERC20("Interoperable XFI", "IXFI") 
        Ownable(owner_) 
    { 
        caller = caller_;
    }

    modifier onlyRelayer() {
        require(whitelisted[msg.sender], "Caller not whitelisted realyers");
        _;
    }

    modifier onlyCrossfiChain() {
        require(block.chainid == crossfi_chainid, "Not CrossFi Chain");
        _;
    }

    // add new whitelisted relayer
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

    // Users get IXFI token by locking their XFI
    function deposit() public payable onlyCrossfiChain {
        require(msg.value > 0, 'Zero Value');
        
        address account = msg.sender;
        _mint(account, msg.value);
    }

    // Users redeem XFI by removing their IXFI
    function withdraw(uint256 amount_) public onlyCrossfiChain {
        address account = msg.sender;
        require(address(this).balance >= amount_, "Not enough XFI");
        require(balanceOf(account) >= amount_, "Not enough IXFI");

        _burn(account, amount_);
        (bool success, ) = address(payable(account)).call{value: amount_}("");
        require(success, "Withdraw failed");
    }

    function mint(
        address to, 
        uint256 amount, 
        bytes calldata data, 
        bytes memory signature
    ) external onlyRelayer {
        
        BridgedData memory brgData = abi.decode(data, (BridgedData));
        bytes32 hash = keccak256(abi.encodePacked(to, amount, data));
        address signer = recoverSigner(hash, signature);

        require(amount > 0, "Zero Amount");
        require(to == signer, "Invalid signature");
        require(block.chainid == brgData.destinationChainId, "Wrong Destination Chain"); // prevent signature replay attack from different chains' transaction
        require(nonces[to] == brgData.destinationNonce, "Invalid nonce"); // prevent signature replay attack from same nonce in current chain

        nonces[to]++;
        _mint(to, amount);
        caller.multicall(brgData.callData);

        emit BridgedSuccess(to, amount, data, signature);
    }

    function burn(
        address from, 
        uint256 amount, 
        bytes calldata data, 
        bytes memory signature
    ) external onlyRelayer {
        
        BridgedData memory brgData = abi.decode(data, (BridgedData));
        bytes32 hash = keccak256(abi.encodePacked(from, amount, data));
        address signer = recoverSigner(hash, signature);

        require(from == signer, "Invalid signature");
        require(block.chainid == brgData.sourceChainId, "Wrong Source Chain"); // prevent signature replay attack from different chains' transaction
        require(nonces[from] == brgData.sourceNonce, "Wrong Nonce"); // prevent signature replay attack from same nonce in current chain
        
        nonces[from]++;
        _burn(from, amount);
        
        emit BridgeRequested(from, amount, data, signature);
    }

    // Recover the signer address from the signature
    function recoverSigner(bytes32 _hash, bytes memory _signature) public pure returns (address) {
        bytes32 ethSignedMessageHash = _hash.toEthSignedMessageHash();
        return ethSignedMessageHash.recover(_signature);
    }
    
}