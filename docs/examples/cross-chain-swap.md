# Cross-Chain Swap Example

This example demonstrates how to perform cross-chain token swaps using IXFI Protocol, including token transfers between different blockchain networks.

## Overview

Cross-chain swaps enable users to exchange tokens across different blockchain networks in a single transaction. IXFI Protocol facilitates this through Axelar's cross-chain infrastructure.

## Basic Cross-Chain Swap

### Frontend Implementation

```javascript
// examples/cross-chain-swap/frontend.js
import { ethers } from 'ethers';
import { IXFIGateway, CrossChainAggregator } from '@ixfi/sdk';

class CrossChainSwapExample {
  constructor(providerUrl, privateKey) {
    this.provider = new ethers.providers.JsonRpcProvider(providerUrl);
    this.signer = new ethers.Wallet(privateKey, this.provider);
    
    // Initialize IXFI components
    this.gateway = new IXFIGateway({
      provider: this.provider,
      signer: this.signer
    });
    
    this.aggregator = new CrossChainAggregator({
      provider: this.provider,
      signer: this.signer
    });
  }

  /**
   * Execute a cross-chain swap from Ethereum to Polygon
   * Example: Swap USDC on Ethereum to USDT on Polygon
   */
  async executeCrossChainSwap() {
    const swapParams = {
      // Source chain swap (Ethereum)
      sourceChain: 'ethereum',
      sourceToken: '0xA0b86a33E6441e1a02c4e4670dd96EA0f25A632', // USDC on Ethereum
      sourceAmount: ethers.utils.parseUnits('1000', 6), // 1000 USDC
      
      // Destination chain swap (Polygon)
      destinationChain: 'polygon',
      destinationToken: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // USDT on Polygon
      destinationReceiver: this.signer.address,
      minDestinationAmount: ethers.utils.parseUnits('950', 6), // 950 USDT (5% slippage)
      
      // Swap configuration
      routerType: 0, // Uniswap V2
      deadline: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
      gasPayment: ethers.utils.parseEther('0.01') // Gas for destination chain
    };

    try {
      console.log('Initiating cross-chain swap...');
      
      // Step 1: Approve source token
      await this.approveToken(swapParams.sourceToken, swapParams.sourceAmount);
      
      // Step 2: Execute cross-chain swap
      const tx = await this.aggregator.crossChainSwap(swapParams);
      console.log('Transaction submitted:', tx.hash);
      
      // Step 3: Wait for confirmation
      const receipt = await tx.wait();
      console.log('Source chain transaction confirmed:', receipt.transactionHash);
      
      // Step 4: Monitor destination chain completion
      const destinationTx = await this.monitorDestinationChain(
        swapParams.destinationChain,
        receipt.transactionHash
      );
      
      console.log('Cross-chain swap completed!');
      return {
        sourceTransaction: receipt.transactionHash,
        destinationTransaction: destinationTx
      };
      
    } catch (error) {
      console.error('Cross-chain swap failed:', error);
      throw error;
    }
  }

  async approveToken(tokenAddress, amount) {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function approve(address spender, uint256 amount) returns (bool)'],
      this.signer
    );

    const approveTx = await tokenContract.approve(this.aggregator.address, amount);
    await approveTx.wait();
    console.log('Token approval confirmed');
  }

  async monitorDestinationChain(destinationChain, sourceTxHash) {
    // Monitor Axelar for cross-chain message execution
    const axelarApi = `https://api.axelar.dev/cross-chain/tx/${sourceTxHash}`;
    
    for (let i = 0; i < 60; i++) { // Poll for 10 minutes
      try {
        const response = await fetch(axelarApi);
        const data = await response.json();
        
        if (data.status === 'executed') {
          return data.destinationTransactionHash;
        }
        
        console.log(`Waiting for destination chain execution... (${i + 1}/60)`);
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        
      } catch (error) {
        console.error('Error monitoring destination chain:', error);
      }
    }
    
    throw new Error('Destination chain execution timeout');
  }

  /**
   * Get quote for cross-chain swap
   */
  async getCrossChainQuote(params) {
    try {
      const quote = await this.aggregator.getCrossChainQuote({
        sourceChain: params.sourceChain,
        sourceToken: params.sourceToken,
        sourceAmount: params.sourceAmount,
        destinationChain: params.destinationChain,
        destinationToken: params.destinationToken,
        routerType: params.routerType || 0
      });

      return {
        estimatedOutput: quote.estimatedOutput,
        bridgeFee: quote.bridgeFee,
        gasFee: quote.gasFee,
        totalFee: quote.totalFee,
        estimatedTime: quote.estimatedTime,
        priceImpact: quote.priceImpact
      };
      
    } catch (error) {
      console.error('Failed to get cross-chain quote:', error);
      throw error;
    }
  }
}

// Usage example
async function main() {
  const swapper = new CrossChainSwapExample(
    process.env.ETHEREUM_RPC_URL,
    process.env.PRIVATE_KEY
  );

  // Get quote first
  const quote = await swapper.getCrossChainQuote({
    sourceChain: 'ethereum',
    sourceToken: '0xA0b86a33E6441e1a02c4e4670dd96EA0f25A632',
    sourceAmount: ethers.utils.parseUnits('1000', 6),
    destinationChain: 'polygon',
    destinationToken: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
  });

  console.log('Cross-chain swap quote:', quote);

  // Execute if quote is acceptable
  if (parseFloat(ethers.utils.formatUnits(quote.estimatedOutput, 6)) >= 950) {
    const result = await swapper.executeCrossChainSwap();
    console.log('Swap result:', result);
  }
}

// Run example
main().catch(console.error);
```

### Smart Contract Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/ICrossChainAggregator.sol";
import "./interfaces/IIXFIGateway.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract CrossChainSwapExample is ReentrancyGuard {
    ICrossChainAggregator public immutable aggregator;
    IIXFIGateway public immutable gateway;
    
    event CrossChainSwapInitiated(
        address indexed user,
        string sourceChain,
        address sourceToken,
        uint256 sourceAmount,
        string destinationChain,
        address destinationToken,
        address destinationReceiver
    );

    constructor(address _aggregator, address _gateway) {
        aggregator = ICrossChainAggregator(_aggregator);
        gateway = IIXFIGateway(_gateway);
    }

    /**
     * @dev Execute a cross-chain token swap
     * @param sourceToken Address of token to swap from
     * @param sourceAmount Amount of source token to swap
     * @param destinationChain Target blockchain name
     * @param destinationToken Address of token to receive on destination chain
     * @param destinationReceiver Address to receive tokens on destination chain
     * @param minDestinationAmount Minimum amount to receive (slippage protection)
     * @param routerType DEX router type to use for swaps
     */
    function executeCrossChainSwap(
        address sourceToken,
        uint256 sourceAmount,
        string calldata destinationChain,
        address destinationToken,
        address destinationReceiver,
        uint256 minDestinationAmount,
        uint8 routerType
    ) external payable nonReentrant {
        require(sourceAmount > 0, "Invalid amount");
        require(bytes(destinationChain).length > 0, "Invalid destination chain");
        require(destinationReceiver != address(0), "Invalid receiver");

        // Transfer source tokens from user
        IERC20(sourceToken).transferFrom(msg.sender, address(this), sourceAmount);

        // Approve aggregator to spend tokens
        IERC20(sourceToken).approve(address(aggregator), sourceAmount);

        // Prepare cross-chain swap parameters
        ICrossChainAggregator.CrossChainSwapParams memory params = 
            ICrossChainAggregator.CrossChainSwapParams({
                sourceSwap: ICrossChainAggregator.SwapParams({
                    tokenIn: sourceToken,
                    tokenOut: _getBridgeToken(sourceToken), // Convert to bridge-compatible token
                    amountIn: sourceAmount,
                    minAmountOut: _calculateMinBridgeAmount(sourceAmount),
                    routerType: routerType,
                    to: address(this),
                    deadline: block.timestamp + 1800, // 30 minutes
                    swapData: ""
                }),
                destinationChain: destinationChain,
                destinationToken: destinationToken,
                destinationReceiver: destinationReceiver,
                minDestinationAmount: minDestinationAmount,
                destinationSwapData: _encodeDestinationSwap(destinationToken, routerType)
            });

        // Execute cross-chain swap
        aggregator.crossChainSwap{value: msg.value}(params);

        emit CrossChainSwapInitiated(
            msg.sender,
            "ethereum", // Current chain
            sourceToken,
            sourceAmount,
            destinationChain,
            destinationToken,
            destinationReceiver
        );
    }

    /**
     * @dev Batch multiple cross-chain swaps
     */
    function executeBatchCrossChainSwap(
        ICrossChainAggregator.CrossChainSwapParams[] calldata swaps
    ) external payable nonReentrant {
        require(swaps.length > 0, "No swaps provided");
        require(swaps.length <= 10, "Too many swaps");

        uint256 totalGasPayment = msg.value / swaps.length;

        for (uint i = 0; i < swaps.length; i++) {
            ICrossChainAggregator.CrossChainSwapParams memory swap = swaps[i];
            
            // Transfer source tokens
            IERC20(swap.sourceSwap.tokenIn).transferFrom(
                msg.sender, 
                address(this), 
                swap.sourceSwap.amountIn
            );

            // Approve aggregator
            IERC20(swap.sourceSwap.tokenIn).approve(
                address(aggregator), 
                swap.sourceSwap.amountIn
            );

            // Execute swap
            aggregator.crossChainSwap{value: totalGasPayment}(swap);
        }
    }

    /**
     * @dev Execute cross-chain swap with automatic routing optimization
     */
    function executeOptimizedCrossChainSwap(
        address sourceToken,
        uint256 sourceAmount,
        string calldata destinationChain,
        address destinationToken,
        address destinationReceiver,
        uint256 maxSlippageBps
    ) external payable nonReentrant {
        // Get quotes from all available routers
        uint8[] memory routerTypes = new uint8[](3);
        routerTypes[0] = 0; // Uniswap V2
        routerTypes[1] = 10; // Uniswap V3
        routerTypes[2] = 30; // Curve

        uint256 bestAmountOut = 0;
        uint8 bestRouterType = 0;

        for (uint i = 0; i < routerTypes.length; i++) {
            try aggregator.getQuote(
                sourceToken, 
                _getBridgeToken(sourceToken), 
                sourceAmount, 
                routerTypes[i]
            ) returns (uint256 amountOut, uint256) {
                if (amountOut > bestAmountOut) {
                    bestAmountOut = amountOut;
                    bestRouterType = routerTypes[i];
                }
            } catch {
                // Skip failed quotes
                continue;
            }
        }

        require(bestAmountOut > 0, "No valid quotes");

        // Calculate minimum amount with slippage
        uint256 minDestinationAmount = bestAmountOut - 
            (bestAmountOut * maxSlippageBps / 10000);

        // Execute with best router
        this.executeCrossChainSwap(
            sourceToken,
            sourceAmount,
            destinationChain,
            destinationToken,
            destinationReceiver,
            minDestinationAmount,
            bestRouterType
        );
    }

    /**
     * @dev Get bridge-compatible token for cross-chain transfer
     */
    function _getBridgeToken(address token) internal pure returns (address) {
        // Map to Axelar-supported tokens
        // This would be implemented based on supported bridge tokens
        return token; // Simplified for example
    }

    /**
     * @dev Calculate minimum bridge amount considering fees
     */
    function _calculateMinBridgeAmount(uint256 amount) internal pure returns (uint256) {
        // Account for bridge fees (typically 0.1%)
        return amount - (amount * 10 / 10000);
    }

    /**
     * @dev Encode destination chain swap data
     */
    function _encodeDestinationSwap(
        address destinationToken,
        uint8 routerType
    ) internal pure returns (bytes memory) {
        return abi.encode(destinationToken, routerType);
    }

    /**
     * @dev Emergency function to recover stuck tokens
     */
    function recoverTokens(address token, uint256 amount) external {
        require(msg.sender == owner(), "Not authorized");
        IERC20(token).transfer(msg.sender, amount);
    }

    /**
     * @dev Estimate gas costs for cross-chain swap
     */
    function estimateGasCost(
        string calldata destinationChain,
        address destinationToken
    ) external view returns (uint256) {
        // This would integrate with Axelar's gas estimation
        return 0.01 ether; // Simplified estimate
    }
}
```

### React Component

```jsx
// examples/cross-chain-swap/CrossChainSwapComponent.jsx
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useCrossChainSwap } from '../hooks/useCrossChainSwap';

const SUPPORTED_CHAINS = [
  { id: 'ethereum', name: 'Ethereum', chainId: 1 },
  { id: 'polygon', name: 'Polygon', chainId: 137 },
  { id: 'bsc', name: 'BSC', chainId: 56 },
  { id: 'arbitrum', name: 'Arbitrum', chainId: 42161 },
  { id: 'optimism', name: 'Optimism', chainId: 10 },
  { id: 'avalanche', name: 'Avalanche', chainId: 43114 }
];

const COMMON_TOKENS = {
  ethereum: [
    { symbol: 'USDC', address: '0xA0b86a33E6441e1a02c4e4670dd96EA0f25A632', decimals: 6 },
    { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 }
  ],
  polygon: [
    { symbol: 'USDC', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 },
    { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
    { symbol: 'WMATIC', address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', decimals: 18 }
  ]
};

const CrossChainSwapComponent = () => {
  const [sourceChain, setSourceChain] = useState('ethereum');
  const [destinationChain, setDestinationChain] = useState('polygon');
  const [sourceToken, setSourceToken] = useState('');
  const [destinationToken, setDestinationToken] = useState('');
  const [amount, setAmount] = useState('');
  const [slippageTolerance, setSlippageTolerance] = useState(0.5);
  const [quote, setQuote] = useState(null);

  const {
    executeCrossChainSwap,
    getCrossChainQuote,
    monitorSwapStatus,
    loading,
    error
  } = useCrossChainSwap();

  const handleGetQuote = async () => {
    if (!sourceToken || !destinationToken || !amount) return;

    try {
      const quoteParams = {
        sourceChain,
        sourceToken,
        sourceAmount: ethers.utils.parseUnits(amount, getTokenDecimals(sourceChain, sourceToken)),
        destinationChain,
        destinationToken
      };

      const quoteResult = await getCrossChainQuote(quoteParams);
      setQuote(quoteResult);
    } catch (err) {
      console.error('Failed to get quote:', err);
    }
  };

  const handleExecuteSwap = async () => {
    if (!quote) return;

    try {
      const swapParams = {
        sourceChain,
        sourceToken,
        sourceAmount: ethers.utils.parseUnits(amount, getTokenDecimals(sourceChain, sourceToken)),
        destinationChain,
        destinationToken,
        minDestinationAmount: calculateMinOutput(),
        slippageTolerance
      };

      const result = await executeCrossChainSwap(swapParams);
      
      // Monitor swap progress
      monitorSwapStatus(result.txHash, (status) => {
        console.log('Swap status:', status);
      });
      
    } catch (err) {
      console.error('Swap failed:', err);
    }
  };

  const calculateMinOutput = () => {
    if (!quote) return '0';
    
    const output = parseFloat(ethers.utils.formatUnits(quote.estimatedOutput, getTokenDecimals(destinationChain, destinationToken)));
    const minOutput = output * (1 - slippageTolerance / 100);
    
    return ethers.utils.parseUnits(minOutput.toFixed(6), getTokenDecimals(destinationChain, destinationToken));
  };

  const getTokenDecimals = (chain, tokenAddress) => {
    const tokens = COMMON_TOKENS[chain] || [];
    const token = tokens.find(t => t.address.toLowerCase() === tokenAddress.toLowerCase());
    return token ? token.decimals : 18;
  };

  const getAvailableTokens = (chain) => {
    return COMMON_TOKENS[chain] || [];
  };

  return (
    <div className="cross-chain-swap">
      <h2>Cross-Chain Token Swap</h2>

      <div className="swap-form">
        {/* Source Chain Selection */}
        <div className="input-group">
          <label>From Chain</label>
          <select 
            value={sourceChain} 
            onChange={(e) => setSourceChain(e.target.value)}
          >
            {SUPPORTED_CHAINS.map(chain => (
              <option key={chain.id} value={chain.id}>
                {chain.name}
              </option>
            ))}
          </select>
        </div>

        {/* Source Token Selection */}
        <div className="input-group">
          <label>From Token</label>
          <select 
            value={sourceToken} 
            onChange={(e) => setSourceToken(e.target.value)}
          >
            <option value="">Select Token</option>
            {getAvailableTokens(sourceChain).map(token => (
              <option key={token.address} value={token.address}>
                {token.symbol}
              </option>
            ))}
          </select>
        </div>

        {/* Amount Input */}
        <div className="input-group">
          <label>Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
          />
        </div>

        {/* Destination Chain Selection */}
        <div className="input-group">
          <label>To Chain</label>
          <select 
            value={destinationChain} 
            onChange={(e) => setDestinationChain(e.target.value)}
          >
            {SUPPORTED_CHAINS.filter(chain => chain.id !== sourceChain).map(chain => (
              <option key={chain.id} value={chain.id}>
                {chain.name}
              </option>
            ))}
          </select>
        </div>

        {/* Destination Token Selection */}
        <div className="input-group">
          <label>To Token</label>
          <select 
            value={destinationToken} 
            onChange={(e) => setDestinationToken(e.target.value)}
          >
            <option value="">Select Token</option>
            {getAvailableTokens(destinationChain).map(token => (
              <option key={token.address} value={token.address}>
                {token.symbol}
              </option>
            ))}
          </select>
        </div>

        {/* Slippage Tolerance */}
        <div className="input-group">
          <label>Slippage Tolerance (%)</label>
          <input
            type="number"
            step="0.1"
            value={slippageTolerance}
            onChange={(e) => setSlippageTolerance(parseFloat(e.target.value))}
          />
        </div>

        {/* Get Quote Button */}
        <button 
          onClick={handleGetQuote}
          disabled={loading || !sourceToken || !destinationToken || !amount}
        >
          {loading ? 'Getting Quote...' : 'Get Quote'}
        </button>
      </div>

      {/* Quote Display */}
      {quote && (
        <div className="quote-section">
          <h3>Quote Details</h3>
          <div className="quote-info">
            <div className="quote-item">
              <span>Estimated Output:</span>
              <span>{ethers.utils.formatUnits(quote.estimatedOutput, getTokenDecimals(destinationChain, destinationToken))}</span>
            </div>
            <div className="quote-item">
              <span>Bridge Fee:</span>
              <span>{ethers.utils.formatEther(quote.bridgeFee)} ETH</span>
            </div>
            <div className="quote-item">
              <span>Gas Fee:</span>
              <span>{ethers.utils.formatEther(quote.gasFee)} ETH</span>
            </div>
            <div className="quote-item">
              <span>Price Impact:</span>
              <span>{quote.priceImpact}%</span>
            </div>
            <div className="quote-item">
              <span>Estimated Time:</span>
              <span>{quote.estimatedTime} minutes</span>
            </div>
          </div>

          <button 
            onClick={handleExecuteSwap}
            disabled={loading}
            className="execute-button"
          >
            {loading ? 'Executing Swap...' : 'Execute Cross-Chain Swap'}
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error">
          Error: {error.message}
        </div>
      )}
    </div>
  );
};

export default CrossChainSwapComponent;
```

### Custom Hook

```javascript
// hooks/useCrossChainSwap.js
import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useIXFI } from './useIXFI';

export const useCrossChainSwap = () => {
  const { aggregator, gateway } = useIXFI();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getCrossChainQuote = useCallback(async (params) => {
    setLoading(true);
    setError(null);

    try {
      const quote = await aggregator.getCrossChainQuote(params);
      return quote;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [aggregator]);

  const executeCrossChainSwap = useCallback(async (params) => {
    setLoading(true);
    setError(null);

    try {
      // Approve tokens if needed
      if (params.sourceToken !== ethers.constants.AddressZero) {
        await approveToken(params.sourceToken, params.sourceAmount);
      }

      // Execute swap
      const tx = await aggregator.crossChainSwap(params);
      
      return {
        txHash: tx.hash,
        receipt: await tx.wait()
      };
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [aggregator]);

  const monitorSwapStatus = useCallback(async (txHash, callback) => {
    const pollInterval = 10000; // 10 seconds
    const maxAttempts = 180; // 30 minutes
    let attempts = 0;

    const poll = async () => {
      try {
        const status = await getSwapStatus(txHash);
        callback(status);

        if (status.completed || attempts >= maxAttempts) {
          return;
        }

        attempts++;
        setTimeout(poll, pollInterval);
      } catch (err) {
        console.error('Error polling swap status:', err);
        setTimeout(poll, pollInterval);
      }
    };

    poll();
  }, []);

  const getSwapStatus = async (txHash) => {
    // This would integrate with Axelar's API or indexer
    const response = await fetch(`https://api.axelar.dev/cross-chain/tx/${txHash}`);
    const data = await response.json();
    
    return {
      status: data.status,
      sourceChainConfirmed: data.sourceChainConfirmed,
      bridgeProcessed: data.bridgeProcessed,
      destinationChainExecuted: data.destinationChainExecuted,
      completed: data.status === 'executed',
      destinationTxHash: data.destinationTransactionHash
    };
  };

  const approveToken = async (tokenAddress, amount) => {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function approve(address spender, uint256 amount) returns (bool)'],
      aggregator.signer
    );

    const tx = await tokenContract.approve(aggregator.address, amount);
    await tx.wait();
  };

  return {
    getCrossChainQuote,
    executeCrossChainSwap,
    monitorSwapStatus,
    loading,
    error
  };
};
```

## Advanced Features

### Multi-Hop Cross-Chain Swaps

```javascript
// Advanced multi-hop cross-chain swap
class MultiHopCrossChainSwap {
  constructor(ixfiSDK) {
    this.sdk = ixfiSDK;
  }

  async executeMultiHopSwap(hops) {
    /*
    Example hops:
    [
      { chain: 'ethereum', tokenIn: 'ETH', tokenOut: 'USDC' },
      { chain: 'polygon', tokenIn: 'USDC', tokenOut: 'MATIC' },
      { chain: 'bsc', tokenIn: 'MATIC', tokenOut: 'BNB' }
    ]
    */
    
    const results = [];
    let currentAmount = hops[0].amountIn;

    for (let i = 0; i < hops.length; i++) {
      const hop = hops[i];
      
      if (i === 0) {
        // First hop - local swap
        const result = await this.sdk.aggregator.executeSwap({
          tokenIn: hop.tokenIn,
          tokenOut: hop.tokenOut,
          amountIn: currentAmount,
          minAmountOut: hop.minAmountOut,
          routerType: hop.routerType
        });
        
        currentAmount = result.amountOut;
        results.push(result);
        
      } else {
        // Subsequent hops - cross-chain
        const result = await this.sdk.gateway.crossChainSwap({
          sourceChain: hops[i-1].chain,
          sourceToken: hops[i-1].tokenOut,
          sourceAmount: currentAmount,
          destinationChain: hop.chain,
          destinationToken: hop.tokenOut,
          minDestinationAmount: hop.minAmountOut
        });
        
        currentAmount = result.estimatedOutput;
        results.push(result);
      }
    }

    return results;
  }
}
```

### Gas Optimization Strategies

```javascript
// Gas-optimized cross-chain swaps
class GasOptimizedCrossChainSwap {
  async executeWithOptimalGas(params) {
    // 1. Monitor gas prices across chains
    const gasPrices = await this.getGasPricesAcrossChains([
      params.sourceChain,
      params.destinationChain
    ]);

    // 2. Calculate optimal timing
    const optimalTiming = this.calculateOptimalTiming(gasPrices);

    // 3. Execute with dynamic gas pricing
    return await this.executeWithDynamicGas(params, optimalTiming);
  }

  async getGasPricesAcrossChains(chains) {
    const prices = {};
    
    for (const chain of chains) {
      const gasPrice = await this.getChainGasPrice(chain);
      prices[chain] = gasPrice;
    }

    return prices;
  }

  calculateOptimalTiming(gasPrices) {
    // Implement gas price prediction algorithm
    return {
      shouldWait: false,
      estimatedOptimalTime: Date.now(),
      potentialSavings: 0
    };
  }
}
```

## Testing

```javascript
// test/cross-chain-swap.test.js
describe('Cross-Chain Swap Example', () => {
  it('should execute cross-chain swap successfully', async () => {
    const swapper = new CrossChainSwapExample(provider, privateKey);
    
    const result = await swapper.executeCrossChainSwap();
    
    expect(result.sourceTransaction).to.be.a('string');
    expect(result.destinationTransaction).to.be.a('string');
  });

  it('should get accurate cross-chain quotes', async () => {
    const quote = await swapper.getCrossChainQuote({
      sourceChain: 'ethereum',
      sourceToken: USDC_ADDRESS,
      sourceAmount: ethers.utils.parseUnits('1000', 6),
      destinationChain: 'polygon',
      destinationToken: USDT_ADDRESS
    });

    expect(quote.estimatedOutput).to.be.gt(0);
    expect(quote.bridgeFee).to.be.gt(0);
  });
});
```

## Resources

- [Axelar Cross-Chain Documentation](https://docs.axelar.dev/)
- [Cross-Chain Message Passing](../cross-chain/message-passing.md)
- [Token Transfers Guide](../cross-chain/token-transfers.md)
- [API Reference](../api-reference/cross-chain-aggregator.md)
- [Security Considerations](../guides/security.md)
