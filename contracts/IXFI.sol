// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

contract IXFI is ERC20, Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;
    using SignatureChecker for address;
    using ECDSA for bytes32;

    uint256 crossfi_chainid = 4158; // 4158 is in mainnet 
    EnumerableSet.AddressSet private relayers;

    mapping(address => bool) public whitelisted;
    mapping(bytes32 => bool) public commandExecuted;
    mapping(string => uint256) public chainIds;
    mapping(uint256 => string) public chainNames;
    mapping(bytes32 => bytes) public approvedPayloads; // Store approved payloads for execution

    // GMP Protocol structures
    struct Command {
        uint256 commandType;
        bytes data;
    }

    // Command types (similar to Axelar)
    uint256 public constant COMMAND_APPROVE_CONTRACT_CALL = 0;
    uint256 public constant COMMAND_APPROVE_CONTRACT_CALL_WITH_MINT = 1;
    uint256 public constant COMMAND_BURN_TOKEN = 2;
    uint256 public constant COMMAND_MINT_TOKEN = 4;

    event RelayerAdded(address indexed relayer);
    event RelayerRemoved(address indexed relayer);
    event ChainAdded(string indexed chainName, uint256 chainId);
    event ChainRemoved(string indexed chainName);

    // GMP Events (similar to Axelar)
    event ContractCall(
        address indexed sender,
        string destinationChain,
        string destinationContractAddress,
        bytes32 indexed payloadHash,
        bytes payload
    );

    event ContractCallWithToken(
        address indexed sender,
        string destinationChain,
        string destinationContractAddress,
        bytes32 indexed payloadHash,
        bytes payload,
        string symbol,
        uint256 amount
    );

    event ContractCallApproved(
        bytes32 indexed commandId,
        string sourceChain,
        string sourceAddress,
        address indexed contractAddress,
        bytes32 indexed payloadHash,
        bytes32 sourceTxHash,
        uint256 sourceEventIndex
    );

    event ContractCallApprovedWithMint(
        bytes32 indexed commandId,
        string sourceChain,
        string sourceAddress,
        address indexed contractAddress,
        bytes32 indexed payloadHash,
        string symbol,
        uint256 amount,
        bytes32 sourceTxHash,
        uint256 sourceEventIndex
    );

    event TokenSent(
        address indexed sender,
        string destinationChain,
        string destinationAddress,
        string symbol,
        uint256 amount
    );

    event Executed(bytes32 indexed commandId);

    // Native XFI <-> IXFI conversion events
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    constructor(address owner_) 
        ERC20("Interoperable XFI", "IXFI") 
        Ownable() 
    {
        // Transfer ownership to the specified owner
        _transferOwnership(owner_);
        
        // Initialize default chains
        chainIds["crossfi"] = 4158;
        chainNames[4158] = "crossfi";
        chainIds["ethereum"] = 1;
        chainNames[1] = "ethereum";
        chainIds["bsc"] = 56;
        chainNames[56] = "bsc";
        chainIds["polygon"] = 137;
        chainNames[137] = "polygon";
        chainIds["base"] = 8453;
        chainNames[8453] = "base";
        chainIds["arbitrum"] = 42161;
        chainNames[42161] = "arbitrum";
        chainIds["avalanche"] = 43114;
        chainNames[43114] = "avalanche";
        chainIds["optimism"] = 10;
        chainNames[10] = "optimism";
    }

    modifier onlyRelayer() {
        require(whitelisted[msg.sender], "Caller not whitelisted relayers");
        _;
    }

    modifier onlyCrossfiChain() {
        require(block.chainid == crossfi_chainid, "Not CrossFi Chain");
        _;
    }

    modifier notExecuted(bytes32 commandId) {
        require(!commandExecuted[commandId], "Command already executed");
        _;
    }

    // Chain management functions
    function addChain(string memory chainName, uint256 chainId) external onlyOwner {
        require(bytes(chainName).length > 0, "Invalid chain name");
        require(chainId > 0, "Invalid chain ID");
        require(chainIds[chainName] == 0, "Chain already exists");
        
        chainIds[chainName] = chainId;
        chainNames[chainId] = chainName;
        
        emit ChainAdded(chainName, chainId);
    }

    function removeChain(string memory chainName) external onlyOwner {
        uint256 chainId = chainIds[chainName];
        require(chainId > 0, "Chain does not exist");
        
        delete chainIds[chainName];
        delete chainNames[chainId];
        
        emit ChainRemoved(chainName);
    }

    function getChainId(string memory chainName) external view returns (uint256) {
        return chainIds[chainName];
    }

    function getChainName(uint256 chainId) external view returns (string memory) {
        return chainNames[chainId];
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

    // GMP Protocol Core Functions
    
    /**
     * @dev Call a contract on another chain
     * @param destinationChain The name of the destination chain
     * @param destinationContractAddress The address of the contract to call
     * @param payload The payload to send to the contract
     */
    function callContract(
        string memory destinationChain,
        string memory destinationContractAddress,
        bytes memory payload
    ) external {
        require(chainIds[destinationChain] > 0, "Unsupported destination chain");
        require(bytes(destinationContractAddress).length > 0, "Invalid destination address");
        
        bytes32 payloadHash = keccak256(payload);
        
        emit ContractCall(
            msg.sender,
            destinationChain,
            destinationContractAddress,
            payloadHash,
            payload
        );
    }

    /**
     * @dev Call a contract on another chain with token transfer
     * @param destinationChain The name of the destination chain
     * @param destinationContractAddress The address of the contract to call
     * @param payload The payload to send to the contract
     * @param symbol The symbol of the token to send
     * @param amount The amount of tokens to send
     */
    function callContractWithToken(
        string memory destinationChain,
        string memory destinationContractAddress,
        bytes memory payload,
        string memory symbol,
        uint256 amount
    ) external {
        require(chainIds[destinationChain] > 0, "Unsupported destination chain");
        require(bytes(destinationContractAddress).length > 0, "Invalid destination address");
        require(amount > 0, "Amount must be greater than zero");
        require(keccak256(bytes(symbol)) == keccak256(bytes("IXFI")), "Unsupported token");
        
        // Burn tokens from sender
        _burn(msg.sender, amount);
        
        bytes32 payloadHash = keccak256(payload);
        
        emit ContractCallWithToken(
            msg.sender,
            destinationChain,
            destinationContractAddress,
            payloadHash,
            payload,
            symbol,
            amount
        );
    }

    /**
     * @dev Send tokens to another chain
     * @param destinationChain The name of the destination chain
     * @param destinationAddress The address to send tokens to
     * @param symbol The symbol of the token to send
     * @param amount The amount of tokens to send
     */
    function sendToken(
        string memory destinationChain,
        string memory destinationAddress,
        string memory symbol,
        uint256 amount
    ) external {
        require(chainIds[destinationChain] > 0, "Unsupported destination chain");
        require(bytes(destinationAddress).length > 0, "Invalid destination address");
        require(amount > 0, "Amount must be greater than zero");
        require(keccak256(bytes(symbol)) == keccak256(bytes("IXFI")), "Unsupported token");
        
        // Burn tokens from sender
        _burn(msg.sender, amount);
        
        emit TokenSent(
            msg.sender,
            destinationChain,
            destinationAddress,
            symbol,
            amount
        );
    }

    /**
     * @dev Deposit native XFI tokens to mint equivalent IXFI tokens (1:1 ratio)
     * 
     * This function allows users to lock their native XFI tokens in the contract
     * and receive an equivalent amount of IXFI tokens. This is the entry point
     * for users to participate in cross-chain transfers using the GMP protocol.
     * 
     * Requirements:
     * - Must be called on CrossFi chain (chainId 4157 for testnet, 4158 for mainnet)
     * - Must send a positive amount of XFI (msg.value > 0)
     * - XFI tokens are locked in the contract and cannot be withdrawn by contract owner
     * 
     * Process:
     * 1. Validates the sent XFI amount is greater than zero
     * 2. Mints equivalent IXFI tokens to the sender's address
     * 3. XFI tokens remain locked in the contract as collateral
     * 
     * Example usage:
     * ```
     * // Deposit 100 XFI to get 100 IXFI
     * ixfi.deposit{value: 100 ether}();
     * ```
     * 
     * @notice This creates a 1:1 backing between XFI and IXFI tokens
     * @notice Users can later withdraw their XFI by burning IXFI tokens
     */
    function deposit() public payable onlyCrossfiChain {
        require(msg.value > 0, 'Zero Value');
        
        address account = msg.sender;
        _mint(account, msg.value);
        
        emit Deposited(account, msg.value);
    }

    /**
     * @dev Withdraw native XFI tokens by burning equivalent IXFI tokens (1:1 ratio)
     * 
     * This function allows users to redeem their locked XFI tokens by burning
     * their IXFI tokens. This is the exit mechanism for users who want to
     * convert their cross-chain IXFI tokens back to native XFI.
     * 
     * Requirements:
     * - Must be called on CrossFi chain (chainId 4157 for testnet, 4158 for mainnet)
     * - User must have sufficient IXFI token balance
     * - Contract must have sufficient XFI balance to honor the withdrawal
     * - Amount must be greater than zero
     * 
     * Security measures:
     * - Burns IXFI tokens before transferring XFI (checks-effects-interactions pattern)
     * - Uses low-level call for XFI transfer with success verification
     * - Prevents reentrancy by burning tokens first
     * 
     * Process:
     * 1. Validates the withdrawal amount
     * 2. Checks user has sufficient IXFI balance
     * 3. Checks contract has sufficient XFI to transfer
     * 4. Burns the specified amount of IXFI tokens from user's balance
     * 5. Transfers equivalent XFI to the user
     * 6. Reverts entire transaction if XFI transfer fails
     * 
     * Example usage:
     * ```
     * // Withdraw 50 XFI by burning 50 IXFI
     * ixfi.withdraw(50 ether);
     * ```
     * 
     * @param amount_ The amount of IXFI tokens to burn and equivalent XFI to withdraw
     * @notice This maintains the 1:1 backing ratio between XFI and IXFI
     * @notice Failed XFI transfers will revert the entire transaction
     */
    function withdraw(uint256 amount_) public onlyCrossfiChain {
        address account = msg.sender;
        require(amount_ > 0, "Zero amount");
        require(address(this).balance >= amount_, "Not enough XFI");
        require(balanceOf(account) >= amount_, "Not enough IXFI");

        _burn(account, amount_);
        (bool success, ) = address(payable(account)).call{value: amount_}("");
        require(success, "Withdraw failed");
        
        emit Withdrawn(account, amount_);
    }

    // GMP Command Execution Functions (for relayers)

    /**
     * @dev Execute commands from relayers
     * @param commandId Unique identifier for the command
     * @param commands Array of commands to execute
     * @param signature Signature from authorized relayer
     */
    function execute(
        bytes32 commandId,
        Command[] memory commands,
        bytes memory signature
    ) external onlyRelayer notExecuted(commandId) {
        // Mark command as executed to prevent replay
        commandExecuted[commandId] = true;
        
        // Verify signature
        bytes32 hash = keccak256(abi.encode(commandId, commands));
        address signer = recoverSigner(hash, signature);
        require(whitelisted[signer], "Invalid signer");
        
        // Execute all commands
        for (uint256 i = 0; i < commands.length; i++) {
            _executeCommand(commandId, commands[i]);
        }
        
        emit Executed(commandId);
    }

    /**
     * @dev Internal function to execute individual commands
     */
    function _executeCommand(bytes32 commandId, Command memory command) internal {
        if (command.commandType == COMMAND_APPROVE_CONTRACT_CALL) {
            _approveContractCall(commandId, command.data);
        } else if (command.commandType == COMMAND_APPROVE_CONTRACT_CALL_WITH_MINT) {
            _approveContractCallWithMint(commandId, command.data);
        } else if (command.commandType == COMMAND_MINT_TOKEN) {
            _mintToken(command.data);
        } else if (command.commandType == COMMAND_BURN_TOKEN) {
            _burnToken(command.data);
        } else {
            revert("Unknown command type");
        }
    }

    /**
     * @dev Approve a contract call from another chain
     */
    function _approveContractCall(bytes32 commandId, bytes memory data) internal {
        (
            string memory sourceChain,
            string memory sourceAddress,
            address contractAddress,
            bytes32 payloadHash,
            bytes32 sourceTxHash,
            uint256 sourceEventIndex,
            bytes memory payload
        ) = abi.decode(data, (string, string, address, bytes32, bytes32, uint256, bytes));
        
        // Verify payload hash matches
        require(keccak256(payload) == payloadHash, "Invalid payload hash");
        
        // Store approved payload for potential execution
        approvedPayloads[commandId] = payload;
        
        emit ContractCallApproved(
            commandId,
            sourceChain,
            sourceAddress,
            contractAddress,
            payloadHash,
            sourceTxHash,
            sourceEventIndex
        );

        // Execute the contract call if the contract implements IXFIExecutable
        if (contractAddress.code.length > 0) {
            try this._safeExecuteCall(
                commandId,
                sourceChain,
                sourceAddress,
                contractAddress,
                payload
            ) {
                // Call succeeded
            } catch {
                // Call failed, but we don't revert the entire transaction
                // The event is still emitted so the approval is recorded
            }
        }
    }

    /**
     * @dev Approve a contract call with mint from another chain
     */
    function _approveContractCallWithMint(bytes32 commandId, bytes memory data) internal {
        (
            string memory sourceChain,
            string memory sourceAddress,
            address contractAddress,
            bytes32 payloadHash,
            string memory symbol,
            uint256 amount,
            bytes32 sourceTxHash,
            uint256 sourceEventIndex,
            bytes memory payload
        ) = abi.decode(data, (string, string, address, bytes32, string, uint256, bytes32, uint256, bytes));
        
        require(keccak256(bytes(symbol)) == keccak256(bytes("IXFI")), "Unsupported token");
        
        // Verify payload hash matches
        require(keccak256(payload) == payloadHash, "Invalid payload hash");
        
        // Store approved payload for potential execution
        approvedPayloads[commandId] = payload;
        
        // Mint tokens to the contract
        _mint(contractAddress, amount);
        
        emit ContractCallApprovedWithMint(
            commandId,
            sourceChain,
            sourceAddress,
            contractAddress,
            payloadHash,
            symbol,
            amount,
            sourceTxHash,
            sourceEventIndex
        );

        // Execute the contract call with token if the contract implements IXFIExecutable
        if (contractAddress.code.length > 0) {
            try this._safeExecuteCallWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                contractAddress,
                payload,
                symbol,
                amount
            ) {
                // Call succeeded
            } catch {
                // Call failed, but we don't revert the entire transaction
                // The tokens are still minted and event is emitted
            }
        }
    }

    /**
     * @dev Mint tokens (for cross-chain transfers)
     */
    function _mintToken(bytes memory data) internal {
        (address to, uint256 amount, string memory symbol) = abi.decode(data, (address, uint256, string));
        
        require(keccak256(bytes(symbol)) == keccak256(bytes("IXFI")), "Unsupported token");
        require(amount > 0, "Amount must be greater than zero");
        require(to != address(0), "Invalid recipient");
        
        _mint(to, amount);
    }

    /**
     * @dev Burn tokens (for cross-chain transfers)
     */
    function _burnToken(bytes memory data) internal {
        (address from, uint256 amount, string memory symbol) = abi.decode(data, (address, uint256, string));
        
        require(keccak256(bytes(symbol)) == keccak256(bytes("IXFI")), "Unsupported token");
        require(amount > 0, "Amount must be greater than zero");
        require(from != address(0), "Invalid sender");
        
        _burn(from, amount);
    }

    /**
     * @dev Get the current XFI backing ratio
     * @return The amount of XFI locked in the contract
     */
    function getXFIBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev Check if the contract is fully backed (XFI balance >= IXFI supply)
     * @return True if fully backed, false otherwise
     */
    function isFullyBacked() external view returns (bool) {
        return address(this).balance >= totalSupply();
    }

    /**
     * @dev Safely execute a contract call (external function for try-catch)
     */
    function _safeExecuteCall(
        bytes32 commandId,
        string memory sourceChain,
        string memory sourceAddress,
        address contractAddress,
        bytes memory payload
    ) external {
        require(msg.sender == address(this), "Only self");
        
        // Try to call the execute function on the target contract
        (bool success, ) = contractAddress.call(
            abi.encodeWithSignature(
                "execute(bytes32,string,string,bytes)",
                commandId,
                sourceChain,
                sourceAddress,
                payload
            )
        );
        
        require(success, "Contract call failed");
    }

    /**
     * @dev Safely execute a contract call with token (external function for try-catch)
     */
    function _safeExecuteCallWithToken(
        bytes32 commandId,
        string memory sourceChain,
        string memory sourceAddress,
        address contractAddress,
        bytes memory payload,
        string memory symbol,
        uint256 amount
    ) external {
        require(msg.sender == address(this), "Only self");
        
        // Try to call the executeWithToken function on the target contract
        (bool success, ) = contractAddress.call(
            abi.encodeWithSignature(
                "executeWithToken(bytes32,string,string,bytes,string,uint256)",
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                symbol,
                amount
            )
        );
        
        require(success, "Contract call with token failed");
    }

    // Utility functions

    /**
     * @dev Check if a command has been executed
     * @param commandId The command ID to check
     * @return True if the command has been executed
     */
    function isCommandExecuted(bytes32 commandId) external view returns (bool) {
        return commandExecuted[commandId];
    }

    /**
     * @dev Check if a contract call is approved
     * @param commandId Unique identifier for the command
     * @return True if the contract call is approved
     */
    function isContractCallApproved(
        bytes32 commandId,
        string calldata /* sourceChain */,
        string calldata /* sourceAddress */,
        address /* contractAddress */,
        bytes32 /* payloadHash */
    ) external view returns (bool) {
        return commandExecuted[commandId];
    }

    /**
     * @dev Check if a contract call with mint is approved
     * @param commandId Unique identifier for the command
     * @return True if the contract call with mint is approved
     */
    function isContractCallAndMintApproved(
        bytes32 commandId,
        string calldata /* sourceChain */,
        string calldata /* sourceAddress */,
        address /* contractAddress */,
        bytes32 /* payloadHash */,
        string calldata /* symbol */,
        uint256 /* amount */
    ) external view returns (bool) {
        return commandExecuted[commandId];
    }

    /**
     * @dev Get approved payload for a command
     * @param commandId The command ID to get payload for
     * @return The approved payload data
     */
    function getApprovedPayload(bytes32 commandId) external view returns (bytes memory) {
        return approvedPayloads[commandId];
    }

    /**
     * @dev Validate contract call for IXFIExecutable contracts
     * @param commandId Unique identifier for the command
     * @param sourceChain Name of the source chain
     * @param sourceAddress Address of the sender on the source chain
     * @param payloadHash Hash of the payload
     * @return True if valid and approved
     */
    function validateContractCall(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash
    ) external view returns (bool) {
        if (!commandExecuted[commandId]) {
            return false;
        }
        
        bytes memory storedPayload = approvedPayloads[commandId];
        if (storedPayload.length == 0) {
            return false;
        }
        
        return keccak256(storedPayload) == payloadHash;
    }

    /**
     * @dev Validate contract call with mint for IXFIExecutable contracts
     * @param commandId Unique identifier for the command
     * @param sourceChain Name of the source chain
     * @param sourceAddress Address of the sender on the source chain
     * @param payloadHash Hash of the payload
     * @param symbol Token symbol
     * @param amount Token amount
     * @return True if valid and approved
     */
    function validateContractCallAndMint(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash,
        string calldata symbol,
        uint256 amount
    ) external view returns (bool) {
        if (!commandExecuted[commandId]) {
            return false;
        }
        
        bytes memory storedPayload = approvedPayloads[commandId];
        if (storedPayload.length == 0) {
            return false;
        }
        
        return keccak256(storedPayload) == payloadHash;
    }

    /**
     * @dev Check if an address is a whitelisted relayer
     * @param relayer The address to check
     * @return True if the address is whitelisted
     */
    function isWhitelistedRelayer(address relayer) external view returns (bool) {
        return whitelisted[relayer];
    }

    /**
     * @dev Get all whitelisted relayers
     * @return Array of whitelisted relayer addresses
     */
    function getAllRelayers() external view returns (address[] memory) {
        uint256 length = relayers.length();
        address[] memory result = new address[](length);
        
        for (uint256 i = 0; i < length; i++) {
            result[i] = relayers.at(i);
        }
        
        return result;
    }

    /**
     * @dev Get the number of whitelisted relayers
     * @return The number of relayers
     */
    function getRelayerCount() external view returns (uint256) {
        return relayers.length();
    }

    // Recover the signer address from the signature
    function recoverSigner(bytes32 _hash, bytes memory _signature) public pure returns (address) {
        bytes32 ethSignedMessageHash = _hash.toEthSignedMessageHash();
        return ethSignedMessageHash.recover(_signature);
    }
    
}