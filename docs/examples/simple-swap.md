# Simple Token Swap Example

This example demonstrates how to perform basic token swaps using IXFI Protocol, including single-chain swaps with various DEX aggregators.

## Overview

Token swaps are the fundamental operation in DeFi, allowing users to exchange one token for another. IXFI Protocol aggregates liquidity from multiple DEXs to provide optimal swap rates.

## Basic Token Swap Implementation

### Frontend Implementation

```javascript
// examples/simple-swap/frontend.js
import { ethers } from 'ethers';
import { IXFIGateway, TokenSwap } from '@ixfi/sdk';

class SimpleSwapExample {
  constructor(providerUrl, privateKey) {
    this.provider = new ethers.providers.JsonRpcProvider(providerUrl);
    this.signer = new ethers.Wallet(privateKey, this.provider);
    
    // Initialize IXFI Gateway
    this.gateway = new IXFIGateway({
      provider: this.provider,
      signer: this.signer,
      chainId: 1 // Ethereum mainnet
    });
  }

  /**
   * Execute a simple token swap
   * Example: Swap 1000 USDC for USDT
   */
  async executeSimpleSwap() {
    const swapParams = {
      tokenIn: '0xA0b86a33E6441e1a02c4e4670dd96EA0f25A632', // USDC
      tokenOut: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
      amountIn: ethers.utils.parseUnits('1000', 6), // 1000 USDC (6 decimals)
      minAmountOut: ethers.utils.parseUnits('995', 6), // 995 USDT (0.5% slippage)
      routerType: 0, // Uniswap V2
      to: this.signer.address,
      deadline: Math.floor(Date.now() / 1000) + 1800 // 30 minutes from now
    };

    try {
      console.log('Executing token swap...');
      
      // Step 1: Approve token spending
      await this.approveToken(swapParams.tokenIn, swapParams.amountIn);
      
      // Step 2: Get swap quote
      const quote = await this.getSwapQuote(swapParams);
      console.log('Swap quote:', quote);
      
      // Step 3: Execute swap
      const tx = await this.gateway.executeSwap(swapParams);
      console.log('Transaction submitted:', tx.hash);
      
      // Step 4: Wait for confirmation
      const receipt = await tx.wait();
      console.log('Swap completed!', receipt.transactionHash);
      
      return {
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice.toString(),
        amountOut: await this.getSwapAmountOut(receipt)
      };
      
    } catch (error) {
      console.error('Swap failed:', error);
      throw error;
    }
  }

  /**
   * Get swap quote for given parameters
   */
  async getSwapQuote(swapParams) {
    try {
      const quote = await this.gateway.getQuote(
        swapParams.tokenIn,
        swapParams.tokenOut,
        swapParams.amountIn,
        swapParams.routerType
      );

      return {
        amountOut: quote.amountOut,
        priceImpact: quote.priceImpact,
        fee: quote.fee,
        gasEstimate: quote.gasEstimate,
        route: quote.route
      };
      
    } catch (error) {
      console.error('Failed to get quote:', error);
      throw error;
    }
  }

  /**
   * Approve token spending for the gateway
   */
  async approveToken(tokenAddress, amount) {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      [
        'function approve(address spender, uint256 amount) returns (bool)',
        'function allowance(address owner, address spender) returns (uint256)'
      ],
      this.signer
    );

    // Check current allowance
    const currentAllowance = await tokenContract.allowance(
      this.signer.address,
      this.gateway.address
    );

    // Approve if needed
    if (currentAllowance.lt(amount)) {
      console.log('Approving token spending...');
      const approveTx = await tokenContract.approve(this.gateway.address, amount);
      await approveTx.wait();
      console.log('Token approval confirmed');
    } else {
      console.log('Token already approved');
    }
  }

  /**
   * Get actual amount received from swap transaction
   */
  async getSwapAmountOut(receipt) {
    // Parse logs to find Transfer events
    const transferEventSignature = ethers.utils.id('Transfer(address,address,uint256)');
    
    for (const log of receipt.logs) {
      if (log.topics[0] === transferEventSignature) {
        // Check if transfer is to our address
        const toAddress = ethers.utils.getAddress('0x' + log.topics[2].slice(26));
        if (toAddress.toLowerCase() === this.signer.address.toLowerCase()) {
          return ethers.BigNumber.from(log.data);
        }
      }
    }
    
    return ethers.BigNumber.from(0);
  }

  /**
   * Execute swap with automatic router selection for best price
   */
  async executeOptimalSwap(tokenIn, tokenOut, amountIn, maxSlippageBps = 50) {
    const routerTypes = [0, 10, 20, 30]; // Uniswap V2, V3, SushiSwap, Curve
    let bestQuote = null;
    let bestRouterType = 0;

    console.log('Finding optimal route...');

    // Get quotes from all routers
    for (const routerType of routerTypes) {
      try {
        const quote = await this.gateway.getQuote(tokenIn, tokenOut, amountIn, routerType);
        
        if (!bestQuote || quote.amountOut.gt(bestQuote.amountOut)) {
          bestQuote = quote;
          bestRouterType = routerType;
        }
        
        console.log(`Router ${routerType}: ${ethers.utils.formatUnits(quote.amountOut, 6)}`);
      } catch (error) {
        console.log(`Router ${routerType} failed:`, error.message);
      }
    }

    if (!bestQuote) {
      throw new Error('No valid routes found');
    }

    // Calculate minimum amount out with slippage protection
    const minAmountOut = bestQuote.amountOut.sub(
      bestQuote.amountOut.mul(maxSlippageBps).div(10000)
    );

    const swapParams = {
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut,
      routerType: bestRouterType,
      to: this.signer.address,
      deadline: Math.floor(Date.now() / 1000) + 1800
    };

    console.log(`Using router ${bestRouterType} for best price`);
    return await this.executeSimpleSwap(swapParams);
  }

  /**
   * Execute multi-hop swap (e.g., Token A -> WETH -> Token B)
   */
  async executeMultiHopSwap(tokenIn, tokenOut, amountIn, intermediateToken) {
    console.log('Executing multi-hop swap...');

    // Step 1: First swap (tokenIn -> intermediateToken)
    const firstSwapParams = {
      tokenIn,
      tokenOut: intermediateToken,
      amountIn,
      minAmountOut: 0, // Will calculate based on quote
      routerType: 0,
      to: this.signer.address,
      deadline: Math.floor(Date.now() / 1000) + 1800
    };

    // Get quote for first hop
    const firstQuote = await this.getSwapQuote(firstSwapParams);
    firstSwapParams.minAmountOut = firstQuote.amountOut.mul(995).div(1000); // 0.5% slippage

    // Execute first swap
    await this.approveToken(tokenIn, amountIn);
    const firstTx = await this.gateway.executeSwap(firstSwapParams);
    const firstReceipt = await firstTx.wait();
    const intermediateAmount = await this.getSwapAmountOut(firstReceipt);

    console.log(`First hop completed: ${ethers.utils.formatEther(intermediateAmount)} intermediate tokens`);

    // Step 2: Second swap (intermediateToken -> tokenOut)
    const secondSwapParams = {
      tokenIn: intermediateToken,
      tokenOut,
      amountIn: intermediateAmount,
      minAmountOut: 0,
      routerType: 0,
      to: this.signer.address,
      deadline: Math.floor(Date.now() / 1000) + 1800
    };

    const secondQuote = await this.getSwapQuote(secondSwapParams);
    secondSwapParams.minAmountOut = secondQuote.amountOut.mul(995).div(1000);

    // Execute second swap
    await this.approveToken(intermediateToken, intermediateAmount);
    const secondTx = await this.gateway.executeSwap(secondSwapParams);
    const secondReceipt = await secondTx.wait();
    const finalAmount = await this.getSwapAmountOut(secondReceipt);

    console.log(`Multi-hop swap completed: ${ethers.utils.formatUnits(finalAmount, 6)} output tokens`);

    return {
      firstTx: firstReceipt.transactionHash,
      secondTx: secondReceipt.transactionHash,
      totalAmountOut: finalAmount
    };
  }

  /**
   * Execute ETH to token swap
   */
  async executeETHToTokenSwap(tokenOut, ethAmount, minTokensOut) {
    const swapParams = {
      tokenIn: ethers.constants.AddressZero, // ETH
      tokenOut,
      amountIn: ethAmount,
      minAmountOut: minTokensOut,
      routerType: 0,
      to: this.signer.address,
      deadline: Math.floor(Date.now() / 1000) + 1800
    };

    // No approval needed for ETH
    const tx = await this.gateway.executeSwap(swapParams, { value: ethAmount });
    const receipt = await tx.wait();
    
    return receipt;
  }

  /**
   * Execute token to ETH swap
   */
  async executeTokenToETHSwap(tokenIn, tokenAmount, minETHOut) {
    const swapParams = {
      tokenIn,
      tokenOut: ethers.constants.AddressZero, // ETH
      amountIn: tokenAmount,
      minAmountOut: minETHOut,
      routerType: 0,
      to: this.signer.address,
      deadline: Math.floor(Date.now() / 1000) + 1800
    };

    await this.approveToken(tokenIn, tokenAmount);
    const tx = await this.gateway.executeSwap(swapParams);
    const receipt = await tx.wait();
    
    return receipt;
  }
}

// Usage examples
async function runExamples() {
  const swapper = new SimpleSwapExample(
    process.env.ETHEREUM_RPC_URL,
    process.env.PRIVATE_KEY
  );

  try {
    // Example 1: Basic USDC to USDT swap
    console.log('=== Basic Swap Example ===');
    const basicSwap = await swapper.executeSimpleSwap();
    console.log('Basic swap result:', basicSwap);

    // Example 2: Optimal routing
    console.log('\n=== Optimal Routing Example ===');
    const optimalSwap = await swapper.executeOptimalSwap(
      '0xA0b86a33E6441e1a02c4e4670dd96EA0f25A632', // USDC
      '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
      ethers.utils.parseUnits('500', 6), // 500 USDC
      50 // 0.5% max slippage
    );
    console.log('Optimal swap result:', optimalSwap);

    // Example 3: ETH to token swap
    console.log('\n=== ETH to Token Swap ===');
    const ethSwap = await swapper.executeETHToTokenSwap(
      '0xA0b86a33E6441e1a02c4e4670dd96EA0f25A632', // USDC
      ethers.utils.parseEther('1'), // 1 ETH
      ethers.utils.parseUnits('1800', 6) // Minimum 1800 USDC
    );
    console.log('ETH swap result:', ethSwap.transactionHash);

  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Run examples
runExamples().catch(console.error);
```

### Smart Contract Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IIXFIGateway.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract SimpleSwapExample is ReentrancyGuard {
    using SafeMath for uint256;

    IIXFIGateway public immutable ixfiGateway;
    
    event SwapExecuted(
        address indexed user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint8 routerType
    );

    event OptimalRouteFound(
        address tokenIn,
        address tokenOut,
        uint8 routerType,
        uint256 expectedOutput
    );

    constructor(address _ixfiGateway) {
        ixfiGateway = IIXFIGateway(_ixfiGateway);
    }

    /**
     * @dev Execute a simple token swap
     * @param tokenIn Address of input token
     * @param tokenOut Address of output token  
     * @param amountIn Amount of input tokens
     * @param minAmountOut Minimum amount of output tokens (slippage protection)
     * @param routerType DEX router to use (0=Uniswap V2, 10=Uniswap V3, etc.)
     */
    function executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint8 routerType
    ) external payable nonReentrant returns (uint256 amountOut) {
        require(amountIn > 0, "Invalid input amount");
        require(tokenIn != tokenOut, "Same input/output token");

        // Handle ETH input
        if (tokenIn == address(0)) {
            require(msg.value == amountIn, "ETH amount mismatch");
        } else {
            require(msg.value == 0, "ETH not expected");
            IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
            IERC20(tokenIn).approve(address(ixfiGateway), amountIn);
        }

        // Prepare swap parameters
        IIXFIGateway.SwapParams memory params = IIXFIGateway.SwapParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            minAmountOut: minAmountOut,
            routerType: routerType,
            to: msg.sender,
            deadline: block.timestamp + 1800, // 30 minutes
            swapData: ""
        });

        // Execute swap
        amountOut = ixfiGateway.executeSwap{value: msg.value}(params);

        emit SwapExecuted(
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            routerType
        );
    }

    /**
     * @dev Execute swap with automatic optimal router selection
     * @param tokenIn Address of input token
     * @param tokenOut Address of output token
     * @param amountIn Amount of input tokens
     * @param maxSlippageBps Maximum slippage in basis points (100 = 1%)
     */
    function executeOptimalSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 maxSlippageBps
    ) external payable nonReentrant returns (uint256 amountOut) {
        // Find best router
        (uint8 bestRouter, uint256 bestOutput) = findOptimalRoute(
            tokenIn,
            tokenOut,
            amountIn
        );

        require(bestOutput > 0, "No valid route found");

        // Calculate minimum output with slippage
        uint256 minAmountOut = bestOutput.sub(
            bestOutput.mul(maxSlippageBps).div(10000)
        );

        emit OptimalRouteFound(tokenIn, tokenOut, bestRouter, bestOutput);

        // Execute swap with optimal router
        return this.executeSwap{value: msg.value}(
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            bestRouter
        );
    }

    /**
     * @dev Execute a multi-hop swap through an intermediate token
     * @param tokenIn Address of input token
     * @param tokenOut Address of output token
     * @param intermediateToken Address of intermediate token (e.g., WETH)
     * @param amountIn Amount of input tokens
     * @param minAmountOut Minimum final output amount
     */
    function executeMultiHopSwap(
        address tokenIn,
        address tokenOut,
        address intermediateToken,
        uint256 amountIn,
        uint256 minAmountOut
    ) external payable nonReentrant returns (uint256 finalAmountOut) {
        require(amountIn > 0, "Invalid input amount");
        require(tokenIn != tokenOut, "Same input/output token");
        require(intermediateToken != tokenIn && intermediateToken != tokenOut, "Invalid intermediate token");

        // Handle input token transfer
        if (tokenIn == address(0)) {
            require(msg.value == amountIn, "ETH amount mismatch");
        } else {
            require(msg.value == 0, "ETH not expected");
            IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        }

        // First hop: tokenIn -> intermediateToken
        uint256 intermediateAmount = _executeSingleSwap(
            tokenIn,
            intermediateToken,
            amountIn,
            0, // No slippage protection on intermediate swap
            0  // Use Uniswap V2
        );

        require(intermediateAmount > 0, "First hop failed");

        // Second hop: intermediateToken -> tokenOut
        finalAmountOut = _executeSingleSwap(
            intermediateToken,
            tokenOut,
            intermediateAmount,
            minAmountOut,
            0  // Use Uniswap V2
        );

        require(finalAmountOut >= minAmountOut, "Insufficient output amount");

        // Transfer final tokens to user
        if (tokenOut == address(0)) {
            payable(msg.sender).transfer(finalAmountOut);
        } else {
            IERC20(tokenOut).transfer(msg.sender, finalAmountOut);
        }
    }

    /**
     * @dev Batch multiple swaps in a single transaction
     * @param swaps Array of swap parameters
     */
    function executeBatchSwaps(
        IIXFIGateway.SwapParams[] calldata swaps
    ) external payable nonReentrant returns (uint256[] memory amountsOut) {
        require(swaps.length > 0, "No swaps provided");
        require(swaps.length <= 5, "Too many swaps");

        amountsOut = new uint256[](swaps.length);
        uint256 totalETHRequired = 0;

        // Calculate total ETH required
        for (uint i = 0; i < swaps.length; i++) {
            if (swaps[i].tokenIn == address(0)) {
                totalETHRequired = totalETHRequired.add(swaps[i].amountIn);
            }
        }

        require(msg.value >= totalETHRequired, "Insufficient ETH");

        // Execute each swap
        for (uint i = 0; i < swaps.length; i++) {
            IIXFIGateway.SwapParams memory swap = swaps[i];
            
            // Handle token transfers
            if (swap.tokenIn != address(0)) {
                IERC20(swap.tokenIn).transferFrom(msg.sender, address(this), swap.amountIn);
                IERC20(swap.tokenIn).approve(address(ixfiGateway), swap.amountIn);
            }

            // Execute swap
            uint256 ethValue = swap.tokenIn == address(0) ? swap.amountIn : 0;
            amountsOut[i] = ixfiGateway.executeSwap{value: ethValue}(swap);

            emit SwapExecuted(
                msg.sender,
                swap.tokenIn,
                swap.tokenOut,
                swap.amountIn,
                amountsOut[i],
                swap.routerType
            );
        }

        // Refund excess ETH
        if (msg.value > totalETHRequired) {
            payable(msg.sender).transfer(msg.value.sub(totalETHRequired));
        }
    }

    /**
     * @dev Find the optimal router for a given swap
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Input amount
     * @return bestRouter The router type that gives the best output
     * @return bestOutput The maximum output amount found
     */
    function findOptimalRoute(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) public view returns (uint8 bestRouter, uint256 bestOutput) {
        uint8[] memory routerTypes = new uint8[](4);
        routerTypes[0] = 0;  // Uniswap V2
        routerTypes[1] = 10; // Uniswap V3
        routerTypes[2] = 20; // SushiSwap
        routerTypes[3] = 30; // Curve

        bestOutput = 0;
        bestRouter = 0;

        for (uint i = 0; i < routerTypes.length; i++) {
            try ixfiGateway.getQuote(tokenIn, tokenOut, amountIn, routerTypes[i]) 
                returns (uint256 amountOut, uint256) {
                if (amountOut > bestOutput) {
                    bestOutput = amountOut;
                    bestRouter = routerTypes[i];
                }
            } catch {
                // Skip failed quotes
                continue;
            }
        }
    }

    /**
     * @dev Internal function to execute a single swap
     */
    function _executeSingleSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint8 routerType
    ) internal returns (uint256 amountOut) {
        // Approve token if needed
        if (tokenIn != address(0)) {
            IERC20(tokenIn).approve(address(ixfiGateway), amountIn);
        }

        IIXFIGateway.SwapParams memory params = IIXFIGateway.SwapParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            minAmountOut: minAmountOut,
            routerType: routerType,
            to: address(this),
            deadline: block.timestamp + 1800,
            swapData: ""
        });

        uint256 ethValue = tokenIn == address(0) ? amountIn : 0;
        amountOut = ixfiGateway.executeSwap{value: ethValue}(params);
    }

    /**
     * @dev Get quote for a swap without executing
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Input amount
     * @param routerType Router type to use
     * @return amountOut Expected output amount
     * @return gasEstimate Estimated gas cost
     */
    function getSwapQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint8 routerType
    ) external view returns (uint256 amountOut, uint256 gasEstimate) {
        return ixfiGateway.getQuote(tokenIn, tokenOut, amountIn, routerType);
    }

    /**
     * @dev Emergency function to recover stuck tokens
     */
    function recoverTokens(address token, uint256 amount) external {
        require(msg.sender == owner(), "Not authorized");
        
        if (token == address(0)) {
            payable(msg.sender).transfer(amount);
        } else {
            IERC20(token).transfer(msg.sender, amount);
        }
    }

    /**
     * @dev Receive ETH
     */
    receive() external payable {}
}
```

### React Component

```jsx
// examples/simple-swap/SwapComponent.jsx
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useSimpleSwap } from '../hooks/useSimpleSwap';

const COMMON_TOKENS = [
  { symbol: 'ETH', address: ethers.constants.AddressZero, decimals: 18 },
  { symbol: 'USDC', address: '0xA0b86a33E6441e1a02c4e4670dd96EA0f25A632', decimals: 6 },
  { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
  { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
  { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 }
];

const ROUTER_TYPES = [
  { id: 0, name: 'Uniswap V2' },
  { id: 10, name: 'Uniswap V3' },
  { id: 20, name: 'SushiSwap' },
  { id: 30, name: 'Curve' }
];

const SwapComponent = () => {
  const [tokenIn, setTokenIn] = useState(COMMON_TOKENS[1]); // USDC
  const [tokenOut, setTokenOut] = useState(COMMON_TOKENS[2]); // USDT
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');
  const [slippageTolerance, setSlippageTolerance] = useState(0.5);
  const [routerType, setRouterType] = useState(0);
  const [useOptimalRouting, setUseOptimalRouting] = useState(true);

  const {
    executeSwap,
    executeOptimalSwap,
    getSwapQuote,
    findOptimalRoute,
    loading,
    error
  } = useSimpleSwap();

  // Get quote when parameters change
  useEffect(() => {
    if (amountIn && tokenIn && tokenOut) {
      handleGetQuote();
    }
  }, [amountIn, tokenIn, tokenOut, routerType]);

  const handleGetQuote = async () => {
    if (!amountIn || !tokenIn || !tokenOut) return;

    try {
      const inputAmount = ethers.utils.parseUnits(amountIn, tokenIn.decimals);
      
      let quote;
      if (useOptimalRouting) {
        const optimalRoute = await findOptimalRoute(
          tokenIn.address,
          tokenOut.address,
          inputAmount
        );
        quote = { amountOut: optimalRoute.bestOutput };
      } else {
        quote = await getSwapQuote(
          tokenIn.address,
          tokenOut.address,
          inputAmount,
          routerType
        );
      }

      const outputAmount = ethers.utils.formatUnits(quote.amountOut, tokenOut.decimals);
      setAmountOut(outputAmount);
      
    } catch (err) {
      console.error('Failed to get quote:', err);
      setAmountOut('');
    }
  };

  const handleSwap = async () => {
    if (!amountIn || !amountOut) return;

    try {
      const inputAmount = ethers.utils.parseUnits(amountIn, tokenIn.decimals);
      const minOutputAmount = ethers.utils.parseUnits(
        (parseFloat(amountOut) * (1 - slippageTolerance / 100)).toFixed(6),
        tokenOut.decimals
      );

      let result;
      if (useOptimalRouting) {
        result = await executeOptimalSwap(
          tokenIn.address,
          tokenOut.address,
          inputAmount,
          slippageTolerance * 100 // Convert to basis points
        );
      } else {
        result = await executeSwap(
          tokenIn.address,
          tokenOut.address,
          inputAmount,
          minOutputAmount,
          routerType
        );
      }

      console.log('Swap completed:', result);
      alert('Swap completed successfully!');
      
    } catch (err) {
      console.error('Swap failed:', err);
      alert('Swap failed: ' + err.message);
    }
  };

  const handleTokenSwap = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn(amountOut);
    setAmountOut('');
  };

  const calculatePriceImpact = () => {
    if (!amountIn || !amountOut) return 0;
    
    // Simplified price impact calculation
    const inputValue = parseFloat(amountIn);
    const outputValue = parseFloat(amountOut);
    const expectedRate = 1; // Assume 1:1 for stablecoins
    
    return Math.abs((outputValue / inputValue - expectedRate) / expectedRate * 100);
  };

  return (
    <div className="swap-component">
      <h2>Token Swap</h2>

      <div className="swap-form">
        {/* From Token */}
        <div className="token-input">
          <label>From</label>
          <div className="input-row">
            <input
              type="number"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              placeholder="0.0"
            />
            <select 
              value={tokenIn.symbol} 
              onChange={(e) => setTokenIn(COMMON_TOKENS.find(t => t.symbol === e.target.value))}
            >
              {COMMON_TOKENS.map(token => (
                <option key={token.symbol} value={token.symbol}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Swap Direction Button */}
        <div className="swap-direction">
          <button onClick={handleTokenSwap} className="swap-button">
            ↓
          </button>
        </div>

        {/* To Token */}
        <div className="token-input">
          <label>To</label>
          <div className="input-row">
            <input
              type="number"
              value={amountOut}
              placeholder="0.0"
              readOnly
            />
            <select 
              value={tokenOut.symbol} 
              onChange={(e) => setTokenOut(COMMON_TOKENS.find(t => t.symbol === e.target.value))}
            >
              {COMMON_TOKENS.filter(t => t.symbol !== tokenIn.symbol).map(token => (
                <option key={token.symbol} value={token.symbol}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Settings */}
        <div className="swap-settings">
          <div className="setting-row">
            <label>
              <input
                type="checkbox"
                checked={useOptimalRouting}
                onChange={(e) => setUseOptimalRouting(e.target.checked)}
              />
              Use Optimal Routing
            </label>
          </div>

          {!useOptimalRouting && (
            <div className="setting-row">
              <label>Router</label>
              <select 
                value={routerType} 
                onChange={(e) => setRouterType(parseInt(e.target.value))}
              >
                {ROUTER_TYPES.map(router => (
                  <option key={router.id} value={router.id}>
                    {router.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="setting-row">
            <label>Slippage Tolerance (%)</label>
            <input
              type="number"
              step="0.1"
              value={slippageTolerance}
              onChange={(e) => setSlippageTolerance(parseFloat(e.target.value))}
            />
          </div>
        </div>

        {/* Quote Info */}
        {amountOut && (
          <div className="quote-info">
            <div className="quote-row">
              <span>Rate:</span>
              <span>1 {tokenIn.symbol} = {(parseFloat(amountOut) / parseFloat(amountIn || 1)).toFixed(6)} {tokenOut.symbol}</span>
            </div>
            <div className="quote-row">
              <span>Price Impact:</span>
              <span className={calculatePriceImpact() > 1 ? 'warning' : ''}>
                {calculatePriceImpact().toFixed(2)}%
              </span>
            </div>
            <div className="quote-row">
              <span>Min. Received:</span>
              <span>{(parseFloat(amountOut) * (1 - slippageTolerance / 100)).toFixed(6)} {tokenOut.symbol}</span>
            </div>
          </div>
        )}

        {/* Swap Button */}
        <button 
          onClick={handleSwap}
          disabled={loading || !amountIn || !amountOut}
          className="swap-execute-button"
        >
          {loading ? 'Swapping...' : 'Swap Tokens'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error">
          Error: {error.message}
        </div>
      )}
    </div>
  );
};

export default SwapComponent;
```

### Custom Hook

```javascript
// hooks/useSimpleSwap.js
import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useIXFI } from './useIXFI';

export const useSimpleSwap = () => {
  const { gateway } = useIXFI();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const executeSwap = useCallback(async (
    tokenIn,
    tokenOut,
    amountIn,
    minAmountOut,
    routerType
  ) => {
    setLoading(true);
    setError(null);

    try {
      // Approve token if not ETH
      if (tokenIn !== ethers.constants.AddressZero) {
        await approveToken(tokenIn, amountIn);
      }

      const swapParams = {
        tokenIn,
        tokenOut,
        amountIn,
        minAmountOut,
        routerType,
        to: gateway.signer.address,
        deadline: Math.floor(Date.now() / 1000) + 1800,
        swapData: '0x'
      };

      const value = tokenIn === ethers.constants.AddressZero ? amountIn : 0;
      const tx = await gateway.executeSwap(swapParams, { value });
      
      return await tx.wait();
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  const executeOptimalSwap = useCallback(async (
    tokenIn,
    tokenOut,
    amountIn,
    maxSlippageBps
  ) => {
    setLoading(true);
    setError(null);

    try {
      if (tokenIn !== ethers.constants.AddressZero) {
        await approveToken(tokenIn, amountIn);
      }

      const value = tokenIn === ethers.constants.AddressZero ? amountIn : 0;
      const tx = await gateway.executeOptimalSwap(
        tokenIn,
        tokenOut,
        amountIn,
        maxSlippageBps,
        { value }
      );
      
      return await tx.wait();
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  const getSwapQuote = useCallback(async (tokenIn, tokenOut, amountIn, routerType) => {
    try {
      const [amountOut, gasEstimate] = await gateway.getQuote(
        tokenIn,
        tokenOut,
        amountIn,
        routerType
      );

      return {
        amountOut,
        gasEstimate,
        priceImpact: await calculatePriceImpact(tokenIn, tokenOut, amountIn, amountOut)
      };
    } catch (err) {
      console.error('Failed to get quote:', err);
      throw err;
    }
  }, [gateway]);

  const findOptimalRoute = useCallback(async (tokenIn, tokenOut, amountIn) => {
    try {
      const [bestRouter, bestOutput] = await gateway.findOptimalRoute(
        tokenIn,
        tokenOut,
        amountIn
      );

      return { bestRouter, bestOutput };
    } catch (err) {
      console.error('Failed to find optimal route:', err);
      throw err;
    }
  }, [gateway]);

  const approveToken = async (tokenAddress, amount) => {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function approve(address spender, uint256 amount) returns (bool)'],
      gateway.signer
    );

    const tx = await tokenContract.approve(gateway.address, amount);
    await tx.wait();
  };

  const calculatePriceImpact = async (tokenIn, tokenOut, amountIn, amountOut) => {
    // Simplified price impact calculation
    // In production, this would use oracle prices
    return 0;
  };

  return {
    executeSwap,
    executeOptimalSwap,
    getSwapQuote,
    findOptimalRoute,
    loading,
    error
  };
};
```

## Testing

```javascript
// test/simple-swap.test.js
describe('Simple Swap Example', () => {
  let swapper;
  let user;

  beforeEach(async () => {
    [user] = await ethers.getSigners();
    swapper = new SimpleSwapExample(provider.connection.url, user.privateKey);
  });

  it('should execute basic token swap', async () => {
    const result = await swapper.executeSimpleSwap();
    expect(result.transactionHash).to.be.a('string');
    expect(result.amountOut).to.be.gt(0);
  });

  it('should find optimal route', async () => {
    const result = await swapper.executeOptimalSwap(
      USDC_ADDRESS,
      USDT_ADDRESS,
      ethers.utils.parseUnits('100', 6),
      50 // 0.5% slippage
    );
    
    expect(result.transactionHash).to.be.a('string');
  });

  it('should execute ETH to token swap', async () => {
    const receipt = await swapper.executeETHToTokenSwap(
      USDC_ADDRESS,
      ethers.utils.parseEther('0.1'),
      ethers.utils.parseUnits('180', 6)
    );
    
    expect(receipt.status).to.equal(1);
  });
});
```

## Resources

- [DEX Aggregation Overview](../dex-aggregation/overview.md)
- [Quote System Guide](../dex-aggregation/quote-system.md)
- [Router Types](../dex-aggregation/router-types.md)
- [API Reference](../api-reference/ixfi-gateway.md)
- [Security Best Practices](../guides/security.md)
