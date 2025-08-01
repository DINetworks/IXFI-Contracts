// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title IDIAOracleV2
 * @notice Interface for DIA Oracle V2 to get price feeds
 */
interface IDIAOracleV2 {
    function getValue(string memory key) external view returns (uint128, uint128);
}

/**
 * @title IIXFI
 * @notice Interface for IXFI token contract with deposit function
 */
interface IIXFI {
    function deposit() external payable;
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/**
 * @title MetaTxGasCreditVault
 * @notice Gas credit vault that uses IXFI as the primary gas token across all EVM chains
 * @dev Users deposit IXFI tokens to get gas credits for meta-transactions
 */
contract MetaTxGasCreditVault is Ownable, ReentrancyGuard {
    
    // IXFI token contract with conversion capabilities
    IIXFI public immutable ixfiToken;
    
    // DIA Oracle for IXFI/USD price feed
    IDIAOracleV2 public diaOracle;
    string public ixfiPriceKey = "IXFI/USD"; // DIA Oracle key for IXFI price
    
    // Price feed settings
    uint256 public maxPriceAge = 3600; // Maximum age of price data (1 hour)
    
    // CrossFi chain ID for XFI conversion
    uint256 public constant CROSSFI_CHAIN_ID = 4158; // CrossFi mainnet
    
    // User balances
    mapping(address => uint256) public deposits; // IXFI deposited
    mapping(address => uint256) public credits;  // Gas credits available (in USD cents)
    
    // Gateway contract that can consume credits
    mapping(address => bool) public authorizedGateways;
    
    // Events
    event Deposited(address indexed user, uint256 ixfiAmount, uint256 creditsAdded);
    event XFIDeposited(address indexed user, uint256 xfiAmount, uint256 ixfiAmount, uint256 creditsAdded);
    event Withdrawn(address indexed user, uint256 ixfiAmount, uint256 creditsDeducted);
    event CreditsUsed(address indexed user, address indexed gateway, uint256 creditsUsed, uint256 gasUsd);
    event GatewayAuthorized(address indexed gateway, bool authorized);
    event OracleUpdated(address newOracle);
    event PriceKeyUpdated(string newKey);
    event MaxPriceAgeUpdated(uint256 newMaxAge);

    constructor(address initialOwner, address _ixfiToken, address _diaOracle) Ownable() {
        require(_ixfiToken != address(0), "Invalid IXFI token address");
        require(_diaOracle != address(0), "Invalid DIA Oracle address");
        ixfiToken = IIXFI(_ixfiToken);
        diaOracle = IDIAOracleV2(_diaOracle);
        _transferOwnership(initialOwner);
    }

    // Modifiers ==================================================
    
    /**
     * @notice Ensures function is only called on CrossFi chain
     */
    modifier onlyCrossFiChain() {
        require(block.chainid == CROSSFI_CHAIN_ID, "Only available on CrossFi chain");
        _;
    }

    // Owner functions ==============================================
    /**
     * @notice Authorize/deauthorize a gateway contract to consume credits
     * @param gateway Gateway contract address
     * @param authorized True to authorize, false to deauthorize
     */
    function setGatewayAuthorization(address gateway, bool authorized) external onlyOwner {
        require(gateway != address(0), "Invalid gateway address");
        authorizedGateways[gateway] = authorized;
        emit GatewayAuthorized(gateway, authorized);
    }

    /**
     * @notice Update the DIA Oracle contract address
     * @param newOracle New DIA Oracle contract address
     */
    function setDIAOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid oracle address");
        diaOracle = IDIAOracleV2(newOracle);
        emit OracleUpdated(newOracle);
    }

    /**
     * @notice Update the IXFI price key for DIA Oracle
     * @param newKey New price key (e.g., "IXFI/USD")
     */
    function setIXFIPriceKey(string memory newKey) external onlyOwner {
        require(bytes(newKey).length > 0, "Invalid price key");
        ixfiPriceKey = newKey;
        emit PriceKeyUpdated(newKey);
    }

    /**
     * @notice Update maximum age for price data
     * @param newMaxAge New maximum age in seconds
     */
    function setMaxPriceAge(uint256 newMaxAge) external onlyOwner {
        require(newMaxAge > 0, "Max age must be > 0");
        maxPriceAge = newMaxAge;
        emit MaxPriceAgeUpdated(newMaxAge);
    }

    // User functions ==============================================

    /**
     * @notice Deposit IXFI tokens to get gas credits (in USD cents)
     * @param amount Amount of IXFI tokens to deposit
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");

        // Transfer IXFI tokens from user
        ixfiToken.transferFrom(msg.sender, address(this), amount);

        // Calculate USD value of deposited IXFI
        uint256 creditsAdded = calculateCreditsFromIXFI(amount);
        
        // Update balances
        deposits[msg.sender] += amount;
        credits[msg.sender] += creditsAdded;

        emit Deposited(msg.sender, amount, creditsAdded);
    }

    /**
     * @notice Deposit XFI to convert to IXFI and get gas credits (CrossFi chain only)
     * @dev Receives XFI via msg.value, converts to IXFI using IXFI.deposit(), then adds credits
     */
    function deposit() external payable nonReentrant onlyCrossFiChain {
        require(msg.value > 0, "Must send XFI");
        
        // Convert XFI to IXFI by calling IXFI contract's deposit function
        // This will mint IXFI tokens to this contract at 1:1 ratio
        ixfiToken.deposit{value: msg.value}();
        
        // IXFI received equals XFI sent (1:1 ratio)
        uint256 ixfiReceived = msg.value;
        
        // Calculate USD value of the IXFI received
        uint256 creditsAdded = calculateCreditsFromIXFI(ixfiReceived);
        
        // Update user balances (same logic as deposit(amount))
        deposits[msg.sender] += ixfiReceived;
        credits[msg.sender] += creditsAdded;
        
        emit XFIDeposited(msg.sender, msg.value, ixfiReceived, creditsAdded);
    }

    /**
     * @notice Withdraw IXFI tokens by spending gas credits
     * @param amount Amount of IXFI tokens to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(deposits[msg.sender] >= amount, "Insufficient IXFI balance");

        // Calculate required credits (USD cents)
        uint256 creditsRequired = calculateCreditsFromIXFI(amount);
        require(credits[msg.sender] >= creditsRequired, "Insufficient credits");

        // Update balances
        deposits[msg.sender] -= amount;
        credits[msg.sender] -= creditsRequired;

        // Transfer IXFI tokens back to user
        ixfiToken.transfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount, creditsRequired);
    }

    // Gateway functions ==========================================

    /**
     * @notice Consume gas credits for a meta-transaction (only authorized gateways)
     * @param user User whose credits to consume
     * @param gasUsd Gas cost in USD cents (calculated by relayer: gasAmount * gasPrice * tokenPrice)
     * @return success True if credits were successfully consumed
     */
    function consumeCredits(address user, uint256 gasUsd) external returns (bool success) {
        require(authorizedGateways[msg.sender], "Unauthorized gateway");
        require(user != address(0), "Invalid user address");
        require(gasUsd > 0, "Gas USD must be > 0");

        // Check if user has enough credits (gasUsd is already in USD cents)
        if (credits[user] < gasUsd) {
            return false; // Not enough credits
        }

        // Consume credits
        credits[user] -= gasUsd;
        
        emit CreditsUsed(user, msg.sender, gasUsd, gasUsd);
        return true;
    }

    // Calculation functions ======================================

    /**
     * @notice Get current IXFI price from DIA Oracle
     * @return price IXFI price in USD (8 decimals)
     * @return timestamp Price timestamp
     */
    function getIXFIPrice() public view returns (uint128 price, uint128 timestamp) {
        return diaOracle.getValue(ixfiPriceKey);
    }

    /**
     * @notice Calculate gas credits (USD cents) for a given IXFI amount
     * @param ixfiAmount Amount of IXFI tokens (18 decimals)
     * @return usdCredits Gas credits in USD cents
     */
    function calculateCreditsFromIXFI(uint256 ixfiAmount) public view returns (uint256 usdCredits) {
        (uint128 ixfiPrice, uint128 timestamp) = getIXFIPrice();
        
        // Check price freshness
        require(timestamp > 0, "Invalid price data");
        require(block.timestamp - timestamp <= maxPriceAge, "Price data too old");
        
        // Calculate USD value: ixfiAmount * ixfiPrice / 1e18 * 100 (for cents)
        // ixfiPrice has 8 decimals, ixfiAmount has 18 decimals
        // Result should be in cents (2 decimals precision)
        return (ixfiAmount * ixfiPrice * 100) / 1e26; // 1e18 (IXFI decimals) + 1e8 (price decimals)
    }

    /**
     * @notice Calculate IXFI amount needed for specific USD amount
     * @param usdCents USD amount in cents
     * @return ixfiNeeded IXFI tokens needed (18 decimals)
     */
    function calculateIXFIForUSD(uint256 usdCents) public view returns (uint256 ixfiNeeded) {
        (uint128 ixfiPrice, uint128 timestamp) = getIXFIPrice();
        
        // Check price freshness
        require(timestamp > 0, "Invalid price data");
        require(block.timestamp - timestamp <= maxPriceAge, "Price data too old");
        
        // Calculate IXFI needed: usdCents / (ixfiPrice / 1e8) * 1e18 / 100
        return (usdCents * 1e26) / (ixfiPrice * 100); // Reverse of calculateCreditsFromIXFI
    }

    // View functions =============================================

    /**
     * @notice Get user's gas credit balance
     * @param user User address
     * @return creditBalance Available credits in USD cents
     */
    function getCreditBalance(address user) external view returns (uint256 creditBalance) {
        return credits[user];
    }

    /**
     * @notice Get user's IXFI deposit balance
     * @param user User address
     * @return depositBalance IXFI tokens deposited
     */
    function getDepositBalance(address user) external view returns (uint256 depositBalance) {
        return deposits[user];
    }

    /**
     * @notice Check if user has enough credits for a gas cost in USD
     * @param user User address
     * @param gasUsd Gas cost in USD cents
     * @return hasEnough True if user has enough credits
     */
    function hasEnoughCredits(address user, uint256 gasUsd) external view returns (bool hasEnough) {
        return credits[user] >= gasUsd;
    }

    /**
     * @notice Get current oracle settings and IXFI price
     * @return oracleAddress DIA Oracle contract address
     * @return priceKey Current IXFI price key
     * @return maxAge Maximum price age in seconds
     * @return currentPrice Current IXFI price (8 decimals)
     * @return priceTimestamp Price timestamp
     */
    function getOracleInfo() external view returns (
        address oracleAddress,
        string memory priceKey,
        uint256 maxAge,
        uint128 currentPrice,
        uint128 priceTimestamp
    ) {
        (uint128 price, uint128 timestamp) = getIXFIPrice();
        return (
            address(diaOracle),
            ixfiPriceKey,
            maxPriceAge,
            price,
            timestamp
        );
    }

    /**
     * @notice Get basic contract information
     * @return ixfiTokenAddress IXFI token contract address
     * @return totalDeposits Total IXFI deposited in the contract
     */
    function getContractInfo() external view returns (
        address ixfiTokenAddress,
        uint256 totalDeposits
    ) {
        return (
            address(ixfiToken),
            ixfiToken.balanceOf(address(this))
        );
    }
}