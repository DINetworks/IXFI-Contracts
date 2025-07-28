const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying IXFI GMP Protocol...");

    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

    // Deploy IXFI contract with GMP functionality
    console.log("\n1. Deploying IXFI Gateway...");
    const IXFI = await ethers.getContractFactory("IXFI");
    const ixfi = await IXFI.deploy(deployer.address);
    await ixfi.waitForDeployment();
    const ixfiAddress = await ixfi.getAddress();
    console.log("IXFI Gateway deployed to:", ixfiAddress);

    // Deploy example CrossChainMessenger (if exists)
    console.log("\n2. Checking for CrossChainMessenger...");
    try {
        const CrossChainMessenger = await ethers.getContractFactory("CrossChainMessenger");
        const messenger = await CrossChainMessenger.deploy(ixfiAddress, ixfiAddress);
        await messenger.waitForDeployment();
        const messengerAddress = await messenger.getAddress();
        console.log("CrossChainMessenger deployed to:", messengerAddress);
    } catch (error) {
        console.log("CrossChainMessenger not found or failed to deploy:", error.message);
    }

    // Initial setup
    console.log("\n3. Initial setup...");

    // Add some initial relayers (in production, these would be real relayer addresses)
    const relayerAddresses = [
        "0x1234567890123456789012345678901234567890", // Replace with real addresses
        "0x2345678901234567890123456789012345678901"
    ];

    for (const relayerAddr of relayerAddresses) {
        try {
            console.log(`Adding relayer: ${relayerAddr}`);
            await ixfi.addWhitelistedRelayer(relayerAddr);
            console.log(`✅ Relayer ${relayerAddr} added successfully`);
        } catch (error) {
            console.log(`❌ Failed to add relayer ${relayerAddr}:`, error.message);
        }
    }

    // Add additional chains (beyond the defaults)
    const additionalChains = [
        { name: "avalanche", id: 43114 },
        { name: "fantom", id: 250 },
        { name: "arbitrum", id: 42161 },
        { name: "optimism", id: 10 }
    ];

    for (const chain of additionalChains) {
        try {
            console.log(`Adding chain: ${chain.name} (ID: ${chain.id})`);
            await ixfi.addChain(chain.name, chain.id);
            console.log(`✅ Chain ${chain.name} added successfully`);
        } catch (error) {
            console.log(`❌ Failed to add chain ${chain.name}:`, error.message);
        }
    }

    console.log("\n4. Deployment Summary:");
    console.log("========================");
    console.log(`IXFI Gateway: ${ixfiAddress}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Network: ${(await ethers.provider.getNetwork()).name}`);
    console.log(`Chain ID: ${(await ethers.provider.getNetwork()).chainId}`);

    console.log("\n5. Verification Commands:");
    console.log("========================");
    console.log(`npx hardhat verify --network <network> ${ixfiAddress} "${deployer.address}"`);

    console.log("\n6. Next Steps:");
    console.log("========================");
    console.log("1. Add real relayer addresses using addWhitelistedRelayer()");
    console.log("2. Set up relayer infrastructure to monitor events");
    console.log("3. Deploy IXFI contracts on other chains");
    console.log("4. Test cross-chain functionality");
    console.log("5. Configure chain mappings on all deployed instances");

    // Optional: Test basic functionality
    console.log("\n7. Testing basic functionality...");
    
    // Check if we're on CrossFi chain for deposit testing
    const currentChainId = (await ethers.provider.getNetwork()).chainId;
    const crossfiChainId = await ixfi.crossfi_chainid();
    
    if (currentChainId === crossfiChainId) {
        try {
            console.log("Testing IXFI deposit on CrossFi chain...");
            const depositTx = await ixfi.deposit({ value: ethers.parseEther("1.0") });
            await depositTx.wait();
            const balance = await ixfi.balanceOf(deployer.address);
            console.log(`✅ IXFI balance after deposit: ${ethers.formatEther(balance)} IXFI`);
            
            // Test backing ratio
            const xfiBalance = await ixfi.getXFIBalance();
            const isFullyBacked = await ixfi.isFullyBacked();
            console.log(`✅ XFI locked in contract: ${ethers.formatEther(xfiBalance)} XFI`);
            console.log(`✅ Is fully backed: ${isFullyBacked}`);
        } catch (error) {
            console.log("❌ Deposit test failed:", error.message);
        }
    } else {
        console.log(`ℹ️  Not on CrossFi chain (current: ${currentChainId}, CrossFi: ${crossfiChainId}), skipping deposit test`);
    }

    // Test getting chain info
    try {
        const chainId = await ixfi.getChainId("ethereum");
        console.log(`✅ Ethereum chain ID: ${chainId}`);
        
        const chainName = await ixfi.getChainName(1);
        console.log(`✅ Chain ID 1 name: ${chainName}`);
        
        // Test relayer functions
        const relayerCount = await ixfi.getRelayerCount();
        console.log(`✅ Number of relayers: ${relayerCount}`);
        
        const allRelayers = await ixfi.getAllRelayers();
        console.log(`✅ All relayers: ${allRelayers.join(", ")}`);
    } catch (error) {
        console.log("❌ Chain info test failed:", error.message);
    }

    // Test GMP functionality example
    console.log("\n8. Testing GMP functionality...");
    try {
        // Test calling a contract on another chain (this will just emit events)
        const payload = ethers.AbiCoder.defaultAbiCoder().encode(
            ["string", "uint256"],
            ["Hello from CrossFi!", 42]
        );
        
        const callTx = await ixfi.callContract(
            "ethereum",
            "0x1234567890123456789012345678901234567890",
            payload
        );
        await callTx.wait();
        console.log("✅ Cross-chain contract call initiated");
        
    } catch (error) {
        console.log("❌ GMP test failed:", error.message);
    }

    console.log("\n🎉 IXFI GMP Protocol deployment completed!");
    console.log("\n📋 Contract Addresses Summary:");
    console.log("================================");
    console.log(`IXFI Gateway: ${ixfiAddress}`);
    console.log(`Owner: ${deployer.address}`);
    console.log(`Network: ${(await ethers.provider.getNetwork()).name}`);
    console.log(`Chain ID: ${(await ethers.provider.getNetwork()).chainId}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
