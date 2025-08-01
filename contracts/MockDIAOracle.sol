// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockDIAOracle
 * @notice Mock DIA Oracle for testing purposes
 */
contract MockDIAOracle {
    
    mapping(string => uint128) private prices;
    mapping(string => uint128) private timestamps;
    
    constructor() {
        // Set default price for IXFI/USD
        prices["IXFI/USD"] = 100000000; // $1.00 with 8 decimals
        timestamps["IXFI/USD"] = uint128(block.timestamp);
    }
    
    /**
     * @notice Set price for testing
     * @param key Price key (e.g., "IXFI/USD")
     * @param price Price with 8 decimals
     */
    function setPrice(string memory key, uint128 price) external {
        prices[key] = price;
        timestamps[key] = uint128(block.timestamp);
    }
    
    /**
     * @notice Get price data (implements DIA Oracle interface)
     * @param key Price key
     * @return price Price with 8 decimals
     * @return timestamp Last update timestamp
     */
    function getValue(string memory key) external view returns (uint128 price, uint128 timestamp) {
        return (prices[key], timestamps[key]);
    }
}
