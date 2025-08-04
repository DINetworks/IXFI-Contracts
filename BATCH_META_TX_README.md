# IXFI Batch Meta-Transaction System

This document describes the updated IXFI Meta-Transaction system with batch processing capabilities, improved gas tracking, and comprehensive transaction logging.

## System Overview

The IXFI Meta-Transaction system consists of two main contracts:

1. **MetaTxGasCreditVault** - Manages gas credits using IXFI tokens (deployed only on CrossFi)
2. **MetaTxGateway** - Executes meta-transactions with batch processing (deployed on all supported chains)

## Key Features

### ✅ Batch Processing
- Process multiple meta-transactions in a single batch
- Single nonce, deadline, and signature for the entire batch
- Atomic execution with individual transaction success tracking
- Comprehensive batch logging and storage

### ✅ Gas Tracking
- Accurate gas measurement for entire batches
- Chain-specific gas cost calculations
- Real-time price feed integration
- Credit consumption based on actual costs

### ✅ Data Storage & Retrieval
- Complete batch transaction logs stored on-chain
- Decoded transaction arrays for easy access
- Historical batch information retrieval
- Success/failure tracking per transaction

### ✅ Multi-Chain Support
- CrossFi as the credit management hub
- Deployable gateways on any EVM chain
- Relayer coordination across chains
- Chain-specific gas price handling

## Contract Architecture

### MetaTxGasCreditVault (CrossFi Only)

```solidity
// Deposit IXFI tokens for gas credits
function deposit(uint256 amount) external

// Deposit XFI directly (converts to IXFI)  
function deposit() external payable

// Calculate credits needed for gas usage
function calculateCreditsForGas(
    uint256 gasUsed,
    uint256 gasPrice, 
    uint256 nativeTokenPriceUsd
) external pure returns (uint256)

// Consume credits for meta-transactions
function consumeCredits(address user, uint256 gasUsd) external returns (bool)
```

### MetaTxGateway (All Chains)

```solidity
// Execute batch of meta-transactions
function executeMetaTransactions(
    address from,
    bytes calldata metaTxData,
    bytes calldata signature,
    uint256 nonce,
    uint256 deadline
) external returns (bool[] memory successes)

// Retrieve batch information
function getBatchTransactionLog(uint256 batchId) external view
function getBatchTransactions(uint256 batchId) external view  
function getBatchSuccesses(uint256 batchId) external view
```

## Usage Examples

### 1. User Deposits IXFI for Gas Credits

```javascript
// Approve IXFI for deposit
await ixfi.approve(vaultAddress, depositAmount);

// Deposit IXFI tokens
await vault.deposit(depositAmount);

// Check credit balance (in USD cents)
const credits = await vault.getCreditBalance(userAddress);
```

### 2. Creating Batch Meta-Transactions

```javascript
// Define batch transactions
const metaTxs = [
    {
        to: contractAddress1,
        value: 0,
        data: contract1.interface.encodeFunctionData("method1", [param1])
    },
    {
        to: contractAddress2, 
        value: 0,
        data: contract2.interface.encodeFunctionData("method2", [param2])
    }
];

// Encode for signature
const metaTxData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["tuple(address to,uint256 value,bytes data)[]"],
    [metaTxs]
);
```

### 3. EIP-712 Signature Creation

```javascript
const domain = {
    name: "MetaTxGateway",
    version: "1", 
    chainId: chainId,
    verifyingContract: gatewayAddress
};

const types = {
    BatchTransaction: [
        { name: "from", type: "address" },
        { name: "metaTxData", type: "bytes" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" }
    ]
};

const value = {
    from: userAddress,
    metaTxData: metaTxData,
    nonce: nonce,
    deadline: deadline
};

const signature = await user.signTypedData(domain, types, value);
```

### 4. Relayer Execution

```javascript
// Check user credits
const hasCredits = await vault.hasEnoughCredits(userAddress, estimatedGasUsd);

// Execute batch if user has credits
const tx = await gateway.executeMetaTransactions(
    userAddress,
    metaTxData, 
    signature,
    nonce,
    deadline
);

// Deduct credits after execution
await vault.consumeCredits(userAddress, actualGasUsd);
```

## Deployment Guide

### 1. Deploy on CrossFi (Main Chain)

```bash
# Set environment variables
export IXFI_ADDRESS="0x..."
export DIA_ORACLE="0x..."
export RELAYER_ADDRESS="0x..."

# Deploy both contracts
npx hardhat run scripts/deploy-meta-tx.js --network crossfi
```

### 2. Deploy on Other Chains

```bash
# Deploy only MetaTxGateway
npx hardhat run scripts/deploy-meta-tx.js --network ethereum
npx hardhat run scripts/deploy-meta-tx.js --network polygon
npx hardhat run scripts/deploy-meta-tx.js --network bsc
```

### 3. Configure Relayer

```json
{
  "relayerPrivateKey": "0x...",
  "chains": {
    "crossfi": {
      "rpc": "https://rpc.crossfi.org",
      "gasCreditVault": "0x...",
      "metaTxGateway": "0x..."
    },
    "ethereum": {
      "rpc": "https://eth-mainnet.g.alchemy.com/v2/...",
      "metaTxGateway": "0x..."
    }
  }
}
```

## Testing

### Run Batch Transaction Tests

```bash
# Run comprehensive batch tests
npx hardhat test test/test-batch-meta-tx.js

# Run original meta-tx tests
npx hardhat test test/test-meta-tx-new.js
```

### Test Example Script

```bash
# Set contract addresses
export VAULT_ADDRESS="0x..."
export GATEWAY_ADDRESS="0x..."
export TARGET_CONTRACT="0x..."

# Run example
npx hardhat run scripts/batch-meta-tx-example.js --network crossfi
```

## Relayer Integration

### Start Relayer Service

```javascript
const MetaTxRelayer = require('./relayer/MetaTxRelayer');
const config = require('./relayer/batch-config.json');

const relayer = new MetaTxRelayer(config);

// Process batch meta-transaction
const result = await relayer.executeBatchMetaTransactions({
    targetChain: "ethereum",
    metaTxs: [...],
    signature: "0x...",
    from: userAddress,
    nonce: userNonce,
    deadline: deadline
});
```

### API Endpoints

```bash
# Health check
GET /health

# Execute batch meta-transaction
POST /batch-meta-tx
{
  "targetChain": "ethereum",
  "metaTxs": [...],
  "signature": "0x...",
  "from": "0x...",
  "nonce": 1,
  "deadline": 1640995200
}

# Get relayer metrics
GET /metrics
```

## Gas Cost Calculation

The system calculates gas costs using the formula:

```
USD Cost = gasUsed × gasPrice × nativeTokenPrice / 1e18 × 100 (for cents)
```

Where:
- `gasUsed`: Actual gas consumed
- `gasPrice`: Network gas price in wei
- `nativeTokenPrice`: Native token price in USD (8 decimals)
- Result is in USD cents for precise accounting

## Event Tracking

### Batch Events

```solidity
event BatchTransactionExecuted(
    uint256 indexed batchId,
    address indexed user,
    address indexed relayer,
    uint256 gasUsed,
    uint256 transactionCount
);
```

### Individual Transaction Events

```solidity
event MetaTransactionExecuted(
    address indexed user,
    address indexed relayer,
    address indexed target,
    bool success
);
```

### Credit Events

```solidity
event CreditsUsed(
    address indexed user,
    address indexed gateway,
    uint256 creditsUsed,
    uint256 gasUsd
);
```

## Security Considerations

1. **Signature Verification**: EIP-712 signatures prevent replay attacks
2. **Nonce Management**: Sequential nonces prevent transaction replay
3. **Deadline Enforcement**: Time-bound transactions prevent stale execution
4. **Relayer Authorization**: Only authorized relayers can execute transactions
5. **Gateway Authorization**: Only authorized gateways can consume credits
6. **Reentrancy Protection**: All state-changing functions use ReentrancyGuard

## Error Handling

### Common Error Scenarios

1. **Insufficient Credits**: User doesn't have enough gas credits
2. **Invalid Signature**: EIP-712 signature verification fails
3. **Expired Deadline**: Transaction submitted after deadline
4. **Invalid Nonce**: Nonce doesn't match expected value
5. **Unauthorized Relayer**: Relayer not authorized for gateway
6. **Transaction Failure**: Individual transactions in batch may fail

### Error Recovery

- Batch execution continues even if individual transactions fail
- Failed transactions are marked in the success array
- Credits are only consumed for successful batch execution
- Partial batch success is tracked and logged

## Monitoring & Metrics

### Relayer Metrics

- Total transactions processed
- Success/failure rates
- Gas usage statistics
- Credit consumption tracking
- Processing time metrics
- Error frequency

### Health Checks

- RPC endpoint connectivity
- Contract interaction status
- Balance monitoring
- Price feed freshness

## Future Enhancements

1. **Dynamic Gas Pricing**: Real-time gas price optimization
2. **Batch Optimization**: Intelligent transaction ordering
3. **Multi-Relayer Support**: Distributed relayer network
4. **Advanced Analytics**: Detailed usage statistics
5. **Mobile SDK**: Easy integration for mobile apps
6. **Cross-Chain Messaging**: Enhanced multi-chain coordination

---

For more information, see the individual contract documentation and example scripts in the `/scripts` directory.
