// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract OracleCreditSystem is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;
    
    struct TokenInfo {
        AggregatorV3Interface priceFeed;
        uint8 decimals;
        bool isStablecoin; // Stablecoins maintain 1:1 value
    }

    struct UserBalance {
        uint256 deposited;
        uint256 credited;
    }

    // Events
    event TokenWhitelisted(address indexed token, address priceFeed);
    event TokenRemoved(address indexed token);
    event Deposited(address indexed user, address indexed token, uint256 amount, uint256 credited);
    event Withdrawn(address indexed user, address indexed token, uint256 amount, uint256 credited);
    event CreditsAdded(address indexed user, uint256 amount);
    event CreditsUsed(address indexed user, uint256 amount);

    EnumerableSet.AddressSet private whitelistedTokens;
    mapping(address => TokenInfo) public tokenInfo;
    mapping(address => mapping(address => UserBalance)) public balances;
    mapping(address => uint256) public credits;
    uint8 public constant creditDecimals = 18;

    constructor(address initialOwner) Ownable(initialOwner) {}

    // Owner functions ==============================================

    function whitelistToken(
        address token,
        address priceFeed,
        bool isStablecoin
    ) external onlyOwner {
        require(!whitelistedTokens.contains(token), "Token already whitelisted");
        require(priceFeed != address(0), "Invalid price feed");
        
        uint8 tokenDecimals = IERC20(token).decimals();
        
        whitelistedTokens.add(token);
        tokenInfo[token] = TokenInfo({
            priceFeed: AggregatorV3Interface(priceFeed),
            decimals: tokenDecimals,
            isStablecoin: isStablecoin
        });

        emit TokenWhitelisted(token, priceFeed);
    }

    function removeToken(address token) external onlyOwner {
        require(whitelistedTokens.contains(token), "Token not whitelisted");
        whitelistedTokens.remove(token);
        delete tokenInfo[token];
        emit TokenRemoved(token);
    }

    // User functions ==============================================

    function deposit(address token, uint256 amount) external {
        require(whitelistedTokens.contains(token), "Token not whitelisted");
        require(amount > 0, "Amount must be > 0");

        // Transfer tokens
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        // Calculate credited amount based on price
        uint256 creditedAmount = calculateCreditValue(token, amount);
        
        // Update balances
        balances[msg.sender][token].deposited += amount;
        balances[msg.sender][token].credited += creditedAmount;
        credits[msg.sender] += creditedAmount;

        emit Deposited(msg.sender, token, amount, creditedAmount);
        emit CreditsAdded(msg.sender, creditedAmount);
    }

    function withdraw(address token, uint256 amount) external {
        require(whitelistedTokens.contains(token), "Token not whitelisted");
        require(amount > 0, "Amount must be > 0");
        require(balances[msg.sender][token].deposited >= amount, "Insufficient balance");

        // Calculate credit value before withdrawal
        uint256 creditedAmount = calculateCreditValue(token, amount);
        require(credits[msg.sender] >= creditedAmount, "Insufficient credits");

        // Update balances
        balances[msg.sender][token].deposited -= amount;
        balances[msg.sender][token].credited -= creditedAmount;
        credits[msg.sender] -= creditedAmount;

        // Transfer tokens
        IERC20(token).transfer(msg.sender, amount);

        emit Withdrawn(msg.sender, token, amount, creditedAmount);
        emit CreditsUsed(msg.sender, creditedAmount);
    }

    // Price calculation functions ================================

    function calculateCreditValue(address token, uint256 amount) public view returns (uint256) {
        TokenInfo memory info = tokenInfo[token];
        
        if (info.isStablecoin) {
            return convertDecimals(amount, info.decimals, creditDecimals);
        }

        (, int256 price,,,) = info.priceFeed.latestRoundData();
        uint8 priceFeedDecimals = info.priceFeed.decimals();
        
        // Formula: (amount * price) / (10^(tokenDecimals + priceFeedDecimals)) * (10^creditDecimals)
        uint256 value = (amount * uint256(price)) / 
                       (10 ** (info.decimals + priceFeedDecimals - creditDecimals));
        
        return value;
    }

    function convertDecimals(uint256 amount, uint8 from, uint8 to) internal pure returns (uint256) {
        return from > to ? 
            amount / (10 ** (from - to)) :
            amount * (10 ** (to - from));
    }

    // View functions =============================================

    function getWhitelistedTokens() external view returns (address[] memory) {
        return whitelistedTokens.values();
    }

    function getTokenPrice(address token) external view returns (int256) {
        require(whitelistedTokens.contains(token), "Token not whitelisted");
        (, int256 price,,,) = tokenInfo[token].priceFeed.latestRoundData();
        return price;
    }

    function getCreditValue(address token, uint256 amount) external view returns (uint256) {
        return calculateCreditValue(token, amount);
    }
}