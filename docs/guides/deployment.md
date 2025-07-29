# Deployment Guide

This comprehensive guide covers deploying IXFI Protocol contracts across multiple blockchain networks, including configuration, testing, and production deployment strategies.

## Overview

IXFI Protocol deployment involves multiple components:

1. **Core Contracts**: IXFI Gateway, Cross-Chain Aggregator, Meta-Transaction Gateway
2. **Network-Specific Configurations**: Chain-specific parameters and addresses
3. **Cross-Chain Setup**: Axelar integration and relayer configuration
4. **Monitoring & Verification**: Contract verification and monitoring setup

## Prerequisites

### Development Environment

```bash
# Node.js and npm
node --version  # v16+ required
npm --version

# Git
git --version

# Hardhat
npm install -g hardhat

# Optional: Foundry for advanced testing
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Required Accounts & Keys

```bash
# Environment variables (.env file)
PRIVATE_KEY=your_deployer_private_key
ETHERSCAN_API_KEY=your_etherscan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key
BSCSCAN_API_KEY=your_bscscan_api_key
ARBISCAN_API_KEY=your_arbiscan_api_key
OPTIMISTIC_API_KEY=your_optimistic_etherscan_api_key
SNOWTRACE_API_KEY=your_snowtrace_api_key

# RPC endpoints
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/your_infura_key
POLYGON_RPC_URL=https://polygon-rpc.com
BSC_RPC_URL=https://bsc-dataseed.binance.org
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
OPTIMISM_RPC_URL=https://mainnet.optimism.io
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc

# Axelar configuration
AXELAR_GATEWAY_ETHEREUM=0x4F4495243837681061C4743b74B3eEdf548D56A5
AXELAR_GATEWAY_POLYGON=0x6f015F16De9fC8791b234eF68D486d2bF203FBA8
AXELAR_GATEWAY_BSC=0x304acf330bbE08d1e512eefaa92F6a57871fD895
AXELAR_GATEWAY_ARBITRUM=0xe432150cce91c13a887f7D836923d5597adD8E31
AXELAR_GATEWAY_OPTIMISM=0xe432150cce91c13a887f7D836923d5597adD8E31
AXELAR_GATEWAY_AVALANCHE=0x5029C0EFf6C34351a0CEc334542cDb22c7928f78

# Gas service addresses
AXELAR_GAS_ETHEREUM=0x2d5d7d31F671F86C782533cc367F14109a082712
AXELAR_GAS_POLYGON=0x2d5d7d31F671F86C782533cc367F14109a082712
AXELAR_GAS_BSC=0x2d5d7d31F671F86C782533cc367F14109a082712
AXELAR_GAS_ARBITRUM=0x2d5d7d31F671F86C782533cc367F14109a082712
AXELAR_GAS_OPTIMISM=0x2d5d7d31F671F86C782533cc367F14109a082712
AXELAR_GAS_AVALANCHE=0x2d5d7d31F671F86C782533cc367F14109a082712
```

## Project Setup

### 1. Initialize Project Structure

```bash
# Clone or create project
git clone https://github.com/ixfi/ixfi-contracts.git
cd ixfi-contracts

# Install dependencies
npm install

# Create deployment directories
mkdir -p deployments
mkdir -p deployments/mainnet
mkdir -p deployments/testnet
mkdir -p scripts/deploy
mkdir -p scripts/verify
mkdir -p scripts/configure
```

### 2. Hardhat Configuration

```javascript
// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-deploy");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      metadata: {
        // Reduce bytecode size
        bytecodeHash: "none"
      }
    }
  },

  networks: {
    hardhat: {
      chainId: 31337,
      forking: {
        url: process.env.ETHEREUM_RPC_URL,
        blockNumber: 18500000 // Pin to specific block for consistency
      }
    },

    // Mainnets
    ethereum: {
      url: process.env.ETHEREUM_RPC_URL,
      chainId: 1,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      gasPrice: 20000000000, // 20 gwei
      verify: {
        etherscan: {
          apiKey: process.env.ETHERSCAN_API_KEY
        }
      }
    },

    polygon: {
      url: process.env.POLYGON_RPC_URL,
      chainId: 137,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      gasPrice: 30000000000, // 30 gwei
      verify: {
        etherscan: {
          apiKey: process.env.POLYGONSCAN_API_KEY,
          apiUrl: "https://api.polygonscan.com"
        }
      }
    },

    bsc: {
      url: process.env.BSC_RPC_URL,
      chainId: 56,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      gasPrice: 5000000000, // 5 gwei
      verify: {
        etherscan: {
          apiKey: process.env.BSCSCAN_API_KEY,
          apiUrl: "https://api.bscscan.com"
        }
      }
    },

    arbitrum: {
      url: process.env.ARBITRUM_RPC_URL,
      chainId: 42161,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      verify: {
        etherscan: {
          apiKey: process.env.ARBISCAN_API_KEY,
          apiUrl: "https://api.arbiscan.io"
        }
      }
    },

    optimism: {
      url: process.env.OPTIMISM_RPC_URL,
      chainId: 10,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      verify: {
        etherscan: {
          apiKey: process.env.OPTIMISTIC_API_KEY,
          apiUrl: "https://api-optimistic.etherscan.io"
        }
      }
    },

    avalanche: {
      url: process.env.AVALANCHE_RPC_URL,
      chainId: 43114,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      verify: {
        etherscan: {
          apiKey: process.env.SNOWTRACE_API_KEY,
          apiUrl: "https://api.snowtrace.io"
        }
      }
    },

    // Testnets
    goerli: {
      url: process.env.GOERLI_RPC_URL,
      chainId: 5,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    },

    mumbai: {
      url: process.env.MUMBAI_RPC_URL,
      chainId: 80001,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    },

    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    }
  },

  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      polygon: process.env.POLYGONSCAN_API_KEY,
      bsc: process.env.BSCSCAN_API_KEY,
      arbitrumOne: process.env.ARBISCAN_API_KEY,
      optimisticEthereum: process.env.OPTIMISTIC_API_KEY,
      avalanche: process.env.SNOWTRACE_API_KEY
    }
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    gasPrice: 20
  },

  namedAccounts: {
    deployer: {
      default: 0
    },
    owner: {
      default: 1
    }
  },

  paths: {
    deploy: "scripts/deploy",
    deployments: "deployments"
  }
};
```

### 3. Deployment Configuration

```javascript
// config/deployment.js
const deploymentConfig = {
  ethereum: {
    chainId: 1,
    axelarGateway: "0x4F4495243837681061C4743b74B3eEdf548D56A5",
    axelarGasService: "0x2d5d7d31F671F86C782533cc367F14109a082712",
    gasOracle: "0x...", // DIA Oracle or Chainlink
    supportedTokens: [
      {
        symbol: "USDC",
        address: "0xA0b86a33E6441e1a02c4e4670dd96EA0f25A632",
        decimals: 6
      },
      {
        symbol: "USDT", 
        address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        decimals: 6
      },
      {
        symbol: "WETH",
        address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        decimals: 18
      }
    ],
    dexRouters: {
      uniswapV2: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
      uniswapV3: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      sushiswap: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
      curve: "0x99a58482BD75cbab83b27EC03CA68fF489b5788f",
      balancer: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
      oneInch: "0x1111111254fb6c44bAC0beD2854e76F90643097d"
    }
  },

  polygon: {
    chainId: 137,
    axelarGateway: "0x6f015F16De9fC8791b234eF68D486d2bF203FBA8",
    axelarGasService: "0x2d5d7d31F671F86C782533cc367F14109a082712",
    gasOracle: "0x...",
    supportedTokens: [
      {
        symbol: "USDC",
        address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
        decimals: 6
      },
      {
        symbol: "USDT",
        address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
        decimals: 6
      },
      {
        symbol: "WMATIC",
        address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
        decimals: 18
      }
    ],
    dexRouters: {
      uniswapV2: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff", // QuickSwap
      uniswapV3: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      sushiswap: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
      curve: "0x445FE580eF8d70FF569aB36e80c647af338db351",
      balancer: "0xBA12222222228d8Ba445958a75a0704d566BF2C8"
    }
  },

  bsc: {
    chainId: 56,
    axelarGateway: "0x304acf330bbE08d1e512eefaa92F6a57871fD895",
    axelarGasService: "0x2d5d7d31F671F86C782533cc367F14109a082712",
    gasOracle: "0x...",
    supportedTokens: [
      {
        symbol: "USDC",
        address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
        decimals: 18
      },
      {
        symbol: "USDT",
        address: "0x55d398326f99059fF775485246999027B3197955",
        decimals: 18
      },
      {
        symbol: "WBNB",
        address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        decimals: 18
      }
    ],
    dexRouters: {
      pancakeswapV2: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
      pancakeswapV3: "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4",
      biswap: "0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8",
      apeswap: "0xcF0feBd3f17CEf5b47b0cD257aCf6025c5BFf3b7"
    }
  }

  // Add configurations for other networks...
};

module.exports = deploymentConfig;
```

## Deployment Scripts

### 1. Main Deployment Script

```javascript
// scripts/deploy/01-deploy-core.js
const { ethers, network } = require("hardhat");
const deploymentConfig = require("../../config/deployment");

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkConfig = deploymentConfig[network.name];

  if (!networkConfig) {
    throw new Error(`No configuration found for network: ${network.name}`);
  }

  console.log(`Deploying to ${network.name} (Chain ID: ${networkConfig.chainId})`);
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(await deployer.getBalance()));

  const deploymentData = {
    network: network.name,
    chainId: networkConfig.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {}
  };

  // 1. Deploy Mock DIA Oracle (for testing)
  console.log("\n1. Deploying Mock DIA Oracle...");
  const MockDIAOracle = await ethers.getContractFactory("MockDIAOracle");
  const mockOracle = await MockDIAOracle.deploy();
  await mockOracle.deployed();
  
  console.log("Mock DIA Oracle deployed to:", mockOracle.address);
  deploymentData.contracts.mockOracle = mockOracle.address;

  // 2. Deploy IXFI Token
  console.log("\n2. Deploying IXFI Token...");
  const IXFI = await ethers.getContractFactory("IXFI");
  const ixfiToken = await IXFI.deploy();
  await ixfiToken.deployed();
  
  console.log("IXFI Token deployed to:", ixfiToken.address);
  deploymentData.contracts.ixfiToken = ixfiToken.address;

  // 3. Deploy Cross-Chain Aggregator
  console.log("\n3. Deploying Cross-Chain Aggregator...");
  const CrossChainAggregator = await ethers.getContractFactory("CrossChainAggregator");
  
  const routerAddresses = Object.values(networkConfig.dexRouters);
  const routerTypes = Object.keys(networkConfig.dexRouters).map((_, index) => index);

  const aggregator = await CrossChainAggregator.deploy(
    networkConfig.axelarGateway,
    networkConfig.axelarGasService,
    mockOracle.address,
    routerAddresses,
    routerTypes
  );
  await aggregator.deployed();
  
  console.log("Cross-Chain Aggregator deployed to:", aggregator.address);
  deploymentData.contracts.aggregator = aggregator.address;

  // 4. Deploy Meta-Transaction Gas Credit Vault
  console.log("\n4. Deploying Meta-Transaction Gas Credit Vault...");
  const MetaTxGasCreditVault = await ethers.getContractFactory("MetaTxGasCreditVault");
  const gasCreditVault = await MetaTxGasCreditVault.deploy(
    ixfiToken.address,
    mockOracle.address
  );
  await gasCreditVault.deployed();
  
  console.log("Meta-Tx Gas Credit Vault deployed to:", gasCreditVault.address);
  deploymentData.contracts.gasCreditVault = gasCreditVault.address;

  // 5. Deploy Meta-Transaction Gateway
  console.log("\n5. Deploying Meta-Transaction Gateway...");
  const MetaTxGateway = await ethers.getContractFactory("MetaTxGateway");
  const metaTxGateway = await MetaTxGateway.deploy(
    aggregator.address,
    gasCreditVault.address,
    networkConfig.axelarGateway,
    networkConfig.axelarGasService
  );
  await metaTxGateway.deployed();
  
  console.log("Meta-Transaction Gateway deployed to:", metaTxGateway.address);
  deploymentData.contracts.metaTxGateway = metaTxGateway.address;

  // 6. Deploy IXFI Executable (for cross-chain calls)
  console.log("\n6. Deploying IXFI Executable...");
  const IXFIExecutable = await ethers.getContractFactory("IXFIExecutable");
  const ixfiExecutable = await IXFIExecutable.deploy(
    networkConfig.axelarGateway,
    networkConfig.axelarGasService,
    aggregator.address
  );
  await ixfiExecutable.deployed();
  
  console.log("IXFI Executable deployed to:", ixfiExecutable.address);
  deploymentData.contracts.ixfiExecutable = ixfiExecutable.address;

  // 7. Deploy Swap Calldata Generator
  console.log("\n7. Deploying Swap Calldata Generator...");
  const SwapCalldataGenerator = await ethers.getContractFactory("SwapCalldataGenerator");
  const calldataGenerator = await SwapCalldataGenerator.deploy();
  await calldataGenerator.deployed();
  
  console.log("Swap Calldata Generator deployed to:", calldataGenerator.address);
  deploymentData.contracts.calldataGenerator = calldataGenerator.address;

  // 8. Configuration
  console.log("\n8. Configuring contracts...");
  
  // Set gas credit vault in meta-tx gateway
  await metaTxGateway.setGasCreditVault(gasCreditVault.address);
  console.log("✓ Gas credit vault set in meta-tx gateway");

  // Set aggregator in IXFI executable
  await ixfiExecutable.setAggregator(aggregator.address);
  console.log("✓ Aggregator set in IXFI executable");

  // Configure supported tokens
  for (const token of networkConfig.supportedTokens) {
    await aggregator.addSupportedToken(token.address, token.symbol);
    console.log(`✓ Added supported token: ${token.symbol} (${token.address})`);
  }

  // Set initial gas prices in oracle
  await mockOracle.setPrice("gwei", ethers.utils.parseUnits("20", "gwei"));
  console.log("✓ Set initial gas price in oracle");

  // Save deployment data
  const fs = require("fs");
  const deploymentPath = `deployments/${network.name}`;
  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath, { recursive: true });
  }
  
  fs.writeFileSync(
    `${deploymentPath}/deployment.json`,
    JSON.stringify(deploymentData, null, 2)
  );

  console.log("\n✅ Deployment completed successfully!");
  console.log("📄 Deployment data saved to:", `${deploymentPath}/deployment.json`);
  
  return deploymentData;
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Deployment failed:", error);
      process.exit(1);
    });
}

module.exports = main;
```

### 2. Contract Verification Script

```javascript
// scripts/verify/verify-contracts.js
const { run, network } = require("hardhat");
const fs = require("fs");

async function main() {
  const deploymentPath = `deployments/${network.name}/deployment.json`;
  
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`No deployment data found for ${network.name}`);
  }

  const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const contracts = deploymentData.contracts;

  console.log(`Verifying contracts on ${network.name}...`);

  // Verification data
  const verifications = [
    {
      name: "MockDIAOracle",
      address: contracts.mockOracle,
      constructorArguments: []
    },
    {
      name: "IXFI",
      address: contracts.ixfiToken,
      constructorArguments: []
    },
    {
      name: "CrossChainAggregator", 
      address: contracts.aggregator,
      constructorArguments: [
        // Constructor args from deployment config
      ]
    },
    {
      name: "MetaTxGasCreditVault",
      address: contracts.gasCreditVault,
      constructorArguments: [
        contracts.ixfiToken,
        contracts.mockOracle
      ]
    },
    {
      name: "MetaTxGateway",
      address: contracts.metaTxGateway,
      constructorArguments: [
        contracts.aggregator,
        contracts.gasCreditVault,
        // Axelar gateway and gas service addresses
      ]
    },
    {
      name: "IXFIExecutable",
      address: contracts.ixfiExecutable,
      constructorArguments: [
        // Axelar gateway, gas service, aggregator
      ]
    },
    {
      name: "SwapCalldataGenerator",
      address: contracts.calldataGenerator,
      constructorArguments: []
    }
  ];

  for (const verification of verifications) {
    try {
      console.log(`\nVerifying ${verification.name} at ${verification.address}...`);
      
      await run("verify:verify", {
        address: verification.address,
        constructorArguments: verification.constructorArguments
      });
      
      console.log(`✅ ${verification.name} verified successfully`);
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log(`✓ ${verification.name} already verified`);
      } else {
        console.error(`❌ Failed to verify ${verification.name}:`, error.message);
      }
    }
  }

  console.log("\n🎉 Verification process completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  });
```

### 3. Multi-Chain Deployment Script

```javascript
// scripts/deploy/deploy-multichain.js
const { spawn } = require("child_process");
const deploymentConfig = require("../../config/deployment");

const networks = ["ethereum", "polygon", "bsc", "arbitrum", "optimism", "avalanche"];

async function deployToNetwork(network) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Starting deployment to ${network}...`);
    
    const deployProcess = spawn("npx", ["hardhat", "run", "scripts/deploy/01-deploy-core.js", "--network", network], {
      stdio: "inherit"
    });

    deployProcess.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ ${network} deployment completed successfully`);
        resolve();
      } else {
        console.error(`❌ ${network} deployment failed with code ${code}`);
        reject(new Error(`Deployment to ${network} failed`));
      }
    });

    deployProcess.on("error", (error) => {
      console.error(`❌ ${network} deployment error:`, error);
      reject(error);
    });
  });
}

async function verifyNetwork(network) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔍 Starting verification on ${network}...`);
    
    const verifyProcess = spawn("npx", ["hardhat", "run", "scripts/verify/verify-contracts.js", "--network", network], {
      stdio: "inherit"
    });

    verifyProcess.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ ${network} verification completed successfully`);
        resolve();
      } else {
        console.error(`❌ ${network} verification failed with code ${code}`);
        resolve(); // Don't fail the entire process for verification failures
      }
    });

    verifyProcess.on("error", (error) => {
      console.error(`❌ ${network} verification error:`, error);
      resolve(); // Don't fail the entire process for verification failures
    });
  });
}

async function main() {
  console.log("🌐 Starting multi-chain deployment to all networks...");
  console.log("Networks:", networks.join(", "));

  const deploymentResults = [];
  const verificationResults = [];

  // Deploy to all networks sequentially
  for (const network of networks) {
    try {
      await deployToNetwork(network);
      deploymentResults.push({ network, status: "success" });
      
      // Wait a bit before verification
      console.log(`⏰ Waiting 30 seconds before verification on ${network}...`);
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      await verifyNetwork(network);
      verificationResults.push({ network, status: "success" });
    } catch (error) {
      console.error(`❌ Failed to deploy to ${network}:`, error.message);
      deploymentResults.push({ network, status: "failed", error: error.message });
    }
  }

  // Summary
  console.log("\n📊 Deployment Summary:");
  console.log("=====================");
  
  deploymentResults.forEach(result => {
    const status = result.status === "success" ? "✅" : "❌";
    console.log(`${status} ${result.network}: ${result.status}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log("\n📊 Verification Summary:");
  console.log("=======================");
  
  verificationResults.forEach(result => {
    const status = result.status === "success" ? "✅" : "❌";
    console.log(`${status} ${result.network}: ${result.status}`);
  });

  const successfulDeployments = deploymentResults.filter(r => r.status === "success").length;
  const totalNetworks = networks.length;
  
  console.log(`\n🎯 Deployment completed: ${successfulDeployments}/${totalNetworks} networks successful`);
  
  if (successfulDeployments === totalNetworks) {
    console.log("🎉 All deployments completed successfully!");
  } else {
    console.log("⚠️  Some deployments failed. Check the logs above for details.");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Multi-chain deployment failed:", error);
    process.exit(1);
  });
```

## Configuration & Setup

### 1. Post-Deployment Configuration

```javascript
// scripts/configure/post-deployment.js
const { ethers, network } = require("hardhat");
const fs = require("fs");

async function main() {
  const deploymentData = JSON.parse(
    fs.readFileSync(`deployments/${network.name}/deployment.json`, "utf8")
  );

  const [deployer] = await ethers.getSigners();
  console.log(`Configuring contracts on ${network.name}...`);

  // Get contract instances
  const aggregator = await ethers.getContractAt("CrossChainAggregator", deploymentData.contracts.aggregator);
  const metaTxGateway = await ethers.getContractAt("MetaTxGateway", deploymentData.contracts.metaTxGateway);
  const gasCreditVault = await ethers.getContractAt("MetaTxGasCreditVault", deploymentData.contracts.gasCreditVault);

  // 1. Configure cross-chain destinations
  console.log("\n1. Configuring cross-chain destinations...");
  
  const crossChainConfigs = [
    { chain: "ethereum", gateway: "0x4F4495243837681061C4743b74B3eEdf548D56A5" },
    { chain: "polygon", gateway: "0x6f015F16De9fC8791b234eF68D486d2bF203FBA8" },
    { chain: "bsc", gateway: "0x304acf330bbE08d1e512eefaa92F6a57871fD895" },
    { chain: "arbitrum", gateway: "0xe432150cce91c13a887f7D836923d5597adD8E31" },
    { chain: "optimism", gateway: "0xe432150cce91c13a887f7D836923d5597adD8E31" },
    { chain: "avalanche", gateway: "0x5029C0EFf6C34351a0CEc334542cDb22c7928f78" }
  ];

  for (const config of crossChainConfigs) {
    if (config.chain !== network.name) {
      await aggregator.setTrustedRemoteAddress(config.chain, config.gateway);
      console.log(`✓ Set trusted remote for ${config.chain}`);
    }
  }

  // 2. Configure gas parameters
  console.log("\n2. Configuring gas parameters...");
  
  await gasCreditVault.setGasPrice(ethers.utils.parseUnits("20", "gwei"));
  await gasCreditVault.setConversionRate(ethers.utils.parseUnits("2000", 18)); // 1 IXFI = 2000 gas units
  console.log("✓ Gas parameters configured");

  // 3. Set up relayer permissions
  console.log("\n3. Setting up relayer permissions...");
  
  const relayerAddress = "0x..."; // Your relayer address
  await metaTxGateway.setRelayerStatus(relayerAddress, true);
  console.log("✓ Relayer permissions set");

  // 4. Configure fee parameters
  console.log("\n4. Configuring fee parameters...");
  
  await aggregator.setProtocolFee(30); // 0.3%
  await aggregator.setFeeRecipient(deployer.address);
  console.log("✓ Fee parameters configured");

  console.log("\n✅ Post-deployment configuration completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Configuration failed:", error);
    process.exit(1);
  });
```

### 2. Relayer Setup

```javascript
// scripts/configure/setup-relayer.js
const { ethers, network } = require("hardhat");

async function main() {
  console.log(`Setting up relayer for ${network.name}...`);

  // Deploy relayer configuration
  const relayerConfig = {
    network: network.name,
    rpcUrl: network.config.url,
    privateKey: process.env.RELAYER_PRIVATE_KEY,
    contracts: {
      metaTxGateway: "0x...", // From deployment
      gasCreditVault: "0x...",
      aggregator: "0x..."
    },
    gasPrice: {
      maxGasPrice: "50000000000", // 50 gwei
      gasMultiplier: 1.2
    },
    monitoring: {
      enabled: true,
      alertThreshold: "1000000000000000000" // 1 ETH
    }
  };

  // Save relayer configuration
  const fs = require("fs");
  fs.writeFileSync(
    `relayer/config/${network.name}.json`,
    JSON.stringify(relayerConfig, null, 2)
  );

  console.log("✅ Relayer configuration saved");
}

main().catch(console.error);
```

## Testing Deployment

### 1. Integration Tests

```javascript
// test/integration/deployment.test.js
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const fs = require("fs");

describe("Deployment Integration Tests", function () {
  let contracts = {};
  let deployer, user1, user2;

  before(async function () {
    [deployer, user1, user2] = await ethers.getSigners();

    // Load deployment data
    const deploymentData = JSON.parse(
      fs.readFileSync(`deployments/${network.name}/deployment.json`, "utf8")
    );

    // Get contract instances
    contracts.ixfiToken = await ethers.getContractAt("IXFI", deploymentData.contracts.ixfiToken);
    contracts.aggregator = await ethers.getContractAt("CrossChainAggregator", deploymentData.contracts.aggregator);
    contracts.metaTxGateway = await ethers.getContractAt("MetaTxGateway", deploymentData.contracts.metaTxGateway);
    contracts.gasCreditVault = await ethers.getContractAt("MetaTxGasCreditVault", deploymentData.contracts.gasCreditVault);
  });

  describe("Contract Deployment", function () {
    it("Should have deployed all contracts", function () {
      expect(contracts.ixfiToken.address).to.be.properAddress;
      expect(contracts.aggregator.address).to.be.properAddress;
      expect(contracts.metaTxGateway.address).to.be.properAddress;
      expect(contracts.gasCreditVault.address).to.be.properAddress;
    });

    it("Should have correct initial configuration", async function () {
      const protocolFee = await contracts.aggregator.protocolFee();
      expect(protocolFee).to.equal(30); // 0.3%

      const feeRecipient = await contracts.aggregator.feeRecipient();
      expect(feeRecipient).to.equal(deployer.address);
    });
  });

  describe("Basic Functionality", function () {
    it("Should be able to swap tokens", async function () {
      // Test basic swap functionality
      // This would require setting up mock tokens or using mainnet fork
    });

    it("Should be able to deposit gas credits", async function () {
      const depositAmount = ethers.utils.parseEther("100");
      
      // First approve tokens
      await contracts.ixfiToken.connect(user1).approve(contracts.gasCreditVault.address, depositAmount);
      
      // Then deposit
      await contracts.gasCreditVault.connect(user1).depositGasCredit(depositAmount);
      
      const userCredits = await contracts.gasCreditVault.getGasCredit(user1.address);
      expect(userCredits).to.be.gt(0);
    });
  });

  describe("Security", function () {
    it("Should have proper access controls", async function () {
      await expect(
        contracts.aggregator.connect(user1).setProtocolFee(50)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not allow unauthorized relayer actions", async function () {
      await expect(
        contracts.metaTxGateway.connect(user1).setRelayerStatus(user2.address, true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
```

### 2. Gas Usage Analysis

```javascript
// scripts/analysis/gas-analysis.js
const { ethers, network } = require("hardhat");

async function main() {
  console.log(`Analyzing gas usage on ${network.name}...`);

  const [deployer] = await ethers.getSigners();
  
  // Load contracts
  const deploymentData = JSON.parse(
    require("fs").readFileSync(`deployments/${network.name}/deployment.json`, "utf8")
  );

  const aggregator = await ethers.getContractAt("CrossChainAggregator", deploymentData.contracts.aggregator);

  // Test different operations
  const operations = [
    {
      name: "Simple Swap",
      operation: async () => {
        // Simulate swap operation
        return aggregator.estimateGas.executeSwap({
          tokenIn: "0x...",
          tokenOut: "0x...",
          amountIn: ethers.utils.parseEther("1"),
          minAmountOut: ethers.utils.parseEther("0.95"),
          routerType: 0,
          to: deployer.address,
          deadline: Math.floor(Date.now() / 1000) + 300,
          swapData: "0x"
        });
      }
    },
    {
      name: "Cross-Chain Swap",
      operation: async () => {
        // Simulate cross-chain swap
        return aggregator.estimateGas.crossChainSwap({
          sourceSwap: {
            tokenIn: "0x...",
            tokenOut: "0x...",
            amountIn: ethers.utils.parseEther("1"),
            minAmountOut: ethers.utils.parseEther("0.95"),
            routerType: 0,
            to: deployer.address,
            deadline: Math.floor(Date.now() / 1000) + 300,
            swapData: "0x"
          },
          destinationChain: "polygon",
          destinationToken: "0x...",
          destinationReceiver: deployer.address,
          minDestinationAmount: ethers.utils.parseEther("0.9"),
          destinationSwapData: "0x"
        });
      }
    }
  ];

  console.log("\n📊 Gas Usage Analysis:");
  console.log("=====================");

  for (const op of operations) {
    try {
      const gasEstimate = await op.operation();
      const gasPrice = await ethers.provider.getGasPrice();
      const costInETH = gasEstimate.mul(gasPrice);
      
      console.log(`\n${op.name}:`);
      console.log(`  Gas: ${gasEstimate.toNumber().toLocaleString()}`);
      console.log(`  Cost: ${ethers.utils.formatEther(costInETH)} ETH`);
    } catch (error) {
      console.log(`\n${op.name}: Error - ${error.message}`);
    }
  }
}

main().catch(console.error);
```

## Monitoring & Maintenance

### 1. Health Check Script

```javascript
// scripts/monitoring/health-check.js
const { ethers, network } = require("hardhat");

async function main() {
  console.log(`Health check for ${network.name}...`);

  const deploymentData = JSON.parse(
    require("fs").readFileSync(`deployments/${network.name}/deployment.json`, "utf8")
  );

  const checks = [];

  // Check contract existence and functionality
  for (const [name, address] of Object.entries(deploymentData.contracts)) {
    try {
      const code = await ethers.provider.getCode(address);
      const isContract = code !== "0x";
      
      checks.push({
        name: `${name} Contract`,
        status: isContract ? "✅ OK" : "❌ FAIL",
        details: isContract ? `Deployed at ${address}` : `No code at ${address}`
      });
    } catch (error) {
      checks.push({
        name: `${name} Contract`,
        status: "❌ ERROR",
        details: error.message
      });
    }
  }

  // Check protocol parameters
  try {
    const aggregator = await ethers.getContractAt("CrossChainAggregator", deploymentData.contracts.aggregator);
    const protocolFee = await aggregator.protocolFee();
    
    checks.push({
      name: "Protocol Fee",
      status: protocolFee.gt(0) && protocolFee.lt(1000) ? "✅ OK" : "⚠️ WARNING",
      details: `Current: ${protocolFee.toNumber() / 100}%`
    });
  } catch (error) {
    checks.push({
      name: "Protocol Fee",
      status: "❌ ERROR",
      details: error.message
    });
  }

  // Print results
  console.log("\n📋 Health Check Results:");
  console.log("========================");
  
  checks.forEach(check => {
    console.log(`${check.status} ${check.name}`);
    console.log(`   ${check.details}`);
  });

  const failedChecks = checks.filter(c => c.status.includes("❌")).length;
  const warningChecks = checks.filter(c => c.status.includes("⚠️")).length;

  console.log(`\n📊 Summary: ${checks.length - failedChecks - warningChecks} OK, ${warningChecks} warnings, ${failedChecks} failures`);

  if (failedChecks > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
```

### 2. Upgrade Preparation

```javascript
// scripts/upgrade/prepare-upgrade.js
const { ethers, upgrades, network } = require("hardhat");

async function main() {
  console.log(`Preparing upgrade for ${network.name}...`);

  const deploymentData = JSON.parse(
    require("fs").readFileSync(`deployments/${network.name}/deployment.json`, "utf8")
  );

  // Prepare upgrades for upgradeable contracts
  const upgradeableContracts = [
    {
      name: "CrossChainAggregator",
      current: deploymentData.contracts.aggregator,
      newVersion: "CrossChainAggregatorV2"
    }
  ];

  for (const contract of upgradeableContracts) {
    try {
      console.log(`\nPreparing upgrade for ${contract.name}...`);
      
      const NewVersion = await ethers.getContractFactory(contract.newVersion);
      const upgrade = await upgrades.prepareUpgrade(contract.current, NewVersion);
      
      console.log(`✅ ${contract.name} upgrade prepared`);
      console.log(`   Implementation: ${upgrade}`);
      
      // Save upgrade info
      const upgradeInfo = {
        contract: contract.name,
        current: contract.current,
        implementation: upgrade,
        timestamp: new Date().toISOString()
      };

      require("fs").writeFileSync(
        `deployments/${network.name}/upgrade-${contract.name.toLowerCase()}.json`,
        JSON.stringify(upgradeInfo, null, 2)
      );

    } catch (error) {
      console.error(`❌ Failed to prepare upgrade for ${contract.name}:`, error.message);
    }
  }
}

main().catch(console.error);
```

## Troubleshooting

### Common Issues

1. **Gas Price Issues**
   ```bash
   # Check current gas prices
   npx hardhat run scripts/analysis/gas-prices.js --network ethereum
   
   # Adjust gas price in hardhat.config.js
   ```

2. **Verification Failures**
   ```bash
   # Manual verification
   npx hardhat verify --network ethereum CONTRACT_ADDRESS "constructor" "args"
   
   # Check flattened source
   npx hardhat flatten contracts/CrossChainAggregator.sol > flattened.sol
   ```

3. **RPC Limits**
   ```bash
   # Use multiple RPC endpoints
   # Add backup URLs in hardhat.config.js
   ```

4. **Contract Size Limits**
   ```bash
   # Check contract sizes
   npx hardhat size-contracts
   
   # Optimize in hardhat.config.js
   optimizer: { enabled: true, runs: 200 }
   ```

## Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [Etherscan Verification](https://hardhat.org/plugins/nomiclabs-hardhat-etherscan.html)
- [OpenZeppelin Upgrades](https://docs.openzeppelin.com/upgrades-plugins/1.x/)
- [Axelar Documentation](https://docs.axelar.dev/)
- [Frontend Integration](frontend-integration.md)
- [Smart Contract Integration](smart-contract-integration.md)
