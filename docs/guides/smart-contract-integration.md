# Smart Contract Integration Guide

This comprehensive guide covers integrating IXFI Protocol directly into smart contracts, including cross-chain operations, DEX aggregation, and meta-transaction implementations.

## Overview

IXFI Protocol provides multiple smart contract integration patterns:

1. **Direct Contract Calls**: Integrate IXFI contracts directly
2. **Interface Implementation**: Implement IXFI interfaces in your contracts
3. **Proxy Integration**: Use IXFI as a backend service
4. **Cross-Chain Integration**: Multi-chain contract interactions
5. **Meta-Transaction Support**: Gasless transaction implementations

## Core Contracts

### IXFI Gateway Interface

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IIXFIGateway {
    struct TransferParams {
        string destinationChain;
        string destinationAddress;
        string symbol;
        uint256 amount;
        bytes payload;
    }

    struct CallContractParams {
        string destinationChain;
        string destinationContract;
        bytes payload;
        string symbol;
        uint256 amount;
    }

    function transferTokens(TransferParams calldata params) external payable;
    function callContract(CallContractParams calldata params) external payable;
    function callContractWithToken(CallContractParams calldata params) external payable;
}
```

### Cross-Chain Aggregator Interface

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICrossChainAggregator {
    struct SwapParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        uint8 routerType;
        address to;
        uint256 deadline;
        bytes swapData;
    }

    struct CrossChainSwapParams {
        SwapParams sourceSwap;
        string destinationChain;
        address destinationToken;
        address destinationReceiver;
        uint256 minDestinationAmount;
        bytes destinationSwapData;
    }

    function executeSwap(SwapParams calldata params) external payable returns (uint256 amountOut);
    function crossChainSwap(CrossChainSwapParams calldata params) external payable;
    function getQuote(address tokenIn, address tokenOut, uint256 amountIn, uint8 routerType) 
        external view returns (uint256 amountOut, uint256 gasEstimate);
}
```

## Basic Integration Patterns

### Pattern 1: Direct DEX Aggregation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/ICrossChainAggregator.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract DEXIntegrationExample is ReentrancyGuard {
    ICrossChainAggregator public immutable aggregator;
    
    event SwapExecuted(
        address indexed user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(address _aggregator) {
        aggregator = ICrossChainAggregator(_aggregator);
    }

    function swapTokens(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint8 routerType
    ) external nonReentrant returns (uint256 amountOut) {
        require(amountIn > 0, "Invalid amount");
        require(tokenIn != tokenOut, "Same token");

        // Transfer tokens from user
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        // Approve aggregator
        IERC20(tokenIn).approve(address(aggregator), amountIn);

        // Execute swap
        ICrossChainAggregator.SwapParams memory params = ICrossChainAggregator.SwapParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            minAmountOut: minAmountOut,
            routerType: routerType,
            to: msg.sender,
            deadline: block.timestamp + 300, // 5 minutes
            swapData: ""
        });

        amountOut = aggregator.executeSwap(params);

        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }

    function getSwapQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint8 routerType
    ) external view returns (uint256 amountOut, uint256 gasEstimate) {
        return aggregator.getQuote(tokenIn, tokenOut, amountIn, routerType);
    }

    function getBestQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint8 bestRouter, uint256 bestAmountOut) {
        uint256 bestAmount = 0;
        uint8 bestType = 0;

        // Check multiple router types
        uint8[] memory routerTypes = new uint8[](6);
        routerTypes[0] = 0;  // Uniswap V2
        routerTypes[1] = 1;  // SushiSwap V2
        routerTypes[2] = 10; // Uniswap V3
        routerTypes[3] = 30; // Curve
        routerTypes[4] = 35; // Balancer
        routerTypes[5] = 36; // 1inch

        for (uint i = 0; i < routerTypes.length; i++) {
            (uint256 amountOut,) = aggregator.getQuote(tokenIn, tokenOut, amountIn, routerTypes[i]);
            if (amountOut > bestAmount) {
                bestAmount = amountOut;
                bestType = routerTypes[i];
            }
        }

        return (bestType, bestAmount);
    }
}
```

### Pattern 2: Cross-Chain Token Bridge

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IIXFIGateway.sol";
import "./interfaces/IAxelarExecutable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CrossChainBridge is IAxelarExecutable {
    IIXFIGateway public immutable gateway;
    
    mapping(bytes32 => bool) public processedCommands;
    mapping(address => mapping(string => uint256)) public pendingTransfers;

    event CrossChainTransferInitiated(
        address indexed user,
        string destinationChain,
        string destinationAddress,
        address token,
        uint256 amount,
        bytes32 commandId
    );

    event CrossChainTransferCompleted(
        address indexed user,
        address token,
        uint256 amount,
        bytes32 commandId
    );

    constructor(address _gateway, address _axelarGateway, address _gasService) 
        IAxelarExecutable(_axelarGateway, _gasService) {
        gateway = IIXFIGateway(_gateway);
    }

    function bridgeTokens(
        string calldata destinationChain,
        string calldata destinationAddress,
        address token,
        uint256 amount
    ) external payable {
        require(amount > 0, "Invalid amount");
        require(bytes(destinationChain).length > 0, "Invalid destination chain");

        // Transfer tokens from user
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        // Approve gateway
        IERC20(token).approve(address(gateway), amount);

        // Get token symbol
        string memory symbol = getTokenSymbol(token);

        // Prepare transfer parameters
        IIXFIGateway.TransferParams memory params = IIXFIGateway.TransferParams({
            destinationChain: destinationChain,
            destinationAddress: destinationAddress,
            symbol: symbol,
            amount: amount,
            payload: abi.encode(msg.sender, token, amount)
        });

        // Execute cross-chain transfer
        gateway.transferTokens{value: msg.value}(params);

        // Track pending transfer
        bytes32 commandId = keccak256(abi.encode(msg.sender, destinationChain, amount, block.timestamp));
        pendingTransfers[msg.sender][destinationChain] += amount;

        emit CrossChainTransferInitiated(
            msg.sender,
            destinationChain,
            destinationAddress,
            token,
            amount,
            commandId
        );
    }

    function _execute(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal override {
        (address user, address token, uint256 amount) = abi.decode(payload, (address, address, uint256));
        
        bytes32 commandId = keccak256(abi.encode(sourceChain, sourceAddress, payload));
        require(!processedCommands[commandId], "Already processed");
        
        processedCommands[commandId] = true;

        // Mint or transfer tokens to user
        _handleTokenReceipt(user, token, amount);

        emit CrossChainTransferCompleted(user, token, amount, commandId);
    }

    function _handleTokenReceipt(address user, address token, uint256 amount) internal {
        // Implementation depends on token model:
        // 1. For wrapped tokens: mint new tokens
        // 2. For native tokens: transfer from pool
        // 3. For vault tokens: release from vault
        
        IERC20(token).transfer(user, amount);
    }

    function getTokenSymbol(address token) internal view returns (string memory) {
        // Get token symbol for cross-chain identification
        (bool success, bytes memory data) = token.staticcall(abi.encodeWithSignature("symbol()"));
        if (success && data.length > 0) {
            return abi.decode(data, (string));
        }
        return "UNKNOWN";
    }

    function estimateGasFee(
        string calldata destinationChain,
        address token,
        uint256 amount
    ) external view returns (uint256) {
        // Estimate gas fees for cross-chain transfer
        return gasService.estimateGasFee(destinationChain, address(this), abi.encode(token, amount));
    }
}
```

### Pattern 3: Meta-Transaction Integration

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IMetaTxGateway.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract MetaTxIntegration is ReentrancyGuard {
    using ECDSA for bytes32;

    IMetaTxGateway public immutable metaTxGateway;
    
    mapping(address => uint256) public nonces;
    mapping(bytes32 => bool) public executedTransactions;

    struct MetaTransaction {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        bytes data;
        uint256 chainId;
    }

    event MetaTransactionExecuted(
        address indexed user,
        address indexed relayer,
        bytes32 indexed txHash,
        bool success
    );

    constructor(address _metaTxGateway) {
        metaTxGateway = IMetaTxGateway(_metaTxGateway);
    }

    function executeMetaTransaction(
        MetaTransaction calldata metaTx,
        bytes calldata signature
    ) external nonReentrant returns (bool success, bytes memory returnData) {
        require(metaTx.chainId == block.chainid, "Invalid chain");
        require(metaTx.nonce == nonces[metaTx.from], "Invalid nonce");

        bytes32 txHash = getTransactionHash(metaTx);
        require(!executedTransactions[txHash], "Transaction already executed");

        // Verify signature
        address signer = txHash.toEthSignedMessageHash().recover(signature);
        require(signer == metaTx.from, "Invalid signature");

        // Mark as executed
        executedTransactions[txHash] = true;
        nonces[metaTx.from]++;

        // Execute transaction
        (success, returnData) = metaTx.to.call{value: metaTx.value, gas: metaTx.gas}(metaTx.data);

        emit MetaTransactionExecuted(metaTx.from, msg.sender, txHash, success);
    }

    function executeMetaTransactionWithGasCredit(
        MetaTransaction calldata metaTx,
        bytes calldata signature,
        uint256 gasCredit
    ) external nonReentrant {
        // Use gas credits from meta-tx gateway
        require(metaTxGateway.getGasCredit(metaTx.from) >= gasCredit, "Insufficient gas credit");

        // Execute meta-transaction
        (bool success,) = this.executeMetaTransaction(metaTx, signature);
        require(success, "Meta-transaction failed");

        // Deduct gas credit
        metaTxGateway.deductGasCredit(metaTx.from, gasCredit);
    }

    function getTransactionHash(MetaTransaction calldata metaTx) public pure returns (bytes32) {
        return keccak256(abi.encode(
            metaTx.from,
            metaTx.to,
            metaTx.value,
            metaTx.gas,
            metaTx.nonce,
            keccak256(metaTx.data),
            metaTx.chainId
        ));
    }

    function getNonce(address user) external view returns (uint256) {
        return nonces[user];
    }
}
```

## Advanced Integration Patterns

### Pattern 4: Yield Farming with Cross-Chain

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/ICrossChainAggregator.sol";
import "./interfaces/IIXFIGateway.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract CrossChainYieldFarm is ReentrancyGuard {
    struct Pool {
        address stakingToken;
        address rewardToken;
        uint256 rewardRate;
        uint256 totalStaked;
        uint256 lastUpdateTime;
        uint256 rewardPerTokenStored;
        bool isActive;
        string destinationChain;
    }

    struct UserInfo {
        uint256 stakedAmount;
        uint256 rewardPerTokenPaid;
        uint256 rewards;
        uint256 lastStakeTime;
    }

    ICrossChainAggregator public immutable aggregator;
    IIXFIGateway public immutable gateway;

    mapping(uint256 => Pool) public pools;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    uint256 public poolCount;

    event Staked(address indexed user, uint256 indexed poolId, uint256 amount);
    event Withdrawn(address indexed user, uint256 indexed poolId, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 indexed poolId, uint256 amount);
    event CrossChainStakingInitiated(address indexed user, uint256 indexed poolId, string destinationChain);

    constructor(address _aggregator, address _gateway) {
        aggregator = ICrossChainAggregator(_aggregator);
        gateway = IIXFIGateway(_gateway);
    }

    function createPool(
        address stakingToken,
        address rewardToken,
        uint256 rewardRate,
        string calldata destinationChain
    ) external returns (uint256 poolId) {
        poolId = poolCount++;
        
        pools[poolId] = Pool({
            stakingToken: stakingToken,
            rewardToken: rewardToken,
            rewardRate: rewardRate,
            totalStaked: 0,
            lastUpdateTime: block.timestamp,
            rewardPerTokenStored: 0,
            isActive: true,
            destinationChain: destinationChain
        });
    }

    function stake(uint256 poolId, uint256 amount) external nonReentrant {
        require(pools[poolId].isActive, "Pool not active");
        require(amount > 0, "Cannot stake 0");

        _updateReward(poolId, msg.sender);

        Pool storage pool = pools[poolId];
        UserInfo storage user = userInfo[poolId][msg.sender];

        IERC20(pool.stakingToken).transferFrom(msg.sender, address(this), amount);

        user.stakedAmount += amount;
        pool.totalStaked += amount;
        user.lastStakeTime = block.timestamp;

        emit Staked(msg.sender, poolId, amount);
    }

    function crossChainStake(
        uint256 poolId,
        uint256 amount,
        address tokenToSwap,
        uint8 routerType
    ) external payable nonReentrant {
        require(pools[poolId].isActive, "Pool not active");
        require(amount > 0, "Cannot stake 0");

        Pool storage pool = pools[poolId];

        // Step 1: Swap tokens to staking token if needed
        if (tokenToSwap != pool.stakingToken) {
            IERC20(tokenToSwap).transferFrom(msg.sender, address(this), amount);
            IERC20(tokenToSwap).approve(address(aggregator), amount);

            ICrossChainAggregator.SwapParams memory swapParams = ICrossChainAggregator.SwapParams({
                tokenIn: tokenToSwap,
                tokenOut: pool.stakingToken,
                amountIn: amount,
                minAmountOut: 0, // Should calculate based on slippage
                routerType: routerType,
                to: address(this),
                deadline: block.timestamp + 300,
                swapData: ""
            });

            amount = aggregator.executeSwap(swapParams);
        } else {
            IERC20(tokenToSwap).transferFrom(msg.sender, address(this), amount);
        }

        // Step 2: Transfer to destination chain if needed
        if (bytes(pool.destinationChain).length > 0) {
            IERC20(pool.stakingToken).approve(address(gateway), amount);

            IIXFIGateway.TransferParams memory transferParams = IIXFIGateway.TransferParams({
                destinationChain: pool.destinationChain,
                destinationAddress: address(this).toString(),
                symbol: getTokenSymbol(pool.stakingToken),
                amount: amount,
                payload: abi.encode(msg.sender, poolId, amount)
            });

            gateway.transferTokens{value: msg.value}(transferParams);

            emit CrossChainStakingInitiated(msg.sender, poolId, pool.destinationChain);
        } else {
            // Local staking
            _stake(poolId, msg.sender, amount);
        }
    }

    function withdraw(uint256 poolId, uint256 amount) external nonReentrant {
        UserInfo storage user = userInfo[poolId][msg.sender];
        require(user.stakedAmount >= amount, "Insufficient staked amount");

        _updateReward(poolId, msg.sender);

        Pool storage pool = pools[poolId];

        user.stakedAmount -= amount;
        pool.totalStaked -= amount;

        IERC20(pool.stakingToken).transfer(msg.sender, amount);

        emit Withdrawn(msg.sender, poolId, amount);
    }

    function claimRewards(uint256 poolId) external nonReentrant {
        _updateReward(poolId, msg.sender);

        UserInfo storage user = userInfo[poolId][msg.sender];
        uint256 reward = user.rewards;

        if (reward > 0) {
            user.rewards = 0;
            Pool storage pool = pools[poolId];
            IERC20(pool.rewardToken).transfer(msg.sender, reward);

            emit RewardsClaimed(msg.sender, poolId, reward);
        }
    }

    function _stake(uint256 poolId, address user, uint256 amount) internal {
        _updateReward(poolId, user);

        Pool storage pool = pools[poolId];
        UserInfo storage userStake = userInfo[poolId][user];

        userStake.stakedAmount += amount;
        pool.totalStaked += amount;
        userStake.lastStakeTime = block.timestamp;

        emit Staked(user, poolId, amount);
    }

    function _updateReward(uint256 poolId, address user) internal {
        Pool storage pool = pools[poolId];
        UserInfo storage userStake = userInfo[poolId][user];

        pool.rewardPerTokenStored = rewardPerToken(poolId);
        pool.lastUpdateTime = block.timestamp;

        if (user != address(0)) {
            userStake.rewards = earned(poolId, user);
            userStake.rewardPerTokenPaid = pool.rewardPerTokenStored;
        }
    }

    function rewardPerToken(uint256 poolId) public view returns (uint256) {
        Pool storage pool = pools[poolId];
        
        if (pool.totalStaked == 0) {
            return pool.rewardPerTokenStored;
        }

        return pool.rewardPerTokenStored + 
            (((block.timestamp - pool.lastUpdateTime) * pool.rewardRate * 1e18) / pool.totalStaked);
    }

    function earned(uint256 poolId, address user) public view returns (uint256) {
        UserInfo storage userStake = userInfo[poolId][user];
        
        return (userStake.stakedAmount * 
            (rewardPerToken(poolId) - userStake.rewardPerTokenPaid)) / 1e18 + userStake.rewards;
    }

    function getTokenSymbol(address token) internal view returns (string memory) {
        (bool success, bytes memory data) = token.staticcall(abi.encodeWithSignature("symbol()"));
        if (success && data.length > 0) {
            return abi.decode(data, (string));
        }
        return "UNKNOWN";
    }
}
```

### Pattern 5: Flash Loan Integration

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/ICrossChainAggregator.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Interface for flash loan provider (e.g., Aave, dYdX)
interface IFlashLoanProvider {
    function flashLoan(address asset, uint256 amount, bytes calldata params) external;
}

contract FlashSwapArbitrage is ReentrancyGuard {
    ICrossChainAggregator public immutable aggregator;
    IFlashLoanProvider public immutable flashLoanProvider;

    struct ArbitrageParams {
        address tokenA;
        address tokenB;
        uint256 amountIn;
        uint8 routerTypeA;
        uint8 routerTypeB;
        uint256 minProfit;
    }

    event ArbitrageExecuted(
        address indexed executor,
        address tokenA,
        address tokenB,
        uint256 amountIn,
        uint256 profit
    );

    constructor(address _aggregator, address _flashLoanProvider) {
        aggregator = ICrossChainAggregator(_aggregator);
        flashLoanProvider = IFlashLoanProvider(_flashLoanProvider);
    }

    function executeArbitrage(ArbitrageParams calldata params) external nonReentrant {
        // Initiate flash loan
        bytes memory data = abi.encode(msg.sender, params);
        flashLoanProvider.flashLoan(params.tokenA, params.amountIn, data);
    }

    function onFlashLoan(
        address asset,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external {
        require(msg.sender == address(flashLoanProvider), "Invalid caller");

        (address executor, ArbitrageParams memory params) = abi.decode(data, (address, ArbitrageParams));

        // Step 1: Swap A -> B on first DEX
        IERC20(asset).approve(address(aggregator), amount);
        
        ICrossChainAggregator.SwapParams memory swapAtoB = ICrossChainAggregator.SwapParams({
            tokenIn: params.tokenA,
            tokenOut: params.tokenB,
            amountIn: amount,
            minAmountOut: 0,
            routerType: params.routerTypeA,
            to: address(this),
            deadline: block.timestamp + 60,
            swapData: ""
        });

        uint256 amountB = aggregator.executeSwap(swapAtoB);

        // Step 2: Swap B -> A on second DEX
        IERC20(params.tokenB).approve(address(aggregator), amountB);

        ICrossChainAggregator.SwapParams memory swapBtoA = ICrossChainAggregator.SwapParams({
            tokenIn: params.tokenB,
            tokenOut: params.tokenA,
            amountIn: amountB,
            minAmountOut: amount + fee, // Must cover loan + fee
            routerType: params.routerTypeB,
            to: address(this),
            deadline: block.timestamp + 60,
            swapData: ""
        });

        uint256 amountA = aggregator.executeSwap(swapBtoA);

        // Calculate profit
        uint256 totalCost = amount + fee;
        require(amountA > totalCost, "No profit");
        
        uint256 profit = amountA - totalCost;
        require(profit >= params.minProfit, "Insufficient profit");

        // Repay flash loan
        IERC20(asset).transfer(address(flashLoanProvider), totalCost);

        // Send profit to executor
        IERC20(asset).transfer(executor, profit);

        emit ArbitrageExecuted(executor, params.tokenA, params.tokenB, amount, profit);
    }

    function checkArbitrageOpportunity(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        uint8 routerTypeA,
        uint8 routerTypeB
    ) external view returns (bool profitable, uint256 estimatedProfit) {
        // Get quote for A -> B
        (uint256 amountB,) = aggregator.getQuote(tokenA, tokenB, amountIn, routerTypeA);
        
        // Get quote for B -> A
        (uint256 amountA,) = aggregator.getQuote(tokenB, tokenA, amountB, routerTypeB);
        
        // Calculate flash loan fee (assuming 0.1%)
        uint256 flashLoanFee = amountIn / 1000;
        uint256 totalCost = amountIn + flashLoanFee;
        
        profitable = amountA > totalCost;
        estimatedProfit = profitable ? amountA - totalCost : 0;
    }
}
```

## Testing Integration

### Hardhat Test Setup

```javascript
// test/integration.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("IXFI Smart Contract Integration", function () {
  let gateway, aggregator, metaTxGateway;
  let owner, user1, user2;
  let testContract;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock contracts
    const Gateway = await ethers.getContractFactory("MockIXFIGateway");
    gateway = await Gateway.deploy();

    const Aggregator = await ethers.getContractFactory("MockCrossChainAggregator");
    aggregator = await Aggregator.deploy();

    const MetaTxGateway = await ethers.getContractFactory("MockMetaTxGateway");
    metaTxGateway = await MetaTxGateway.deploy();

    // Deploy test contract
    const TestContract = await ethers.getContractFactory("DEXIntegrationExample");
    testContract = await TestContract.deploy(aggregator.address);
  });

  describe("DEX Integration", function () {
    it("Should execute swap correctly", async function () {
      const tokenA = "0x" + "1".repeat(40);
      const tokenB = "0x" + "2".repeat(40);
      const amountIn = ethers.utils.parseEther("1");
      const minAmountOut = ethers.utils.parseEther("0.95");

      // Mock token contracts
      const MockToken = await ethers.getContractFactory("MockERC20");
      const mockTokenA = await MockToken.deploy("TokenA", "TKA", 18);
      const mockTokenB = await MockToken.deploy("TokenB", "TKB", 18);

      // Mint tokens to user
      await mockTokenA.mint(user1.address, amountIn);
      await mockTokenA.connect(user1).approve(testContract.address, amountIn);

      // Execute swap
      await expect(
        testContract.connect(user1).swapTokens(
          mockTokenA.address,
          mockTokenB.address,
          amountIn,
          minAmountOut,
          0 // Router type
        )
      ).to.emit(testContract, "SwapExecuted");
    });

    it("Should get best quote from multiple routers", async function () {
      const tokenA = "0x" + "1".repeat(40);
      const tokenB = "0x" + "2".repeat(40);
      const amountIn = ethers.utils.parseEther("1");

      const [bestRouter, bestAmount] = await testContract.getBestQuote(
        tokenA,
        tokenB,
        amountIn
      );

      expect(bestRouter).to.be.a('number');
      expect(bestAmount).to.be.a('object'); // BigNumber
    });
  });

  describe("Cross-Chain Bridge", function () {
    let bridgeContract;

    beforeEach(async function () {
      const Bridge = await ethers.getContractFactory("CrossChainBridge");
      bridgeContract = await Bridge.deploy(
        gateway.address,
        ethers.constants.AddressZero, // Mock Axelar gateway
        ethers.constants.AddressZero  // Mock gas service
      );
    });

    it("Should initiate cross-chain transfer", async function () {
      const MockToken = await ethers.getContractFactory("MockERC20");
      const token = await MockToken.deploy("TestToken", "TEST", 18);
      
      const amount = ethers.utils.parseEther("1");
      await token.mint(user1.address, amount);
      await token.connect(user1).approve(bridgeContract.address, amount);

      await expect(
        bridgeContract.connect(user1).bridgeTokens(
          "polygon",
          user1.address,
          token.address,
          amount,
          { value: ethers.utils.parseEther("0.01") }
        )
      ).to.emit(bridgeContract, "CrossChainTransferInitiated");
    });
  });

  describe("Meta-Transaction", function () {
    let metaTxContract;

    beforeEach(async function () {
      const MetaTx = await ethers.getContractFactory("MetaTxIntegration");
      metaTxContract = await MetaTx.deploy(metaTxGateway.address);
    });

    it("Should execute meta-transaction with valid signature", async function () {
      const nonce = await metaTxContract.getNonce(user1.address);
      const chainId = await ethers.provider.getNetwork().then(n => n.chainId);

      const metaTx = {
        from: user1.address,
        to: metaTxContract.address,
        value: 0,
        gas: 100000,
        nonce: nonce,
        data: "0x",
        chainId: chainId
      };

      const txHash = await metaTxContract.getTransactionHash(metaTx);
      const signature = await user1.signMessage(ethers.utils.arrayify(txHash));

      await expect(
        metaTxContract.executeMetaTransaction(metaTx, signature)
      ).to.emit(metaTxContract, "MetaTransactionExecuted");
    });
  });
});
```

### Mock Contracts for Testing

```solidity
// contracts/mocks/MockERC20.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_
    ) ERC20(name, symbol) {
        _decimals = decimals_;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}

// contracts/mocks/MockCrossChainAggregator.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockCrossChainAggregator {
    function executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint8 routerType,
        address to,
        uint256 deadline,
        bytes calldata swapData
    ) external returns (uint256) {
        // Mock implementation
        return amountIn * 95 / 100; // 5% slippage
    }

    function getQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint8 routerType
    ) external pure returns (uint256 amountOut, uint256 gasEstimate) {
        amountOut = amountIn * 95 / 100; // Mock 5% slippage
        gasEstimate = 150000; // Mock gas estimate
    }
}
```

## Deployment Scripts

### Deployment Configuration

```javascript
// scripts/deploy-integration.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Network-specific addresses
  const networkAddresses = {
    mainnet: {
      gateway: "0x...", // IXFI Gateway address on mainnet
      aggregator: "0x...", // CrossChain Aggregator address
      metaTxGateway: "0x..." // Meta-transaction gateway
    },
    polygon: {
      gateway: "0x...",
      aggregator: "0x...",
      metaTxGateway: "0x..."
    }
    // Add other networks
  };

  const network = await ethers.provider.getNetwork();
  const addresses = networkAddresses[network.name];

  if (!addresses) {
    throw new Error(`No addresses configured for network: ${network.name}`);
  }

  // Deploy DEX Integration Example
  const DEXIntegration = await ethers.getContractFactory("DEXIntegrationExample");
  const dexIntegration = await DEXIntegration.deploy(addresses.aggregator);
  await dexIntegration.deployed();
  console.log("DEX Integration deployed to:", dexIntegration.address);

  // Deploy Cross-Chain Bridge
  const CrossChainBridge = await ethers.getContractFactory("CrossChainBridge");
  const bridge = await CrossChainBridge.deploy(
    addresses.gateway,
    ethers.constants.AddressZero, // Axelar gateway (network specific)
    ethers.constants.AddressZero  // Gas service (network specific)
  );
  await bridge.deployed();
  console.log("Cross-Chain Bridge deployed to:", bridge.address);

  // Deploy Meta-Transaction Integration
  const MetaTxIntegration = await ethers.getContractFactory("MetaTxIntegration");
  const metaTxIntegration = await MetaTxIntegration.deploy(addresses.metaTxGateway);
  await metaTxIntegration.deployed();
  console.log("Meta-Transaction Integration deployed to:", metaTxIntegration.address);

  // Verify contracts on Etherscan
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("Waiting for block confirmations...");
    await dexIntegration.deployTransaction.wait(5);
    await bridge.deployTransaction.wait(5);
    await metaTxIntegration.deployTransaction.wait(5);

    console.log("Verifying contracts...");
    await verifyContract(dexIntegration.address, [addresses.aggregator]);
    await verifyContract(bridge.address, [
      addresses.gateway,
      ethers.constants.AddressZero,
      ethers.constants.AddressZero
    ]);
    await verifyContract(metaTxIntegration.address, [addresses.metaTxGateway]);
  }

  // Save deployment addresses
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId,
    deployer: deployer.address,
    contracts: {
      dexIntegration: dexIntegration.address,
      crossChainBridge: bridge.address,
      metaTxIntegration: metaTxIntegration.address
    },
    timestamp: new Date().toISOString()
  };

  const fs = require("fs");
  fs.writeFileSync(
    `deployments/${network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("Deployment completed!");
}

async function verifyContract(address, constructorArguments) {
  try {
    await hre.run("verify:verify", {
      address,
      constructorArguments
    });
    console.log(`Contract ${address} verified successfully`);
  } catch (error) {
    console.error(`Failed to verify contract ${address}:`, error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

## Security Best Practices

### 1. Access Control

```solidity
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract SecureIXFIIntegration is Ownable, Pausable {
    mapping(address => bool) public authorizedCallers;
    
    modifier onlyAuthorized() {
        require(authorizedCallers[msg.sender] || msg.sender == owner(), "Unauthorized");
        _;
    }

    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
    }

    function emergencyPause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
```

### 2. Input Validation

```solidity
function validateSwapParams(SwapParams calldata params) internal pure {
    require(params.tokenIn != address(0), "Invalid token in");
    require(params.tokenOut != address(0), "Invalid token out");
    require(params.tokenIn != params.tokenOut, "Same token");
    require(params.amountIn > 0, "Invalid amount");
    require(params.minAmountOut > 0, "Invalid min amount");
    require(params.deadline > block.timestamp, "Expired");
}
```

### 3. Reentrancy Protection

```solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SafeIXFIIntegration is ReentrancyGuard {
    function swapTokens(...) external nonReentrant {
        // Safe implementation
    }
}
```

## Resources

- [Solidity Documentation](https://docs.soliditylang.org/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Hardhat Testing](https://hardhat.org/tutorial/testing-contracts.html)
- [IXFI API Reference](../api-reference/)
- [Security Best Practices](security.md)
- [Deployment Guide](deployment.md)
