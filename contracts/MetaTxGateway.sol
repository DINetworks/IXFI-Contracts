// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
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

    // EIP-712 Meta Transaction Typehash
    bytes32 private constant META_TRANSACTION_TYPEHASH = keccak256(
        "MetaTransaction(address from,address to,uint256 value,bytes data,uint256 nonce,uint256 deadline)"
    );
    
    // Relayer management
    mapping(address => bool) public authorizedRelayers;
    
    // Nonce management for replay protection
    mapping(address => uint256) public nonces;
    
    struct MetaTransaction {
        address from;      // User who signed the transaction
        address to;        // Target contract to call
        uint256 value;     // ETH value to send (usually 0)
        bytes data;        // Function call data
        uint256 nonce;     // User's current nonce
        uint256 deadline;  // Transaction deadline
    }

    // Events
    event RelayerAuthorized(address indexed relayer, bool authorized);
    event MetaTransactionExecuted(
        address indexed user,
        address indexed relayer,
        address indexed target,
        uint256 gasUsed,
        bool success
    );

    constructor(address initialOwner) Ownable(initialOwner) {}

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
     * @param metaTx Meta-transaction data
     * @param signature User's signature
     * @return success True if the transaction was successful
     */
    function executeMetaTransaction(
        MetaTransaction calldata metaTx,
        bytes calldata signature
    ) external nonReentrant returns (bool success) {
        require(authorizedRelayers[msg.sender], "Unauthorized relayer");
        require(block.timestamp <= metaTx.deadline, "Transaction expired");
        require(metaTx.nonce == nonces[metaTx.from], "Invalid nonce");

        // Verify signature
        require(_verifySignature(metaTx, signature), "Invalid signature");

        // Estimate gas before execution
        uint256 gasStart = gasleft();

        // Increment nonce to prevent replay
        nonces[metaTx.from]++;

        // Execute the transaction
        (success, ) = metaTx.to.call{value: metaTx.value}(metaTx.data);
        
        // Calculate actual gas used
        uint256 gasUsed = gasStart - gasleft() + 21000; // Add base transaction cost
        
        emit MetaTransactionExecuted(metaTx.from, msg.sender, metaTx.to, gasUsed, success);
        
        return success;
    }

    /**
     * @notice Batch execute multiple meta-transactions
     * @param metaTxs Array of meta-transactions
     * @param signatures Array of signatures corresponding to each transaction
     * @return successes Array of success status for each transaction
     */
    function batchExecuteMetaTransactions(
        MetaTransaction[] calldata metaTxs,
        bytes[] calldata signatures
    ) external nonReentrant returns (bool[] memory successes) {
        require(authorizedRelayers[msg.sender], "Unauthorized relayer");
        require(metaTxs.length == signatures.length, "Length mismatch");
        require(metaTxs.length > 0, "Empty batch");

        successes = new bool[](metaTxs.length);

        for (uint256 i = 0; i < metaTxs.length; i++) {
            // Execute each transaction individually
            // Note: Using a try-catch to continue execution even if one fails
            try this.executeMetaTransaction(metaTxs[i], signatures[i]) returns (bool success) {
                successes[i] = success;
            } catch {
                successes[i] = false;
            }
        }

        return successes;
    }

    // Helper functions ==========================================

    /**
     * @notice Verify EIP-712 signature for a meta-transaction
     * @param metaTx Meta-transaction data
     * @param signature User's signature
     * @return valid True if signature is valid
     */
    function _verifySignature(
        MetaTransaction calldata metaTx,
        bytes calldata signature
    ) internal view returns (bool valid) {
        bytes32 domainSeparator = keccak256(abi.encode(
            EIP712_DOMAIN_TYPEHASH,
            keccak256("MetaTxGateway"),
            keccak256("1"),
            block.chainid,
            address(this)
        ));

        bytes32 structHash = keccak256(abi.encode(
            META_TRANSACTION_TYPEHASH,
            metaTx.from,
            metaTx.to,
            metaTx.value,
            keccak256(metaTx.data),
            metaTx.nonce,
            metaTx.deadline
        ));

        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            domainSeparator,
            structHash
        ));

        address recoveredSigner = digest.recover(signature);
        return recoveredSigner == metaTx.from;
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
}