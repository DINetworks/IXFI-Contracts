# IXFI Technical Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Contracts](#core-contracts)
4. [GMP Protocol](#gmp-protocol)
5. [Meta-Transaction System](#meta-transaction-system)
6. [Deployment Guide](#deployment-guide)
7. [API Reference](#api-reference)
8. [Security Considerations](#security-considerations)
9. [Integration Guide](#integration-guide)

## Overview

IXFI (Interoperable XFI) is a comprehensive cross-chain infrastructure that enables seamless asset transfers and gasless transactions across multiple EVM-compatible blockchains. The system consists of two main components:

1. **GMP (General Message Passing) Protocol** - For cross-chain communication and token transfers
2. **Meta-Transaction System** - For gasless transaction execution with IXFI-based gas credits
3. **Cross-Chain DEX Aggregation** - Multi-protocol DEX routing with 37+ supported protocols

### Key Features

- **1:1 XFI Backing**: IXFI tokens are fully backed by native XFI on CrossFi chain
- **Cross-Chain Communication**: Message passing protocol similar to Axelar
- **Gasless Transactions**: Users can execute transactions without holding native gas tokens
- **Multi-Chain Support**: Ethereum, BSC, Polygon, Avalanche, Arbitrum, Optimism, Base
- **Advanced DEX Aggregation**: Support for 37+ DEX protocols including V2 and V3 variants
- **Optimal Route Selection**: Intelligent routing across multiple DEXes for best prices
- **Concentrated Liquidity**: Full support for Uniswap V3, SushiSwap V3, PancakeSwap V3
- **Decentralized Relayers**: Network of whitelisted relayers for cross-chain operations

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CrossFi       │    │   Ethereum      │    │   Other Chains  │
│   (Source)      │    │   (Target)      │    │   (BSC/Polygon) │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ IXFI Gateway    │    │ IXFI Gateway    │    │ IXFI Gateway    │
│ GasCreditVault  │    │ MetaTxGateway   │    │ MetaTxGateway   │
│ XFI ↔ IXFI      │    │ Contract Calls  │    │ Contract Calls  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Relayer       │
                    │   Network       │
                    │                 │
                    │ - IXFIRelayer   │
                    │ - MetaTxRelayer │
                    │ - Monitoring    │
                    └─────────────────┘
```

### System Components

1. **IXFI Gateway** (`IXFI.sol`) - Core contract handling GMP and XFI↔IXFI conversion
2. **MetaTxGasCreditVault** (`MetaTxGasCreditVault.sol`) - Gas credit management on CrossFi
3. **MetaTxGateway** (`MetaTxGateway.sol`) - Meta-transaction execution on any chain
4. **IXFIExecutable** (`IXFIExecutable.sol`) - Base contract for dApps receiving cross-chain calls
5. **CrossChainAggregator** (`CrossChainAggregator.sol`) - Multi-protocol DEX aggregation system
6. **MulticallLibraryV2** (`MulticallLibraryV2.sol`) - Batch operations and optimal routing
7. **QuoteLibrary** (`QuoteLibrary.sol`) - Price quotation for 37+ DEX protocols
8. **Relayer Services** - Off-chain services for cross-chain coordination

## DEX Aggregation System

The IXFI protocol includes a sophisticated DEX aggregation system that supports 37+ protocols across 7 chains, providing optimal routing and price discovery for token swaps.

### Supported DEX Protocols

#### V2 AMM Protocols (Traditional)
- **Uniswap V2** (All networks)
- **SushiSwap V2** (All networks)
- **PancakeSwap V2** (BSC, Ethereum)
- **TraderJoe V1** (Avalanche)
- **QuickSwap** (Polygon)
- **SpookySwap** (Fantom-compatible)
- **Dfyn** (Polygon)

#### V3 Concentrated Liquidity
- **Uniswap V3** (Ethereum, Polygon, Arbitrum, Optimism, Base)
- **SushiSwap V3** (Multi-chain)
- **PancakeSwap V3** (BSC, Ethereum)
- **Algebra** (Polygon)
- **Camelot V3** (Arbitrum)

#### Solidly Forks (ve(3,3))
- **Velodrome** (Optimism)
- **Aerodrome** (Base)
- **Thena** (BSC)
- **Ramses** (Arbitrum)

#### Stableswap Protocols
- **Curve Finance** (Multi-chain)
- **Ellipsis** (BSC)
- **Belt Finance** (BSC)

#### Specialized DEXes
- **Balancer V2** (Multi-chain)
- **1inch** (Multi-chain)
- **Platypus** (Avalanche)
- **WooFi** (Multi-chain)
- **DODO** (Multi-chain)

### Architecture Components

#### CrossChainAggregator.sol
Main aggregation contract that:
- Orchestrates multi-DEX quote comparisons
- Executes optimal swap routes
- Handles cross-chain operations
- Manages slippage protection

```solidity
function getOptimalQuote(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256[] memory routerTypes
) external view returns (uint256 bestAmount, uint256 bestRouter)

function executeSwap(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    uint256 routerType,
    bytes calldata swapData
) external payable
```

#### MulticallLibraryV2.sol
Batch operations library for:
- Parallel quote fetching from 37 protocols
- Optimal route selection
- Gas-efficient multicall execution
- Error handling and fallbacks

```solidity
function getMultipleQuotes(
    address tokenIn,
    address tokenOut,
    uint256 amountIn
) external view returns (QuoteResult[] memory quotes)

function _generateQuoteCalldata(
    uint256 routerType,
    address tokenIn,
    address tokenOut,
    uint256 amountIn
) internal pure returns (bytes memory)
```

#### QuoteLibrary.sol
Quote calculation engine supporting:
- V2 AMM price calculations
- V3 concentrated liquidity math
- Curve stableswap formulas
- Balancer weighted pool math

```solidity
// V2 DEX Quotes
function getUniswapV2Quote(address factory, address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256)

// V3 DEX Quotes
function getUniswapV3Quote(address factory, address tokenIn, address tokenOut, uint256 amountIn, uint24 fee) external view returns (uint256)
function getSushiswapV3Quote(address factory, address tokenIn, address tokenOut, uint256 amountIn, uint24 fee) external view returns (uint256)
function getPancakeswapV3Quote(address factory, address tokenIn, address tokenOut, uint256 amountIn, uint24 fee) external view returns (uint256)

// Specialized Protocols
function getCurveQuote(address pool, address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256)
function getBalancerV2Quote(address vault, bytes32 poolId, address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256)
```

### Router Type Mapping

Each DEX protocol is assigned a unique router type ID (0-36):

| Router Type | Protocol | Networks | Notes |
|-------------|----------|----------|-------|
| 0 | Uniswap V2 | All | Standard AMM |
| 1 | SushiSwap V2 | All | Fork of Uniswap V2 |
| 2 | PancakeSwap V2 | BSC, ETH | BSC native |
| 3 | Uniswap V3 | ETH, Polygon, Arbitrum, Optimism, Base | Concentrated liquidity |
| 4 | SushiSwap V3 | Multi-chain | V3 implementation |
| 5 | PancakeSwap V3 | BSC, ETH | V3 concentrated liquidity |
| 6-15 | Various V2 AMMs | Network-specific | QuickSwap, TraderJoe, etc. |
| 16-25 | Solidly Forks | Network-specific | Velodrome, Aerodrome, etc. |
| 26-30 | Stableswap | Multi-chain | Curve, Ellipsis, etc. |
| 31-36 | Specialized | Multi-chain | Balancer, 1inch, DODO, etc. |

### Integration Examples

#### Basic Token Swap
```solidity
// Get quotes from all available DEXes
(uint256 bestAmount, uint256 bestRouter) = aggregator.getOptimalQuote(
    USDC,
    WETH,
    1000e6, // 1000 USDC
    getAllRouterTypes()
);

// Execute swap with best route
aggregator.executeSwap{value: msg.value}(
    USDC,
    WETH,
    1000e6,
    bestAmount * 995 / 1000, // 0.5% slippage
    bestRouter,
    swapData
);
```

#### Cross-Chain Swap
```solidity
// Swap USDC on Ethereum for WBNB on BSC
aggregator.crossChainSwap(
    "ethereum",
    "binance",
    USDC,
    WBNB,
    1000e6,
    minAmountOut,
    routerType
);
```

## Core Contracts

### IXFI.sol - Main Gateway Contract

The core contract that handles:
- XFI ↔ IXFI conversion (1:1 ratio)
- Cross-chain message passing
- Token transfers between chains
- Relayer management

#### Key Functions

```solidity
// XFI ↔ IXFI Conversion
function deposit() public payable onlyCrossfiChain
function withdraw(uint256 amount_) public onlyCrossfiChain

// Cross-chain Operations
function callContract(string memory destinationChain, string memory destinationContractAddress, bytes memory payload) external
function callContractWithToken(string memory destinationChain, string memory destinationContractAddress, bytes memory payload, string memory symbol, uint256 amount) external
function sendToken(string memory destinationChain, string memory destinationAddress, string memory symbol, uint256 amount) external

// Relayer Functions
function execute(bytes32 commandId, Command[] memory commands, bytes memory signature) external onlyRelayer
```

#### State Variables

```solidity
uint256 crossfi_chainid = 4157; // 4158 for mainnet
mapping(address => bool) public whitelisted; // Whitelisted relayers
mapping(bytes32 => bool) public commandExecuted; // Executed commands
mapping(string => uint256) public chainIds; // Supported chains
mapping(bytes32 => bytes) public approvedPayloads; // Approved payloads
```

#### Events

```solidity
event ContractCall(address indexed sender, string destinationChain, string destinationContractAddress, bytes32 indexed payloadHash, bytes payload);
event ContractCallWithToken(address indexed sender, string destinationChain, string destinationContractAddress, bytes32 indexed payloadHash, bytes payload, string symbol, uint256 amount);
event TokenSent(address indexed sender, string destinationChain, string destinationAddress, string symbol, uint256 amount);
event Deposited(address indexed user, uint256 amount);
event Withdrawn(address indexed user, uint256 amount);
```

### MetaTxGasCreditVault.sol - Gas Credit Management

Manages IXFI-based gas credits on CrossFi chain with DIA Oracle integration for real-time pricing.

#### Key Features

- **USD-Based Credits**: Gas credits denominated in USD cents
- **DIA Oracle Integration**: Real-time IXFI/USD price feeds
- **Gateway Authorization**: Only authorized gateways can consume credits
- **Price Validation**: Ensures price data freshness

#### Key Functions

```solidity
// User Functions
function deposit(uint256 amount) external nonReentrant
function withdraw(uint256 amount) external nonReentrant

// Gateway Functions
function consumeCredits(address user, uint256 gasUsd) external returns (bool success)

// Owner Functions
function setDIAOracle(address newOracle) external onlyOwner
function setIXFIPriceKey(string memory newKey) external onlyOwner
function setGatewayAuthorization(address gateway, bool authorized) external onlyOwner

// View Functions
function calculateCreditsFromIXFI(uint256 ixfiAmount) public view returns (uint256 usdCredits)
function hasEnoughCredits(address user, uint256 gasUsd) external view returns (bool hasEnough)
function getIXFIPrice() public view returns (uint128 price, uint128 timestamp)
```

#### Oracle Integration

```solidity
interface IDIAOracleV2 {
    function getValue(string memory key) external view returns (uint128, uint128);
}
```

### MetaTxGateway.sol - Meta-Transaction Execution

Handles gasless transaction execution on any EVM chain using EIP-712 signatures.

#### Key Features

- **EIP-712 Compliance**: Standard meta-transaction signatures
- **Nonce Management**: Replay attack protection
- **Relayer Authorization**: Only authorized relayers can execute
- **Gas Independence**: No vault dependency on non-CrossFi chains

#### Key Functions

```solidity
// Meta-transaction Execution
function executeMetaTransaction(MetaTransaction memory metaTx, bytes memory signature) external onlyRelayer nonReentrant

// Batch Operations
function executeBatchMetaTransactions(MetaTransaction[] memory metaTxs, bytes[] memory signatures) external onlyRelayer nonReentrant

// Management
function setRelayerAuthorization(address relayer, bool authorized) external onlyOwner

// View Functions
function getNonce(address user) external view returns (uint256)
function getDomainSeparator() public view returns (bytes32)
function getMetaTransactionHash(MetaTransaction memory metaTx) public view returns (bytes32)
```

#### MetaTransaction Structure

```solidity
struct MetaTransaction {
    address from;      // User who signed the transaction
    address to;        // Target contract to call
    uint256 value;     // ETH value to send (usually 0)
    bytes data;        // Function call data
    uint256 nonce;     // User's current nonce
    uint256 deadline;  // Transaction deadline
}
```

### IXFIExecutable.sol - dApp Integration Base

Abstract contract for dApps that want to receive cross-chain calls.

#### Key Functions

```solidity
function execute(bytes32 commandId, string calldata sourceChain, string calldata sourceAddress, bytes calldata payload) external override onlyGateway

function executeWithToken(bytes32 commandId, string calldata sourceChain, string calldata sourceAddress, bytes calldata payload, string calldata symbol, uint256 amount) external override onlyGateway

// Abstract functions to implement
function _execute(string calldata sourceChain, string calldata sourceAddress, bytes calldata payload) internal virtual;
function _executeWithToken(string calldata sourceChain, string calldata sourceAddress, bytes calldata payload, string calldata symbol, uint256 amount) internal virtual;
```

## GMP Protocol

### Message Flow

1. **Initiation**: User calls `callContract()` or `callContractWithToken()` on source chain
2. **Event Emission**: Contract emits cross-chain event with payload
3. **Relayer Monitoring**: Relayers monitor events on all chains
4. **Command Creation**: Relayer creates execution commands for destination chain
5. **Execution**: Relayer calls `execute()` on destination chain with signed commands
6. **Validation**: Contract validates signature and executes commands

### Command Types

```solidity
uint256 public constant COMMAND_APPROVE_CONTRACT_CALL = 0;
uint256 public constant COMMAND_APPROVE_CONTRACT_CALL_WITH_MINT = 1;
uint256 public constant COMMAND_BURN_TOKEN = 2;
uint256 public constant COMMAND_MINT_TOKEN = 4;
```

### Security Model

- **Relayer Consensus**: Multiple whitelisted relayers must agree
- **Signature Verification**: All commands must be signed by authorized relayers
- **Replay Protection**: Commands can only be executed once
- **Payload Validation**: Payload hashes are verified on execution

## Meta-Transaction System

### Architecture Overview

The meta-transaction system operates on a distributed model:

- **CrossFi Chain**: Hosts `MetaTxGasCreditVault` for centralized credit management
- **Other Chains**: Host `MetaTxGateway` for transaction execution
- **MetaTxRelayer**: Coordinates between vault and gateways

### Transaction Flow

1. **Credit Deposit**: User deposits IXFI on CrossFi for gas credits
2. **Transaction Signing**: User signs meta-transaction with EIP-712
3. **Credit Check**: Relayer verifies credits on CrossFi vault
4. **Execution**: Relayer executes transaction on target chain
5. **Credit Deduction**: Relayer deducts gas costs from CrossFi vault

### EIP-712 Domain

```solidity
{
    name: "MetaTxGateway",
    version: "1",
    chainId: <target_chain_id>,
    verifyingContract: <gateway_address>
}
```

### Gas Calculation

Gas costs are calculated in USD and converted using DIA Oracle:

```
gasUsd = gasUsed * gasPrice * nativeTokenPrice
creditsNeeded = gasUsd (in cents)
```

## Deployment Guide

### Prerequisites

1. Node.js >= 18.0.0
2. Hardhat development environment
3. DIA Oracle deployment addresses
4. Sufficient native tokens for deployment

### Deployment Steps

#### 1. Environment Setup

```bash
# Clone repository
git clone <repository-url>
cd IXFI-Contracts

# Install dependencies
npm install
cd relayer && npm install && cd ..

# Setup environment
npm run setup
```

#### 2. Configure Networks

Edit `hardhat.config.js`:

```javascript
networks: {
  crossfi: {
    chainId: 4157, // 4158 for mainnet
    url: "https://rpc.testnet.ms",
    accounts: [process.env.PRIVATE_KEY]
  },
  ethereum: {
    chainId: 1, // 11155111 for sepolia
    url: "https://mainnet.infura.io/v3/YOUR_KEY",
    accounts: [process.env.PRIVATE_KEY]
  }
  // Add other chains...
}
```

#### 3. Deploy Contracts

```bash
# Deploy GMP system
npx hardhat run scripts/deploy-gmp.js --network crossfi
npx hardhat run scripts/deploy-gmp.js --network ethereum

# Deploy Meta-Transaction system
npx hardhat run scripts/deploy-meta-tx.js --network crossfi
npx hardhat run scripts/deploy-meta-tx.js --network ethereum

# Whitelist relayers
npx hardhat run scripts/whitelist-relayer.js --network crossfi
```

#### 4. Configure Relayers

```bash
# Setup GMP relayer
cd relayer
cp config.example.json config.json
# Edit config.json with contract addresses and RPC URLs

# Setup Meta-Transaction relayer
cp meta-tx-config.example.json meta-tx-config.json
# Edit meta-tx-config.json
```

#### 5. Start Relayers

```bash
# Start GMP relayer
npm run start:gmp

# Start Meta-Transaction relayer (separate terminal)
npm run start:meta-tx
```

### Configuration Files

#### GMP Relayer Config

```json
{
  "relayerPrivateKey": "0x...",
  "pollingInterval": 5000,
  "gasLimit": 500000,
  "chains": {
    "crossfi": {
      "rpc": "https://rpc.testnet.ms",
      "chainId": 4157,
      "ixfiAddress": "0x...",
      "blockConfirmations": 1
    },
    "ethereum": {
      "rpc": "https://mainnet.infura.io/v3/YOUR_KEY",
      "chainId": 1,
      "ixfiAddress": "0x...",
      "blockConfirmations": 12
    }
  }
}
```

#### Meta-Transaction Relayer Config

```json
{
  "relayerPrivateKey": "0x...",
  "chains": {
    "crossfi": {
      "rpc": "https://rpc.testnet.ms",
      "vaultAddress": "0x...",
      "gatewayAddress": "0x..."
    },
    "ethereum": {
      "rpc": "https://mainnet.infura.io/v3/YOUR_KEY",
      "gatewayAddress": "0x..."
    }
  },
  "server": {
    "port": 3001,
    "corsOrigins": ["http://localhost:3000"]
  }
}
```

## API Reference

### REST API Endpoints

#### Health Check
```
GET /health
Response: {
  "status": "healthy",
  "chains": {...},
  "processedEvents": 1234,
  "relayerAddress": "0x..."
}
```

#### Meta-Transaction Submission
```
POST /api/meta-tx
Body: {
  "metaTx": {
    "from": "0x...",
    "to": "0x...",
    "value": "0",
    "data": "0x...",
    "nonce": 1,
    "deadline": 1234567890
  },
  "signature": "0x...",
  "targetChain": "ethereum"
}
```

#### Credit Balance
```
GET /api/credits/:userAddress
Response: {
  "balance": 1000,
  "balanceUsd": "10.00"
}
```

### JavaScript SDK

#### Basic Usage

```javascript
const { IXFIProvider } = require('@ixfi/sdk');

const provider = new IXFIProvider({
  crossfiRpc: 'https://rpc.testnet.ms',
  ethereumRpc: 'https://mainnet.infura.io/v3/YOUR_KEY',
  relayerUrl: 'http://localhost:3001'
});

// Deposit XFI for IXFI
await provider.deposit('100'); // 100 XFI

// Send cross-chain transaction
await provider.callContract(
  'ethereum',
  '0xTargetContract',
  '0xPayloadData'
);

// Execute gasless transaction
await provider.executeMetaTransaction({
  to: '0xTargetContract',
  data: '0xFunctionCall',
  deadline: Date.now() + 3600000 // 1 hour
});
```

## Security Considerations

### Access Controls

1. **Owner Privileges**:
   - Add/remove relayers
   - Update chain configurations
   - Set oracle addresses
   - Emergency pause functions

2. **Relayer Permissions**:
   - Execute cross-chain commands
   - Submit meta-transactions
   - Access failure recovery mechanisms

3. **Gateway Authorizations**:
   - Consume gas credits
   - Execute meta-transactions on behalf of users

### Attack Vectors & Mitigations

#### 1. Replay Attacks
- **Risk**: Reusing signatures or commands
- **Mitigation**: Nonces, command IDs, deadline validation

#### 2. Oracle Manipulation
- **Risk**: Price feed manipulation for gas credits
- **Mitigation**: Price freshness checks, multiple oracle sources

#### 3. Relayer Compromise
- **Risk**: Malicious relayer executing unauthorized commands
- **Mitigation**: Multi-signature requirements, relayer consensus

#### 4. Cross-chain Race Conditions
- **Risk**: State inconsistency between chains
- **Mitigation**: Atomic operations, compensation mechanisms

### Best Practices

1. **Regular Security Audits**: Schedule periodic security reviews
2. **Monitoring**: Implement comprehensive monitoring and alerting
3. **Gradual Rollout**: Start with limited functionality and scale
4. **Emergency Procedures**: Have emergency pause and recovery mechanisms
5. **Key Management**: Use hardware wallets for critical operations

## Integration Guide

### For dApp Developers

#### 1. Inherit IXFIExecutable

```solidity
pragma solidity ^0.8.20;

import "./IXFIExecutable.sol";

contract MyDApp is IXFIExecutable {
    constructor(address gateway_) IXFIExecutable(gateway_) {}
    
    function _execute(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal override {
        // Handle cross-chain call
        (uint256 value, address recipient) = abi.decode(payload, (uint256, address));
        // Process the cross-chain data
    }
    
    function _executeWithToken(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) internal override {
        // Handle cross-chain call with tokens
        // IXFI tokens are already minted to this contract
    }
}
```

#### 2. Frontend Integration

```javascript
// Initialize IXFI provider
const ixfi = new IXFIProvider({
  rpc: 'https://rpc.testnet.ms',
  relayerUrl: 'http://localhost:3001'
});

// Check user's gas credits
const credits = await ixfi.getCreditBalance(userAddress);

// Execute gasless transaction
const metaTx = {
  from: userAddress,
  to: contractAddress,
  data: encodedFunctionCall,
  nonce: await ixfi.getNonce(userAddress),
  deadline: Date.now() + 3600000
};

const signature = await signer.signTypedData(domain, types, metaTx);
await ixfi.submitMetaTransaction(metaTx, signature, 'ethereum');
```

### For Relayer Operators

#### 1. Hardware Requirements
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Storage**: 100GB+ SSD
- **Network**: Stable internet connection

#### 2. Monitoring Setup

```javascript
// Health monitoring
setInterval(async () => {
  const health = await relayer.getHealth();
  if (health.status !== 'healthy') {
    // Send alerts
    await sendAlert('Relayer unhealthy', health);
  }
}, 30000);
```

#### 3. Backup Strategies
- Regular database backups
- Key management security
- Redundant relayer deployment

### Testing Framework

#### Unit Tests

```javascript
describe("IXFI Cross-Chain", function () {
  it("Should execute cross-chain call", async function () {
    // Setup contracts
    const ixfi = await deployIXFI();
    const target = await deployTarget();
    
    // Execute cross-chain call
    await ixfi.callContract("ethereum", target.address, payload);
    
    // Verify execution
    expect(await target.executed()).to.be.true;
  });
});
```

#### Integration Tests

```javascript
describe("Meta-Transaction Flow", function () {
  it("Should execute gasless transaction", async function () {
    // Setup vault and gateway
    const vault = await deployVault();
    const gateway = await deployGateway();
    
    // User deposits credits
    await vault.deposit(ethers.parseEther("10"));
    
    // Execute meta-transaction
    const metaTx = createMetaTx();
    const signature = await signMetaTx(metaTx);
    await gateway.executeMetaTransaction(metaTx, signature);
    
    // Verify execution and credit deduction
    expect(await target.executed()).to.be.true;
    expect(await vault.getCreditBalance(user.address)).to.be.lt(initialCredits);
  });
});
```

---

This technical documentation provides comprehensive coverage of the IXFI system architecture, deployment procedures, and integration guidelines. For additional support or questions, please refer to the project repository or contact the development team.
