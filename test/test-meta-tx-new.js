const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("IXFI Meta-Transaction System - New Architecture", function () {
    let ixfi, vault, gateway;
    let owner, relayer, user1, user2;
    
    beforeEach(async function () {
        [owner, relayer, user1, user2] = await ethers.getSigners();
        
        // Deploy IXFI token
        const IXFI = await ethers.getContractFactory("IXFI");
        ixfi = await IXFI.deploy(owner.address);
        await ixfi.waitForDeployment();
        
        // Deploy mock DIA Oracle for testing
        const MockDIAOracle = await ethers.getContractFactory("MockDIAOracle");
        const diaOracle = await MockDIAOracle.deploy();
        await diaOracle.waitForDeployment();
        
        // Deploy MetaTxGasCreditVault (only on CrossFi)
        const MetaTxGasCreditVault = await ethers.getContractFactory("MetaTxGasCreditVault");
        vault = await MetaTxGasCreditVault.deploy(owner.address, await ixfi.getAddress(), await diaOracle.getAddress());
        await vault.waitForDeployment();
        
        // Deploy MetaTxGateway (on any chain, no vault dependency)
        const MetaTxGateway = await ethers.getContractFactory("MetaTxGateway");
        gateway = await MetaTxGateway.deploy(owner.address);
        await gateway.waitForDeployment();
        
        // Configure vault (authorize gateway for local testing only)
        await vault.setGatewayAuthorization(await gateway.getAddress(), true);
        await gateway.setRelayerAuthorization(relayer.address, true);
        
        // Give users some IXFI tokens
        await ixfi.connect(user1).deposit({ value: ethers.parseEther("100") });
        
        console.log("✅ Test setup completed");
    });

    describe("Architecture Separation", function () {
        it("Should deploy MetaTxGateway without vault dependency", async function () {
            // Deploy another gateway without any vault reference
            const MetaTxGateway = await ethers.getContractFactory("MetaTxGateway");
            const independentGateway = await MetaTxGateway.deploy(owner.address);
            await independentGateway.waitForDeployment();
            
            // Should be able to authorize relayers
            await independentGateway.setRelayerAuthorization(relayer.address, true);
            expect(await independentGateway.isRelayerAuthorized(relayer.address)).to.be.true;
            
            console.log("✅ Independent gateway deployed successfully");
        });

        it("Should manage gas credits only on CrossFi vault", async function () {
            const depositAmount = ethers.parseEther("10");
            
            // User deposits IXFI for gas credits
            await ixfi.connect(user1).approve(await vault.getAddress(), depositAmount);
            await vault.connect(user1).deposit(depositAmount);
            
            const credits = await vault.getCreditBalance(user1.address);
            expect(credits).to.be.gt(0);
            
            // Check if user has enough credits for a transaction
            const gasEstimate = 100000;
            const hasEnough = await vault.hasEnoughCredits(user1.address, gasEstimate);
            expect(hasEnough).to.be.true;
            
            console.log(`✅ User has ${credits} gas credits for ${gasEstimate} gas`);
        });
    });

    describe("Gateway-Only Execution", function () {
        it("Should execute meta-transactions without checking credits", async function () {
            // Create meta-transaction
            const metaTx = {
                from: user1.address,
                to: await ixfi.getAddress(),
                value: 0,
                data: ixfi.interface.encodeFunctionData("transfer", [user2.address, ethers.parseEther("1")]),
                nonce: await gateway.getNonce(user1.address),
                deadline: Math.floor(Date.now() / 1000) + 3600
            };

            // Create EIP-712 signature
            const domain = {
                name: "MetaTxGateway",
                version: "1",
                chainId: (await ethers.provider.getNetwork()).chainId,
                verifyingContract: await gateway.getAddress()
            };

            const types = {
                MetaTransaction: [
                    { name: "from", type: "address" },
                    { name: "to", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "data", type: "bytes" },
                    { name: "nonce", type: "uint256" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const signature = await user1.signTypedData(domain, types, metaTx);

            // Execute meta-transaction (gateway doesn't check credits)
            const initialBalance = await ixfi.balanceOf(user2.address);
            
            const tx = await gateway.connect(relayer).executeMetaTransaction(metaTx, signature);
            const receipt = await tx.wait();
            
            const finalBalance = await ixfi.balanceOf(user2.address);
            expect(finalBalance).to.be.gt(initialBalance);
            
            // Verify nonce was incremented
            expect(await gateway.getNonce(user1.address)).to.equal(1);
            
            console.log("✅ Meta-transaction executed without credit checking");
            console.log(`⛽ Gas used: ${receipt.gasUsed}`);
        });

        it("Should handle invalid signatures correctly", async function () {
            const metaTx = {
                from: user1.address,
                to: await ixfi.getAddress(),
                value: 0,
                data: "0x",
                nonce: await gateway.getNonce(user1.address),
                deadline: Math.floor(Date.now() / 1000) + 3600
            };

            const invalidSignature = "0x" + "00".repeat(65);

            await expect(
                gateway.connect(relayer).executeMetaTransaction(metaTx, invalidSignature)
            ).to.be.revertedWith("Invalid signature");
        });
    });

    describe("Credit Management (CrossFi Only)", function () {
        it("Should consume credits when called by authorized gateway", async function () {
            const depositAmount = ethers.parseEther("20");
            const gasUsed = 75000;
            
            // User deposits IXFI
            await ixfi.connect(user1).approve(await vault.getAddress(), depositAmount);
            await vault.connect(user1).deposit(depositAmount);
            
            const initialCredits = await vault.getCreditBalance(user1.address);
            
            // Simulate gateway consuming credits (in real scenario, this happens via relayer)
            const success = await vault.connect(gateway).consumeCredits(user1.address, gasUsed);
            expect(success).to.be.true;
            
            const finalCredits = await vault.getCreditBalance(user1.address);
            expect(finalCredits).to.be.lt(initialCredits);
            
            console.log(`✅ Credits consumed: ${initialCredits - finalCredits} for ${gasUsed} gas`);
        });

        it("Should calculate correct credits for gas consumption", async function () {
            const gasAmount = 100000;
            const creditsNeeded = await vault.calculateCreditsForGas(gasAmount);
            
            expect(creditsNeeded).to.be.gt(0);
            console.log(`✅ ${gasAmount} gas requires ${creditsNeeded} credits`);
        });
    });

    describe("Cross-Chain Simulation", function () {
        it("Should simulate relayer workflow: check credits on CrossFi, execute on target chain", async function () {
            console.log("\n🌐 Simulating Cross-Chain Meta-Transaction Flow");
            
            // Step 1: User deposits IXFI on CrossFi for gas credits
            const depositAmount = ethers.parseEther("15");
            await ixfi.connect(user1).approve(await vault.getAddress(), depositAmount);
            await vault.connect(user1).deposit(depositAmount);
            
            const initialCredits = await vault.getCreditBalance(user1.address);
            console.log(`✅ User deposited ${ethers.formatEther(depositAmount)} IXFI, got ${initialCredits} credits`);
            
            // Step 2: Create meta-transaction for "target chain"
            const metaTx = {
                from: user1.address,
                to: await ixfi.getAddress(),
                value: 0,
                data: ixfi.interface.encodeFunctionData("transfer", [user2.address, ethers.parseEther("3")]),
                nonce: await gateway.getNonce(user1.address),
                deadline: Math.floor(Date.now() / 1000) + 3600
            };
            
            // Step 3: Relayer checks credits on CrossFi
            const gasEstimate = 80000;
            const hasEnoughCredits = await vault.hasEnoughCredits(user1.address, gasEstimate);
            expect(hasEnoughCredits).to.be.true;
            console.log(`✅ User has enough credits for ${gasEstimate} gas`);
            
            // Step 4: Relayer executes on "target chain" (simulated)
            const domain = {
                name: "MetaTxGateway",
                version: "1",
                chainId: (await ethers.provider.getNetwork()).chainId,
                verifyingContract: await gateway.getAddress()
            };
            
            const types = {
                MetaTransaction: [
                    { name: "from", type: "address" },
                    { name: "to", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "data", type: "bytes" },
                    { name: "nonce", type: "uint256" },
                    { name: "deadline", type: "uint256" }
                ]
            };
            
            const signature = await user1.signTypedData(domain, types, metaTx);
            
            const tx = await gateway.connect(relayer).executeMetaTransaction(metaTx, signature);
            const receipt = await tx.wait();
            
            console.log(`✅ Meta-transaction executed on target chain - Gas used: ${receipt.gasUsed}`);
            
            // Step 5: Relayer deducts credits on CrossFi
            await vault.connect(gateway).consumeCredits(user1.address, receipt.gasUsed);
            
            const finalCredits = await vault.getCreditBalance(user1.address);
            console.log(`✅ Credits deducted: ${initialCredits - finalCredits}`);
            console.log("🎉 Cross-chain meta-transaction flow completed!");
        });
    });
});
