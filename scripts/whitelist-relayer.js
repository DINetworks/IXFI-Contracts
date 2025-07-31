const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    console.log("Adding relayer to whitelist...");

    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log("Using account:", deployer.address);

    // Get relayer address from command line or environment
    const relayerAddress = process.env.RELAYER_ADDRESS || process.argv[2];
    
    if (!relayerAddress) {
        console.error("❌ Please provide relayer address:");
        console.log("   npx hardhat run scripts/whitelist-relayer.js --network <network> <relayer_address>");
        console.log("   Or set RELAYER_ADDRESS environment variable");
        process.exit(1);
    }

    if (!ethers.isAddress(relayerAddress)) {
        console.error("❌ Invalid relayer address:", relayerAddress);
        process.exit(1);
    }

    // Get IXFI contract address (you may need to update this)
    const ixfiAddress = process.env.IXFI_ADDRESS;
    
    if (!ixfiAddress) {
        console.error("❌ Please set IXFI_ADDRESS environment variable or update the script");
        process.exit(1);
    }

    // Connect to IXFI contract
    const IXFI = await ethers.getContractFactory("IXFI");
    const ixfi = IXFI.attach(ixfiAddress);

    console.log("IXFI Contract:", ixfiAddress);
    console.log("Relayer Address:", relayerAddress);

    // Check if already whitelisted
    try {
        const isWhitelisted = await ixfi.isWhitelistedRelayer(relayerAddress);
        
        if (isWhitelisted) {
            console.log("✅ Relayer is already whitelisted");
            return;
        }

        // Add to whitelist
        console.log("Adding relayer to whitelist...");
        const tx = await ixfi.addWhitelistedRelayer(relayerAddress);
        console.log("Transaction hash:", tx.hash);

        const receipt = await tx.wait();
        console.log("✅ Relayer whitelisted successfully!");
        console.log("Gas used:", receipt.gasUsed.toString());

        // Verify
        const isNowWhitelisted = await ixfi.isWhitelistedRelayer(relayerAddress);
        console.log("Verification:", isNowWhitelisted ? "✅ SUCCESS" : "❌ FAILED");

    } catch (error) {
        console.error("❌ Failed to whitelist relayer:", error.message);
        
        if (error.message.includes("Already relayer")) {
            console.log("ℹ️  Relayer is already whitelisted");
        } else if (error.message.includes("Ownable: caller is not the owner")) {
            console.log("❌ Only the contract owner can whitelist relayers");
        } else {
            throw error;
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
