# Basic Token Swap

This example demonstrates how to perform a basic token swap using the IXFI Protocol's DEX aggregation capabilities.

## Overview

A basic token swap allows users to exchange one token for another through the best available route across multiple DEX protocols, all in a single transaction.

## Prerequisites

- Wallet with tokens to swap
- Sufficient gas for transaction execution
- Basic understanding of ERC20 tokens

## Smart Contract Integration

### Simple Swap Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/ICrossChainAggregator.sol";

contract BasicSwapExample {
    using SafeERC20 for IERC20;
    
    ICrossChainAggregator public immutable aggregator;
    
    constructor(address _aggregator) {
        aggregator = ICrossChainAggregator(_aggregator);
    }
    
    function swapTokens(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        address recipient
    ) external returns (uint256 amountOut) {
        // Transfer input tokens from user
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Approve aggregator to spend tokens
        IERC20(tokenIn).safeApprove(address(aggregator), amountIn);
        
        // Get quote for the swap
        uint256 expectedOut = aggregator.getAmountOut(
            amountIn,
            tokenIn,
            tokenOut
        );
        
        require(expectedOut >= amountOutMin, "Insufficient output amount");
        
        // Execute the swap
        amountOut = aggregator.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            tokenIn,
            tokenOut,
            recipient
        );
        
        return amountOut;
    }
}
```

## Frontend Integration

### Using ethers.js

```javascript
import { ethers } from 'ethers';

// Contract addresses (replace with actual addresses)
const AGGREGATOR_ADDRESS = "0x...";
const TOKEN_A_ADDRESS = "0x...";
const TOKEN_B_ADDRESS = "0x...";

// Contract ABIs
const aggregatorABI = [
    "function getAmountOut(uint256 amountIn, address tokenIn, address tokenOut) view returns (uint256)",
    "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address tokenIn, address tokenOut, address recipient) returns (uint256)"
];

const erc20ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

async function performBasicSwap() {
    // Initialize provider and signer
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const userAddress = await signer.getAddress();
    
    // Initialize contracts
    const aggregator = new ethers.Contract(AGGREGATOR_ADDRESS, aggregatorABI, signer);
    const tokenA = new ethers.Contract(TOKEN_A_ADDRESS, erc20ABI, signer);
    
    // Swap parameters
    const amountIn = ethers.parseEther("100"); // 100 Token A
    const slippageTolerance = 0.01; // 1%
    
    try {
        // Step 1: Check user balance
        const balance = await tokenA.balanceOf(userAddress);
        console.log(`Token A Balance: ${ethers.formatEther(balance)}`);
        
        if (balance < amountIn) {
            throw new Error("Insufficient Token A balance");
        }
        
        // Step 2: Get quote
        const expectedOut = await aggregator.getAmountOut(
            amountIn,
            TOKEN_A_ADDRESS,
            TOKEN_B_ADDRESS
        );
        
        const amountOutMin = expectedOut * BigInt(Math.floor((1 - slippageTolerance) * 1000)) / 1000n;
        
        console.log(`Expected Output: ${ethers.formatEther(expectedOut)} Token B`);
        console.log(`Minimum Output: ${ethers.formatEther(amountOutMin)} Token B`);
        
        // Step 3: Check and set allowance
        const currentAllowance = await tokenA.allowance(userAddress, AGGREGATOR_ADDRESS);
        
        if (currentAllowance < amountIn) {
            console.log("Approving tokens...");
            const approveTx = await tokenA.approve(AGGREGATOR_ADDRESS, amountIn);
            await approveTx.wait();
            console.log("Approval confirmed");
        }
        
        // Step 4: Execute swap
        console.log("Executing swap...");
        const swapTx = await aggregator.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            TOKEN_A_ADDRESS,
            TOKEN_B_ADDRESS,
            userAddress
        );
        
        const receipt = await swapTx.wait();
        console.log(`Swap completed! Transaction hash: ${receipt.hash}`);
        
        // Parse the actual output amount from events
        const swapEvent = receipt.logs.find(log => 
            log.topics[0] === ethers.id("TokenSwap(address,address,uint256,uint256,address)")
        );
        
        if (swapEvent) {
            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
                ['address', 'address', 'uint256', 'uint256', 'address'],
                swapEvent.data
            );
            console.log(`Actual output: ${ethers.formatEther(decoded[3])} Token B`);
        }
        
    } catch (error) {
        console.error("Swap failed:", error);
        throw error;
    }
}
```

### React Component Example

```jsx
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const BasicSwapComponent = () => {
    const [tokenABalance, setTokenABalance] = useState('0');
    const [tokenBBalance, setTokenBBalance] = useState('0');
    const [amountIn, setAmountIn] = useState('');
    const [expectedOut, setExpectedOut] = useState('0');
    const [isLoading, setIsLoading] = useState(false);
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);

    // Initialize Web3 connection
    useEffect(() => {
        const initWeb3 = async () => {
            if (window.ethereum) {
                const provider = new ethers.BrowserProvider(window.ethereum);
                const signer = await provider.getSigner();
                setProvider(provider);
                setSigner(signer);
                await loadBalances(signer);
            }
        };
        initWeb3();
    }, []);

    // Load token balances
    const loadBalances = async (signer) => {
        const userAddress = await signer.getAddress();
        const tokenA = new ethers.Contract(TOKEN_A_ADDRESS, erc20ABI, signer);
        const tokenB = new ethers.Contract(TOKEN_B_ADDRESS, erc20ABI, signer);
        
        const balanceA = await tokenA.balanceOf(userAddress);
        const balanceB = await tokenB.balanceOf(userAddress);
        
        setTokenABalance(ethers.formatEther(balanceA));
        setTokenBBalance(ethers.formatEther(balanceB));
    };

    // Get quote when amount changes
    useEffect(() => {
        const getQuote = async () => {
            if (amountIn && parseFloat(amountIn) > 0 && signer) {
                try {
                    const aggregator = new ethers.Contract(AGGREGATOR_ADDRESS, aggregatorABI, signer);
                    const amountInWei = ethers.parseEther(amountIn);
                    
                    const quote = await aggregator.getAmountOut(
                        amountInWei,
                        TOKEN_A_ADDRESS,
                        TOKEN_B_ADDRESS
                    );
                    
                    setExpectedOut(ethers.formatEther(quote));
                } catch (error) {
                    console.error('Quote error:', error);
                    setExpectedOut('0');
                }
            } else {
                setExpectedOut('0');
            }
        };

        const timeoutId = setTimeout(getQuote, 500); // Debounce
        return () => clearTimeout(timeoutId);
    }, [amountIn, signer]);

    // Execute swap
    const handleSwap = async () => {
        if (!signer || !amountIn || parseFloat(amountIn) <= 0) return;

        setIsLoading(true);
        try {
            await performBasicSwap();
            await loadBalances(signer); // Refresh balances
            setAmountIn(''); // Clear input
        } catch (error) {
            alert(`Swap failed: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="swap-container">
            <h2>Basic Token Swap</h2>
            
            <div className="balance-info">
                <p>Token A Balance: {tokenABalance}</p>
                <p>Token B Balance: {tokenBBalance}</p>
            </div>

            <div className="swap-form">
                <div className="input-group">
                    <label>Amount to Swap (Token A):</label>
                    <input
                        type="number"
                        value={amountIn}
                        onChange={(e) => setAmountIn(e.target.value)}
                        placeholder="0.0"
                        disabled={isLoading}
                    />
                </div>

                <div className="output-group">
                    <label>Expected Output (Token B):</label>
                    <input
                        type="text"
                        value={expectedOut}
                        readOnly
                        placeholder="0.0"
                    />
                </div>

                <button 
                    onClick={handleSwap}
                    disabled={isLoading || !amountIn || parseFloat(amountIn) <= 0}
                    className="swap-button"
                >
                    {isLoading ? 'Swapping...' : 'Swap Tokens'}
                </button>
            </div>
        </div>
    );
};

export default BasicSwapComponent;
```

## CLI Example

### Using Hardhat Script

```javascript
// scripts/basic-swap.js
const { ethers } = require("hardhat");

async function main() {
    // Get signers
    const [deployer] = await ethers.getSigners();
    console.log("Swapping with account:", deployer.address);

    // Contract addresses
    const AGGREGATOR_ADDRESS = process.env.AGGREGATOR_ADDRESS;
    const TOKEN_A_ADDRESS = process.env.TOKEN_A_ADDRESS;
    const TOKEN_B_ADDRESS = process.env.TOKEN_B_ADDRESS;

    // Initialize contracts
    const aggregator = await ethers.getContractAt("CrossChainAggregator", AGGREGATOR_ADDRESS);
    const tokenA = await ethers.getContractAt("IERC20", TOKEN_A_ADDRESS);
    const tokenB = await ethers.getContractAt("IERC20", TOKEN_B_ADDRESS);

    // Swap parameters
    const amountIn = ethers.parseEther("10"); // 10 tokens
    const slippage = 0.005; // 0.5%

    try {
        // Check balance
        const balance = await tokenA.balanceOf(deployer.address);
        console.log(`Token A balance: ${ethers.formatEther(balance)}`);

        if (balance < amountIn) {
            throw new Error("Insufficient balance");
        }

        // Get quote
        const expectedOut = await aggregator.getAmountOut(
            amountIn,
            TOKEN_A_ADDRESS,
            TOKEN_B_ADDRESS
        );

        const amountOutMin = expectedOut * BigInt(Math.floor((1 - slippage) * 1000)) / 1000n;

        console.log(`Expected output: ${ethers.formatEther(expectedOut)}`);
        console.log(`Minimum output: ${ethers.formatEther(amountOutMin)}`);

        // Check allowance
        const allowance = await tokenA.allowance(deployer.address, AGGREGATOR_ADDRESS);
        
        if (allowance < amountIn) {
            console.log("Approving tokens...");
            const approveTx = await tokenA.approve(AGGREGATOR_ADDRESS, amountIn);
            await approveTx.wait();
            console.log("Approval confirmed");
        }

        // Execute swap
        console.log("Executing swap...");
        const swapTx = await aggregator.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            TOKEN_A_ADDRESS,
            TOKEN_B_ADDRESS,
            deployer.address
        );

        const receipt = await swapTx.wait();
        console.log(`Swap completed! Gas used: ${receipt.gasUsed}`);

        // Check new balances
        const newBalanceA = await tokenA.balanceOf(deployer.address);
        const newBalanceB = await tokenB.balanceOf(deployer.address);

        console.log(`New Token A balance: ${ethers.formatEther(newBalanceA)}`);
        console.log(`New Token B balance: ${ethers.formatEther(newBalanceB)}`);

    } catch (error) {
        console.error("Swap failed:", error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

Run the script:
```bash
npx hardhat run scripts/basic-swap.js --network <network-name>
```

## Price Impact and Slippage

### Understanding Slippage

Slippage is the difference between expected and actual execution price:

```javascript
function calculateSlippage(expectedOut, actualOut) {
    const slippage = (expectedOut - actualOut) / expectedOut;
    return slippage * 100; // Return as percentage
}

// Example usage
const slippagePercent = calculateSlippage(
    ethers.parseEther("99.5"),   // Expected
    ethers.parseEther("99.0")    // Actual
);
console.log(`Slippage: ${slippagePercent.toFixed(2)}%`);
```

### Price Impact Calculation

```javascript
async function calculatePriceImpact(tokenIn, tokenOut, amountIn) {
    const aggregator = new ethers.Contract(AGGREGATOR_ADDRESS, aggregatorABI, provider);
    
    // Get quote for small amount (current price)
    const smallAmount = ethers.parseEther("1");
    const basePrice = await aggregator.getAmountOut(smallAmount, tokenIn, tokenOut);
    
    // Get quote for actual amount
    const actualQuote = await aggregator.getAmountOut(amountIn, tokenIn, tokenOut);
    const actualPrice = actualQuote * smallAmount / amountIn;
    
    // Calculate price impact
    const priceImpact = (basePrice - actualPrice) / basePrice;
    return priceImpact * 100; // Return as percentage
}
```

## Error Handling

### Common Errors and Solutions

```javascript
async function safeSwap(tokenIn, tokenOut, amountIn, amountOutMin, recipient) {
    try {
        const tx = await aggregator.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            tokenIn,
            tokenOut,
            recipient
        );
        return await tx.wait();
    } catch (error) {
        // Handle specific errors
        if (error.message.includes("insufficient output amount")) {
            throw new Error("Slippage tolerance exceeded. Try increasing slippage or reducing amount.");
        } else if (error.message.includes("transfer amount exceeds allowance")) {
            throw new Error("Token allowance insufficient. Please approve tokens first.");
        } else if (error.message.includes("transfer amount exceeds balance")) {
            throw new Error("Insufficient token balance for swap.");
        } else if (error.message.includes("no liquidity")) {
            throw new Error("No liquidity available for this trading pair.");
        } else {
            throw new Error(`Swap failed: ${error.message}`);
        }
    }
}
```

## Gas Optimization

### Batch Operations

```solidity
// Optimized multi-step operations
function swapAndStake(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 amountOutMin,
    address stakingContract
) external {
    // Step 1: Swap tokens
    uint256 amountOut = aggregator.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        tokenIn,
        tokenOut,
        address(this) // Receive tokens to this contract
    );
    
    // Step 2: Stake received tokens
    IERC20(tokenOut).safeApprove(stakingContract, amountOut);
    IStaking(stakingContract).stake(amountOut);
}
```

### Gas Estimation

```javascript
async function estimateSwapGas(tokenIn, tokenOut, amountIn, amountOutMin, recipient) {
    try {
        const gasEstimate = await aggregator.estimateGas.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            tokenIn,
            tokenOut,
            recipient
        );
        
        // Add 20% buffer for gas price fluctuations
        return gasEstimate * 120n / 100n;
    } catch (error) {
        console.error("Gas estimation failed:", error);
        return 300000n; // Fallback gas limit
    }
}
```

## Best Practices

### 1. Always Check Allowances

```javascript
async function ensureAllowance(token, spender, amount, signer) {
    const tokenContract = new ethers.Contract(token, erc20ABI, signer);
    const userAddress = await signer.getAddress();
    
    const currentAllowance = await tokenContract.allowance(userAddress, spender);
    
    if (currentAllowance < amount) {
        const approveTx = await tokenContract.approve(spender, amount);
        await approveTx.wait();
    }
}
```

### 2. Implement Proper Slippage Protection

```javascript
function calculateAmountOutMin(expectedOut, slippagePercent) {
    const slippageFactor = BigInt(Math.floor((100 - slippagePercent) * 100));
    return expectedOut * slippageFactor / 10000n;
}
```

### 3. Use Deadline for Time Protection

```javascript
function getDeadline(minutesFromNow = 20) {
    return Math.floor(Date.now() / 1000) + (minutesFromNow * 60);
}
```

### 4. Monitor Transaction Status

```javascript
async function waitForConfirmation(txHash, confirmations = 1) {
    const receipt = await provider.waitForTransaction(txHash, confirmations);
    
    if (receipt.status === 0) {
        throw new Error("Transaction failed");
    }
    
    return receipt;
}
```

## Testing

### Unit Tests

```javascript
// test/BasicSwap.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BasicSwap", function() {
    let aggregator, tokenA, tokenB, basicSwap;
    let owner, user;

    beforeEach(async function() {
        [owner, user] = await ethers.getSigners();
        
        // Deploy mock contracts and setup
        // ... deployment code
    });

    it("should perform basic token swap", async function() {
        const amountIn = ethers.parseEther("100");
        const expectedOut = await aggregator.getAmountOut(
            amountIn,
            tokenA.address,
            tokenB.address
        );
        
        await tokenA.connect(user).approve(basicSwap.address, amountIn);
        
        await expect(
            basicSwap.connect(user).swapTokens(
                tokenA.address,
                tokenB.address,
                amountIn,
                expectedOut * 99n / 100n, // 1% slippage
                user.address
            )
        ).to.emit(aggregator, "TokenSwap");
    });
});
```

## Resources

- [DEX Aggregation Overview](../dex-aggregation/overview.md)
- [Cross-Chain Swap Example](cross-chain-swap.md)
- [API Reference](../api-reference/cross-chain-aggregator.md)
- [Security Best Practices](../guides/security.md)
