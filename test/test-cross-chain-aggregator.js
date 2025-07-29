const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CrossChainAggregator", function () {
    let crossChainAggregator;
    let swapCalldataGenerator;
    let ixfiToken;
    let mockToken;
    let mockGateway;
    let mockGasService;
    let owner, user1, user2, relayer;

    beforeEach(async function () {
        [owner, user1, user2, relayer] = await ethers.getSigners();

        // Deploy mock contracts
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        ixfiToken = await MockERC20.deploy("IXFI Token", "IXFI", 18);
        mockToken = await MockERC20.deploy("Mock Token", "MOCK", 18);

        const MockAxelarGateway = await ethers.getContractFactory("MockAxelarGateway");
        mockGateway = await MockAxelarGateway.deploy();

        const MockAxelarGasService = await ethers.getContractFactory("MockAxelarGasService");
        mockGasService = await MockAxelarGasService.deploy();

        // Deploy SwapCalldataGenerator
        const SwapCalldataGenerator = await ethers.getContractFactory("SwapCalldataGenerator");
        swapCalldataGenerator = await SwapCalldataGenerator.deploy(owner.address);

        // Deploy CrossChainAggregator
        const CrossChainAggregator = await ethers.getContractFactory("CrossChainAggregator");
        crossChainAggregator = await CrossChainAggregator.deploy(
            mockGateway.address,
            mockGasService.address,
            ixfiToken.address,
            swapCalldataGenerator.address
        );

        // Setup initial state
        await crossChainAggregator.setSupportedChain(56, true); // BSC
        await crossChainAggregator.setSupportedChain(137, true); // Polygon
        
        // Mint tokens for testing
        await ixfiToken.mint(user1.address, ethers.utils.parseEther("1000"));
        await ixfiToken.mint(crossChainAggregator.address, ethers.utils.parseEther("10000"));
        await mockToken.mint(user1.address, ethers.utils.parseEther("1000"));
    });

    describe("Deployment", function () {
        it("Should set the correct owner", async function () {
            expect(await crossChainAggregator.owner()).to.equal(owner.address);
        });

        it("Should set the correct IXFI token address", async function () {
            expect(await crossChainAggregator.ixfiToken()).to.equal(ixfiToken.address);
        });

        it("Should set the correct gateway and gas service addresses", async function () {
            expect(await crossChainAggregator.gateway()).to.equal(mockGateway.address);
            expect(await crossChainAggregator.gasService()).to.equal(mockGasService.address);
        });
    });

    describe("Admin Functions", function () {
        it("Should allow owner to set supported chains", async function () {
            await crossChainAggregator.setSupportedChain(43114, true); // Avalanche
            expect(await crossChainAggregator.supportedChains(43114)).to.be.true;
        });

        it("Should not allow non-owner to set supported chains", async function () {
            await expect(
                crossChainAggregator.connect(user1).setSupportedChain(43114, true)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should allow owner to pause contract", async function () {
            await crossChainAggregator.pause();
            expect(await crossChainAggregator.paused()).to.be.true;
        });

        it("Should not allow operations when paused", async function () {
            await crossChainAggregator.pause();
            
            const swapData = {
                sourceToken: mockToken.address,
                sourceAmount: ethers.utils.parseEther("100"),
                destinationChain: "bsc",
                destinationToken: "0x55d398326f99059fF775485246999027B3197955",
                minDestinationAmount: ethers.utils.parseEther("99"),
                recipient: user1.address,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                routerCalldata: "0x"
            };

            await expect(
                crossChainAggregator.connect(user1).crossChainSwap(swapData)
            ).to.be.revertedWith("Pausable: paused");
        });
    });

    describe("Cross-Chain Swap", function () {
        let validSwapData;

        beforeEach(function () {
            validSwapData = {
                sourceToken: mockToken.address,
                sourceAmount: ethers.utils.parseEther("100"),
                destinationChain: "bsc",
                destinationToken: "0x55d398326f99059fF775485246999027B3197955",
                minDestinationAmount: ethers.utils.parseEther("99"),
                recipient: user1.address,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                routerCalldata: "0x"
            };
        });

        it("Should initiate cross-chain swap successfully", async function () {
            // Approve tokens
            await mockToken.connect(user1).approve(crossChainAggregator.address, validSwapData.sourceAmount);

            // Execute swap
            await expect(
                crossChainAggregator.connect(user1).crossChainSwap(validSwapData, {
                    value: ethers.utils.parseEther("0.1")
                })
            ).to.emit(crossChainAggregator, "CrossChainSwapInitiated");
        });

        it("Should fail with unsupported destination chain", async function () {
            validSwapData.destinationChain = "unsupported";

            await mockToken.connect(user1).approve(crossChainAggregator.address, validSwapData.sourceAmount);

            await expect(
                crossChainAggregator.connect(user1).crossChainSwap(validSwapData)
            ).to.be.revertedWith("Unsupported destination chain");
        });

        it("Should fail with expired deadline", async function () {
            validSwapData.deadline = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

            await mockToken.connect(user1).approve(crossChainAggregator.address, validSwapData.sourceAmount);

            await expect(
                crossChainAggregator.connect(user1).crossChainSwap(validSwapData)
            ).to.be.revertedWith("Swap deadline expired");
        });

        it("Should fail with insufficient token allowance", async function () {
            await expect(
                crossChainAggregator.connect(user1).crossChainSwap(validSwapData)
            ).to.be.revertedWith("ERC20: insufficient allowance");
        });

        it("Should handle IXFI token as source correctly", async function () {
            validSwapData.sourceToken = ixfiToken.address;
            
            await ixfiToken.connect(user1).approve(crossChainAggregator.address, validSwapData.sourceAmount);

            await expect(
                crossChainAggregator.connect(user1).crossChainSwap(validSwapData, {
                    value: ethers.utils.parseEther("0.1")
                })
            ).to.emit(crossChainAggregator, "CrossChainSwapInitiated");
        });

        it("Should generate unique swap ID for each swap", async function () {
            await mockToken.connect(user1).approve(crossChainAggregator.address, validSwapData.sourceAmount.mul(2));

            const tx1 = await crossChainAggregator.connect(user1).crossChainSwap(validSwapData, {
                value: ethers.utils.parseEther("0.1")
            });

            const tx2 = await crossChainAggregator.connect(user1).crossChainSwap(validSwapData, {
                value: ethers.utils.parseEther("0.1")
            });

            const receipt1 = await tx1.wait();
            const receipt2 = await tx2.wait();

            const event1 = receipt1.events.find(e => e.event === "CrossChainSwapInitiated");
            const event2 = receipt2.events.find(e => e.event === "CrossChainSwapInitiated");

            expect(event1.args.swapId).to.not.equal(event2.args.swapId);
        });
    });

    describe("Token Execution", function () {
        it("Should execute with token correctly", async function () {
            const recipient = user2.address;
            const amount = ethers.utils.parseEther("100");
            const destinationToken = mockToken.address;

            const payload = ethers.utils.defaultAbiCoder.encode(
                ["address", "uint256", "address"],
                [recipient, amount, destinationToken]
            );

            await expect(
                crossChainAggregator.executeWithToken(
                    "ethereum",
                    "0x1234567890123456789012345678901234567890",
                    payload,
                    "IXFI",
                    amount
                )
            ).to.emit(crossChainAggregator, "CrossChainSwapCompleted");
        });

        it("Should handle invalid payload gracefully", async function () {
            const invalidPayload = "0x1234";

            await expect(
                crossChainAggregator.executeWithToken(
                    "ethereum",
                    "0x1234567890123456789012345678901234567890",
                    invalidPayload,
                    "IXFI",
                    ethers.utils.parseEther("100")
                )
            ).to.be.reverted;
        });
    });

    describe("Swap Recovery", function () {
        it("Should allow owner to recover failed swaps", async function () {
            const swapId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-swap-1"));
            const amount = ethers.utils.parseEther("100");
            
            // Simulate a failed swap by creating a swap record
            await crossChainAggregator.connect(owner).recoverFailedSwap(
                swapId,
                user1.address,
                ixfiToken.address,
                amount
            );

            // Check if tokens were returned to user
            // This would require more sophisticated mocking in a real test
        });

        it("Should not allow non-owner to recover swaps", async function () {
            const swapId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-swap-1"));
            const amount = ethers.utils.parseEther("100");

            await expect(
                crossChainAggregator.connect(user1).recoverFailedSwap(
                    swapId,
                    user1.address,
                    ixfiToken.address,
                    amount
                )
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("Emergency Functions", function () {
        it("Should allow owner to emergency withdraw", async function () {
            const amount = ethers.utils.parseEther("100");
            
            await expect(
                crossChainAggregator.connect(owner).emergencyWithdraw(ixfiToken.address, amount)
            ).to.not.be.reverted;
        });

        it("Should not allow non-owner to emergency withdraw", async function () {
            const amount = ethers.utils.parseEther("100");

            await expect(
                crossChainAggregator.connect(user1).emergencyWithdraw(ixfiToken.address, amount)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("SwapCalldataGenerator", function () {
        beforeEach(async function () {
            // Configure some test routers
            await swapCalldataGenerator.configureRouter(
                1, // Ethereum
                0, // Uniswap V2
                "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
                true
            );

            await swapCalldataGenerator.configureRouter(
                1, // Ethereum
                1, // Uniswap V3
                "0xE592427A0AEce92De3Edee1F18E0157C05861564",
                true
            );
        });

        it("Should generate Uniswap V2 calldata correctly", async function () {
            const calldata = await swapCalldataGenerator.generateUniswapV2Calldata(
                ethers.utils.parseEther("1"),
                ethers.utils.parseEther("0.95"),
                [ixfiToken.address, mockToken.address],
                user1.address,
                Math.floor(Date.now() / 1000) + 3600
            );

            expect(calldata).to.not.equal("0x");
            expect(calldata.length).to.be.greaterThan(10); // Should have meaningful data
        });

        it("Should generate Uniswap V3 calldata correctly", async function () {
            const path = ethers.utils.solidityPack(
                ["address", "uint24", "address"],
                [ixfiToken.address, 3000, mockToken.address]
            );

            const calldata = await swapCalldataGenerator.generateUniswapV3ExactInputCalldata(
                ethers.utils.parseEther("1"),
                ethers.utils.parseEther("0.95"),
                path,
                user1.address,
                Math.floor(Date.now() / 1000) + 3600
            );

            expect(calldata).to.not.equal("0x");
            expect(calldata.length).to.be.greaterThan(10);
        });

        it("Should generate Curve calldata correctly", async function () {
            const poolAddress = "0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7"; // 3Pool

            const calldata = await swapCalldataGenerator.generateCurveSwapCalldata(
                poolAddress,
                0, // USDC index
                1, // USDT index
                ethers.utils.parseUnits("100", 6),
                ethers.utils.parseUnits("99", 6)
            );

            expect(calldata).to.not.equal("0x");
        });

        it("Should configure router correctly", async function () {
            await swapCalldataGenerator.configureRouter(
                56, // BSC
                3, // PancakeSwap
                "0x10ED43C718714eb63d5aA57B78B54704E256024E",
                true
            );

            const config = await swapCalldataGenerator.getRouterConfig(56, 3);
            expect(config.isActive).to.be.true;
            expect(config.routerAddress).to.equal("0x10ED43C718714eb63d5aA57B78B54704E256024E");
            expect(config.routerType).to.equal(3);
        });

        it("Should set chain support correctly", async function () {
            await swapCalldataGenerator.setChainSupport(42161, true); // Arbitrum
            expect(await swapCalldataGenerator.supportedChains(42161)).to.be.true;
        });

        it("Should batch configure routers correctly", async function () {
            const chainIds = [137, 137, 137]; // Polygon
            const routerTypes = [0, 1, 4]; // Different router types
            const routerAddresses = [
                "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
                "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
                "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506"
            ];
            const activeStates = [true, true, false];

            await swapCalldataGenerator.batchConfigureRouters(
                chainIds,
                routerTypes,
                routerAddresses,
                activeStates
            );

            // Check first router
            const config1 = await swapCalldataGenerator.getRouterConfig(137, 0);
            expect(config1.isActive).to.be.true;
            expect(config1.routerAddress).to.equal(routerAddresses[0]);

            // Check disabled router
            const config3 = await swapCalldataGenerator.getRouterConfig(137, 4);
            expect(config3.isActive).to.be.false;
        });

        it("Should get optimal router correctly", async function () {
            // This test would require more sophisticated logic
            // For now, we test that it returns a configured router
            const [routerAddress, routerType] = await swapCalldataGenerator.getOptimalRouter(
                1, // Ethereum
                ixfiToken.address,
                mockToken.address,
                ethers.utils.parseEther("1")
            );

            expect(routerAddress).to.equal("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");
            expect(routerType).to.equal(0); // Uniswap V2
        });

        it("Should revert when no active router found", async function () {
            await expect(
                swapCalldataGenerator.getOptimalRouter(
                    999, // Unsupported chain
                    ixfiToken.address,
                    mockToken.address,
                    ethers.utils.parseEther("1")
                )
            ).to.be.revertedWith("No active router found");
        });
    });

    describe("Integration Tests", function () {
        it("Should complete full swap flow with calldata generation", async function () {
            // Configure router
            await swapCalldataGenerator.configureRouter(
                1, // Ethereum
                0, // Uniswap V2
                "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
                true
            );

            // Generate calldata
            const calldata = await swapCalldataGenerator.generateUniswapV2Calldata(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("95"),
                [mockToken.address, ixfiToken.address],
                crossChainAggregator.address,
                Math.floor(Date.now() / 1000) + 3600
            );

            // Prepare swap data
            const swapData = {
                sourceToken: mockToken.address,
                sourceAmount: ethers.utils.parseEther("100"),
                destinationChain: "bsc",
                destinationToken: "0x55d398326f99059fF775485246999027B3197955",
                minDestinationAmount: ethers.utils.parseEther("90"),
                recipient: user1.address,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                routerCalldata: calldata
            };

            // Approve and execute swap
            await mockToken.connect(user1).approve(crossChainAggregator.address, swapData.sourceAmount);

            await expect(
                crossChainAggregator.connect(user1).crossChainSwap(swapData, {
                    value: ethers.utils.parseEther("0.1")
                })
            ).to.emit(crossChainAggregator, "CrossChainSwapInitiated");
        });
    });

    describe("Gas Optimization Tests", function () {
        it("Should use reasonable gas for cross-chain swap", async function () {
            const swapData = {
                sourceToken: mockToken.address,
                sourceAmount: ethers.utils.parseEther("100"),
                destinationChain: "bsc",
                destinationToken: "0x55d398326f99059fF775485246999027B3197955",
                minDestinationAmount: ethers.utils.parseEther("99"),
                recipient: user1.address,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                routerCalldata: "0x"
            };

            await mockToken.connect(user1).approve(crossChainAggregator.address, swapData.sourceAmount);

            const tx = await crossChainAggregator.connect(user1).crossChainSwap(swapData, {
                value: ethers.utils.parseEther("0.1")
            });

            const receipt = await tx.wait();
            
            // Gas should be reasonable (adjust threshold as needed)
            expect(receipt.gasUsed).to.be.below(500000); // 500k gas limit
        });
    });
});

// Mock contract implementations for testing
const MockERC20 = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private _decimals;
    
    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
    }
    
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
`;

const MockAxelarGateway = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockAxelarGateway {
    function callContract(
        string calldata destinationChain,
        string calldata contractAddress,
        bytes calldata payload
    ) external {
        // Mock implementation
        emit ContractCall(msg.sender, destinationChain, contractAddress, keccak256(payload), payload);
    }
    
    function callContractWithToken(
        string calldata destinationChain,
        string calldata contractAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) external {
        // Mock implementation
        emit ContractCallWithToken(msg.sender, destinationChain, contractAddress, keccak256(payload), payload, symbol, amount);
    }
    
    event ContractCall(
        address indexed sender,
        string destinationChain,
        string contractAddress,
        bytes32 indexed payloadHash,
        bytes payload
    );
    
    event ContractCallWithToken(
        address indexed sender,
        string destinationChain,
        string contractAddress,
        bytes32 indexed payloadHash,
        bytes payload,
        string symbol,
        uint256 amount
    );
}
`;

const MockAxelarGasService = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockAxelarGasService {
    function payNativeGasForContractCall(
        address sender,
        string calldata destinationChain,
        string calldata contractAddress,
        bytes calldata payload,
        address refundAddress
    ) external payable {
        // Mock implementation
        emit NativeGasPaidForContractCall(sender, destinationChain, contractAddress, keccak256(payload), msg.value, refundAddress);
    }
    
    function payNativeGasForContractCallWithToken(
        address sender,
        string calldata destinationChain,
        string calldata contractAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount,
        address refundAddress
    ) external payable {
        // Mock implementation
        emit NativeGasPaidForContractCallWithToken(sender, destinationChain, contractAddress, keccak256(payload), symbol, amount, msg.value, refundAddress);
    }
    
    event NativeGasPaidForContractCall(
        address indexed sourceAddress,
        string destinationChain,
        string destinationAddress,
        bytes32 indexed payloadHash,
        uint256 gasFeeAmount,
        address refundAddress
    );
    
    event NativeGasPaidForContractCallWithToken(
        address indexed sourceAddress,
        string destinationChain,
        string destinationAddress,
        bytes32 indexed payloadHash,
        string symbol,
        uint256 amount,
        uint256 gasFeeAmount,
        address refundAddress
    );
}
`;
