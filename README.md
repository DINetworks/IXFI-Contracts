
## IXFI Cross-Chain Protocol

IXFI (Interoperable XFI) is a comprehensive cross-chain infrastructure that enables seamless asset transfers, DEX aggregation, and gasless transactions across multiple EVM-compatible blockchains.

## 📚 Documentation

**Complete documentation is available in GitBook format:**

### 🚀 Quick Access
- **[📖 Full Documentation](./docs/)** - Complete GitBook-style documentation
- **[⚡ Quick Start Guide](./docs/getting-started/quick-start.md)** - Get started in 5 minutes
- **[🔧 API Reference](./docs/api-reference/)** - Complete contract APIs
- **[💡 Examples](./docs/examples/)** - Integration patterns and code samples

### 📖 Build Documentation Locally

```bash
# Navigate to docs directory
cd docs

# Install dependencies
npm install

# Serve documentation locally
npm run docs:serve

# Or build static files
npm run docs:build

# Generate PDF
npm run docs:pdf
```

### 📋 Documentation Structure

```
docs/
├── getting-started/     # Installation and quick start
├── core-concepts/       # Protocol architecture and concepts
├── dex-aggregation/     # 37+ DEX protocol integration
├── cross-chain/         # Cross-chain operations
├── api-reference/       # Complete API documentation
├── guides/             # Integration and deployment guides
├── examples/           # Real-world usage examples
└── resources/          # FAQ, troubleshooting, glossary
```

## Features

### 🔗 Cross-Chain Infrastructure
- **Cross-Chain Token Transfers**: Send IXFI tokens between supported chains
- **Cross-Chain Contract Calls**: Execute smart contract functions across different blockchains  
- **1:1 XFI Backing**: All IXFI tokens are backed by native XFI on CrossFi chain
- **Multi-Chain Support**: Ethereum, BSC, Polygon, Avalanche, Arbitrum, Optimism, Base

### 🔄 Advanced DEX Aggregation
- **37+ DEX Protocols**: Support for V2 AMM, V3 concentrated liquidity, Solidly forks, stableswap
- **Optimal Routing**: Intelligent multi-DEX routing for best execution prices
- **V3 Integration**: Uniswap V3, SushiSwap V3, PancakeSwap V3 concentrated liquidity support
- **Cross-Chain Swaps**: A→IXFI→B token swaps across different networks

### ⛽ Gasless Transaction System
- **IXFI Gas Credits**: Execute transactions without holding native gas tokens
- **Meta-Transaction Support**: EIP-712 signature-based transaction execution
- **Cross-Chain Gasless**: Seamless gasless operations across all supported chains
    <a href="https://ixfi.network.com">
        <img alt="logo" src="https://github.com/IXFILabs/IXFILabs/blob/main/IXFI-banner.png" style="width: 100%;">
    </a>


## IXFI Protocol

The Interoperable XFI (IXFI) Protocol introduces a groundbreaking approach to cross-chain interoperability by leveraging XFI as the primary gas token. This enables gasless cross-chain swaps through a meta-transaction relay system while enhancing XFI’s utility across multiple blockchain networks.

By addressing the limitations of CrossFi’s existing bridge, IXFI transforms CrossFi’s ecosystem into a fully interoperable and programmable cross-chain infrastructure. This innovation allows seamless asset transfers, smart contract execution, and data messaging across diverse blockchain ecosystems.

## Tech Stack

- **Solidity** (v0.8.20) - Smart contract development
- **Hardhat** (v2.22.19) - Development framework and testing
- **OpenZeppelin Contracts** (v5.2.0) - Security-audited contract libraries
- **Chainlink Oracles** - Real-time price feeds for gas credit calculation
- **Node.js** - Relayer infrastructure and event monitoring
- **Ethers.js** - Blockchain interaction and cryptography

## Development & Test on Local Environment

Clone and install npm modules

```sh
git clone https://github.com/IXFILabs/IXFI-Contracts.git
cd IXFI-Contracts
npm install
```

Create .env file and setup env variables

```
RPC_URL=https://crossfi-testnet.g.alchemy.com/v2/<YOUR_ALCHEMY_API_KEY>
PRIVATE_KEY=<YOUR_WALLET_PRIVATE_KEY>
```

Run tests to verify the installation:

```sh
npx hardhat test
```

## Core Architecture

### IXFI Gateway Contract (`IXFI.sol`)

The central hub for all cross-chain operations, providing:

**Cross-Chain Communication:**
- `callContract()` - Execute contracts on remote chains
- `callContractWithToken()` - Execute contracts and transfer tokens
- `sendToken()` - Simple cross-chain token transfers

**XFI Backing System:**
- `deposit()` - Convert XFI to IXFI (1:1 ratio)
- `withdraw()` - Convert IXFI back to XFI
- Automatic backing verification for all operations

**Command Execution:**
- `execute()` - Process cross-chain commands via relayers
- Support for multiple command types (contract calls, token operations)
- Cryptographic validation and replay protection

### Relayer Infrastructure (`relayer/`)

Decentralized event monitoring and command execution system:

**Event Processing:**
- Monitors `ContractCall`, `ContractCallWithToken`, and `TokenSent` events
- Automatic payload verification and command generation
- Cross-chain message delivery with built-in retry mechanisms

**Health Monitoring:**
- RESTful health and metrics endpoints
- Real-time processing statistics
- Configurable monitoring and alerting

### Deployment Scripts (`scripts/`)

Production-ready deployment automation:
- `deploy-gmp.js` - Complete GMP protocol deployment
- `whitelist-relayer.js` - Relayer permission management
- Multi-chain deployment support with verification

### Meta Transaction System (`MetaTxGasCreditVault.sol` & `MetaTxGateway.sol`)

Gasless transaction infrastructure that enables users to execute transactions without paying gas fees:

**Gas Credit Vault:**
- `deposit()` - Deposit tokens (USDC, USDT, IXFI, etc.) to earn gas credits
- `withdraw()` - Withdraw deposited tokens and deduct corresponding credits
- Real-time token price conversion using Chainlink oracles
- Support for stablecoins with 1:1 credit conversion

**Meta Transaction Gateway:**
- `executeMetaTransaction()` - Execute user transactions with relayer paying gas
- `recoverSigner()` - Cryptographic signature verification
- Nonce-based replay protection
- Integration with gas credit system for automatic fee deduction

**Key Features:**
- **Multi-Token Support**: Accept various tokens for gas payment (USDC, USDT, IXFI)
- **Oracle Integration**: Real-time price feeds for accurate credit calculation
- **Flexible Credits**: Credits can be used across all supported operations
- **Signature Verification**: EIP-712 standard for secure meta transactions

## Quick Start Guide

### 1. Deploy IXFI Protocol

```sh
# Deploy on CrossFi testnet
npx hardhat run scripts/deploy-gmp.js --network crossfi

# Deploy on additional chains (Ethereum, Polygon, BSC, etc.)
npx hardhat run scripts/deploy-gmp.js --network ethereum
```

### 2. Set Up Relayer

```sh
cd relayer
npm install

# Configure relayer settings
cp config.example.json config.json
# Edit config.json with your RPC endpoints and private key

# Start relayer service
node index.js
```

### 3. Cross-Chain Usage Examples

**Simple Token Transfer:**
```solidity
// Send 100 IXFI from CrossFi to Ethereum
ixfi.sendToken("ethereum", recipientAddress, "IXFI", 100 * 10**18);
```

**Cross-Chain Contract Call:**
```solidity
// Call a DeFi contract on Polygon from any chain
bytes memory payload = abi.encode("swap", tokenIn, tokenOut, amount);
ixfi.callContract("polygon", dexContract, payload);
```

**Contract Call with Token Transfer:**
```solidity
// Send tokens and execute a contract in one transaction
ixfi.callContractWithToken(
    "bsc",
    stakingContract,
    abi.encode("stake", duration),
    "IXFI",
    stakeAmount
);
```

### 4. Gasless Meta Transaction Setup

**Deploy Meta Transaction Infrastructure:**
```sh
# Deploy gas credit vault and gateway
npx hardhat run scripts/deploy-meta-tx.js --network crossfi
```

**Set Up Gas Credits:**
```solidity
// Deposit USDC to get gas credits
vault.deposit(usdcToken, 100 * 10**6); // 100 USDC

// Check available credits
uint256 credits = vault.credits(userAddress);
```

## Supported DEX Protocols & Networks

### 🌐 Supported Networks
- **Ethereum Mainnet** (Chain ID: 1)
- **BNB Smart Chain** (Chain ID: 56) 
- **Polygon** (Chain ID: 137)
- **Avalanche** (Chain ID: 43114)
- **Arbitrum One** (Chain ID: 42161)
- **Optimism** (Chain ID: 10)
- **Base** (Chain ID: 8453)

### 🔄 Supported DEX Protocols (37 Total)

**AMM Protocols (Uniswap V2 Style):**
- Uniswap V2, SushiSwap V2, PancakeSwap V2
- QuickSwap, TraderJoe, SpookySwap, SpiritSwap
- ApeSwap, Biswap, MDEX, Camelot, ZyberSwap

**Concentrated Liquidity (Uniswap V3 Style):**
- Uniswap V3, SushiSwap V3, PancakeSwap V3
- Ramses, Algebra

**Solidly Fork Protocols:**
- Velodrome (Optimism), Aerodrome (Base)
- Solidly, Thena (BSC), Chronos

**Stableswap Protocols:**
- Curve Finance, Platypus (Avalanche), Wombat

**Specialized Protocols:**
- Balancer (Weighted pools), Beethoven X (Fantom/Optimism)
- GMX (Perpetuals), Maverick (Concentrated liquidity)
- 1inch, ParaSwap, 0x Protocol, Kyber Network, DODO, Bancor

### 📊 Cross-Chain Aggregation Features

**Smart Router Selection:**
- Automatic optimal DEX selection across 37+ protocols
- Real-time price comparison and slippage optimization
- Multi-hop routing for best execution prices
- Gas cost optimization in route selection

**V2 vs V3 Protocol Support:**
- Traditional AMM (constant product) pools
- Concentrated liquidity with custom fee tiers
- Dynamic fee adjustment based on volatility
- Capital efficiency optimization

## Architecture Overview

### Core Components

**CrossChainAggregator.sol** - Main aggregation contract
- Cross-chain swap execution and coordination
- Integration with Axelar Network for message passing
- Token bridging and destination chain execution

**SwapCalldataGenerator.sol** - DEX interaction layer  
- Calldata generation for 37+ DEX protocols
- Optimal router selection using MulticallLibraryV2
- Quote aggregation and price discovery

**MulticallLibraryV2.sol** - Batch operations library
- Efficient multi-DEX quote batching using Multicall3
- Router configuration and management  
- Support for all 37 router types with proper categorization

**Libraries Architecture:**
- **QuoteLibrary.sol** - Quote calculation for all DEX types
- **CalldataLibrary.sol** - Calldata generation utilities
- **MulticallLibraryV2.sol** - Batch quote operations

### Usage Examples

**Basic Cross-Chain Swap:**
```solidity
// Swap 100 USDC on Ethereum → USDT on BSC
SwapData memory swapData = SwapData({
    sourceToken: "0xA0b86a33E6441c45C74d7F7f5234f3628B8b5C22", // USDC
    sourceAmount: 100 * 10**6,
    destinationChain: "bsc", 
    destinationToken: "0x55d398326f99059fF775485246999027B3197955", // USDT
    minDestinationAmount: 99 * 10**18,
    recipient: userAddress,
    deadline: block.timestamp + 3600,
    routerCalldata: calldataGenerator.generateOptimalCalldata(...)
});

aggregator.crossChainSwap(swapData, { value: gasFee });
```

**Multi-DEX Quote Comparison:**
```solidity
// Get quotes from all active DEXes on Ethereum
(address bestRouter, uint256 bestOutput) = calldataGenerator.getOptimalRouter(
    1, // Ethereum
    tokenIn,
    tokenOut, 
    amountIn
);
```

**Execute Gasless Transactions:**
```javascript
// User signs transaction off-chain
const signature = await user.signTypedData(domain, types, message);

// Relayer executes with gas payment
await gateway.executeMetaTransaction(
    userAddress,
    functionCall,
    nonce,
    signature
);
```

## Key Features

### 🌉 Cross-Chain Interoperability
- **Universal Gateway**: Single contract interface for all cross-chain operations
- **Message Passing**: Execute smart contracts across different blockchain networks
- **Token + Data**: Combine token transfers with arbitrary data execution
- **Chain Agnostic**: Support for any EVM-compatible blockchain

### ⛽ Gasless Meta Transactions
- **No Gas Required**: Users execute transactions without holding native tokens
- **Multi-Token Payment**: Accept USDC, USDT, IXFI, and other tokens for gas
- **Oracle-Based Pricing**: Real-time token-to-gas conversion via Chainlink
- **Credit System**: Flexible gas credit management with deposit/withdraw

### 💰 XFI-Backed Tokenomics  
- **1:1 Backing**: Every IXFI token backed by real XFI in the gateway contract
- **Deposit/Withdraw**: Seamless conversion between XFI and IXFI
- **Transparent Reserves**: On-chain verification of backing ratio
- **No Inflation**: Token supply directly tied to XFI deposits

### 🔄 Relayer Network
- **Event-Driven**: Automatic processing of cross-chain events
- **Decentralized**: Multiple relayers can operate independently  
- **Health Monitoring**: Built-in metrics and health check endpoints
- **Fault Tolerant**: Retry mechanisms and error handling

### 🔒 Security & Validation
- **Cryptographic Proofs**: All cross-chain messages cryptographically verified
- **Replay Protection**: Command IDs prevent duplicate execution
- **Payload Verification**: Hash-based payload integrity checks
- **Access Control**: Role-based permissions for relayers and administrators

## Testing

Run the comprehensive test suite:

```sh
# Run all tests
npx hardhat test

# Run specific GMP protocol tests  
npx hardhat test test/test-gmp.js

# Run with gas reporting
REPORT_GAS=true npx hardhat test
```

## Documentation

- **[USAGE.md](./USAGE.md)** - Complete usage guide and API reference
- **[GMP_README.md](./GMP_README.md)** - Technical specification for GMP protocol
- **[relayer/README.md](./relayer/README.md)** - Relayer setup and configuration guide

## Deployed Contracts

### CrossFi Testnet
| Contract | Address | Description |
|----------|---------|-------------|
| IXFI Gateway | `0xFC4C231D2293180a30eCd10Ce9A84bDBF27B3967` | Main GMP gateway contract |
| MetaTxGasCreditVault | `TBD` | Gas credit management system |
| MetaTxGateway | `TBD` | Gasless transaction execution |

### Deployment Status
- ✅ CrossFi Testnet - Active (GMP Protocol)
- 🔄 CrossFi Testnet - Pending (Meta Transaction System)
- 🔄 Ethereum Sepolia - Pending  
- 🔄 Polygon Mumbai - Pending
- 🔄 BSC Testnet - Pending

## Community & Support

- **GitHub**: [IXFILabs/IXFI-Contracts](https://github.com/IXFILabs/IXFI-Contracts)
- **Website**: [ixfi.network.com](https://ixfi.network.com)
- **Documentation**: Comprehensive guides in `/docs`
- **Issues**: Report bugs and feature requests on GitHub

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.





