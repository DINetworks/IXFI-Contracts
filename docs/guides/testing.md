# Testing Guide

This comprehensive guide covers testing strategies, frameworks, and best practices for IXFI Protocol smart contracts and integrations.

## Overview

IXFI Protocol testing encompasses multiple layers:

1. **Unit Tests**: Individual contract function testing
2. **Integration Tests**: Multi-contract interaction testing
3. **End-to-End Tests**: Full protocol workflow testing
4. **Cross-Chain Tests**: Multi-blockchain integration testing
5. **Security Tests**: Vulnerability and attack vector testing
6. **Performance Tests**: Gas optimization and load testing

## Testing Environment Setup

### Prerequisites

```bash
# Core dependencies
npm install --save-dev @nomicfoundation/hardhat-toolbox
npm install --save-dev @nomicfoundation/hardhat-network-helpers
npm install --save-dev @nomicfoundation/hardhat-chai-matchers
npm install --save-dev @typechain/hardhat
npm install --save-dev solidity-coverage
npm install --save-dev hardhat-gas-reporter

# Testing frameworks
npm install --save-dev chai mocha
npm install --save-dev @openzeppelin/test-helpers
npm install --save-dev ethereum-waffle

# Advanced testing tools
npm install --save-dev @tenderly/hardhat-tenderly
npm install --save-dev hardhat-tracer
npm install --save-dev hardhat-contract-sizer
```

### Hardhat Configuration

```javascript
// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-network-helpers");
require("solidity-coverage");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");

module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },

  networks: {
    hardhat: {
      chainId: 31337,
      forking: {
        url: process.env.ETHEREUM_RPC_URL,
        blockNumber: 18500000 // Pin for consistency
      },
      // Increase gas limit for complex tests
      gas: 30000000,
      gasPrice: 20000000000,
      // Enable console.log in contracts
      loggingEnabled: true
    },

    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    }
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    gasPrice: 20,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY
  },

  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true
  },

  mocha: {
    timeout: 60000 // 60 seconds
  }
};
```

## Unit Testing

### Basic Contract Testing

```javascript
// test/unit/IXFI.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("IXFI Token", function () {
  async function deployIXFIFixture() {
    const [owner, addr1, addr2] = await ethers.getSigners();

    const IXFI = await ethers.getContractFactory("IXFI");
    const ixfi = await IXFI.deploy();

    return { ixfi, owner, addr1, addr2 };
  }

  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      const { ixfi } = await loadFixture(deployIXFIFixture);

      expect(await ixfi.name()).to.equal("IXFI Protocol");
      expect(await ixfi.symbol()).to.equal("IXFI");
    });

    it("Should set the right decimals", async function () {
      const { ixfi } = await loadFixture(deployIXFIFixture);
      expect(await ixfi.decimals()).to.equal(18);
    });

    it("Should assign the total supply to the owner", async function () {
      const { ixfi, owner } = await loadFixture(deployIXFIFixture);
      
      const ownerBalance = await ixfi.balanceOf(owner.address);
      const totalSupply = await ixfi.totalSupply();
      
      expect(ownerBalance).to.equal(totalSupply);
    });
  });

  describe("Transfers", function () {
    it("Should transfer tokens between accounts", async function () {
      const { ixfi, owner, addr1, addr2 } = await loadFixture(deployIXFIFixture);

      // Transfer 50 tokens from owner to addr1
      await expect(ixfi.transfer(addr1.address, 50))
        .to.changeTokenBalances(ixfi, [owner, addr1], [-50, 50]);

      // Transfer 50 tokens from addr1 to addr2
      await expect(ixfi.connect(addr1).transfer(addr2.address, 50))
        .to.changeTokenBalances(ixfi, [addr1, addr2], [-50, 50]);
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const { ixfi, owner, addr1 } = await loadFixture(deployIXFIFixture);
      const initialOwnerBalance = await ixfi.balanceOf(owner.address);

      await expect(
        ixfi.connect(addr1).transfer(owner.address, 1)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");

      expect(await ixfi.balanceOf(owner.address)).to.equal(initialOwnerBalance);
    });

    it("Should emit Transfer events", async function () {
      const { ixfi, owner, addr1 } = await loadFixture(deployIXFIFixture);

      await expect(ixfi.transfer(addr1.address, 50))
        .to.emit(ixfi, "Transfer")
        .withArgs(owner.address, addr1.address, 50);
    });
  });

  describe("Allowances", function () {
    it("Should approve and transfer from", async function () {
      const { ixfi, owner, addr1, addr2 } = await loadFixture(deployIXFIFixture);

      // Approve addr1 to spend 100 tokens
      await ixfi.approve(addr1.address, 100);
      expect(await ixfi.allowance(owner.address, addr1.address)).to.equal(100);

      // Transfer 50 tokens from owner to addr2 via addr1
      await expect(ixfi.connect(addr1).transferFrom(owner.address, addr2.address, 50))
        .to.changeTokenBalances(ixfi, [owner, addr2], [-50, 50]);

      // Check remaining allowance
      expect(await ixfi.allowance(owner.address, addr1.address)).to.equal(50);
    });

    it("Should fail transferFrom without allowance", async function () {
      const { ixfi, owner, addr1, addr2 } = await loadFixture(deployIXFIFixture);

      await expect(
        ixfi.connect(addr1).transferFrom(owner.address, addr2.address, 50)
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });
  });
});
```

### Cross-Chain Aggregator Testing

```javascript
// test/unit/CrossChainAggregator.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("CrossChainAggregator", function () {
  async function deployAggregatorFixture() {
    const [owner, user1, user2, feeRecipient] = await ethers.getSigners();

    // Deploy mock contracts
    const MockGateway = await ethers.getContractFactory("MockAxelarGateway");
    const gateway = await MockGateway.deploy();

    const MockGasService = await ethers.getContractFactory("MockAxelarGasService");
    const gasService = await MockGasService.deploy();

    const MockOracle = await ethers.getContractFactory("MockDIAOracle");
    const oracle = await MockOracle.deploy();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const tokenA = await MockERC20.deploy("Token A", "TKA", 18);
    const tokenB = await MockERC20.deploy("Token B", "TKB", 18);

    // Deploy router mocks
    const MockRouter = await ethers.getContractFactory("MockRouter");
    const uniswapV2Router = await MockRouter.deploy();
    const sushiswapRouter = await MockRouter.deploy();

    // Deploy aggregator
    const CrossChainAggregator = await ethers.getContractFactory("CrossChainAggregator");
    const aggregator = await CrossChainAggregator.deploy(
      gateway.address,
      gasService.address,
      oracle.address,
      [uniswapV2Router.address, sushiswapRouter.address],
      [0, 1] // Router types
    );

    // Setup initial state
    await tokenA.mint(user1.address, ethers.utils.parseEther("1000"));
    await tokenB.mint(user1.address, ethers.utils.parseEther("1000"));
    
    await aggregator.setFeeRecipient(feeRecipient.address);
    await aggregator.setProtocolFee(30); // 0.3%

    return {
      aggregator,
      gateway,
      gasService,
      oracle,
      tokenA,
      tokenB,
      uniswapV2Router,
      sushiswapRouter,
      owner,
      user1,
      user2,
      feeRecipient
    };
  }

  describe("Deployment", function () {
    it("Should set correct initial parameters", async function () {
      const { aggregator, gateway, gasService, oracle } = await loadFixture(deployAggregatorFixture);

      expect(await aggregator.axelarGateway()).to.equal(gateway.address);
      expect(await aggregator.axelarGasService()).to.equal(gasService.address);
      expect(await aggregator.gasOracle()).to.equal(oracle.address);
    });

    it("Should set router configurations", async function () {
      const { aggregator, uniswapV2Router, sushiswapRouter } = await loadFixture(deployAggregatorFixture);

      const router0 = await aggregator.routers(0);
      const router1 = await aggregator.routers(1);

      expect(router0).to.equal(uniswapV2Router.address);
      expect(router1).to.equal(sushiswapRouter.address);
    });
  });

  describe("Swap Execution", function () {
    it("Should execute simple swap", async function () {
      const { aggregator, tokenA, tokenB, user1 } = await loadFixture(deployAggregatorFixture);

      const amountIn = ethers.utils.parseEther("10");
      const minAmountOut = ethers.utils.parseEther("9");

      // Approve tokens
      await tokenA.connect(user1).approve(aggregator.address, amountIn);

      // Execute swap
      const swapParams = {
        tokenIn: tokenA.address,
        tokenOut: tokenB.address,
        amountIn: amountIn,
        minAmountOut: minAmountOut,
        routerType: 0,
        to: user1.address,
        deadline: Math.floor(Date.now() / 1000) + 300,
        swapData: "0x"
      };

      await expect(aggregator.connect(user1).executeSwap(swapParams))
        .to.emit(aggregator, "SwapExecuted")
        .withArgs(
          user1.address,
          tokenA.address,
          tokenB.address,
          amountIn,
          ethers.utils.parseEther("9.5"), // Mock router returns 95% of input
          0
        );
    });

    it("Should fail with insufficient slippage protection", async function () {
      const { aggregator, tokenA, tokenB, user1 } = await loadFixture(deployAggregatorFixture);

      const amountIn = ethers.utils.parseEther("10");
      const minAmountOut = ethers.utils.parseEther("10"); // Too high

      await tokenA.connect(user1).approve(aggregator.address, amountIn);

      const swapParams = {
        tokenIn: tokenA.address,
        tokenOut: tokenB.address,
        amountIn: amountIn,
        minAmountOut: minAmountOut,
        routerType: 0,
        to: user1.address,
        deadline: Math.floor(Date.now() / 1000) + 300,
        swapData: "0x"
      };

      await expect(
        aggregator.connect(user1).executeSwap(swapParams)
      ).to.be.revertedWith("Insufficient output amount");
    });

    it("Should collect protocol fees", async function () {
      const { aggregator, tokenA, tokenB, user1, feeRecipient } = await loadFixture(deployAggregatorFixture);

      const amountIn = ethers.utils.parseEther("10");
      const minAmountOut = ethers.utils.parseEther("9");

      await tokenA.connect(user1).approve(aggregator.address, amountIn);

      const swapParams = {
        tokenIn: tokenA.address,
        tokenOut: tokenB.address,
        amountIn: amountIn,
        minAmountOut: minAmountOut,
        routerType: 0,
        to: user1.address,
        deadline: Math.floor(Date.now() / 1000) + 300,
        swapData: "0x"
      };

      const initialFeeRecipientBalance = await tokenB.balanceOf(feeRecipient.address);
      
      await aggregator.connect(user1).executeSwap(swapParams);

      const finalFeeRecipientBalance = await tokenB.balanceOf(feeRecipient.address);
      expect(finalFeeRecipientBalance).to.be.gt(initialFeeRecipientBalance);
    });
  });

  describe("Quote System", function () {
    it("Should return accurate quotes", async function () {
      const { aggregator, tokenA, tokenB } = await loadFixture(deployAggregatorFixture);

      const amountIn = ethers.utils.parseEther("10");
      const [amountOut, gasEstimate] = await aggregator.getQuote(
        tokenA.address,
        tokenB.address,
        amountIn,
        0
      );

      expect(amountOut).to.equal(ethers.utils.parseEther("9.5"));
      expect(gasEstimate).to.be.gt(0);
    });

    it("Should return quotes from all routers", async function () {
      const { aggregator, tokenA, tokenB } = await loadFixture(deployAggregatorFixture);

      const amountIn = ethers.utils.parseEther("10");
      const quotes = await aggregator.getAllQuotes(tokenA.address, tokenB.address, amountIn);

      expect(quotes).to.have.length(2);
      expect(quotes[0].success).to.be.true;
      expect(quotes[1].success).to.be.true;
    });
  });

  describe("Cross-Chain Operations", function () {
    it("Should initiate cross-chain swap", async function () {
      const { aggregator, tokenA, tokenB, user1 } = await loadFixture(deployAggregatorFixture);

      const amountIn = ethers.utils.parseEther("10");
      await tokenA.connect(user1).approve(aggregator.address, amountIn);

      const crossChainParams = {
        sourceSwap: {
          tokenIn: tokenA.address,
          tokenOut: tokenB.address,
          amountIn: amountIn,
          minAmountOut: ethers.utils.parseEther("9"),
          routerType: 0,
          to: aggregator.address,
          deadline: Math.floor(Date.now() / 1000) + 300,
          swapData: "0x"
        },
        destinationChain: "polygon",
        destinationToken: tokenB.address,
        destinationReceiver: user1.address,
        minDestinationAmount: ethers.utils.parseEther("8"),
        destinationSwapData: "0x"
      };

      await expect(
        aggregator.connect(user1).crossChainSwap(crossChainParams, { value: ethers.utils.parseEther("0.01") })
      ).to.emit(aggregator, "CrossChainSwapInitiated");
    });
  });

  describe("Access Control", function () {
    it("Should only allow owner to set parameters", async function () {
      const { aggregator, user1 } = await loadFixture(deployAggregatorFixture);

      await expect(
        aggregator.connect(user1).setProtocolFee(50)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should allow owner to pause contract", async function () {
      const { aggregator, owner } = await loadFixture(deployAggregatorFixture);

      await aggregator.connect(owner).pause();
      expect(await aggregator.paused()).to.be.true;
    });
  });
});
```

## Integration Testing

### Multi-Contract Integration

```javascript
// test/integration/full-protocol.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Full Protocol Integration", function () {
  async function deployFullProtocolFixture() {
    const [owner, user1, user2, relayer, feeRecipient] = await ethers.getSigners();

    // Deploy all contracts
    const IXFI = await ethers.getContractFactory("IXFI");
    const ixfi = await IXFI.deploy();

    const MockGateway = await ethers.getContractFactory("MockAxelarGateway");
    const gateway = await MockGateway.deploy();

    const MockGasService = await ethers.getContractFactory("MockAxelarGasService");
    const gasService = await MockGasService.deploy();

    const MockOracle = await ethers.getContractFactory("MockDIAOracle");
    const oracle = await MockOracle.deploy();

    const MockRouter = await ethers.getContractFactory("MockRouter");
    const router = await MockRouter.deploy();

    const CrossChainAggregator = await ethers.getContractFactory("CrossChainAggregator");
    const aggregator = await CrossChainAggregator.deploy(
      gateway.address,
      gasService.address,
      oracle.address,
      [router.address],
      [0]
    );

    const MetaTxGasCreditVault = await ethers.getContractFactory("MetaTxGasCreditVault");
    const gasCreditVault = await MetaTxGasCreditVault.deploy(ixfi.address, oracle.address);

    const MetaTxGateway = await ethers.getContractFactory("MetaTxGateway");
    const metaTxGateway = await MetaTxGateway.deploy(
      aggregator.address,
      gasCreditVault.address,
      gateway.address,
      gasService.address
    );

    const IXFIExecutable = await ethers.getContractFactory("IXFIExecutable");
    const executable = await IXFIExecutable.deploy(
      gateway.address,
      gasService.address,
      aggregator.address
    );

    // Setup tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    const usdt = await MockERC20.deploy("Tether USD", "USDT", 6);

    // Initial setup
    await ixfi.transfer(user1.address, ethers.utils.parseEther("1000"));
    await usdc.mint(user1.address, "1000000000"); // 1000 USDC (6 decimals)
    await usdt.mint(user1.address, "1000000000"); // 1000 USDT (6 decimals)

    // Configure contracts
    await aggregator.setFeeRecipient(feeRecipient.address);
    await aggregator.setProtocolFee(30);
    await metaTxGateway.setRelayerStatus(relayer.address, true);
    await oracle.setPrice("gwei", ethers.utils.parseUnits("20", "gwei"));

    return {
      ixfi,
      aggregator,
      metaTxGateway,
      gasCreditVault,
      executable,
      usdc,
      usdt,
      oracle,
      owner,
      user1,
      user2,
      relayer,
      feeRecipient
    };
  }

  describe("Basic Swap Flow", function () {
    it("Should complete full swap workflow", async function () {
      const { aggregator, usdc, usdt, user1 } = await loadFixture(deployFullProtocolFixture);

      const amountIn = "100000000"; // 100 USDC
      const minAmountOut = "95000000"; // 95 USDT

      // 1. User approves tokens
      await usdc.connect(user1).approve(aggregator.address, amountIn);

      // 2. Get quote
      const [amountOut, gasEstimate] = await aggregator.getQuote(
        usdc.address,
        usdt.address,
        amountIn,
        0
      );

      expect(amountOut).to.be.gte(minAmountOut);

      // 3. Execute swap
      const swapParams = {
        tokenIn: usdc.address,
        tokenOut: usdt.address,
        amountIn: amountIn,
        minAmountOut: minAmountOut,
        routerType: 0,
        to: user1.address,
        deadline: Math.floor(Date.now() / 1000) + 300,
        swapData: "0x"
      };

      const initialUSDCBalance = await usdc.balanceOf(user1.address);
      const initialUSDTBalance = await usdt.balanceOf(user1.address);

      await aggregator.connect(user1).executeSwap(swapParams);

      const finalUSDCBalance = await usdc.balanceOf(user1.address);
      const finalUSDTBalance = await usdt.balanceOf(user1.address);

      expect(finalUSDCBalance).to.equal(initialUSDCBalance.sub(amountIn));
      expect(finalUSDTBalance).to.be.gt(initialUSDTBalance);
    });
  });

  describe("Meta-Transaction Flow", function () {
    it("Should execute gasless transaction", async function () {
      const { aggregator, metaTxGateway, gasCreditVault, ixfi, usdc, usdt, user1, relayer } = 
        await loadFixture(deployFullProtocolFixture);

      // 1. User deposits gas credits
      const gasDepositAmount = ethers.utils.parseEther("100");
      await ixfi.connect(user1).approve(gasCreditVault.address, gasDepositAmount);
      await gasCreditVault.connect(user1).depositGasCredit(gasDepositAmount);

      // 2. Prepare meta-transaction
      const swapAmount = "50000000"; // 50 USDC
      await usdc.connect(user1).approve(aggregator.address, swapAmount);

      const metaTxParams = {
        user: user1.address,
        tokenIn: usdc.address,
        tokenOut: usdt.address,
        amountIn: swapAmount,
        minAmountOut: "47500000", // 47.5 USDT
        routerType: 0,
        deadline: Math.floor(Date.now() / 1000) + 300,
        swapData: "0x"
      };

      // 3. Relayer executes meta-transaction
      const initialUserBalance = await usdt.balanceOf(user1.address);
      const initialGasCredit = await gasCreditVault.getGasCredit(user1.address);

      await metaTxGateway.connect(relayer).executeMetaSwap(metaTxParams);

      const finalUserBalance = await usdt.balanceOf(user1.address);
      const finalGasCredit = await gasCreditVault.getGasCredit(user1.address);

      expect(finalUserBalance).to.be.gt(initialUserBalance);
      expect(finalGasCredit).to.be.lt(initialGasCredit);
    });
  });

  describe("Cross-Chain Integration", function () {
    it("Should handle cross-chain message execution", async function () {
      const { executable, aggregator, usdc, usdt, user1 } = await loadFixture(deployFullProtocolFixture);

      // Simulate cross-chain message execution
      const sourceChain = "ethereum";
      const sourceAddress = "0x1234567890123456789012345678901234567890";
      
      const swapData = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256", "uint256", "uint8", "address"],
        [usdc.address, usdt.address, "100000000", "95000000", 0, user1.address]
      );

      // Mint tokens to executable contract for the swap
      await usdc.mint(executable.address, "100000000");

      const initialBalance = await usdt.balanceOf(user1.address);

      // Execute cross-chain swap
      await executable._testExecute(sourceChain, sourceAddress, swapData);

      const finalBalance = await usdt.balanceOf(user1.address);
      expect(finalBalance).to.be.gt(initialBalance);
    });
  });

  describe("Fee Distribution", function () {
    it("Should correctly distribute protocol fees", async function () {
      const { aggregator, usdc, usdt, user1, feeRecipient } = await loadFixture(deployFullProtocolFixture);

      const amountIn = "1000000000"; // 1000 USDC
      await usdc.connect(user1).approve(aggregator.address, amountIn);

      const swapParams = {
        tokenIn: usdc.address,
        tokenOut: usdt.address,
        amountIn: amountIn,
        minAmountOut: "950000000",
        routerType: 0,
        to: user1.address,
        deadline: Math.floor(Date.now() / 1000) + 300,
        swapData: "0x"
      };

      const initialFeeBalance = await usdt.balanceOf(feeRecipient.address);
      
      await aggregator.connect(user1).executeSwap(swapParams);

      const finalFeeBalance = await usdt.balanceOf(feeRecipient.address);
      
      // Check that fees were collected (0.3% of output)
      const expectedFee = ethers.BigNumber.from("950000000").mul(30).div(10000);
      expect(finalFeeBalance.sub(initialFeeBalance)).to.be.closeTo(expectedFee, "1000000");
    });
  });

  describe("Emergency Scenarios", function () {
    it("Should handle contract pause", async function () {
      const { aggregator, usdc, usdt, user1, owner } = await loadFixture(deployFullProtocolFixture);

      // Pause contract
      await aggregator.connect(owner).pause();

      const swapParams = {
        tokenIn: usdc.address,
        tokenOut: usdt.address,
        amountIn: "100000000",
        minAmountOut: "95000000",
        routerType: 0,
        to: user1.address,
        deadline: Math.floor(Date.now() / 1000) + 300,
        swapData: "0x"
      };

      await expect(
        aggregator.connect(user1).executeSwap(swapParams)
      ).to.be.revertedWith("Pausable: paused");

      // Unpause and try again
      await aggregator.connect(owner).unpause();
      
      await usdc.connect(user1).approve(aggregator.address, "100000000");
      await expect(
        aggregator.connect(user1).executeSwap(swapParams)
      ).to.emit(aggregator, "SwapExecuted");
    });
  });
});
```

## Fork Testing

### Mainnet Fork Tests

```javascript
// test/fork/mainnet-integration.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { impersonateAccount, setBalance } = require("@nomicfoundation/hardhat-network-helpers");

describe("Mainnet Fork Integration", function () {
  const USDC_ADDRESS = "0xA0b86a33E6441e1a02c4e4670dd96EA0f25A632";
  const USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
  const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const UNISWAP_V2_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

  let aggregator;
  let usdc, usdt, weth;
  let usdcWhale, user;

  before(async function () {
    // Fork mainnet at specific block
    await network.provider.request({
      method: "hardhat_reset",
      params: [{
        forking: {
          jsonRpcUrl: process.env.ETHEREUM_RPC_URL,
          blockNumber: 18500000
        }
      }]
    });

    // Get signers
    [user] = await ethers.getSigners();

    // Impersonate USDC whale
    const usdcWhaleAddress = "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503"; // Binance wallet
    await impersonateAccount(usdcWhaleAddress);
    await setBalance(usdcWhaleAddress, ethers.utils.parseEther("100"));
    usdcWhale = await ethers.getSigner(usdcWhaleAddress);

    // Get token contracts
    usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);
    usdt = await ethers.getContractAt("IERC20", USDT_ADDRESS);
    weth = await ethers.getContractAt("IERC20", WETH_ADDRESS);

    // Deploy aggregator with real router addresses
    const MockGateway = await ethers.getContractFactory("MockAxelarGateway");
    const gateway = await MockGateway.deploy();

    const MockGasService = await ethers.getContractFactory("MockAxelarGasService");
    const gasService = await MockGasService.deploy();

    const MockOracle = await ethers.getContractFactory("MockDIAOracle");
    const oracle = await MockOracle.deploy();

    const CrossChainAggregator = await ethers.getContractFactory("CrossChainAggregator");
    aggregator = await CrossChainAggregator.deploy(
      gateway.address,
      gasService.address,
      oracle.address,
      [UNISWAP_V2_ROUTER, UNISWAP_V3_ROUTER],
      [0, 10] // Uniswap V2 and V3
    );

    // Transfer USDC from whale to user
    const transferAmount = ethers.utils.parseUnits("10000", 6); // 10,000 USDC
    await usdc.connect(usdcWhale).transfer(user.address, transferAmount);
  });

  it("Should execute real Uniswap V2 swap", async function () {
    const amountIn = ethers.utils.parseUnits("1000", 6); // 1000 USDC
    const minAmountOut = ethers.utils.parseUnits("950", 6); // 950 USDT (5% slippage)

    await usdc.connect(user).approve(aggregator.address, amountIn);

    const initialUSDCBalance = await usdc.balanceOf(user.address);
    const initialUSDTBalance = await usdt.balanceOf(user.address);

    const swapParams = {
      tokenIn: USDC_ADDRESS,
      tokenOut: USDT_ADDRESS,
      amountIn: amountIn,
      minAmountOut: minAmountOut,
      routerType: 0, // Uniswap V2
      to: user.address,
      deadline: Math.floor(Date.now() / 1000) + 300,
      swapData: "0x"
    };

    await aggregator.connect(user).executeSwap(swapParams);

    const finalUSDCBalance = await usdc.balanceOf(user.address);
    const finalUSDTBalance = await usdt.balanceOf(user.address);

    expect(finalUSDCBalance).to.equal(initialUSDCBalance.sub(amountIn));
    expect(finalUSDTBalance).to.be.gt(initialUSDTBalance.add(minAmountOut));
  });

  it("Should execute real Uniswap V3 swap", async function () {
    const amountIn = ethers.utils.parseUnits("1000", 6); // 1000 USDC
    const minAmountOut = ethers.utils.parseUnits("950", 6); // 950 USDT

    await usdc.connect(user).approve(aggregator.address, amountIn);

    const swapParams = {
      tokenIn: USDC_ADDRESS,
      tokenOut: USDT_ADDRESS,
      amountIn: amountIn,
      minAmountOut: minAmountOut,
      routerType: 10, // Uniswap V3
      to: user.address,
      deadline: Math.floor(Date.now() / 1000) + 300,
      swapData: "0x"
    };

    await expect(aggregator.connect(user).executeSwap(swapParams))
      .to.emit(aggregator, "SwapExecuted");
  });

  it("Should compare quotes from different DEXes", async function () {
    const amountIn = ethers.utils.parseUnits("1000", 6);

    const quotes = await aggregator.getAllQuotes(USDC_ADDRESS, USDT_ADDRESS, amountIn);

    expect(quotes).to.have.length.greaterThan(0);
    
    // Check that we get different quotes from different routers
    const v2Quote = quotes.find(q => q.routerType === 0);
    const v3Quote = quotes.find(q => q.routerType === 10);

    if (v2Quote && v3Quote) {
      console.log(`Uniswap V2 quote: ${ethers.utils.formatUnits(v2Quote.amountOut, 6)} USDT`);
      console.log(`Uniswap V3 quote: ${ethers.utils.formatUnits(v3Quote.amountOut, 6)} USDT`);
    }
  });

  it("Should handle large swaps efficiently", async function () {
    const largeAmount = ethers.utils.parseUnits("5000", 6); // 5000 USDC
    
    await usdc.connect(user).approve(aggregator.address, largeAmount);

    const gasEstimate = await aggregator.connect(user).estimateGas.executeSwap({
      tokenIn: USDC_ADDRESS,
      tokenOut: USDT_ADDRESS,
      amountIn: largeAmount,
      minAmountOut: ethers.utils.parseUnits("4750", 6),
      routerType: 0,
      to: user.address,
      deadline: Math.floor(Date.now() / 1000) + 300,
      swapData: "0x"
    });

    console.log(`Gas estimate for large swap: ${gasEstimate.toString()}`);
    expect(gasEstimate).to.be.lt(300000); // Should be efficient
  });
});
```

## Security Testing

### Vulnerability Testing

```javascript
// test/security/security.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Security Tests", function () {
  // ... fixture setup ...

  describe("Reentrancy Protection", function () {
    it("Should prevent reentrancy attacks", async function () {
      // Deploy malicious contract that attempts reentrancy
      const MaliciousContract = await ethers.getContractFactory("MaliciousReentrant");
      const malicious = await MaliciousContract.deploy();

      // ... test reentrancy attack prevention ...
    });
  });

  describe("Access Control", function () {
    it("Should enforce owner-only functions", async function () {
      const { aggregator, user1 } = await loadFixture(deployAggregatorFixture);

      const ownerOnlyFunctions = [
        "setProtocolFee",
        "setFeeRecipient",
        "addRouter",
        "removeRouter",
        "pause",
        "unpause"
      ];

      for (const funcName of ownerOnlyFunctions) {
        await expect(
          aggregator.connect(user1)[funcName](...getDefaultArgs(funcName))
        ).to.be.revertedWith("Ownable: caller is not the owner");
      }
    });
  });

  describe("Input Validation", function () {
    it("Should validate swap parameters", async function () {
      const { aggregator, tokenA, tokenB, user1 } = await loadFixture(deployAggregatorFixture);

      // Test zero amount
      await expect(
        aggregator.connect(user1).executeSwap({
          tokenIn: tokenA.address,
          tokenOut: tokenB.address,
          amountIn: 0,
          minAmountOut: 0,
          routerType: 0,
          to: user1.address,
          deadline: Math.floor(Date.now() / 1000) + 300,
          swapData: "0x"
        })
      ).to.be.revertedWith("Invalid amount");

      // Test same token
      await expect(
        aggregator.connect(user1).executeSwap({
          tokenIn: tokenA.address,
          tokenOut: tokenA.address,
          amountIn: ethers.utils.parseEther("1"),
          minAmountOut: ethers.utils.parseEther("1"),
          routerType: 0,
          to: user1.address,
          deadline: Math.floor(Date.now() / 1000) + 300,
          swapData: "0x"
        })
      ).to.be.revertedWith("Same token");

      // Test expired deadline
      await expect(
        aggregator.connect(user1).executeSwap({
          tokenIn: tokenA.address,
          tokenOut: tokenB.address,
          amountIn: ethers.utils.parseEther("1"),
          minAmountOut: ethers.utils.parseEther("0.95"),
          routerType: 0,
          to: user1.address,
          deadline: Math.floor(Date.now() / 1000) - 300, // Past deadline
          swapData: "0x"
        })
      ).to.be.revertedWith("Expired");
    });
  });

  describe("Slippage Protection", function () {
    it("Should protect against front-running", async function () {
      const { aggregator, tokenA, tokenB, user1 } = await loadFixture(deployAggregatorFixture);

      const amountIn = ethers.utils.parseEther("100");
      const minAmountOut = ethers.utils.parseEther("99"); // Very tight slippage

      await tokenA.connect(user1).approve(aggregator.address, amountIn);

      // This should fail due to slippage (mock router returns 95%)
      await expect(
        aggregator.connect(user1).executeSwap({
          tokenIn: tokenA.address,
          tokenOut: tokenB.address,
          amountIn: amountIn,
          minAmountOut: minAmountOut,
          routerType: 0,
          to: user1.address,
          deadline: Math.floor(Date.now() / 1000) + 300,
          swapData: "0x"
        })
      ).to.be.revertedWith("Insufficient output amount");
    });
  });

  describe("Gas Griefing Protection", function () {
    it("Should limit gas consumption", async function () {
      // Test that contract operations don't consume excessive gas
      const { aggregator, tokenA, tokenB, user1 } = await loadFixture(deployAggregatorFixture);

      const amountIn = ethers.utils.parseEther("1");
      await tokenA.connect(user1).approve(aggregator.address, amountIn);

      const gasEstimate = await aggregator.connect(user1).estimateGas.executeSwap({
        tokenIn: tokenA.address,
        tokenOut: tokenB.address,
        amountIn: amountIn,
        minAmountOut: ethers.utils.parseEther("0.95"),
        routerType: 0,
        to: user1.address,
        deadline: Math.floor(Date.now() / 1000) + 300,
        swapData: "0x"
      });

      expect(gasEstimate).to.be.lt(200000); // Reasonable gas limit
    });
  });
});
```

## Performance Testing

### Gas Optimization Tests

```javascript
// test/performance/gas-optimization.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Gas Optimization Tests", function () {
  let aggregator, tokenA, tokenB, user;

  beforeEach(async function () {
    // Setup contracts...
  });

  it("Should optimize gas for batch operations", async function () {
    const batchSize = 10;
    const amounts = Array(batchSize).fill(ethers.utils.parseEther("1"));
    
    // Test individual operations
    let totalGasIndividual = ethers.BigNumber.from(0);
    for (let i = 0; i < batchSize; i++) {
      const gasEstimate = await aggregator.estimateGas.executeSwap(/* params */);
      totalGasIndividual = totalGasIndividual.add(gasEstimate);
    }

    // Test batch operation
    const batchGasEstimate = await aggregator.estimateGas.executeBatchSwap(/* batch params */);

    // Batch should be more efficient
    expect(batchGasEstimate).to.be.lt(totalGasIndividual.mul(8).div(10)); // 20% savings
  });

  it("Should measure gas consumption across routers", async function () {
    const amountIn = ethers.utils.parseEther("100");
    const routerTypes = [0, 1, 10, 30]; // Different router types

    const gasUsage = {};

    for (const routerType of routerTypes) {
      const gasEstimate = await aggregator.estimateGas.executeSwap({
        tokenIn: tokenA.address,
        tokenOut: tokenB.address,
        amountIn: amountIn,
        minAmountOut: ethers.utils.parseEther("95"),
        routerType: routerType,
        to: user.address,
        deadline: Math.floor(Date.now() / 1000) + 300,
        swapData: "0x"
      });

      gasUsage[routerType] = gasEstimate.toNumber();
    }

    console.log("Gas usage by router type:", gasUsage);
    
    // Verify all are within reasonable bounds
    Object.values(gasUsage).forEach(gas => {
      expect(gas).to.be.lt(300000);
    });
  });
});
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Compile contracts
      run: npx hardhat compile
    
    - name: Run unit tests
      run: npx hardhat test test/unit/
      env:
        ETHEREUM_RPC_URL: ${{ secrets.ETHEREUM_RPC_URL }}
    
    - name: Run integration tests
      run: npx hardhat test test/integration/
      env:
        ETHEREUM_RPC_URL: ${{ secrets.ETHEREUM_RPC_URL }}
    
    - name: Run security tests
      run: npx hardhat test test/security/
    
    - name: Generate coverage report
      run: npx hardhat coverage
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
    
    - name: Contract size check
      run: npx hardhat size-contracts
    
    - name: Gas report
      run: npx hardhat test --reporter gas
      env:
        REPORT_GAS: true
        COINMARKETCAP_API_KEY: ${{ secrets.COINMARKETCAP_API_KEY }}
```

## Test Utilities

### Custom Matchers

```javascript
// test/utils/matchers.js
const { expect } = require("chai");

// Custom matcher for checking token balances
expect.extend({
  toChangeTokenBalance(received, token, accounts, expectedChanges) {
    // Implementation for checking token balance changes
  },
  
  toBeWithinSlippage(received, expected, slippageBps) {
    // Implementation for checking slippage tolerance
  }
});
```

### Test Helpers

```javascript
// test/utils/helpers.js
const { ethers } = require("hardhat");

async function setupTokens(amount = "1000") {
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  
  const tokenA = await MockERC20.deploy("Token A", "TKA", 18);
  const tokenB = await MockERC20.deploy("Token B", "TKB", 18);
  
  return { tokenA, tokenB };
}

async function fundAccount(token, account, amount) {
  await token.mint(account.address, ethers.utils.parseEther(amount));
}

function getRandomAddress() {
  return ethers.Wallet.createRandom().address;
}

module.exports = {
  setupTokens,
  fundAccount,
  getRandomAddress
};
```

## Resources

- [Hardhat Testing Guide](https://hardhat.org/tutorial/testing-contracts.html)
- [Chai Matchers](https://www.chaijs.com/api/bdd/)
- [OpenZeppelin Test Helpers](https://docs.openzeppelin.com/test-helpers/)
- [Solidity Coverage](https://github.com/sc-forks/solidity-coverage)
- [Gas Reporter](https://github.com/cgewecke/hardhat-gas-reporter)
- [Smart Contract Integration](smart-contract-integration.md)
- [Security Best Practices](security.md)
