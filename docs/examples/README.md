# IXFI Protocol Examples

This directory contains comprehensive examples demonstrating how to integrate and use IXFI Protocol across various scenarios and use cases.

## Overview

The examples are organized by functionality and complexity, ranging from simple token swaps to advanced cross-chain operations and gasless transactions. Each example includes:

- **Frontend Implementation**: JavaScript/TypeScript code for web applications
- **Smart Contract Integration**: Solidity contracts for on-chain integration
- **React Components**: Ready-to-use UI components
- **Testing**: Comprehensive test suites
- **Documentation**: Detailed explanations and best practices

## Available Examples

### 1. [Simple Token Swap](./simple-swap.md)
Basic token swapping functionality with DEX aggregation.

**Features:**
- Single-chain token swaps
- Optimal router selection
- Multi-hop swaps
- ETH ↔ Token swaps
- Batch swaps
- Slippage protection

**Use Cases:**
- DeFi applications
- Portfolio rebalancing
- Automated trading bots
- Wallet integrations

```javascript
const swapper = new SimpleSwapExample(providerUrl, privateKey);
const result = await swapper.executeSimpleSwap();
```

### 2. [Cross-Chain Swap](./cross-chain-swap.md)
Advanced cross-chain token swapping using Axelar infrastructure.

**Features:**
- Cross-chain token transfers
- Multi-chain DEX aggregation
- Gas payment handling
- Transaction monitoring
- Batch cross-chain operations

**Use Cases:**
- Cross-chain portfolio management
- Multi-chain arbitrage
- Chain abstraction layers
- Cross-chain DeFi protocols

```javascript
const crossChainSwapper = new CrossChainSwapExample(providerUrl, privateKey);
const result = await crossChainSwapper.executeCrossChainSwap();
```

### 3. [Meta-Transaction](./meta-transaction.md)
Gasless transactions using meta-transaction infrastructure.

**Features:**
- Gasless token swaps
- EIP-712 signature handling
- Relayer network integration
- Batch meta-transactions
- Fee delegation

**Use Cases:**
- User onboarding (no gas required)
- Enterprise integrations
- Mobile wallet applications
- Sponsored transactions

```javascript
const metaTxExample = new MetaTransactionExample(providerUrl, privateKey, relayerUrl);
const result = await metaTxExample.executeGaslessSwap();
```

## Quick Start

### Prerequisites

```bash
npm install ethers @ixfi/sdk
```

### Basic Setup

```javascript
import { ethers } from 'ethers';
import { IXFIGateway } from '@ixfi/sdk';

// Initialize provider and signer
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);

// Initialize IXFI Gateway
const gateway = new IXFIGateway({
  provider,
  signer,
  chainId: 1 // Ethereum mainnet
});
```

### Environment Variables

Create a `.env` file with your configuration:

```env
# RPC URLs
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
POLYGON_RPC_URL=https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID
BSC_RPC_URL=https://bsc-dataseed.binance.org/

# Private Keys (for testing only)
PRIVATE_KEY=your_private_key_here
USER_PRIVATE_KEY=user_private_key_here

# Relayer Configuration
RELAYER_URL=https://relayer.ixfi.com
RELAYER_PRIVATE_KEY=relayer_private_key_here

# Contract Addresses
IXFI_GATEWAY_ADDRESS=0x...
META_TX_GATEWAY_ADDRESS=0x...
CROSS_CHAIN_AGGREGATOR_ADDRESS=0x...

# External Services
REDIS_URL=redis://localhost:6379
```

## Example Structure

Each example follows a consistent structure:

```
example-name/
├── frontend.js          # JavaScript/TypeScript implementation
├── smart-contract.sol   # Solidity contract integration
├── react-component.jsx  # React UI component
├── custom-hook.js       # React hook for state management
├── test/               # Test files
│   ├── unit.test.js
│   └── integration.test.js
└── README.md           # Detailed documentation
```

## Code Patterns

### Error Handling

```javascript
try {
  const result = await gateway.executeSwap(params);
  console.log('Swap successful:', result);
} catch (error) {
  if (error.code === 'INSUFFICIENT_FUNDS') {
    console.error('Insufficient balance for swap');
  } else if (error.code === 'SLIPPAGE_EXCEEDED') {
    console.error('Slippage tolerance exceeded');
  } else {
    console.error('Swap failed:', error.message);
  }
}
```

### Gas Optimization

```javascript
// Estimate gas before execution
const gasEstimate = await gateway.estimateGas(swapParams);
const gasPrice = await provider.getGasPrice();
const totalCost = gasEstimate.mul(gasPrice);

console.log(`Estimated gas cost: ${ethers.utils.formatEther(totalCost)} ETH`);
```

### Event Monitoring

```javascript
// Listen for swap events
gateway.on('SwapExecuted', (user, tokenIn, tokenOut, amountIn, amountOut) => {
  console.log(`Swap: ${amountIn} ${tokenIn} → ${amountOut} ${tokenOut}`);
});
```

## Common Integration Patterns

### 1. DeFi Protocol Integration

```solidity
contract MyDeFiProtocol {
    IIXFIGateway public ixfiGateway;
    
    function autoRebalance(address tokenIn, address tokenOut, uint256 amount) external {
        // Use IXFI for optimal token swapping
        ixfiGateway.executeSwap(SwapParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amount,
            minAmountOut: calculateMinOutput(amount),
            routerType: 0,
            to: address(this),
            deadline: block.timestamp + 1800,
            swapData: ""
        }));
    }
}
```

### 2. Frontend Integration

```jsx
function SwapInterface() {
  const { executeSwap, loading, error } = useIXFI();
  
  const handleSwap = async () => {
    try {
      const result = await executeSwap({
        tokenIn: selectedTokenIn.address,
        tokenOut: selectedTokenOut.address,
        amountIn: parseUnits(inputAmount, selectedTokenIn.decimals),
        minAmountOut: calculateMinOutput(),
        routerType: 0
      });
      
      setTransactionHash(result.hash);
    } catch (err) {
      setError(err.message);
    }
  };
  
  return (
    <div>
      {/* Swap UI components */}
      <button onClick={handleSwap} disabled={loading}>
        {loading ? 'Swapping...' : 'Swap Tokens'}
      </button>
    </div>
  );
}
```

### 3. Backend/API Integration

```javascript
// Express.js API endpoint
app.post('/api/swap', async (req, res) => {
  try {
    const { tokenIn, tokenOut, amountIn, userAddress } = req.body;
    
    // Validate parameters
    if (!isValidAddress(tokenIn) || !isValidAddress(tokenOut)) {
      return res.status(400).json({ error: 'Invalid token addresses' });
    }
    
    // Execute swap
    const result = await ixfiGateway.executeSwap({
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut: calculateMinOutput(amountIn),
      routerType: 0,
      to: userAddress,
      deadline: Math.floor(Date.now() / 1000) + 1800
    });
    
    res.json({
      transactionHash: result.hash,
      status: 'pending'
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Testing

### Unit Tests

```javascript
describe('IXFI Integration Tests', () => {
  let gateway;
  let user;
  
  beforeEach(async () => {
    [user] = await ethers.getSigners();
    gateway = await deployIXFIGateway();
  });
  
  it('should execute swap successfully', async () => {
    const result = await gateway.executeSwap(validSwapParams);
    expect(result).to.emit(gateway, 'SwapExecuted');
  });
});
```

### Integration Tests

```javascript
describe('Cross-Chain Integration', () => {
  it('should complete cross-chain swap', async () => {
    // Test actual cross-chain functionality
    const result = await crossChainSwap({
      sourceChain: 'ethereum',
      destinationChain: 'polygon',
      // ... other params
    });
    
    // Verify on both chains
    expect(result.sourceChainTx).to.be.a('string');
    expect(result.destinationChainTx).to.be.a('string');
  });
});
```

## Best Practices

### Security

1. **Always validate input parameters**
2. **Use slippage protection**
3. **Implement proper access controls**
4. **Handle edge cases gracefully**

```javascript
function validateSwapParams(params) {
  if (!ethers.utils.isAddress(params.tokenIn)) {
    throw new Error('Invalid tokenIn address');
  }
  if (params.amountIn.lte(0)) {
    throw new Error('Amount must be greater than 0');
  }
  if (params.deadline < Math.floor(Date.now() / 1000)) {
    throw new Error('Deadline has passed');
  }
}
```

### Gas Optimization

1. **Estimate gas before execution**
2. **Use batch operations when possible**
3. **Implement gas price strategies**

```javascript
// Dynamic gas pricing
const gasPrice = await provider.getGasPrice();
const priorityFee = gasPrice.mul(110).div(100); // 10% priority

const tx = await gateway.executeSwap(params, {
  gasPrice: priorityFee,
  gasLimit: estimatedGas.mul(120).div(100) // 20% buffer
});
```

### User Experience

1. **Provide clear transaction status**
2. **Implement proper loading states**
3. **Show meaningful error messages**

```javascript
const [txStatus, setTxStatus] = useState('idle');

const updateStatus = (status, hash) => {
  setTxStatus(status);
  
  switch (status) {
    case 'pending':
      showToast('Transaction submitted...', hash);
      break;
    case 'confirmed':
      showToast('Swap completed successfully!', hash);
      break;
    case 'failed':
      showToast('Transaction failed', hash, 'error');
      break;
  }
};
```

## Support and Resources

### Documentation
- [Core Concepts](../core-concepts/protocol-overview.md)
- [API Reference](../api-reference/)
- [Integration Guides](../guides/)

### Community
- [Discord](https://discord.gg/ixfi)
- [Telegram](https://t.me/ixfi)
- [GitHub](https://github.com/IXFI-Protocol)

### Development Support
- [Developer Portal](https://dev.ixfi.com)
- [Technical Documentation](../TECHNICAL_DOCS.md)
- [Deployment Guide](../guides/deployment.md)

## Contributing

We welcome contributions to improve these examples! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

### Code Style

- Use TypeScript for type safety
- Follow ESLint configuration
- Include comprehensive JSDoc comments
- Write meaningful test cases

```javascript
/**
 * Execute a token swap with optimal routing
 * @param {Object} params - Swap parameters
 * @param {string} params.tokenIn - Input token address
 * @param {string} params.tokenOut - Output token address
 * @param {BigNumber} params.amountIn - Input amount
 * @param {number} params.maxSlippageBps - Maximum slippage in basis points
 * @returns {Promise<TransactionReceipt>} Transaction receipt
 */
async function executeOptimalSwap(params) {
  // Implementation
}
```

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.
