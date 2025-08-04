// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title MetaTxGateway
 * @notice Gateway for executing gasless meta-transactions on any EVM chain
 * @dev Does not handle gas credits - relies on external relayer for credit management
 */
contract MetaTxGateway is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    // EIP-712 Domain Separator
    bytes32 private constant EIP712_DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    // EIP-712 Meta Transaction Typehash for batch transactions
    bytes32 private constant META_TRANSACTION_TYPEHASH = keccak256(
        "MetaTransaction(address from,bytes metaTxData,uint256 nonce,uint256 deadline)"
    );
    
    // Relayer management
    mapping(address => bool) public authorizedRelayers;
    
    // Nonce management for replay protection
    mapping(address => uint256) public nonces;

    // Storage for batch transaction logs
    struct BatchTransactionLog {
        address user;
        address relayer;
        bytes metaTxData;
        uint256 gasUsed;
        uint256 timestamp;
        bool[] successes;
    }

    // Mapping from batch transaction ID to log
    mapping(uint256 => BatchTransactionLog) public batchTransactionLogs;
    uint256 public nextBatchId;

    // Separate mapping for storing decoded transactions
    mapping(uint256 => MetaTransaction[]) public batchTransactions;

    struct MetaTransaction {
        address to;        // Target contract to call
        uint256 value;     // ETH value to send (usually 0)
        bytes data;        // Function call data
    }

    // Events
    event RelayerAuthorized(address indexed relayer, bool authorized);
    event MetaTransactionExecuted(
        address indexed user,
        address indexed relayer,
        address indexed target,
        bool success
    );
    event BatchTransactionExecuted(
        uint256 indexed batchId,
        address indexed user,
        address indexed relayer,
        uint256 gasUsed,
        uint256 transactionCount
    );

    constructor(address initialOwner) Ownable() {
        _transferOwnership(initialOwner);
    }

    // Owner functions ==============================================

    /**
     * @notice Authorize/deauthorize a relayer
     * @param relayer Relayer address
     * @param authorized True to authorize, false to deauthorize
     */
    function setRelayerAuthorization(address relayer, bool authorized) external onlyOwner {
        require(relayer != address(0), "Invalid relayer address");
        authorizedRelayers[relayer] = authorized;
        emit RelayerAuthorized(relayer, authorized);
    }

    // Meta-transaction functions ================================

    /**
     * @notice Execute a meta-transaction on behalf of a user
     * @param from User's address
     * @param metaTx Meta-transaction data
     * @return success True if the transaction was successful
     */
    function _executeMetaTransaction(
        address from,
        MetaTransaction calldata metaTx
    ) external nonReentrant returns (bool success) {
        // Execute the transaction
        (success, ) = metaTx.to.call{value: metaTx.value}(metaTx.data);
        
        emit MetaTransactionExecuted(from, msg.sender, metaTx.to, success);
        
        return success;
    }

    /**
     * @notice Batch execute multiple meta-transactions
     * @param from User's address
     * @param metaTxData Encoded bytes of Array of meta-transactions
     * @param signature signature corresponding to entire meta transaction
     * @param nonce User's nonce
     * @param deadline Transaction deadline
     * @return successes Array of success status for each transaction
     */
    function executeMetaTransactions(
        address from,
        bytes calldata metaTxData,
        bytes calldata signature,
        uint256 nonce,
        uint256 deadline
    ) external nonReentrant returns (bool[] memory successes) {
        uint256 batchGasStart = gasleft();
        
        require(authorizedRelayers[msg.sender], "Unauthorized relayer");
        require(block.timestamp <= deadline, "Transaction expired");
        require(nonce == nonces[from], "Invalid nonce");
        require(_verifySignature(from, metaTxData, signature, nonce, deadline), "Invalid signature");

        MetaTransaction[] memory metaTxs = abi.decode(metaTxData, (MetaTransaction[]));
        require(metaTxs.length > 0, "Empty batch Txs");     

        successes = new bool[](metaTxs.length);

        // Store batch transaction log
        uint256 batchId = nextBatchId++;

        // Execute all transactions in the batch
        for (uint256 i = 0; i < metaTxs.length; i++) {
            bool success;
            try this._executeMetaTransaction(from, metaTxs[i]) returns (bool _success) {
                success = _success;
            } catch {
                success = false;
            }
            
            batchTransactionLogs[batchId].successes.push(success);
            batchTransactions[batchId].push(metaTxs[i]);
        }

        // Increment nonce to prevent replay
        nonces[from]++;
        
        // Calculate total gas used for the entire batch
        uint256 totalGasUsed = batchGasStart - gasleft() + 21000; // Add base transaction cost

        batchTransactionLogs[batchId].user = from;
        batchTransactionLogs[batchId].relayer = msg.sender;
        batchTransactionLogs[batchId].metaTxData = metaTxData;
        batchTransactionLogs[batchId].gasUsed = totalGasUsed;
        batchTransactionLogs[batchId].timestamp = block.timestamp;

        // Emit batch transaction event
        emit BatchTransactionExecuted(batchId, from, msg.sender, totalGasUsed, metaTxs.length);

        return successes;
    }

    // Helper functions ==========================================

    /**
     * @notice Verify EIP-712 signature for batch meta-transactions
     * @param from User's address
     * @param metaTxData Encoded bytes of Meta-transactions data
     * @param signature User's signature
     * @param nonce User's nonce
     * @param deadline User's deadline
     * @return valid True if signature is valid
     */
    function _verifySignature(
        address from,
        bytes calldata metaTxData,
        bytes calldata signature,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bool valid) {
        bytes32 domainSeparator = this.getDomainSeparator();

        bytes32 structHash = keccak256(abi.encode(
            META_TRANSACTION_TYPEHASH,
            from,
            keccak256(metaTxData),
            nonce,
            deadline
        ));

        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            domainSeparator,
            structHash
        ));

        address recoveredSigner = digest.recover(signature);
        return recoveredSigner == from;
    }

    // View functions ============================================

    /**
     * @notice Get the current nonce for a user
     * @param user User address
     * @return currentNonce Current nonce value
     */
    function getNonce(address user) external view returns (uint256 currentNonce) {
        return nonces[user];
    }

    /**
     * @notice Check if a relayer is authorized
     * @param relayer Relayer address
     * @return isAuthorized True if relayer is authorized
     */
    function isRelayerAuthorized(address relayer) external view returns (bool isAuthorized) {
        return authorizedRelayers[relayer];
    }

    /**
     * @notice Get the domain separator for EIP-712
     * @return separator Domain separator hash
     */
    function getDomainSeparator() external view returns (bytes32 separator) {
        return keccak256(abi.encode(
            EIP712_DOMAIN_TYPEHASH,
            keccak256("MetaTxGateway"),
            keccak256("1"),
            block.chainid,
            address(this)
        ));
    }

    /**
     * @notice Get batch transaction log by ID
     * @param batchId Batch transaction ID
     * @return log Batch transaction log
     */
    function getBatchTransactionLog(uint256 batchId) external view returns (BatchTransactionLog memory log) {
        require(batchId < nextBatchId, "Invalid batch ID");
        return batchTransactionLogs[batchId];
    }

    /**
     * @notice Get batch transaction gas usage by ID
     * @param batchId Batch transaction ID
     * @return gasUsed Gas used for the batch transaction
     */
    function getBatchGasUsed(uint256 batchId) external view returns (uint256 gasUsed) {
        require(batchId < nextBatchId, "Invalid batch ID");
        return batchTransactionLogs[batchId].gasUsed;
    }

    /**
     * @notice Get batch transaction successes by ID
     * @param batchId Batch transaction ID
     * @return successes Array of success status for each transaction in the batch
     */
    function getBatchSuccesses(uint256 batchId) external view returns (bool[] memory successes) {
        require(batchId < nextBatchId, "Invalid batch ID");
        return batchTransactionLogs[batchId].successes;
    }

    /**
     * @notice Get total number of batch transactions processed
     * @return count Total batch transaction count
     */
    function getTotalBatchCount() external view returns (uint256 count) {
        return nextBatchId;
    }

    /**
     * @notice Get decoded transactions from a batch by ID
     * @param batchId Batch transaction ID
     * @return transactions Array of MetaTransaction structs in the batch
     */
    function getBatchTransactions(uint256 batchId) external view returns (MetaTransaction[] memory transactions) {
        require(batchId < nextBatchId, "Invalid batch ID");
        return batchTransactions[batchId];
    }
}