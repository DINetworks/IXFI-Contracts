# Installation

This guide will help you set up the IXFI Protocol for development and integration.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Git**
- **Hardhat** (for smart contract development)

## Environment Setup

### 1. Clone the Repository

```bash
git clone https://github.com/DINetworks/IXFI-Contracts.git
cd IXFI-Contracts
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Environment Configuration

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Configure your environment variables:

```env
# Network RPC URLs
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
BSC_RPC_URL=https://bsc-dataseed1.binance.org/
POLYGON_RPC_URL=https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
OPTIMISM_RPC_URL=https://mainnet.optimism.io
BASE_RPC_URL=https://mainnet.base.org

# Private Keys (for deployment)
DEPLOYER_PRIVATE_KEY=your_private_key_here
RELAYER_PRIVATE_KEY=your_relayer_private_key_here

# API Keys
ETHERSCAN_API_KEY=your_etherscan_api_key
BSCSCAN_API_KEY=your_bscscan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key

# IXFI Configuration
CROSSFI_CHAIN_ID=4157
IXFI_TOKEN_ADDRESS=0x...
```

## Package Installation

### NPM Package

Install the IXFI SDK for frontend integration:

```bash
npm install @ixfi/sdk
# or
yarn add @ixfi/sdk
```

### Smart Contract Dependencies

The contracts use OpenZeppelin and other standard libraries:

```bash
npm install @openzeppelin/contracts
npm install @axelar-network/axelar-gmp-sdk-solidity
```

## Network Configuration

### Supported Networks

The IXFI Protocol is deployed on the following networks:

| Network | Chain ID | RPC URL |
|---------|----------|---------|
| Ethereum | 1 | `https://mainnet.infura.io/v3/YOUR_PROJECT_ID` |
| BSC | 56 | `https://bsc-dataseed1.binance.org/` |
| Polygon | 137 | `https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID` |
| Avalanche | 43114 | `https://api.avax.network/ext/bc/C/rpc` |
| Arbitrum | 42161 | `https://arb1.arbitrum.io/rpc` |
| Optimism | 10 | `https://mainnet.optimism.io` |
| Base | 8453 | `https://mainnet.base.org` |

### Hardhat Configuration

Update your `hardhat.config.js`:

```javascript
require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-etherscan');
require('hardhat-gas-reporter');
require('dotenv').config();

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  networks: {
    ethereum: {
      url: process.env.ETHEREUM_RPC_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 1
    },
    bsc: {
      url: process.env.BSC_RPC_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 56
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 137
    },
    // Add other networks...
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      bsc: process.env.BSCSCAN_API_KEY,
      polygon: process.env.POLYGONSCAN_API_KEY
    }
  }
};
```

## Verification

### Test Installation

Run the test suite to verify everything is working:

```bash
npx hardhat test
```

### Compile Contracts

Compile the smart contracts:

```bash
npx hardhat compile
```

### Local Deployment

Deploy to local Hardhat network:

```bash
npx hardhat node
# In another terminal
npx hardhat run scripts/deploy-simple.js --network localhost
```

## IDE Setup

### VS Code Extensions

Recommended VS Code extensions:

- **Solidity** by Juan Blanco
- **Hardhat for Visual Studio Code**
- **GitBook** (for documentation editing)
- **Prettier - Code formatter**
- **ESLint**

### VS Code Settings

Add to your `settings.json`:

```json
{
  "solidity.defaultCompiler": "localNodeModule",
  "solidity.compileUsingRemoteVersion": "v0.8.24+commit.a1b79de6",
  "solidity.packageDefaultDependenciesContractsDirectory": "contracts",
  "solidity.packageDefaultDependenciesDirectory": "node_modules"
}
```

## Next Steps

Now that you have IXFI installed, you can:

1. **[Follow the Quick Start Guide](quick-start.md)** for basic usage
2. **[Learn Core Concepts](../core-concepts/protocol-overview.md)** to understand the protocol
3. **[Explore Examples](../examples/basic-swap.md)** for integration patterns

## Troubleshooting

### Common Issues

**Node.js Version**
```bash
# Check Node.js version
node --version
# Should be v16 or higher
```

**Dependencies**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Hardhat Compilation**
```bash
# Clear Hardhat cache
npx hardhat clean
npx hardhat compile
```

### Getting Help

If you encounter issues:

1. Check the [Troubleshooting Guide](../resources/troubleshooting.md)
2. Search existing [GitHub Issues](https://github.com/DINetworks/IXFI-Contracts/issues)
3. Join our [Discord community](https://discord.gg/ixfi)
4. Create a new issue with detailed information
