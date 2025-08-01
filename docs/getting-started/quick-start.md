# Quick Start

Get up and running with IXFI Protocol in just a few minutes! This guide will walk you through your first cross-chain token swap.

## Overview

In this quick start, you'll learn how to:

1. Connect to the IXFI Protocol
2. Perform a basic token swap
3. Execute a cross-chain transfer
4. Use the DEX aggregation features

## 1. Basic Setup

### Frontend Integration

First, install and initialize the IXFI SDK:

```javascript
import { IXFIProvider, CrossChainAggregator } from '@ixfi/sdk';
import { ethers } from 'ethers';

// Initialize Web3 provider
const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();

// Initialize IXFI
const ixfi = new IXFIProvider({
  provider: provider,
  signer: signer,
  network: 'mainnet' // or 'testnet'
});

// Initialize DEX Aggregator
const aggregator = new CrossChainAggregator({
  provider: provider,
  signer: signer
});
```

### Smart Contract Integration

For direct smart contract integration:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IIXFIGateway.sol";
import "./IXFIExecutable.sol";

contract MyDApp is IXFIExecutable {
    constructor(address gateway) IXFIExecutable(gateway) {}
    
    function sendCrossChainMessage(
        string memory destinationChain,
        string memory destinationAddress,
        bytes memory payload
    ) external {
        gateway.callContract(destinationChain, destinationAddress, payload);
    }
}
```

## 2. Your First Token Swap

### Local Swap (Same Chain)

Swap tokens on the same blockchain using DEX aggregation:

```javascript
async function performSwap() {
  try {
    const tokenIn = '0xA0b86a33E6441e1a02c4e4670dd96EA0f25A632'; // USDC
    const tokenOut = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH
    const amountIn = ethers.utils.parseUnits('100', 6); // 100 USDC
    
    // Get the best quote from all DEXes
    const quote = await aggregator.getOptimalQuote(
      tokenIn,
      tokenOut,
      amountIn
    );
    
    console.log(`Best rate: ${quote.bestAmount} WETH for 100 USDC`);
    console.log(`Best DEX: ${quote.dexName}`);
    
    // Execute the swap
    const tx = await aggregator.executeSwap({
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut: quote.bestAmount.mul(995).div(1000), // 0.5% slippage
      routerType: quote.bestRouter
    });
    
    console.log('Swap successful:', tx.hash);
  } catch (error) {
    console.error('Swap failed:', error);
  }
}
```

### Cross-Chain Swap

Swap tokens across different blockchains:

```javascript
async function crossChainSwap() {
  try {
    // Swap USDC on Ethereum for BNB on BSC
    const tx = await ixfi.crossChainSwap({
      sourceChain: 'ethereum',
      destinationChain: 'bsc',
      tokenIn: '0xA0b86a33E6441e1a02c4e4670dd96EA0f25A632', // USDC on Ethereum
      tokenOut: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB on BSC
      amountIn: ethers.utils.parseUnits('100', 6),
      minAmountOut: ethers.utils.parseEther('0.3'), // Minimum BNB expected
      slippage: 50 // 0.5%
    });
    
    console.log('Cross-chain swap initiated:', tx.hash);
    
    // Monitor the swap progress
    const result = await ixfi.waitForCrossChainCompletion(tx.hash);
    console.log('Cross-chain swap completed:', result);
  } catch (error) {
    console.error('Cross-chain swap failed:', error);
  }
}
```

## 3. Cross-Chain Token Transfer

Send tokens to another blockchain:

```javascript
async function sendTokensCrossChain() {
  try {
    const tx = await ixfi.sendToken({
      destinationChain: 'polygon',
      destinationAddress: '0x742d35Cc6634C0532925a3b8D4048b05fb2fE98c',
      tokenSymbol: 'IXFI',
      amount: ethers.utils.parseEther('10') // 10 IXFI
    });
    
    console.log('Cross-chain transfer initiated:', tx.hash);
  } catch (error) {
    console.error('Transfer failed:', error);
  }
}
```

## 4. Gasless Transactions

Execute transactions without holding native gas tokens:

```javascript
async function gaslessTransaction() {
  try {
    // Check gas credits balance
    const credits = await ixfi.getGasCredits();
    console.log(`Gas credits: $${credits.balance}`);
    
    if (credits.balance < 0.50) {
      throw new Error('Insufficient gas credits');
    }
    
    // Execute gasless transaction
    const tx = await ixfi.executeGaslessTransaction({
      to: '0x...',
      data: '0x...', // Encoded function call
      value: '0'
    });
    
    console.log('Gasless transaction executed:', tx.hash);
  } catch (error) {
    console.error('Gasless transaction failed:', error);
  }
}
```

## 5. DEX Aggregation Features

### Compare All DEX Quotes

```javascript
async function compareQuotes() {
  const quotes = await aggregator.getAllQuotes(
    '0xA0b86a33E6441e1a02c4e4670dd96EA0f25A632', // USDC
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    ethers.utils.parseUnits('1000', 6) // 1000 USDC
  );
  
  // Display top 5 quotes
  quotes.slice(0, 5).forEach((quote, index) => {
    console.log(`${index + 1}. ${quote.dexName}: ${quote.amountOut} WETH`);
  });
}
```

### Multi-Protocol Routing

```javascript
async function multiProtocolSwap() {
  // Swap using specific DEX protocols
  const routerTypes = [
    0,  // Uniswap V2
    10, // Uniswap V3
    1,  // SushiSwap V2
    30  // Curve
  ];
  
  const quote = await aggregator.getOptimalQuote(
    tokenIn,
    tokenOut,
    amountIn,
    routerTypes
  );
  
  console.log(`Best quote from selected DEXes: ${quote.bestAmount}`);
}
```

## 6. Error Handling

Implement proper error handling for production applications:

```javascript
async function robustSwap() {
  try {
    // Attempt swap
    const tx = await aggregator.executeSwap(swapParams);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      console.log('Swap successful!');
    } else {
      throw new Error('Transaction failed');
    }
  } catch (error) {
    if (error.code === 'INSUFFICIENT_FUNDS') {
      console.error('Insufficient balance');
    } else if (error.code === 'USER_REJECTED') {
      console.error('User rejected transaction');
    } else if (error.message.includes('slippage')) {
      console.error('Slippage tolerance exceeded');
    } else {
      console.error('Unknown error:', error);
    }
  }
}
```

## Next Steps

Now that you've completed the quick start:

1. **[Explore Core Concepts](../core-concepts/protocol-overview.md)** - Understand how IXFI works
2. **[Learn DEX Aggregation](../dex-aggregation/overview.md)** - Master multi-protocol trading
3. **[Study Examples](../examples/basic-swap.md)** - See real-world integration patterns
4. **[Read API Reference](../api-reference/ixfi-gateway.md)** - Complete function documentation

## Common Patterns

### React Hook Example

```javascript
import { useState, useEffect } from 'react';
import { useIXFI } from '@ixfi/react-hooks';

function SwapComponent() {
  const { ixfi, aggregator } = useIXFI();
  const [quote, setQuote] = useState(null);
  
  useEffect(() => {
    async function getQuote() {
      const result = await aggregator.getOptimalQuote(
        tokenIn,
        tokenOut,
        amountIn
      );
      setQuote(result);
    }
    
    getQuote();
  }, [tokenIn, tokenOut, amountIn]);
  
  return (
    <div>
      {quote && (
        <p>Best rate: {quote.bestAmount} tokens</p>
      )}
    </div>
  );
}
```

### Vue.js Integration

```javascript
import { reactive, computed } from 'vue';
import { IXFIProvider } from '@ixfi/sdk';

export default {
  setup() {
    const state = reactive({
      provider: null,
      quote: null
    });
    
    const initIXFI = async () => {
      state.provider = new IXFIProvider({
        network: 'mainnet'
      });
    };
    
    return {
      state,
      initIXFI
    };
  }
};
```

## Support & Community

- 📖 **Documentation**: You're reading it!
- 💬 **Discord**: [Join our community](https://discord.gg/ixfi)
- 🐛 **Issues**: [GitHub Issues](https://github.com/DINetworks/IXFI-Contracts/issues)
- 📧 **Email**: support@ixfi.com
- 🐦 **Twitter**: [@IXFIProtocol](https://twitter.com/IXFIProtocol)

Ready to dive deeper? Continue with the [Core Concepts](../core-concepts/protocol-overview.md) section!
