const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("IXFI GMP Protocol Complete Test", function () {
    let ixfi;
    let owner, relayer, user1, user2, destinationContract;
    
    beforeEach(async function () {
        [owner, relayer, user1, user2, destinationContract] = await ethers.getSigners();
        
        // Deploy IXFI contract
        const IXFI = await ethers.getContractFactory("IXFI");
        ixfi = await IXFI.deploy("IXFI Token", "IXFI", 18);
        await ixfi.waitForDeployment();
        
        // Set up relayer
        await ixfi.setRelayerStatus(relayer.address, true);
        
        console.log("✅ IXFI deployed at:", await ixfi.getAddress());
        console.log("✅ Relayer set up:", relayer.address);
    });

    describe("GMP Cross-Chain Contract Calls", function () {
        it("Should execute a complete cross-chain contract call flow", async function () {
            const destinationChain = "ethereum";
            const payload = ethers.toUtf8Bytes("Hello Cross-Chain!");
            const payloadHash = ethers.keccak256(payload);
            
            console.log("\n🔄 Testing Cross-Chain Contract Call Flow");
            console.log("Payload:", ethers.toUtf8String(payload));
            console.log("Payload Hash:", payloadHash);
            
            // Step 1: User calls contract on destination chain
            const tx1 = await ixfi.connect(user1).callContract(
                destinationChain,
                destinationContract.address,
                payload
            );
            
            const receipt1 = await tx1.wait();
            const callEvent = receipt1.logs.find(log => 
                log.fragment && log.fragment.name === "ContractCall"
            );
            
            expect(callEvent).to.not.be.undefined;
            console.log("✅ ContractCall event emitted");
            
            // Step 2: Relayer processes the event and creates command
            const commandId = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ['string', 'string', 'address', 'bytes32', 'uint256'],
                    [
                        destinationChain,
                        user1.address,
                        destinationContract.address,
                        payloadHash,
                        receipt1.blockNumber
                    ]
                )
            );
            
            console.log("Command ID:", commandId);
            
            // Step 3: Relayer executes command to approve contract call
            const commandData = ethers.AbiCoder.defaultAbiCoder().encode(
                ['uint256', 'bytes32', 'string', 'string', 'address', 'bytes32', 'bytes'],
                [
                    0, // APPROVE_CONTRACT_CALL
                    commandId,
                    "source-chain",
                    user1.address,
                    destinationContract.address,
                    payloadHash,
                    payload
                ]
            );
            
            const tx2 = await ixfi.connect(relayer).execute(commandData, '0x00');
            const receipt2 = await tx2.wait();
            
            console.log("✅ Command executed by relayer");
            
            // Step 4: Verify contract call was approved and executed
            const isApproved = await ixfi.isContractCallApproved(
                commandId,
                "source-chain",
                user1.address,
                destinationContract.address,
                payloadHash
            );
            
            expect(isApproved).to.be.true;
            console.log("✅ Contract call approved");
            
            // Step 5: Verify payload was stored
            const storedPayload = await ixfi.getApprovedPayload(commandId);
            expect(storedPayload).to.equal(ethers.hexlify(payload));
            console.log("✅ Payload stored correctly");
            
            // Step 6: Verify validation function works
            const isValid = await ixfi.validateContractCall(
                commandId,
                "source-chain",
                user1.address,
                payloadHash
            );
            
            expect(isValid).to.be.true;
            console.log("✅ Contract call validation successful");
        });
        
        it("Should execute a complete cross-chain contract call with token flow", async function () {
            const destinationChain = "ethereum";
            const amount = ethers.parseEther("100");
            const payload = ethers.toUtf8Bytes("Hello with tokens!");
            const payloadHash = ethers.keccak256(payload);
            
            console.log("\n💰 Testing Cross-Chain Contract Call With Token Flow");
            
            // First, user needs some tokens to send
            await ixfi.connect(user1).deposit({ value: amount });
            console.log("✅ User deposited XFI and received IXFI tokens");
            
            // Step 1: User calls contract with tokens on destination chain
            const tx1 = await ixfi.connect(user1).callContractWithToken(
                destinationChain,
                destinationContract.address,
                payload,
                "IXFI",
                amount
            );
            
            const receipt1 = await tx1.wait();
            const callEvent = receipt1.logs.find(log => 
                log.fragment && log.fragment.name === "ContractCallWithToken"
            );
            
            expect(callEvent).to.not.be.undefined;
            console.log("✅ ContractCallWithToken event emitted");
            
            // Check user's balance was reduced
            const userBalance = await ixfi.balanceOf(user1.address);
            expect(userBalance).to.equal(0);
            console.log("✅ User tokens burned");
            
            // Step 2: Relayer processes and approves with mint
            const commandId = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ['string', 'string', 'address', 'bytes32', 'string', 'uint256', 'uint256'],
                    [
                        destinationChain,
                        user1.address,
                        destinationContract.address,
                        payloadHash,
                        "IXFI",
                        amount,
                        receipt1.blockNumber
                    ]
                )
            );
            
            const commandData = ethers.AbiCoder.defaultAbiCoder().encode(
                ['uint256', 'bytes32', 'string', 'string', 'address', 'bytes32', 'string', 'uint256', 'bytes'],
                [
                    1, // APPROVE_CONTRACT_CALL_WITH_MINT
                    commandId,
                    "source-chain",
                    user1.address,
                    destinationContract.address,
                    payloadHash,
                    "IXFI",
                    amount,
                    payload
                ]
            );
            
            const tx2 = await ixfi.connect(relayer).execute(commandData, '0x00');
            await tx2.wait();
            
            console.log("✅ Command with mint executed by relayer");
            
            // Step 3: Verify contract call with mint was approved
            const isApproved = await ixfi.isContractCallAndMintApproved(
                commandId,
                "source-chain",
                user1.address,
                destinationContract.address,
                payloadHash,
                "IXFI",
                amount
            );
            
            expect(isApproved).to.be.true;
            console.log("✅ Contract call with mint approved");
            
            // Step 4: Verify tokens were minted to destination contract
            const contractBalance = await ixfi.balanceOf(destinationContract.address);
            expect(contractBalance).to.equal(amount);
            console.log("✅ Tokens minted to destination contract");
        });
    });

    describe("GMP Token Transfer", function () {
        it("Should execute a complete cross-chain token transfer", async function () {
            const destinationChain = "polygon";
            const amount = ethers.parseEther("50");
            
            console.log("\n💸 Testing Cross-Chain Token Transfer");
            
            // User deposits XFI to get IXFI
            await ixfi.connect(user1).deposit({ value: amount });
            console.log("✅ User deposited XFI and received IXFI tokens");
            
            // Step 1: User sends tokens to another chain
            const tx1 = await ixfi.connect(user1).sendToken(
                destinationChain,
                user2.address,
                "IXFI",
                amount
            );
            
            const receipt1 = await tx1.wait();
            const tokenSentEvent = receipt1.logs.find(log => 
                log.fragment && log.fragment.name === "TokenSent"
            );
            
            expect(tokenSentEvent).to.not.be.undefined;
            console.log("✅ TokenSent event emitted");
            
            // Check sender's balance was reduced
            const senderBalance = await ixfi.balanceOf(user1.address);
            expect(senderBalance).to.equal(0);
            console.log("✅ Sender tokens burned");
            
            // Step 2: Relayer processes and mints on destination
            const commandId = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ['string', 'string', 'address', 'string', 'uint256', 'uint256'],
                    [
                        destinationChain,
                        user1.address,
                        user2.address,
                        "IXFI",
                        amount,
                        receipt1.blockNumber
                    ]
                )
            );
            
            const commandData = ethers.AbiCoder.defaultAbiCoder().encode(
                ['uint256', 'bytes32', 'string', 'address', 'string', 'uint256'],
                [
                    4, // MINT_TOKEN
                    commandId,
                    "IXFI",
                    user2.address,
                    "IXFI",
                    amount
                ]
            );
            
            const tx2 = await ixfi.connect(relayer).execute(commandData, '0x00');
            await tx2.wait();
            
            console.log("✅ Mint command executed by relayer");
            
            // Step 3: Verify tokens were minted to recipient
            const recipientBalance = await ixfi.balanceOf(user2.address);
            expect(recipientBalance).to.equal(amount);
            console.log("✅ Tokens minted to recipient on destination chain");
        });
    });

    describe("Relayer Management", function () {
        it("Should manage relayer permissions correctly", async function () {
            console.log("\n🔐 Testing Relayer Management");
            
            // Test adding relayer
            await ixfi.setRelayerStatus(user1.address, true);
            expect(await ixfi.relayers(user1.address)).to.be.true;
            console.log("✅ Relayer added successfully");
            
            // Test removing relayer
            await ixfi.setRelayerStatus(user1.address, false);
            expect(await ixfi.relayers(user1.address)).to.be.false;
            console.log("✅ Relayer removed successfully");
            
            // Test non-relayer cannot execute commands
            const commandData = ethers.AbiCoder.defaultAbiCoder().encode(
                ['uint256', 'bytes32', 'string', 'address', 'string', 'uint256'],
                [4, ethers.randomBytes(32), "IXFI", user2.address, "IXFI", 100]
            );
            
            await expect(
                ixfi.connect(user1).execute(commandData, '0x00')
            ).to.be.revertedWith("Only relayer");
            console.log("✅ Non-relayer cannot execute commands");
        });
    });

    describe("XFI Backing", function () {
        it("Should maintain 1:1 XFI backing", async function () {
            console.log("\n⚖️  Testing XFI Backing Mechanism");
            
            const depositAmount = ethers.parseEther("100");
            
            // Test deposit
            const initialBalance = await ethers.provider.getBalance(await ixfi.getAddress());
            
            await ixfi.connect(user1).deposit({ value: depositAmount });
            
            const finalBalance = await ethers.provider.getBalance(await ixfi.getAddress());
            const userTokens = await ixfi.balanceOf(user1.address);
            
            expect(finalBalance - initialBalance).to.equal(depositAmount);
            expect(userTokens).to.equal(depositAmount);
            console.log("✅ XFI properly escrowed and IXFI minted");
            
            // Test withdrawal
            await ixfi.connect(user1).withdraw(depositAmount);
            
            const finalBalanceAfterWithdraw = await ethers.provider.getBalance(await ixfi.getAddress());
            const userTokensAfterWithdraw = await ixfi.balanceOf(user1.address);
            
            expect(finalBalanceAfterWithdraw).to.equal(initialBalance);
            expect(userTokensAfterWithdraw).to.equal(0);
            console.log("✅ XFI properly returned and IXFI burned");
        });
    });
});
