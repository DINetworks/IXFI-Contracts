# IXFI Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Network Configuration](#network-configuration)
4. [Contract Deployment](#contract-deployment)
5. [Relayer Setup](#relayer-setup)
6. [Post-Deployment Configuration](#post-deployment-configuration)
7. [Testing and Validation](#testing-and-validation)
8. [Production Checklist](#production-checklist)

## Prerequisites

### System Requirements
- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0
- **Git**: Latest version
- **Operating System**: Windows/macOS/Linux

### Required Accounts and Access
- **Deployer Wallet**: Funded with native tokens on all target chains
- **Relayer Wallet**: Separate wallet for relayer operations
- **DIA Oracle Access**: Oracle contract addresses for each chain
- **RPC Endpoints**: Reliable RPC access for all chains

### Funding Requirements

| Chain | Estimated Gas Cost | Purpose |
|-------|-------------------|---------|
| CrossFi | 0.1 XFI | Core contracts deployment |
| Ethereum | 0.05 ETH | Gateway and vault deployment |
| BSC | 0.01 BNB | Gateway deployment |
| Polygon | 50 MATIC | Gateway deployment |

## Environment Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/DINetworks/IXFI-Contracts.git
cd IXFI-Contracts

# Install dependencies
npm install

# Install relayer dependencies
cd relayer
npm install
cd ..
```

### 2. Environment Configuration

Create `.env` file in project root:

```bash
# Deployer private key (without 0x prefix)
PRIVATE_KEY=your_deployer_private_key_here

# RPC URLs
CROSSFI_RPC=https://rpc.testnet.ms
ETHEREUM_RPC=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
BSC_RPC=https://bsc-dataseed1.binance.org
POLYGON_RPC=https://polygon-rpc.com

# Optional: Etherscan API keys for verification
ETHERSCAN_API_KEY=your_etherscan_key
BSCSCAN_API_KEY=your_bscscan_key
POLYGONSCAN_API_KEY=your_polygonscan_key

# DIA Oracle addresses (per chain)
CROSSFI_DIA_ORACLE=0x...
ETHEREUM_DIA_ORACLE=0x...
BSC_DIA_ORACLE=0x...
POLYGON_DIA_ORACLE=0x...
```

Create `relayer/.env`:

```bash
# Relayer private key
RELAYER_PRIVATE_KEY=your_relayer_private_key_here

# API configuration
PORT=3001
CORS_ORIGINS=http://localhost:3000,https://your-dapp.com

# Monitoring
HEALTH_CHECK_INTERVAL=30000
MAX_RETRY_ATTEMPTS=3
RETRY_DELAY=5000
```

## Network Configuration

### Hardhat Configuration

Verify `hardhat.config.js` contains all target networks:

```javascript
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    // CrossFi Testnet
    crossfi: {
      chainId: 4157,
      url: process.env.CROSSFI_RPC,
      accounts: [process.env.PRIVATE_KEY]
    },
    // CrossFi Mainnet
    crossfiMainnet: {
      chainId: 4158,
      url: "https://rpc.mainnet.ms",
      accounts: [process.env.PRIVATE_KEY]
    },
    // Ethereum Mainnet
    ethereum: {
      chainId: 1,
      url: process.env.ETHEREUM_RPC,
      accounts: [process.env.PRIVATE_KEY]
    },
    // Ethereum Sepolia
    sepolia: {
      chainId: 11155111,
      url: "https://sepolia.infura.io/v3/" + process.env.INFURA_KEY,
      accounts: [process.env.PRIVATE_KEY]
    },
    // Binance Smart Chain
    bsc: {
      chainId: 56,
      url: process.env.BSC_RPC,
      accounts: [process.env.PRIVATE_KEY]
    },
    // BSC Testnet
    bscTestnet: {
      chainId: 97,
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      accounts: [process.env.PRIVATE_KEY]
    },
    // Polygon Mainnet
    polygon: {
      chainId: 137,
      url: process.env.POLYGON_RPC,
      accounts: [process.env.PRIVATE_KEY]
    },
    // Polygon Mumbai
    mumbai: {
      chainId: 80001,
      url: "https://rpc-mumbai.maticvigil.com",
      accounts: [process.env.PRIVATE_KEY]
    }
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      sepolia: process.env.ETHERSCAN_API_KEY,
      bsc: process.env.BSCSCAN_API_KEY,
      bscTestnet: process.env.BSCSCAN_API_KEY,
      polygon: process.env.POLYGONSCAN_API_KEY,
      polygonMumbai: process.env.POLYGONSCAN_API_KEY
    }
  }
};
```

## Contract Deployment

### 1. Deploy GMP System

#### Step 1: Deploy on CrossFi (Primary Chain)

```bash
# Deploy IXFI gateway on CrossFi
npx hardhat run scripts/deploy-gmp.js --network crossfi
```

Expected output:
```
Deploying IXFI on CrossFi...
IXFI deployed to: 0x1234567890123456789012345678901234567890
Owner: 0xYourDeployerAddress
Initial chains configured: crossfi, ethereum, bsc, polygon
✅ CrossFi deployment complete
```

#### Step 2: Deploy on Other Chains

```bash
# Deploy on Ethereum
npx hardhat run scripts/deploy-gmp.js --network ethereum

# Deploy on BSC
npx hardhat run scripts/deploy-gmp.js --network bsc

# Deploy on Polygon
npx hardhat run scripts/deploy-gmp.js --network polygon
```

### 2. Deploy Meta-Transaction System

#### Step 1: Deploy Vault on CrossFi

```bash
npx hardhat run scripts/deploy-meta-tx.js --network crossfi
```

Expected output:
```
Deploying Meta-Transaction System on CrossFi...
MetaTxGasCreditVault deployed to: 0xAbcdef1234567890123456789012345678901234
DIA Oracle: 0x...
IXFI Token: 0x...
✅ Vault deployment complete
```

#### Step 2: Deploy Gateways on Other Chains

```bash
# Deploy on Ethereum
npx hardhat run scripts/deploy-meta-tx.js --network ethereum

# Deploy on BSC
npx hardhat run scripts/deploy-meta-tx.js --network bsc

# Deploy on Polygon
npx hardhat run scripts/deploy-meta-tx.js --network polygon
```

### 3. Record Deployment Addresses

Create `deployment-addresses.json`:

```json
{
  "networks": {
    "crossfi": {
      "chainId": 4157,
      "ixfi": "0x...",
      "metaTxVault": "0x...",
      "metaTxGateway": "0x..."
    },
    "ethereum": {
      "chainId": 1,
      "ixfi": "0x...",
      "metaTxGateway": "0x..."
    },
    "bsc": {
      "chainId": 56,
      "ixfi": "0x...",
      "metaTxGateway": "0x..."
    },
    "polygon": {
      "chainId": 137,
      "ixfi": "0x...",
      "metaTxGateway": "0x..."
    }
  },
  "oracles": {
    "crossfi": "0x...",
    "ethereum": "0x...",
    "bsc": "0x...",
    "polygon": "0x..."
  }
}
```

## Relayer Setup

### 1. Configure Relayer Accounts

```bash
# Whitelist relayer on all chains
npx hardhat run scripts/whitelist-relayer.js --network crossfi
npx hardhat run scripts/whitelist-relayer.js --network ethereum
npx hardhat run scripts/whitelist-relayer.js --network bsc
npx hardhat run scripts/whitelist-relayer.js --network polygon
```

### 2. Relayer Configuration Files

#### GMP Relayer Config (`relayer/config.json`)

```json
{
  "relayerPrivateKey": "0x...",
  "pollingInterval": 5000,
  "gasLimit": 500000,
  "gasPrice": "auto",
  "chains": {
    "crossfi": {
      "rpc": "https://rpc.testnet.ms",
      "chainId": 4157,
      "ixfiAddress": "0x...",
      "blockConfirmations": 1,
      "startBlock": "latest"
    },
    "ethereum": {
      "rpc": "https://mainnet.infura.io/v3/YOUR_KEY",
      "chainId": 1,
      "ixfiAddress": "0x...",
      "blockConfirmations": 12,
      "startBlock": "latest"
    },
    "bsc": {
      "rpc": "https://bsc-dataseed1.binance.org",
      "chainId": 56,
      "ixfiAddress": "0x...",
      "blockConfirmations": 15,
      "startBlock": "latest"
    },
    "polygon": {
      "rpc": "https://polygon-rpc.com",
      "chainId": 137,
      "ixfiAddress": "0x...",
      "blockConfirmations": 20,
      "startBlock": "latest"
    }
  },
  "logging": {
    "level": "info",
    "file": "logs/gmp-relayer.log"
  }
}
```

#### Meta-Transaction Relayer Config (`relayer/meta-tx-config.json`)

```json
{
  "relayerPrivateKey": "0x...",
  "chains": {
    "crossfi": {
      "rpc": "https://rpc.testnet.ms",
      "vaultAddress": "0x...",
      "gatewayAddress": "0x...",
      "gasPrice": "auto"
    },
    "ethereum": {
      "rpc": "https://mainnet.infura.io/v3/YOUR_KEY",
      "gatewayAddress": "0x...",
      "gasPrice": "auto"
    },
    "bsc": {
      "rpc": "https://bsc-dataseed1.binance.org",
      "gatewayAddress": "0x...",
      "gasPrice": "5000000000"
    },
    "polygon": {
      "rpc": "https://polygon-rpc.com",
      "gatewayAddress": "0x...",
      "gasPrice": "30000000000"
    }
  },
  "server": {
    "port": 3001,
    "corsOrigins": [
      "http://localhost:3000",
      "https://your-dapp.com"
    ]
  },
  "creditManagement": {
    "checkInterval": 30000,
    "minCreditBuffer": 100,
    "maxRetries": 3
  }
}
```

### 3. Start Relayer Services

```bash
cd relayer

# Start GMP relayer
npm run start:gmp

# Start Meta-Transaction relayer (in separate terminal)
npm run start:meta-tx
```

## Post-Deployment Configuration

### 1. Configure Meta-Transaction Vault

```bash
# Authorize gateways to consume credits
npx hardhat run scripts/configure-vault.js --network crossfi
```

Script content:
```javascript
async function main() {
  const vaultAddress = "0x..."; // Your vault address
  const gatewayAddresses = [
    "0x...", // Ethereum gateway
    "0x...", // BSC gateway
    "0x..."  // Polygon gateway
  ];
  
  const vault = await ethers.getContractAt("MetaTxGasCreditVault", vaultAddress);
  
  for (const gateway of gatewayAddresses) {
    await vault.setGatewayAuthorization(gateway, true);
    console.log(`Authorized gateway: ${gateway}`);
  }
}
```

### 2. Configure Chain Registry

```bash
# Update chain configurations if needed
npx hardhat run scripts/update-chains.js --network crossfi
```

### 3. Initial Token Supply

```bash
# Deposit initial XFI to create IXFI supply
npx hardhat run scripts/initial-deposit.js --network crossfi
```

## Testing and Validation

### 1. Unit Tests

```bash
# Run all tests
npm test

# Run specific test suites
npx hardhat test test/test-gmp.js
npx hardhat test test/test-meta-tx-new.js
```

### 2. Integration Testing

```bash
# Test cross-chain functionality
npx hardhat run scripts/test-cross-chain.js --network crossfi

# Test meta-transactions
npx hardhat run scripts/test-meta-tx.js --network ethereum
```

### 3. Relayer Health Check

```bash
# Check GMP relayer
curl http://localhost:3000/health

# Check Meta-TX relayer
curl http://localhost:3001/health
```

Expected responses:
```json
{
  "status": "healthy",
  "chains": {
    "crossfi": "connected",
    "ethereum": "connected",
    "bsc": "connected",
    "polygon": "connected"
  },
  "relayerAddress": "0x...",
  "processedEvents": 0
}
```

### 4. Functional Testing

#### Test Cross-Chain Transfer

```javascript
// Test script
const ixfi = await ethers.getContractAt("IXFI", ixfiAddress);

// Deposit XFI for IXFI
await ixfi.deposit({ value: ethers.parseEther("1.0") });

// Send cross-chain
await ixfi.callContractWithToken(
  "ethereum",
  targetContract,
  payload,
  "IXFI",
  ethers.parseEther("0.5")
);
```

#### Test Meta-Transaction

```javascript
// Test gasless transaction
const response = await fetch('http://localhost:3001/api/meta-tx', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    metaTx: {
      from: userAddress,
      to: targetContract,
      value: "0",
      data: encodedCall,
      nonce: currentNonce,
      deadline: futureTimestamp
    },
    signature: userSignature,
    targetChain: "ethereum"
  })
});
```

## Production Checklist

### Pre-Launch Security

- [ ] **Contract Audits**: Complete security audit by reputable firm
- [ ] **Relayer Security**: Secure key management (HSM/hardware wallets)
- [ ] **Rate Limiting**: Implement API rate limiting for relayers
- [ ] **Monitoring**: Set up comprehensive monitoring and alerts
- [ ] **Emergency Controls**: Test pause mechanisms and emergency procedures

### Operational Readiness

- [ ] **Backup Systems**: Redundant relayer infrastructure
- [ ] **Load Testing**: Stress test under high transaction volume
- [ ] **Documentation**: Complete operational runbooks
- [ ] **Support Team**: Train support team on troubleshooting
- [ ] **Incident Response**: Establish incident response procedures

### Performance Optimization

- [ ] **Gas Optimization**: Optimize contract gas usage
- [ ] **RPC Reliability**: Use reliable RPC providers with failover
- [ ] **Database Scaling**: Ensure relayer database can handle load
- [ ] **CDN Setup**: Use CDN for relayer API endpoints
- [ ] **Caching**: Implement appropriate caching strategies

### Compliance and Legal

- [ ] **Regulatory Review**: Ensure compliance with applicable regulations
- [ ] **Terms of Service**: Publish clear terms and conditions
- [ ] **Privacy Policy**: Comply with data protection requirements
- [ ] **KYC/AML**: Implement if required by jurisdiction
- [ ] **Insurance**: Consider smart contract insurance coverage

### Launch Configuration

#### Production Environment Variables

```bash
# Use mainnet configurations
CROSSFI_RPC=https://rpc.mainnet.ms
ETHEREUM_RPC=https://mainnet.infura.io/v3/YOUR_KEY
BSC_RPC=https://bsc-dataseed1.binance.org
POLYGON_RPC=https://polygon-rpc.com

# Production relayer settings
POLLING_INTERVAL=3000
GAS_PRICE_STRATEGY=fast
MAX_RETRIES=5
CONFIRMATION_BLOCKS=12

# Monitoring
ENABLE_METRICS=true
PROMETHEUS_PORT=9090
LOG_LEVEL=warn
```

#### Mainnet Deployment Commands

```bash
# Deploy to mainnets
npx hardhat run scripts/deploy-gmp.js --network crossfiMainnet
npx hardhat run scripts/deploy-gmp.js --network ethereum
npx hardhat run scripts/deploy-gmp.js --network bsc
npx hardhat run scripts/deploy-gmp.js --network polygon

# Deploy meta-tx system
npx hardhat run scripts/deploy-meta-tx.js --network crossfiMainnet
npx hardhat run scripts/deploy-meta-tx.js --network ethereum
npx hardhat run scripts/deploy-meta-tx.js --network bsc
npx hardhat run scripts/deploy-meta-tx.js --network polygon

# Configure production settings
npx hardhat run scripts/production-setup.js --network crossfiMainnet
```

### Post-Launch Monitoring

#### Key Metrics to Monitor

1. **Cross-Chain Success Rate**: % of successful cross-chain transactions
2. **Relayer Uptime**: Availability of relayer services
3. **Gas Credit Usage**: User adoption of gasless transactions
4. **Oracle Price Accuracy**: DIA oracle price feed reliability
5. **Contract Security**: No unauthorized access or exploits

#### Alerting Thresholds

- Relayer down for > 5 minutes
- Cross-chain failure rate > 5%
- Gas price spike > 200% of average
- Oracle price deviation > 10%
- Contract balance changes unexpectedly

### Maintenance Procedures

#### Regular Maintenance

- Weekly relayer log analysis
- Monthly security parameter review
- Quarterly disaster recovery testing
- Annual security audit updates

#### Emergency Procedures

1. **Contract Pause**: How to pause contracts in emergency
2. **Relayer Shutdown**: Safe relayer shutdown procedures
3. **Fund Recovery**: Emergency fund recovery mechanisms
4. **Communication**: User communication during incidents

This deployment guide provides a comprehensive path from development to production for the IXFI system. Follow each step carefully and maintain thorough documentation throughout the process.
