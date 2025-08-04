require('dotenv').config();
const hre = require("hardhat");

async function main() {
    console.log("🚀 IXFI Batch Meta-Transaction Example\n");

    const { ethers } = hre;
    const [deployer, relayer, user] = await ethers.getSigners();
    const { provider, formatEther, getContractAt, parseUnits } = ethers;
    const network = await provider.getNetwork();
    
    console.log("Network:", network.name, "- Chain ID:", network.chainId);
    console.log("User:", user.address);
    console.log("Relayer:", relayer.address);
    
    // Contract addresses (replace with actual deployed addresses)
    const VAULT_ADDRESS = process.env.VAULT_ADDRESS || "0x...";
    const GATEWAY_ADDRESS = process.env.GATEWAY_ADDRESS || "0x..."; 
    const IXFI_ADDRESS = process.env.IXFI_ADDRESS || "0x...";
    const TARGET_CONTRACT = process.env.TARGET_CONTRACT || "0x...";
    
    try {
        // Get contract instances
        const vault = await getContractAt("MetaTxGasCreditVault", VAULT_ADDRESS);
        const gateway = await getContractAt("MetaTxGateway", GATEWAY_ADDRESS);
        const ixfi = await getContractAt("IXFI", IXFI_ADDRESS);
        
        console.log("📋 Contract Addresses:");
        console.log("IXFI Token:", IXFI_ADDRESS);
        console.log("GasCreditVault:", VAULT_ADDRESS);
        console.log("MetaTxGateway:", GATEWAY_ADDRESS);
        console.log("Target Contract:", TARGET_CONTRACT);
        
        // Step 1: Check user's current balances
        console.log("\n💰 Current Balances:");
        const ixfiBalance = await ixfi.balanceOf(user.address);
        const depositBalance = await vault.getDepositBalance(user.address);
        const creditBalance = await vault.getCreditBalance(user.address);
        
        console.log(`IXFI Balance: ${formatEther(ixfiBalance)}`);
        console.log(`Deposited IXFI: ${formatEther(depositBalance)}`);
        console.log(`Gas Credits: ${creditBalance} cents`);
        
        // Step 2: Deposit IXFI for gas credits if needed
        if (creditBalance < 1000n) { // Less than $10 in credits
            console.log("\n💳 Depositing IXFI for gas credits...");
            const depositAmount = parseUnits("50", 18); // 50 IXFI
            
            // Approve and deposit
            const approveTx = await ixfi.connect(user).approve(VAULT_ADDRESS, depositAmount);
            await approveTx.wait();
            console.log("✅ IXFI approved");
            
            const depositTx = await vault.connect(user).deposit(depositAmount);
            await depositTx.wait();
            console.log("✅ IXFI deposited");
            
            const newCreditBalance = await vault.getCreditBalance(user.address);
            console.log(`New credit balance: ${newCreditBalance} cents`);
        }
        
        // Step 3: Create batch meta-transactions
        console.log("\n📦 Creating batch meta-transactions...");
        
        // Example: Multiple calls to a target contract
        const targetContract = await getContractAt("MockDIAOracle", TARGET_CONTRACT);
        
        const metaTxs = [
            {
                to: TARGET_CONTRACT,
                value: 0,
                data: targetContract.interface.encodeFunctionData("setValue", ["batch_key_1", 12345, Math.floor(Date.now() / 1000)])
            },
            {
                to: TARGET_CONTRACT,
                value: 0,
                data: targetContract.interface.encodeFunctionData("setValue", ["batch_key_2", 67890, Math.floor(Date.now() / 1000)])
            },
            {
                to: TARGET_CONTRACT,
                value: 0,
                data: targetContract.interface.encodeFunctionData("setValue", ["batch_key_3", 11111, Math.floor(Date.now() / 1000)])
            }
        ];
        
        console.log(`Created batch of ${metaTxs.length} transactions`);
        
        // Step 4: Encode batch data
        const metaTxData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["tuple(address to,uint256 value,bytes data)[]"],
            [metaTxs]
        );
        
        // Step 5: Prepare signature data
        const userAddress = user.address;
        const nonce = await gateway.getNonce(userAddress);
        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
        
        console.log(`User nonce: ${nonce}`);
        console.log(`Deadline: ${deadline}`);
        
        // Step 6: Create EIP-712 signature
        console.log("\n✍️  Creating EIP-712 signature...");
        
        const domain = {
            name: "MetaTxGateway",
            version: "1",
            chainId: Number(network.chainId),
            verifyingContract: GATEWAY_ADDRESS
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
        console.log("✅ Signature created");
        
        // Step 7: Estimate gas for the batch
        console.log("\n⛽ Estimating gas...");
        try {
            const gasEstimate = await gateway.connect(relayer).executeMetaTransactions.estimateGas(
                userAddress,
                metaTxData,
                signature,
                nonce,
                deadline
            );
            console.log(`Estimated gas: ${gasEstimate}`);
        } catch (error) {
            console.log("⚠️  Could not estimate gas:", error.message);
        }
        
        // Step 8: Execute batch meta-transaction
        console.log("\n🚀 Executing batch meta-transaction...");
        
        const executeTx = await gateway.connect(relayer).executeMetaTransactions(
            userAddress,
            metaTxData,
            signature,
            nonce,
            deadline
        );
        
        console.log(`Transaction sent: ${executeTx.hash}`);
        
        const receipt = await executeTx.wait();
        console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
        console.log(`Gas used: ${receipt.gasUsed}`);
        
        // Step 9: Get batch information
        console.log("\n📊 Batch Information:");
        
        const totalBatches = await gateway.getTotalBatchCount();
        const batchId = totalBatches - 1n; // Latest batch
        
        console.log(`Total batches processed: ${totalBatches}`);
        console.log(`Current batch ID: ${batchId}`);
        
        // Get batch details
        const batchLog = await gateway.getBatchTransactionLog(batchId);
        console.log(`Batch user: ${batchLog.user}`);
        console.log(`Batch relayer: ${batchLog.relayer}`);
        console.log(`Batch gas used: ${batchLog.gasUsed}`);
        console.log(`Batch timestamp: ${new Date(Number(batchLog.timestamp) * 1000).toISOString()}`);
        
        // Get batch successes
        const successes = await gateway.getBatchSuccesses(batchId);
        console.log(`Transaction successes: [${successes.join(', ')}]`);
        
        // Get batch transactions
        const batchTransactions = await gateway.getBatchTransactions(batchId);
        console.log(`Batch contained ${batchTransactions.length} transactions`);
        
        // Step 10: Check updated balances
        console.log("\n💰 Updated Balances:");
        const finalCreditBalance = await vault.getCreditBalance(user.address);
        console.log(`Final credit balance: ${finalCreditBalance} cents`);
        console.log(`Credits consumed: ${creditBalance - finalCreditBalance} cents`);
        
        // Parse events from the transaction
        console.log("\n📋 Events Emitted:");
        for (const log of receipt.logs) {
            try {
                const parsed = gateway.interface.parseLog(log);
                if (parsed.name === "BatchTransactionExecuted") {
                    console.log(`✅ BatchTransactionExecuted: ID=${parsed.args.batchId}, Gas=${parsed.args.gasUsed}, Count=${parsed.args.transactionCount}`);
                } else if (parsed.name === "MetaTransactionExecuted") {
                    console.log(`✅ MetaTransactionExecuted: Target=${parsed.args.target}, Success=${parsed.args.success}`);
                }
            } catch (e) {
                // Not a gateway event
            }
        }
        
        console.log("\n🎉 Batch meta-transaction example completed successfully!");
        
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
}

// Helper function to simulate relayer behavior
async function simulateRelayerCheck(userAddress, metaTxData, targetChain = "ethereum") {
    console.log("\n🔍 Simulating relayer pre-execution checks...");
    
    // Simulate gas estimation
    const estimatedGas = 250000; // Conservative estimate
    console.log(`Estimated gas: ${estimatedGas}`);
    
    // Simulate gas price check
    const gasPrice = await ethers.provider.getFeeData().then(fee => fee.gasPrice);
    console.log(`Current gas price: ${ethers.formatUnits(gasPrice, "gwei")} Gwei`);
    
    // Simulate native token price (in real relayer, this would come from price feeds)
    const nativeTokenPrices = {
        ethereum: 3000,
        polygon: 1.2,
        bsc: 600,
        avalanche: 40,
        arbitrum: 3000,
        optimism: 3000
    };
    
    const tokenPrice = nativeTokenPrices[targetChain] || 1;
    console.log(`${targetChain} token price: $${tokenPrice}`);
    
    // Calculate estimated cost in USD cents
    const estimatedCostUsd = (estimatedGas * Number(gasPrice) * tokenPrice) / 1e18 * 100;
    console.log(`Estimated cost: ${estimatedCostUsd.toFixed(2)} cents`);
    
    return {
        estimatedGas,
        gasPrice,
        tokenPrice,
        estimatedCostUsd
    };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
