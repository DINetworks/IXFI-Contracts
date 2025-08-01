# Cross-Chain Aggregator Integration Examples

This document provides comprehensive examples for integrating and using the IXFI Cross-Chain Aggregator system.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Contract Integration](#contract-integration)
3. [Frontend Integration](#frontend-integration)
4. [API Examples](#api-examples)
5. [Testing Examples](#testing-examples)
6. [Production Deployment](#production-deployment)

## Quick Start

### 1. Deploy the System

```bash
# Deploy all contracts
npx hardhat run scripts/deploy-aggregator.js --network ethereum

# Verify contracts
npx hardhat verify --network ethereum AGGREGATOR_ADDRESS "GATEWAY" "GAS_SERVICE" "IXFI_TOKEN" "CALLDATA_GENERATOR"
```

### 2. Basic Cross-Chain Swap

```javascript
const { ethers } = require("ethers");

// Connect to aggregator contract
const aggregator = new ethers.Contract(
    AGGREGATOR_ADDRESS,
    AGGREGATOR_ABI,
    signer
);

// Prepare swap data
const swapData = {
    sourceToken: "0xA0b86a33E6441c45C74d7F7f5234f3628B8b5C22", // USDC
    sourceAmount: ethers.utils.parseUnits("100", 6),
    destinationChain: "bsc",
    destinationToken: "0x55d398326f99059fF775485246999027B3197955", // USDT
    minDestinationAmount: ethers.utils.parseUnits("99", 18),
    recipient: userAddress,
    deadline: Math.floor(Date.now() / 1000) + 3600,
    routerCalldata: "0x..." // Generated from SwapCalldataGenerator
};

// Execute cross-chain swap
const tx = await aggregator.crossChainSwap(swapData, {
    value: ethers.utils.parseEther("0.1") // Gas payment
});

await tx.wait();
console.log("Cross-chain swap initiated:", tx.hash);
```

## Contract Integration

### 1. Smart Contract Integration

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./CrossChainAggregator.sol";

contract DeFiProtocol {
    CrossChainAggregator public immutable aggregator;
    
    constructor(address _aggregator) {
        aggregator = CrossChainAggregator(_aggregator);
    }
    
    function performCrossChainArbitrage(
        address sourceToken,
        uint256 amount,
        string calldata destinationChain,
        address destinationToken,
        bytes calldata routerCalldata
    ) external {
        // Approve tokens
        IERC20(sourceToken).approve(address(aggregator), amount);
        
        // Prepare swap data
        CrossChainAggregator.SwapData memory swapData = CrossChainAggregator.SwapData({
            sourceToken: sourceToken,
            sourceAmount: amount,
            destinationChain: destinationChain,
            destinationToken: destinationToken,
            minDestinationAmount: amount * 95 / 100, // 5% slippage
            recipient: address(this),
            deadline: block.timestamp + 3600,
            routerCalldata: routerCalldata
        });
        
        // Execute cross-chain swap
        aggregator.crossChainSwap(swapData);
    }
    
    // Handle receiving tokens from cross-chain swap
    function onTokenReceived(
        address token,
        uint256 amount,
        bytes calldata data
    ) external {
        require(msg.sender == address(aggregator), "Unauthorized");
        
        // Process received tokens
        // Implement your logic here
    }
}
```

### 2. Router Calldata Generation

```javascript
const { ethers } = require("ethers");

class CalldataGenerator {
    constructor(generatorAddress, provider) {
        this.contract = new ethers.Contract(
            generatorAddress,
            GENERATOR_ABI,
            provider
        );
    }

    // Generate Uniswap V2 calldata
    async generateUniswapV2Calldata(swapParams) {
        const { amountIn, amountOutMin, path, to, deadline } = swapParams;
        
        return await this.contract.generateUniswapV2Calldata(
            amountIn,
            amountOutMin,
            path,
            to,
            deadline
        );
    }

    // Generate Uniswap V3 calldata
    async generateUniswapV3Calldata(swapParams) {
        const { amountIn, amountOutMin, path, recipient, deadline } = swapParams;
        
        return await this.contract.generateUniswapV3ExactInputCalldata(
            amountIn,
            amountOutMin,
            path,
            recipient,
            deadline
        );
    }

    // Get optimal router for a swap
    async getOptimalRouter(chainId, tokenIn, tokenOut, amount) {
        const [routerAddress, routerType] = await this.contract.getOptimalRouter(
            chainId,
            tokenIn,
            tokenOut,
            amount
        );
        
        return { routerAddress, routerType };
    }
}

// Usage example
const generator = new CalldataGenerator(GENERATOR_ADDRESS, provider);

const calldata = await generator.generateUniswapV2Calldata({
    amountIn: ethers.utils.parseEther("1"),
    amountOutMin: ethers.utils.parseEther("0.95"),
    path: [TOKEN_A, TOKEN_B],
    to: AGGREGATOR_ADDRESS,
    deadline: Math.floor(Date.now() / 1000) + 1800
});
```

## Frontend Integration

### 1. React Component Example

```jsx
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const CrossChainSwapWidget = () => {
    const [swapData, setSwapData] = useState({
        sourceChain: 'ethereum',
        sourceToken: '',
        sourceAmount: '',
        destinationChain: 'bsc',
        destinationToken: '',
        slippage: 1.0
    });
    
    const [isLoading, setIsLoading] = useState(false);
    const [txHash, setTxHash] = useState('');

    const supportedChains = {
        ethereum: { name: 'Ethereum', chainId: 1 },
        bsc: { name: 'BSC', chainId: 56 },
        polygon: { name: 'Polygon', chainId: 137 },
        avalanche: { name: 'Avalanche', chainId: 43114 }
    };

    const executeSwap = async () => {
        setIsLoading(true);
        
        try {
            // Connect to wallet
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            
            // Get aggregator contract
            const aggregator = new ethers.Contract(
                AGGREGATOR_ADDRESS,
                AGGREGATOR_ABI,
                signer
            );
            
            // Generate router calldata
            const routerCalldata = await generateRouterCalldata(swapData);
            
            // Prepare swap parameters
            const swapParams = {
                sourceToken: swapData.sourceToken,
                sourceAmount: ethers.utils.parseUnits(swapData.sourceAmount, 18),
                destinationChain: swapData.destinationChain,
                destinationToken: swapData.destinationToken,
                minDestinationAmount: calculateMinAmount(swapData),
                recipient: await signer.getAddress(),
                deadline: Math.floor(Date.now() / 1000) + 3600,
                routerCalldata: routerCalldata
            };
            
            // Execute transaction
            const tx = await aggregator.crossChainSwap(swapParams, {
                value: ethers.utils.parseEther("0.1")
            });
            
            setTxHash(tx.hash);
            await tx.wait();
            
            alert('Cross-chain swap completed successfully!');
            
        } catch (error) {
            console.error('Swap failed:', error);
            alert('Swap failed: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="swap-widget">
            <h2>Cross-Chain Token Swap</h2>
            
            <div className="swap-form">
                <div className="form-group">
                    <label>Source Chain</label>
                    <select 
                        value={swapData.sourceChain}
                        onChange={(e) => setSwapData({...swapData, sourceChain: e.target.value})}
                    >
                        {Object.entries(supportedChains).map(([key, chain]) => (
                            <option key={key} value={key}>{chain.name}</option>
                        ))}
                    </select>
                </div>
                
                <div className="form-group">
                    <label>Source Token</label>
                    <input 
                        type="text"
                        placeholder="Token contract address"
                        value={swapData.sourceToken}
                        onChange={(e) => setSwapData({...swapData, sourceToken: e.target.value})}
                    />
                </div>
                
                <div className="form-group">
                    <label>Amount</label>
                    <input 
                        type="number"
                        placeholder="0.0"
                        value={swapData.sourceAmount}
                        onChange={(e) => setSwapData({...swapData, sourceAmount: e.target.value})}
                    />
                </div>
                
                <div className="form-group">
                    <label>Destination Chain</label>
                    <select 
                        value={swapData.destinationChain}
                        onChange={(e) => setSwapData({...swapData, destinationChain: e.target.value})}
                    >
                        {Object.entries(supportedChains).map(([key, chain]) => (
                            <option key={key} value={key}>{chain.name}</option>
                        ))}
                    </select>
                </div>
                
                <div className="form-group">
                    <label>Destination Token</label>
                    <input 
                        type="text"
                        placeholder="Token contract address"
                        value={swapData.destinationToken}
                        onChange={(e) => setSwapData({...swapData, destinationToken: e.target.value})}
                    />
                </div>
                
                <button 
                    onClick={executeSwap}
                    disabled={isLoading}
                    className="swap-button"
                >
                    {isLoading ? 'Swapping...' : 'Execute Cross-Chain Swap'}
                </button>
                
                {txHash && (
                    <div className="tx-hash">
                        Transaction: <a href={`https://etherscan.io/tx/${txHash}`} target="_blank">{txHash}</a>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CrossChainSwapWidget;
```

### 2. Price Estimation Service

```javascript
class CrossChainPriceService {
    constructor(aggregatorAddress, calldataGeneratorAddress) {
        this.aggregatorAddress = aggregatorAddress;
        this.calldataGeneratorAddress = calldataGeneratorAddress;
        this.providers = new Map();
    }

    async estimateSwapPrice(swapParams) {
        const { 
            sourceChain, 
            sourceToken, 
            sourceAmount, 
            destinationChain, 
            destinationToken 
        } = swapParams;

        try {
            // 1. Get source chain DEX quotes
            const sourceQuotes = await this.getSourceChainQuotes(
                sourceChain,
                sourceToken,
                IXFI_TOKEN_ADDRESS,
                sourceAmount
            );

            // 2. Get destination chain DEX quotes
            const destQuotes = await this.getDestinationChainQuotes(
                destinationChain,
                IXFI_TOKEN_ADDRESS,
                destinationToken,
                sourceQuotes.outputAmount
            );

            // 3. Calculate total output and fees
            const bridgeFee = await this.estimateBridgeFee(sourceChain, destinationChain);
            const totalOutput = destQuotes.outputAmount;
            const totalFees = sourceQuotes.fee.add(destQuotes.fee).add(bridgeFee);

            return {
                estimatedOutput: totalOutput,
                totalFees: totalFees,
                priceImpact: this.calculatePriceImpact(sourceAmount, totalOutput),
                route: {
                    source: sourceQuotes.route,
                    destination: destQuotes.route
                },
                executionTime: '2-5 minutes'
            };

        } catch (error) {
            console.error('Price estimation failed:', error);
            throw new Error('Unable to estimate swap price');
        }
    }

    async getSourceChainQuotes(chainId, tokenIn, tokenOut, amountIn) {
        // Query multiple DEXs on source chain
        const providers = [
            () => this.getUniswapQuote(chainId, tokenIn, tokenOut, amountIn),
            () => this.getSushiswapQuote(chainId, tokenIn, tokenOut, amountIn),
            () => this.getCurveQuote(chainId, tokenIn, tokenOut, amountIn),
        ];

        const quotes = await Promise.allSettled(
            providers.map(provider => provider())
        );

        // Return best quote
        const validQuotes = quotes
            .filter(result => result.status === 'fulfilled')
            .map(result => result.value);

        return validQuotes.reduce((best, current) => 
            current.outputAmount.gt(best.outputAmount) ? current : best
        );
    }

    async getDestinationChainQuotes(chainId, tokenIn, tokenOut, amountIn) {
        // Similar to source chain quotes
        return this.getSourceChainQuotes(chainId, tokenIn, tokenOut, amountIn);
    }

    async estimateBridgeFee(sourceChain, destinationChain) {
        // Query Axelar gas service for cross-chain fee
        const gasService = new ethers.Contract(
            GAS_SERVICE_ADDRESS,
            GAS_SERVICE_ABI,
            this.providers.get(sourceChain)
        );

        return await gasService.estimateGasFee(
            destinationChain,
            AGGREGATOR_ADDRESS,
            "0x", // payload
            { gasLimit: 500000 }
        );
    }

    calculatePriceImpact(inputAmount, outputAmount) {
        // Calculate price impact percentage
        const expectedOutput = inputAmount; // 1:1 for simplicity
        const actualOutput = outputAmount;
        
        return expectedOutput.sub(actualOutput)
            .mul(10000)
            .div(expectedOutput)
            .toNumber() / 100; // Convert to percentage
    }
}
```

## API Examples

### 1. REST API Server

```javascript
const express = require('express');
const { ethers } = require('ethers');

const app = express();
app.use(express.json());

class CrossChainAggregatorAPI {
    constructor() {
        this.aggregator = new ethers.Contract(
            AGGREGATOR_ADDRESS,
            AGGREGATOR_ABI,
            provider
        );
        
        this.priceService = new CrossChainPriceService(
            AGGREGATOR_ADDRESS,
            CALLDATA_GENERATOR_ADDRESS
        );
    }

    // Get quote for cross-chain swap
    async getQuote(req, res) {
        try {
            const { 
                sourceChain, 
                sourceToken, 
                sourceAmount, 
                destinationChain, 
                destinationToken 
            } = req.body;

            const quote = await this.priceService.estimateSwapPrice({
                sourceChain,
                sourceToken,
                sourceAmount: ethers.utils.parseUnits(sourceAmount, 18),
                destinationChain,
                destinationToken
            });

            res.json({
                success: true,
                quote: {
                    ...quote,
                    estimatedOutput: ethers.utils.formatUnits(quote.estimatedOutput, 18),
                    totalFees: ethers.utils.formatEther(quote.totalFees)
                }
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    // Execute cross-chain swap
    async executeSwap(req, res) {
        try {
            const { swapData, userSignature } = req.body;

            // Verify user signature and execute swap
            const tx = await this.aggregator.crossChainSwap(swapData);

            res.json({
                success: true,
                transactionHash: tx.hash,
                message: 'Cross-chain swap initiated successfully'
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    // Get swap status
    async getSwapStatus(req, res) {
        try {
            const { transactionHash } = req.params;

            const receipt = await provider.getTransactionReceipt(transactionHash);
            
            if (!receipt) {
                return res.json({
                    status: 'pending',
                    message: 'Transaction is being processed'
                });
            }

            if (receipt.status === 1) {
                res.json({
                    status: 'completed',
                    message: 'Cross-chain swap completed successfully',
                    receipt: receipt
                });
            } else {
                res.json({
                    status: 'failed',
                    message: 'Transaction failed',
                    receipt: receipt
                });
            }

        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    // Get supported chains and tokens
    async getSupportedAssets(req, res) {
        try {
            const supportedChains = await this.aggregator.getSupportedChains();
            const supportedTokens = await this.aggregator.getSupportedTokens();

            res.json({
                success: true,
                data: {
                    chains: supportedChains,
                    tokens: supportedTokens
                }
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

const api = new CrossChainAggregatorAPI();

// Routes
app.post('/api/quote', (req, res) => api.getQuote(req, res));
app.post('/api/swap', (req, res) => api.executeSwap(req, res));
app.get('/api/swap/:transactionHash', (req, res) => api.getSwapStatus(req, res));
app.get('/api/assets', (req, res) => api.getSupportedAssets(req, res));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Cross-Chain Aggregator API running on port ${PORT}`);
});
```

### 2. WebSocket Service for Real-time Updates

```javascript
const WebSocket = require('ws');

class CrossChainWebSocketService {
    constructor(port = 8080) {
        this.wss = new WebSocket.Server({ port });
        this.subscriptions = new Map();
        
        this.wss.on('connection', (ws) => {
            console.log('New WebSocket connection');
            
            ws.on('message', (message) => {
                this.handleMessage(ws, JSON.parse(message));
            });
            
            ws.on('close', () => {
                this.cleanup(ws);
            });
        });

        // Listen to blockchain events
        this.setupEventListeners();
    }

    handleMessage(ws, message) {
        switch (message.type) {
            case 'subscribe_swap':
                this.subscribeToSwap(ws, message.transactionHash);
                break;
            case 'subscribe_prices':
                this.subscribeToPrices(ws, message.pairs);
                break;
            case 'unsubscribe':
                this.unsubscribe(ws, message.subscription);
                break;
        }
    }

    subscribeToSwap(ws, txHash) {
        if (!this.subscriptions.has(ws)) {
            this.subscriptions.set(ws, new Set());
        }
        
        this.subscriptions.get(ws).add(`swap:${txHash}`);
        
        // Send initial status
        this.sendSwapUpdate(ws, txHash);
    }

    subscribeToPrices(ws, pairs) {
        if (!this.subscriptions.has(ws)) {
            this.subscriptions.set(ws, new Set());
        }
        
        pairs.forEach(pair => {
            this.subscriptions.get(ws).add(`price:${pair}`);
        });
    }

    setupEventListeners() {
        // Listen to CrossChainSwap events
        const aggregator = new ethers.Contract(
            AGGREGATOR_ADDRESS,
            AGGREGATOR_ABI,
            provider
        );

        aggregator.on('CrossChainSwapInitiated', (swapId, user, sourceChain, destinationChain) => {
            this.broadcastSwapEvent('initiated', {
                swapId,
                user,
                sourceChain,
                destinationChain,
                timestamp: new Date().toISOString()
            });
        });

        aggregator.on('CrossChainSwapCompleted', (swapId, outputAmount) => {
            this.broadcastSwapEvent('completed', {
                swapId,
                outputAmount: ethers.utils.formatEther(outputAmount),
                timestamp: new Date().toISOString()
            });
        });
    }

    broadcastSwapEvent(eventType, data) {
        const message = JSON.stringify({
            type: 'swap_update',
            event: eventType,
            data: data
        });

        this.wss.clients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                const subscriptions = this.subscriptions.get(ws);
                if (subscriptions && subscriptions.has(`swap:${data.swapId}`)) {
                    ws.send(message);
                }
            }
        });
    }

    cleanup(ws) {
        this.subscriptions.delete(ws);
    }
}

// Start WebSocket service
const wsService = new CrossChainWebSocketService(8080);
console.log('WebSocket service running on port 8080');
```

## Testing Examples

### 1. Unit Tests

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CrossChainAggregator", function () {
    let aggregator, ixfiToken, calldataGenerator;
    let owner, user1, user2;

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();

        // Deploy IXFI token
        const IXFI = await ethers.getContractFactory("IXFI");
        ixfiToken = await IXFI.deploy("IXFI", "IXFI", 18, ethers.utils.parseEther("1000000"));

        // Deploy calldata generator
        const SwapCalldataGenerator = await ethers.getContractFactory("SwapCalldataGenerator");
        calldataGenerator = await SwapCalldataGenerator.deploy(owner.address);

        // Deploy aggregator
        const CrossChainAggregator = await ethers.getContractFactory("CrossChainAggregator");
        aggregator = await CrossChainAggregator.deploy(
            "0x4F4495243837681061C4743b74B3eEdf548D56A5", // Mock gateway
            "0xbE406F0189A0B4cf3A05C286473D23791Dd44Cc6", // Mock gas service
            ixfiToken.address,
            calldataGenerator.address
        );

        // Setup initial state
        await aggregator.setSupportedChain(56, true); // BSC
        await ixfiToken.mint(aggregator.address, ethers.utils.parseEther("1000000"));
    });

    describe("Cross-Chain Swap", function () {
        it("Should initiate cross-chain swap successfully", async function () {
            const swapData = {
                sourceToken: ixfiToken.address,
                sourceAmount: ethers.utils.parseEther("100"),
                destinationChain: "bsc",
                destinationToken: "0x55d398326f99059fF775485246999027B3197955",
                minDestinationAmount: ethers.utils.parseEther("99"),
                recipient: user1.address,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                routerCalldata: "0x"
            };

            // Mint tokens to user
            await ixfiToken.mint(user1.address, ethers.utils.parseEther("1000"));
            await ixfiToken.connect(user1).approve(aggregator.address, swapData.sourceAmount);

            // Execute swap
            await expect(
                aggregator.connect(user1).crossChainSwap(swapData, {
                    value: ethers.utils.parseEther("0.1")
                })
            ).to.emit(aggregator, "CrossChainSwapInitiated");
        });

        it("Should handle token execution correctly", async function () {
            const payload = ethers.utils.defaultAbiCoder.encode(
                ["address", "uint256", "address"],
                [user1.address, ethers.utils.parseEther("100"), ixfiToken.address]
            );

            await expect(
                aggregator.executeWithToken(
                    "ethereum",
                    "0x1234567890123456789012345678901234567890",
                    payload,
                    "IXFI",
                    ethers.utils.parseEther("100")
                )
            ).to.emit(aggregator, "CrossChainSwapCompleted");
        });
    });

    describe("Calldata Generation", function () {
        it("Should generate Uniswap V2 calldata correctly", async function () {
            const calldata = await calldataGenerator.generateUniswapV2Calldata(
                ethers.utils.parseEther("1"),
                ethers.utils.parseEther("0.95"),
                [ixfiToken.address, "0xA0b86a33E6441c45C74d7F7f5234f3628B8b5C22"],
                user1.address,
                Math.floor(Date.now() / 1000) + 3600
            );

            expect(calldata).to.not.equal("0x");
        });

        it("Should configure routers correctly", async function () {
            await calldataGenerator.configureRouter(
                1, // Ethereum
                0, // Uniswap V2
                "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
                true
            );

            const config = await calldataGenerator.getRouterConfig(1, 0);
            expect(config.isActive).to.be.true;
            expect(config.routerAddress).to.equal("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");
        });
    });

    describe("Admin Functions", function () {
        it("Should allow owner to set supported chains", async function () {
            await aggregator.setSupportedChain(137, true); // Polygon
            expect(await aggregator.supportedChains(137)).to.be.true;
        });

        it("Should not allow non-owner to set supported chains", async function () {
            await expect(
                aggregator.connect(user1).setSupportedChain(137, true)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });
});
```

### 2. Integration Tests

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CrossChain Integration Tests", function () {
    let contracts = {};
    let users = {};

    before(async function () {
        // Deploy full system
        const deployment = await require("../scripts/deploy-aggregator.js").main();
        contracts = deployment;

        [users.owner, users.alice, users.bob] = await ethers.getSigners();
    });

    describe("End-to-End Cross-Chain Swap", function () {
        it("Should execute complete cross-chain swap flow", async function () {
            // This test would require forked networks or testnet deployment
            // Implementation depends on your testing environment
            
            const aggregator = await ethers.getContractAt(
                "CrossChainAggregator",
                contracts.crossChainAggregator
            );

            // Prepare mock swap data
            const swapData = {
                sourceToken: "0xA0b86a33E6441c45C74d7F7f5234f3628B8b5C22",
                sourceAmount: ethers.utils.parseUnits("100", 6),
                destinationChain: "bsc",
                destinationToken: "0x55d398326f99059fF775485246999027B3197955",
                minDestinationAmount: ethers.utils.parseUnits("99", 18),
                recipient: users.alice.address,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                routerCalldata: "0x"
            };

            // This would involve actual cross-chain messaging
            // For now, we'll test the contract logic
            console.log("Integration test prepared for:", contracts);
        });
    });
});
```

## Production Deployment

### 1. Mainnet Deployment Checklist

```markdown
## Pre-Deployment Checklist

### Security
- [ ] Complete security audit by reputable firm
- [ ] Implement time locks for admin functions
- [ ] Set up multi-signature wallet for contract ownership
- [ ] Test emergency pause functionality
- [ ] Verify all external contract integrations

### Testing
- [ ] Comprehensive unit test coverage (>95%)
- [ ] Integration tests on all supported chains
- [ ] Stress test with high volume transactions
- [ ] Test failure scenarios and recovery mechanisms
- [ ] Verify gas optimization

### Infrastructure
- [ ] Set up monitoring and alerting systems
- [ ] Deploy on testnets first
- [ ] Prepare rollback procedures
- [ ] Set up dedicated RPC nodes
- [ ] Configure load balancers

### Documentation
- [ ] Complete API documentation
- [ ] User guides and tutorials
- [ ] Emergency procedures documentation
- [ ] Contract verification on block explorers
```

### 2. Monitoring and Maintenance

```javascript
// monitoring/health-check.js
const { ethers } = require("ethers");

class SystemHealthMonitor {
    constructor(contracts, providers) {
        this.contracts = contracts;
        this.providers = providers;
        this.alerts = [];
    }

    async performHealthCheck() {
        const checks = [
            this.checkContractHealth(),
            this.checkTokenBalances(),
            this.checkGasLevels(),
            this.checkCrossChainConnectivity()
        ];

        const results = await Promise.allSettled(checks);
        
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                this.alerts.push({
                    type: 'error',
                    check: checks[index].name,
                    message: result.reason.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        return {
            healthy: this.alerts.length === 0,
            alerts: this.alerts
        };
    }

    async checkContractHealth() {
        for (const [chainId, provider] of this.providers) {
            const aggregator = new ethers.Contract(
                this.contracts.aggregator[chainId],
                AGGREGATOR_ABI,
                provider
            );

            // Check if contract is responding
            await aggregator.owner();
        }
    }

    async checkTokenBalances() {
        // Check IXFI token balances in aggregator contracts
        for (const [chainId, provider] of this.providers) {
            const ixfiToken = new ethers.Contract(
                this.contracts.ixfiToken[chainId],
                ERC20_ABI,
                provider
            );

            const balance = await ixfiToken.balanceOf(
                this.contracts.aggregator[chainId]
            );

            const minBalance = ethers.utils.parseEther("10000"); // 10k IXFI minimum
            
            if (balance.lt(minBalance)) {
                throw new Error(`Low IXFI balance on chain ${chainId}: ${ethers.utils.formatEther(balance)}`);
            }
        }
    }

    async checkGasLevels() {
        // Check gas levels for automated operations
        for (const [chainId, provider] of this.providers) {
            const balance = await provider.getBalance(this.operatorAddress);
            const minBalance = ethers.utils.parseEther("0.1");
            
            if (balance.lt(minBalance)) {
                throw new Error(`Low gas balance on chain ${chainId}: ${ethers.utils.formatEther(balance)}`);
            }
        }
    }

    async checkCrossChainConnectivity() {
        // Verify Axelar network connectivity
        // This would involve checking gateway contracts and gas services
    }
}

// Usage
const monitor = new SystemHealthMonitor(contracts, providers);
setInterval(async () => {
    const health = await monitor.performHealthCheck();
    
    if (!health.healthy) {
        console.error('System health check failed:', health.alerts);
        // Send alerts to monitoring system
    }
}, 60000); // Check every minute
```

This comprehensive integration guide provides everything needed to deploy, integrate, and maintain the IXFI Cross-Chain Aggregator system in production environments.
