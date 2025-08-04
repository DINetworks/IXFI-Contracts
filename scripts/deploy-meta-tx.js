require('dotenv').config();
const hre = require("hardhat");

async function main() {
    console.log("🚀 Deploying IXFI Meta-Transaction System...\n");

    const { ethers } = hre;
    const [deployer] = await ethers.getSigners();
    const {provider, formatEther, getContractFactory, getContractAt, parseUnits } = ethers;
    const network = await provider.getNetwork();
    const isMainChain = network.name === "crossfi" || network.chainId === 4158n;
    
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", formatEther(await provider.getBalance(deployer.address)));
    console.log("Network:", network.name, "- Chain ID:", network.chainId);
    console.log("Is CrossFi (main chain):", isMainChain, "\n");

    try {
        let vaultAddress = null;
        let gatewayAddress = null;

        if (isMainChain) {
            // Deploy on CrossFi: Both GasCreditVault and MetaTxGateway
            console.log("📦 Deploying on CrossFi - Full Meta-Transaction System");
            
            // Get IXFI token address
            const IXFI_ADDRESS = process.env.IXFI_ADDRESS || "0xFC4C231D2293180a30eCd10Ce9A84bDBF27B3967";
            console.log("Using IXFI token at:", IXFI_ADDRESS);

            const DIA_ORACLE = process.env.DIA_ORACLE || "0x859e221ada7cebdf5d4040bf6a2b8959c05a4233";
            console.log("Using DIA Oracle V2 at:", DIA_ORACLE);

            // 1. Deploy MetaTxGasCreditVault
            console.log("\n📦 Deploying MetaTxGasCreditVault...");
            const MetaTxGasCreditVault = await getContractFactory("MetaTxGasCreditVault");
            const vault = await MetaTxGasCreditVault.deploy(deployer.address, IXFI_ADDRESS, DIA_ORACLE);
            await vault.waitForDeployment();
            vaultAddress = await vault.getAddress();
            console.log("✅ MetaTxGasCreditVault deployed to:", vaultAddress);

            // 2. Deploy MetaTxGateway
            console.log("\n📦 Deploying MetaTxGateway...");
            const MetaTxGateway = await getContractFactory("MetaTxGateway");
            const gateway = await MetaTxGateway.deploy(deployer.address);
            await gateway.waitForDeployment();
            gatewayAddress = await gateway.getAddress();
            console.log("✅ MetaTxGateway deployed to:", gatewayAddress);

            // 3. Configure vault to authorize gateway for credit consumption
            console.log("\n🔧 Configuring GasCreditVault...");
            await vault.setGatewayAuthorization(gatewayAddress, true);
            console.log("✅ Gateway authorized in vault");

            // 4. Configure gateway to authorize relayer
            const relayerAddress = process.env.RELAYER_ADDRESS;
            if (relayerAddress) {
                console.log("\n🔧 Configuring MetaTxGateway...");
                await gateway.setRelayerAuthorization(relayerAddress, true);
                console.log(`✅ Relayer ${relayerAddress} authorized in gateway`);
            } else {
                console.log("⚠️  RELAYER_ADDRESS not set - manual authorization required");
            }

            // 5. Get IXFI price info
            try {
                const [price, timestamp] = await vault.getIXFIPrice();
                console.log(`\n💰 IXFI Price: $${Number(price) / 1e8} (timestamp: ${timestamp})`);
            } catch (error) {
                console.log("⚠️  Could not fetch IXFI price from oracle");
            }

        } else {
            // Deploy on other chains: Only MetaTxGateway
            console.log("📦 Deploying on External Chain - MetaTxGateway Only");
            
            const MetaTxGateway = await getContractFactory("MetaTxGateway");
            const gateway = await MetaTxGateway.deploy(deployer.address);
            await gateway.waitForDeployment();
            gatewayAddress = await gateway.getAddress();
            console.log("✅ MetaTxGateway deployed to:", gatewayAddress);
        }

        // 5. Authorize deployer as relayer for testing
        if (gatewayAddress) {
            const gateway = await getContractAt("MetaTxGateway", gatewayAddress);
            console.log("\n🔑 Authorizing deployer as relayer...");
            const relayerTx = await gateway.setRelayerAuthorization(deployer.address, true);
            await relayerTx.wait();
            console.log("✅ Deployer authorized as relayer");
        }

        // 6. Display deployment summary
        console.log("\n🎉 Deployment completed successfully!");
        console.log("=" .repeat(60));
        console.log("📋 DEPLOYMENT SUMMARY");
        console.log("=" .repeat(60));
        console.log("Network:", network.name);
        console.log("Chain ID:", network.chainId);
        console.log("Deployer:", deployer.address);
        
        if (isMainChain) {
            console.log("IXFI Token:", process.env.IXFI_ADDRESS || "0xFC4C231D2293180a30eCd10Ce9A84bDBF27B3967");
            console.log("MetaTxGasCreditVault:", vaultAddress);
        }
        console.log("MetaTxGateway:", gatewayAddress);
        console.log("=" .repeat(60));

        // 7. Configuration for relayer
        console.log("\n📝 Relayer Configuration:");
        if (isMainChain) {
            console.log(`Add to meta-tx-config.json for CrossFi:`);
            console.log(`"crossfi": {`);
            console.log(`  "rpc": "https://rpc.mainnet.ms",`);
            console.log(`  "gasCreditVault": "${vaultAddress}",`);
            console.log(`  "metaTxGateway": "${gatewayAddress}"`);
            console.log(`}`);
        } else {
            console.log(`Add to meta-tx-config.json for ${network.name}:`);
            console.log(`"${network.name}": {`);
            console.log(`  "rpc": "YOUR_RPC_URL",`);
            console.log(`  "metaTxGateway": "${gatewayAddress}"`);
            console.log(`}`);
        }

        // 8. Verification instructions
        console.log("\n🔍 To verify contracts on block explorer:");
        if (vaultAddress) {
            console.log(`npx hardhat verify --network ${network.name} ${vaultAddress} "${deployer.address}" "${process.env.IXFI_ADDRESS || '0xFC4C231D2293180a30eCd10Ce9A84bDBF27B3967'}"`);
        }
        if (gatewayAddress) {
            console.log(`npx hardhat verify --network ${network.name} ${gatewayAddress} "${deployer.address}"`);
        }

        // 9. Usage examples
        console.log("\n📚 Next Steps:");
        if (isMainChain) {
            console.log("1. Users can deposit IXFI for gas credits:");
            console.log(`   vault.deposit(parseEther("100"))`);
            console.log("2. Configure relayer with both contracts");
            console.log("3. Start relayer: node meta-tx-relayer.js");
        } else {
            console.log("1. Configure relayer with gateway address");
            console.log("2. Ensure CrossFi vault is deployed and configured");
            console.log("3. Submit meta-transactions via relayer API");
        }

        return {
            vault: vaultAddress,
            gateway: gatewayAddress,
            network: network.name,
            chainId: network.chainId
        };

    } catch (error) {
        console.error("❌ Deployment failed:", error.message);
        throw error;
    }
}

// Test function to demonstrate the system
async function testMetaTxSystem(contracts) {
    console.log("\n🧪 Testing Meta-Transaction System...");
    
    const [deployer, user] = await getSigners();
    
    try {
        // Get contract instances
        const vault = await getContractAt("MetaTxGasCreditVault", contracts.vault);
        const gateway = await getContractAt("MetaTxGateway", contracts.gateway);
        const ixfi = await getContractAt("IXFI", contracts.ixfi);

        // Test 1: Check initial state
        console.log("📊 Initial state:");
        const settings = await vault.getSettings();
        console.log(`   Gas Price: ${formatUnits(settings[0], "gwei")} gwei`);
        console.log(`   IXFI Rate: ${settings[1].toString()}`);
        console.log(`   User credits: ${await vault.getCreditBalance(user.address)}`);

        // Test 2: Simulate deposit (if user has IXFI)
        const userIXFIBalance = await ixfi.balanceOf(user.address);
        if (userIXFIBalance > 0) {
            console.log("\n💰 Testing deposit...");
            const depositAmount = parseEther("10");
            
            // Approve vault to spend IXFI
            await ixfi.connect(user).approve(contracts.vault, depositAmount);
            
            // Deposit IXFI for credits
            await vault.connect(user).deposit(depositAmount);
            
            const newCredits = await vault.getCreditBalance(user.address);
            console.log(`✅ User now has ${newCredits} gas credits`);
        } else {
            console.log("⚠️  User has no IXFI tokens for testing deposits");
        }

        // Test 3: Check if user can execute transactions
        const mockMetaTx = {
            from: user.address,
            to: contracts.ixfi,
            value: 0,
            data: "0x",
            nonce: await gateway.getNonce(user.address),
            deadline: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
        };

        const canExecute = await gateway.canExecuteTransaction(user.address, mockMetaTx);
        console.log(`\n🔍 Can user execute meta-tx: ${canExecute}`);

        console.log("✅ Meta-Transaction system test completed!");

    } catch (error) {
        console.error("❌ Test failed:", error.message);
    }
}

// Main execution
if (require.main === module) {
    main()
        .then(async (contracts) => {
            // Run tests if requested
            if (process.env.RUN_TESTS === "true") {
                await testMetaTxSystem(contracts);
            }
            process.exit(0);
        })
        .catch((error) => {
            console.error("Script failed:", error);
            process.exit(1);
        });
}

module.exports = { main, testMetaTxSystem };
