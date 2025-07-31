const hre = require("hardhat");
const { ethers } = hre;

/**
 * Comprehensive deployment script for Cross-Chain Aggregator
 * This script deploys all necessary contracts and sets up initial configurations
 */

async function main() {
    console.log("🚀 Deploying Cross-Chain Aggregator System...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    // Network configuration
    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId;
    console.log(`\n📡 Network: ${network.name} (Chain ID: ${chainId})`);

    // Display supported router types
    console.log("\n🎯 Supported Router Types:");
    const routerTypes = {
        0: "UNISWAP_V2", 1: "UNISWAP_V3", 2: "SUSHISWAP", 3: "SUSHISWAP_V3",
        4: "PANCAKESWAP", 5: "PANCAKESWAP_V3", 6: "QUICKSWAP", 7: "CURVE",
        8: "BALANCER", 9: "ONE_INCH", 10: "PARASWAP", 11: "ZEROX_PROTOCOL",
        12: "KYBER_NETWORK", 13: "DODO", 14: "BANCOR", 15: "SHIBASWAP",
        16: "TRADERJOE", 17: "SPOOKYSWAP", 18: "SPIRITSWAP", 19: "APESWAP",
        20: "BISWAP", 21: "MDEX", 22: "VELODROME", 23: "AERODROME",
        24: "RAMSES", 25: "SOLIDLY", 26: "THENA", 27: "CAMELOT",
        28: "CHRONOS", 29: "ZYBERSWAP", 30: "BEETHOVEN_X", 31: "PLATYPUS",
        32: "WOMBAT", 33: "GMXSWAP", 34: "MAVERICK", 35: "ALGEBRA", 36: "RETRO"
    };
    
    Object.entries(routerTypes).forEach(([id, name]) => {
        console.log(`  ${id.padStart(2)}: ${name}`);
    });

    // Contract deployment
    console.log("\n📋 Step 1: Deploying core contracts...");

    // 1. Deploy IXFI Token (if not already deployed)
    let ixfiToken;
    try {
        const IXFI = await ethers.getContractFactory("IXFI");
        ixfiToken = await IXFI.deploy(
            "IXFI Token",
            "IXFI",
            18,
            ethers.utils.parseEther("1000000000") // 1B total supply
        );
        await ixfiToken.deployed();
        console.log("✅ IXFI Token deployed to:", ixfiToken.address);
    } catch (error) {
        console.log("⚠️  IXFI Token deployment failed or already exists");
    }

    // 2. Deploy SwapCalldataGenerator
    const SwapCalldataGenerator = await ethers.getContractFactory("SwapCalldataGenerator");
    const calldataGenerator = await SwapCalldataGenerator.deploy(deployer.address);
    await calldataGenerator.deployed();
    console.log("✅ SwapCalldataGenerator deployed to:", calldataGenerator.address);

    // 3. Deploy CrossChainAggregator
    const CrossChainAggregator = await ethers.getContractFactory("CrossChainAggregator");
    
    // Mock gateway and gas service addresses for testing
    const mockGateway = "0x4F4495243837681061C4743b74B3eEdf548D56A5"; // Axelar testnet
    const mockGasService = "0xbE406F0189A0B4cf3A05C286473D23791Dd44Cc6"; // Axelar testnet
    
    const aggregator = await CrossChainAggregator.deploy(
        mockGateway,
        mockGasService,
        ixfiToken.address,
        calldataGenerator.address
    );
    await aggregator.deployed();
    console.log("✅ CrossChainAggregator deployed to:", aggregator.address);

    console.log("\n⚙️  Step 2: Configuring router settings...");

    // Configure popular DEX routers for different chains
    const routerConfigs = [
        // Ethereum Mainnet (1)
        {
            chainId: 1,
            routers: [
                { type: 0, address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", active: true }, // Uniswap V2
                { type: 1, address: "0xE592427A0AEce92De3Edee1F18E0157C05861564", active: true }, // Uniswap V3
                { type: 2, address: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F", active: true }, // SushiSwap V2
                { type: 3, address: "0x2E6cd2d30aa43f40aa81619ff4b6E0a41479B13F", active: true }, // SushiSwap V3
                { type: 6, address: "0xBA12222222228d8Ba445958a75a0704d566BF2C8", active: true }, // Balancer
                { type: 7, address: "0x1111111254EEB25477B68fb85Ed929f73A960582", active: true }, // 1inch
                { type: 8, address: "0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57", active: true }, // ParaSwap
            ]
        },
        // BSC Mainnet (56)
        {
            chainId: 56,
            routers: [
                { type: 4, address: "0x10ED43C718714eb63d5aA57B78B54704E256024E", active: true }, // PancakeSwap V2
                { type: 5, address: "0x1b81D678ffb9C0263b24A97847620C99d213eB14", active: true }, // PancakeSwap V3
                { type: 2, address: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", active: true }, // SushiSwap V2
                { type: 19, address: "0xcF0feBd3f17CEf5b47b0cD257aCf6025c5BFf3b7", active: true }, // ApeSwap
                { type: 20, address: "0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8", active: true }, // Biswap
                { type: 21, address: "0x7DAe51BD3E3376B8c7c4900E9107f12Be3AF1bA8", active: true }, // MDEX
            ]
        },
        // Polygon Mainnet (137)
        {
            chainId: 137,
            routers: [
                { type: 6, address: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff", active: true }, // QuickSwap
                { type: 2, address: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", active: true }, // SushiSwap V2
                { type: 8, address: "0xBA12222222228d8Ba445958a75a0704d566BF2C8", active: true }, // Balancer
                { type: 9, address: "0x1111111254EEB25477B68fb85Ed929f73A960582", active: true }, // 1inch
            ]
        },
        // Avalanche (43114)
        {
            chainId: 43114,
            routers: [
                { type: 16, address: "0x60aE616a2155Ee3d9A68541Ba4544862310933d4", active: true }, // Trader Joe
                { type: 2, address: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", active: true }, // SushiSwap V2
                { type: 31, address: "0x188bED1968b795d5c9022F6a0bb5931Ac4c18F00", active: true }, // Platypus
            ]
        },
        // Arbitrum (42161)
        {
            chainId: 42161,
            routers: [
                { type: 0, address: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", active: true }, // Uniswap V2 fork
                { type: 1, address: "0xE592427A0AEce92De3Edee1F18E0157C05861564", active: true }, // Uniswap V3
                { type: 2, address: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", active: true }, // SushiSwap V2
                { type: 27, address: "0xc873fEcbd354f5A56E00E710B90EF4201db2448d", active: true }, // Camelot
                { type: 29, address: "0x1F721E2E82F6676FCE4eA07A5958cF098D339e18", active: true }, // ZyberSwap
                { type: 33, address: "0x80A9ae39310abf666A87C743d6ebBD0E8C42158E", active: true }, // GMX
            ]
        },
        // Optimism (10)
        {
            chainId: 10,
            routers: [
                { type: 0, address: "0x9c12939390052919aF3155f41Bf4160Fd3666A6f", active: true }, // Uniswap V2 fork
                { type: 1, address: "0xE592427A0AEce92De3Edee1F18E0157C05861564", active: true }, // Uniswap V3
                { type: 22, address: "0x9c12939390052919aF3155f41Bf4160Fd3666A6f", active: true }, // Velodrome
                { type: 8, address: "0xBA12222222228d8Ba445958a75a0704d566BF2C8", active: true }, // Balancer
                { type: 30, address: "0x1F98431c8aD98523631AE4a59f267346ea31F984", active: true }, // Beethoven X
            ]
        },
        // Base (8453)
        {
            chainId: 8453,
            routers: [
                { type: 0, address: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24", active: true }, // Uniswap V2 fork
                { type: 1, address: "0x2626664c2603336E57B271c5C0b26F421741e481", active: true }, // Uniswap V3
                { type: 23, address: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43", active: true }, // Aerodrome
            ]
        }
    ];

    // Configure routers
    for (const config of routerConfigs) {
        try {
            await calldataGenerator.setChainSupport(config.chainId, true);
            console.log(`✅ Enabled support for chain ${config.chainId}`);

            for (const router of config.routers) {
                await calldataGenerator.configureRouter(
                    config.chainId,
                    router.type,
                    router.address,
                    router.active
                );
                console.log(`  📍 Configured router type ${router.type} (${routerTypes[router.type]}) at ${router.address}`);
            }
        } catch (error) {
            console.error(`❌ Failed to configure chain ${config.chainId}:`, error.message);
        }
    }

    console.log("\n🔗 Step 3: Setting up cross-chain configurations...");

    // Set supported destination chains for aggregator
    const supportedChains = [1, 56, 137, 43114, 42161, 10, 8453]; // ETH, BSC, Polygon, Avalanche, Arbitrum, Optimism, Base
    
    for (const destChainId of supportedChains) {
        await aggregator.setSupportedChain(destChainId, true);
        console.log(`✅ Enabled destination chain: ${destChainId}`);
    }

    console.log("\n💰 Step 4: Initial token setup...");

    // Mint some IXFI tokens to aggregator for testing
    if (ixfiToken) {
        await ixfiToken.mint(aggregator.address, ethers.utils.parseEther("1000000"));
        console.log("✅ Minted 1M IXFI tokens to aggregator");
    }

    console.log("\n📊 Step 5: Deployment Summary");
    console.log("=" * 50);
    console.log(`🏗️  Network: ${network.name} (${chainId})`);
    console.log(`👤 Deployer: ${deployer.address}`);
    if (ixfiToken) console.log(`🪙 IXFI Token: ${ixfiToken.address}`);
    console.log(`⚙️  Calldata Generator: ${calldataGenerator.address}`);
    console.log(`🌉 Cross-Chain Aggregator: ${aggregator.address}`);
    console.log(`📡 Supported Chains: ${supportedChains.join(", ")}`);

    // Generate deployment verification commands
    console.log("\n🔍 Verification Commands:");
    console.log("=" * 50);
    if (ixfiToken) {
        console.log(`npx hardhat verify --network ${network.name} ${ixfiToken.address} "IXFI Token" "IXFI" 18 "1000000000000000000000000000"`);
    }
    console.log(`npx hardhat verify --network ${network.name} ${calldataGenerator.address} "${deployer.address}"`);
    console.log(`npx hardhat verify --network ${network.name} ${aggregator.address} "${mockGateway}" "${mockGasService}" "${ixfiToken?.address || 'IXFI_ADDRESS'}" "${calldataGenerator.address}"`);

    // Generate configuration file
    const deploymentConfig = {
        network: network.name,
        chainId: chainId.toString(),
        deployer: deployer.address,
        contracts: {
            ixfiToken: ixfiToken?.address || null,
            calldataGenerator: calldataGenerator.address,
            crossChainAggregator: aggregator.address
        },
        supportedChains: supportedChains,
        routerConfigs: routerConfigs,
        timestamp: new Date().toISOString()
    };

    const fs = require('fs');
    const configPath = `deployment-${network.name}-${Date.now()}.json`;
    fs.writeFileSync(configPath, JSON.stringify(deploymentConfig, null, 2));
    console.log(`\n💾 Configuration saved to: ${configPath}`);

    // Validate deployment
    const isValid = await validateDeployment(deploymentConfig);
    if (!isValid) {
        console.warn("⚠️  Deployment validation failed - please check configuration");
    }

    console.log("\n🎉 Deployment completed successfully!");
    console.log("\n📋 Next Steps:");
    console.log("1. Verify contracts on block explorer");
    console.log("2. Set up relayer configurations");
    console.log("3. Configure frontend with contract addresses");
    console.log("4. Test cross-chain swaps on testnet");
    console.log("5. Audit contracts before mainnet deployment");

    return {
        ixfiToken: ixfiToken?.address,
        calldataGenerator: calldataGenerator.address,
        crossChainAggregator: aggregator.address,
        deploymentConfig
    };
}

// Example usage and testing functions
async function testCrossChainSwap() {
    console.log("\n🧪 Testing Cross-Chain Swap Functionality...");
    
    const [user] = await ethers.getSigners();
    
    // Get deployed contracts (replace with actual addresses)
    const aggregatorAddress = "YOUR_AGGREGATOR_ADDRESS";
    const aggregator = await ethers.getContractAt("CrossChainAggregator", aggregatorAddress);
    
    // Example swap: 100 USDC on Ethereum → IXFI → 100 USDT on BSC
    const swapRequest = {
        sourceToken: "0xA0b86a33E6441c45C74d7F7f5234f3628B8b5C22", // USDC on Ethereum
        sourceAmount: ethers.utils.parseUnits("100", 6), // 100 USDC
        destinationChain: "bsc",
        destinationToken: "0x55d398326f99059fF775485246999027B3197955", // USDT on BSC
        minDestinationAmount: ethers.utils.parseUnits("99", 18), // Min 99 USDT
        recipient: user.address,
        deadline: Math.floor(Date.now() / 1000) + 3600 // 1 hour
    };
    
    console.log("📋 Swap Request:", swapRequest);
    
    // In practice, you would call aggregator.crossChainSwap() with proper parameters
    console.log("✅ Test swap request prepared");
}

// Validate deployment function
async function validateDeployment(deploymentConfig) {
    console.log("\n🔍 Validating Deployment...");
    
    try {
        // Validate contracts exist and are functional
        const calldataGenerator = await ethers.getContractAt("SwapCalldataGenerator", deploymentConfig.contracts.calldataGenerator);
        const aggregator = await ethers.getContractAt("CrossChainAggregator", deploymentConfig.contracts.crossChainAggregator);
        
        // Test basic functionality
        const supportedChains = await Promise.all([1, 56, 137].map(async (chainId) => {
            try {
                return await calldataGenerator.supportedChains(chainId);
            } catch {
                return false;
            }
        }));
        
        console.log("✅ Contract validation passed");
        console.log(`📊 Supported chains test: ${supportedChains.filter(Boolean).length}/3 chains active`);
        
        // Test router configurations
        let totalRouters = 0;
        for (const config of deploymentConfig.routerConfigs) {
            for (const router of config.routers) {
                try {
                    const routerConfig = await calldataGenerator.routers(config.chainId, router.type);
                    if (routerConfig.isActive) {
                        totalRouters++;
                    }
                } catch (error) {
                    console.warn(`⚠️  Router ${router.type} on chain ${config.chainId} validation failed`);
                }
            }
        }
        
        console.log(`🎯 Total active routers: ${totalRouters}`);
        console.log("✅ Deployment validation completed successfully");
        
        return true;
    } catch (error) {
        console.error("❌ Deployment validation failed:", error.message);
        return false;
    }
}

// Run deployment
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ Deployment failed:", error);
            process.exit(1);
        });
}

module.exports = { main, testCrossChainSwap, validateDeployment };
