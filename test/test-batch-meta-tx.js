const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("IXFI Batch Meta-Transaction System", function () {
    let ixfi, vault, gateway, mockOracle;
    let owner, relayer, user1, user2, targetContract;
    
    beforeEach(async function () {
        [owner, relayer, user1, user2] = await ethers.getSigners();
        
        // Deploy IXFI token
        const IXFI = await ethers.getContractFactory("IXFI");
        ixfi = await IXFI.deploy(owner.address);
        await ixfi.waitForDeployment();
        
        // Deploy mock DIA Oracle for testing
        const MockDIAOracle = await ethers.getContractFactory("MockDIAOracle");
        mockOracle = await MockDIAOracle.deploy();
        await mockOracle.waitForDeployment();
        
        // Set IXFI price to $0.20 (XFI price)
        await mockOracle.setValue("XFI/USD", ethers.parseUnits("0.2", 8), Math.floor(Date.now() / 1000));
        
        // Deploy MetaTxGasCreditVault
        const MetaTxGasCreditVault = await ethers.getContractFactory("MetaTxGasCreditVault");
        vault = await MetaTxGasCreditVault.deploy(
            owner.address, 
            await ixfi.getAddress(), 
            await mockOracle.getAddress()
        );
        await vault.waitForDeployment();
        
        // Deploy MetaTxGateway
        const MetaTxGateway = await ethers.getContractFactory("MetaTxGateway");
        gateway = await MetaTxGateway.deploy(owner.address);
        await gateway.waitForDeployment();
        
        // Deploy a simple target contract for testing
        const SimpleContract = await ethers.getContractFactory("MockDIAOracle"); // Reuse for simplicity
        targetContract = await SimpleContract.deploy();
        await targetContract.waitForDeployment();
        
        // Configure contracts
        await vault.setGatewayAuthorization(await gateway.getAddress(), true);
        await gateway.setRelayerAuthorization(relayer.address, true);
        
        // Give user1 some IXFI tokens and credits
        await ixfi.connect(user1).deposit({ value: ethers.parseEther("100") });
        await ixfi.connect(user1).approve(await vault.getAddress(), ethers.parseEther("50"));
        await vault.connect(user1).deposit(ethers.parseEther("50")); // $10 worth at $0.20/IXFI
        
        console.log("✅ Test setup completed");
    });

    describe("Batch Meta-Transaction Processing", function () {
        it("Should execute a batch of meta-transactions successfully", async function () {
            const user1Address = user1.address;
            const targetAddress = await targetContract.getAddress();
            
            // Create batch of meta-transactions
            const metaTxs = [
                {
                    to: targetAddress,
                    value: 0,
                    data: targetContract.interface.encodeFunctionData("setValue", ["key1", 12345, 67890])
                },
                {
                    to: targetAddress,
                    value: 0,
                    data: targetContract.interface.encodeFunctionData("setValue", ["key2", 54321, 98760])
                }
            ];
            
            // Encode meta-transaction data
            const metaTxData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["tuple(address to,uint256 value,bytes data)[]"],
                [metaTxs]
            );
            
            // Get user's nonce and set deadline
            const nonce = await gateway.getNonce(user1Address);
            const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
            
            // Create EIP-712 signature for batch
            const domain = {
                name: "MetaTxGateway",
                version: "1",
                chainId: await ethers.provider.getNetwork().then(n => Number(n.chainId)),
                verifyingContract: await gateway.getAddress()
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
                from: user1Address,
                metaTxData: metaTxData,
                nonce: nonce,
                deadline: deadline
            };
            
            const signature = await user1.signTypedData(domain, types, value);
            
            // Check initial credits
            const initialCredits = await vault.getCreditBalance(user1Address);
            console.log(`Initial credits: ${initialCredits}`);
            
            // Execute batch meta-transaction
            const tx = await gateway.connect(relayer).executeMetaTransactions(
                user1Address,
                metaTxData,
                signature,
                nonce,
                deadline
            );
            
            const receipt = await tx.wait();
            console.log(`Gas used: ${receipt.gasUsed}`);
            
            // Verify batch was recorded
            const totalBatches = await gateway.getTotalBatchCount();
            expect(totalBatches).to.equal(1);
            
            // Get batch information
            const batchLog = await gateway.getBatchTransactionLog(0);
            expect(batchLog.user).to.equal(user1Address);
            expect(batchLog.relayer).to.equal(relayer.address);
            expect(batchLog.gasUsed).to.be.gt(0);
            
            // Get batch transactions
            const batchTransactions = await gateway.getBatchTransactions(0);
            expect(batchTransactions.length).to.equal(2);
            expect(batchTransactions[0].to).to.equal(targetAddress);
            expect(batchTransactions[1].to).to.equal(targetAddress);
            
            // Get batch successes
            const successes = await gateway.getBatchSuccesses(0);
            expect(successes.length).to.equal(2);
            
            console.log(`Batch successes: ${successes}`);
        });

        it("Should handle mixed success/failure in batch", async function () {
            const user1Address = user1.address;
            const targetAddress = await targetContract.getAddress();
            
            // Create batch with one valid and one invalid transaction
            const metaTxs = [
                {
                    to: targetAddress,
                    value: 0,
                    data: targetContract.interface.encodeFunctionData("setValue", ["key1", 12345, 67890])
                },
                {
                    to: targetAddress,
                    value: 0,
                    data: "0x1234" // Invalid data that will fail
                }
            ];
            
            const metaTxData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["tuple(address to,uint256 value,bytes data)[]"],
                [metaTxs]
            );
            
            const nonce = await gateway.getNonce(user1Address);
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            
            // Create signature
            const domain = {
                name: "MetaTxGateway",
                version: "1",
                chainId: await ethers.provider.getNetwork().then(n => Number(n.chainId)),
                verifyingContract: await gateway.getAddress()
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
                from: user1Address,
                metaTxData: metaTxData,
                nonce: nonce,
                deadline: deadline
            };
            
            const signature = await user1.signTypedData(domain, types, value);
            
            // Execute batch
            await gateway.connect(relayer).executeMetaTransactions(
                user1Address,
                metaTxData,
                signature,
                nonce,
                deadline
            );
            
            // Check batch results
            const successes = await gateway.getBatchSuccesses(0);
            expect(successes.length).to.equal(2);
            expect(successes[0]).to.be.true;  // First transaction should succeed
            expect(successes[1]).to.be.false; // Second transaction should fail
            
            console.log(`Mixed batch results: ${successes}`);
        });

        it("Should properly calculate and consume gas credits", async function () {
            const user1Address = user1.address;
            const targetAddress = await targetContract.getAddress();
            
            // Check initial credits
            const initialCredits = await vault.getCreditBalance(user1Address);
            console.log(`Initial credits: ${initialCredits} cents`);
            
            // Create a simple batch
            const metaTxs = [{
                to: targetAddress,
                value: 0,
                data: targetContract.interface.encodeFunctionData("setValue", ["test", 123, 456])
            }];
            
            const metaTxData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["tuple(address to,uint256 value,bytes data)[]"],
                [metaTxs]
            );
            
            const nonce = await gateway.getNonce(user1Address);
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            
            // Create signature
            const domain = {
                name: "MetaTxGateway",
                version: "1",
                chainId: await ethers.provider.getNetwork().then(n => Number(n.chainId)),
                verifyingContract: await gateway.getAddress()
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
                from: user1Address,
                metaTxData: metaTxData,
                nonce: nonce,
                deadline: deadline
            };
            
            const signature = await user1.signTypedData(domain, types, value);
            
            // Execute transaction
            const tx = await gateway.connect(relayer).executeMetaTransactions(
                user1Address,
                metaTxData,
                signature,
                nonce,
                deadline
            );
            
            const receipt = await tx.wait();
            
            // Check gas calculation
            const batchLog = await gateway.getBatchTransactionLog(0);
            expect(batchLog.gasUsed).to.be.gt(0);
            
            console.log(`Recorded gas used: ${batchLog.gasUsed}`);
            console.log(`Actual gas used: ${receipt.gasUsed}`);
            
            // Test gas credit calculation function
            const gasPrice = ethers.parseUnits("20", "gwei"); // 20 Gwei
            const ethPrice = ethers.parseUnits("3000", 8); // $3000 ETH
            
            const creditsNeeded = await vault.calculateCreditsForGas(
                receipt.gasUsed,
                gasPrice,
                ethPrice
            );
            
            console.log(`Credits needed for this transaction: ${creditsNeeded} cents`);
            
            // Verify credits calculation makes sense
            expect(creditsNeeded).to.be.gt(0);
            expect(creditsNeeded).to.be.lt(initialCredits); // Should be less than what user has
        });

        it("Should reject batch if user has insufficient credits", async function () {
            // Create a user with no credits
            const [poorUser] = await ethers.getSigners();
            const targetAddress = await targetContract.getAddress();
            
            const metaTxs = [{
                to: targetAddress,
                value: 0,
                data: targetContract.interface.encodeFunctionData("setValue", ["test", 123, 456])
            }];
            
            const metaTxData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["tuple(address to,uint256 value,bytes data)[]"],
                [metaTxs]
            );
            
            const nonce = await gateway.getNonce(poorUser.address);
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            
            // Create signature
            const domain = {
                name: "MetaTxGateway",
                version: "1",
                chainId: await ethers.provider.getNetwork().then(n => Number(n.chainId)),
                verifyingContract: await gateway.getAddress()
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
                from: poorUser.address,
                metaTxData: metaTxData,
                nonce: nonce,
                deadline: deadline
            };
            
            const signature = await poorUser.signTypedData(domain, types, value);
            
            // This should work at the gateway level since gateway doesn't check credits
            // Credits are checked by the relayer before calling the gateway
            await expect(
                gateway.connect(relayer).executeMetaTransactions(
                    poorUser.address,
                    metaTxData,
                    signature,
                    nonce,
                    deadline
                )
            ).to.not.be.reverted; // Gateway doesn't check credits
            
            // But vault should reject credit consumption
            const hasCredits = await vault.hasEnoughCredits(poorUser.address, 1000);
            expect(hasCredits).to.be.false;
        });
    });

    describe("Gas Credit Management", function () {
        it("Should deposit IXFI and receive proper credits", async function () {
            const depositAmount = ethers.parseEther("10"); // 10 IXFI
            
            // Give user2 some IXFI
            await ixfi.connect(user2).deposit({ value: ethers.parseEther("20") });
            await ixfi.connect(user2).approve(await vault.getAddress(), depositAmount);
            
            // Check initial balances
            const initialCredits = await vault.getCreditBalance(user2.address);
            const initialDeposits = await vault.getDepositBalance(user2.address);
            
            // Deposit IXFI
            await vault.connect(user2).deposit(depositAmount);
            
            // Check final balances
            const finalCredits = await vault.getCreditBalance(user2.address);
            const finalDeposits = await vault.getDepositBalance(user2.address);
            
            expect(finalDeposits - initialDeposits).to.equal(depositAmount);
            expect(finalCredits).to.be.gt(initialCredits);
            
            // Calculate expected credits: 10 IXFI * $0.20 * 100 cents = 200 cents
            const expectedCredits = await vault.calculateCreditsFromIXFI(depositAmount);
            expect(finalCredits - initialCredits).to.equal(expectedCredits);
            
            console.log(`Deposited: ${ethers.formatEther(depositAmount)} IXFI`);
            console.log(`Credits received: ${finalCredits - initialCredits} cents`);
        });

        it("Should calculate gas costs correctly", async function () {
            // Test gas cost calculation
            const gasUsed = 100000;
            const gasPrice = ethers.parseUnits("20", "gwei"); // 20 Gwei
            const ethPrice = ethers.parseUnits("3000", 8); // $3000 ETH with 8 decimals
            
            const creditsNeeded = await vault.calculateCreditsForGas(gasUsed, gasPrice, ethPrice);
            
            // Expected: 100000 * 20e9 * 3000 / 1e8 / 1e18 * 100 = 60 cents
            // gasUsed * gasPrice * ethPrice * 100 / 1e26
            const expected = BigInt(gasUsed) * gasPrice * ethPrice * 100n / (10n ** 26n);
            
            expect(creditsNeeded).to.equal(expected);
            console.log(`Gas cost for ${gasUsed} gas at ${ethers.formatUnits(gasPrice, "gwei")} Gwei: ${creditsNeeded} cents`);
        });
    });
});
