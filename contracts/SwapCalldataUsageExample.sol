// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./SwapCalldataGenerator.sol";
import "./libraries/QuoteLibrary.sol";
import "./libraries/CalldataLibrary.sol";
import "./interfaces/IIXFIGateway.sol";

/**
 * @title SwapCalldataUsageExample
 * @notice Example contract demonstrating how to use SwapCalldataGenerator for cross-chain swaps
 * @dev This contract shows practical usage patterns for generating and executing swap calldata
 */
contract SwapCalldataUsageExample {
    using SafeERC20 for IERC20;

    SwapCalldataGenerator public immutable calldataGenerator;
    IIXFIGateway public immutable ixfiGateway;
    
    // Events
    event SwapInitiated(
        address indexed user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 expectedAmountOut,
        string destinationChain,
        QuoteLibrary.RouterType routerType
    );
    
    event LocalSwapExecuted(
        address indexed user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        QuoteLibrary.RouterType routerType
    );

    constructor(address _calldataGenerator, address _ixfiGateway) {
        calldataGenerator = SwapCalldataGenerator(_calldataGenerator);
        ixfiGateway = IIXFIGateway(_ixfiGateway);
    }

    /**
     * @notice Example: Execute a cross-chain swap using IXFI Gateway
     * @param tokenIn Input token address
     * @param tokenOut Output token address (on destination chain)
     * @param amountIn Amount of input tokens
     * @param destinationChain Name of destination chain
     * @param destinationAddress Recipient address on destination chain
     * @param routerType Type of DEX router to use
     * @param slippageBps Slippage tolerance in basis points (e.g., 300 = 3%)
     */
    function executeCrossChainSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        string calldata destinationChain,
        string calldata destinationAddress,
        QuoteLibrary.RouterType routerType,
        uint256 slippageBps
    ) external {
        require(amountIn > 0, "Amount must be > 0");
        require(slippageBps <= 1000, "Slippage too high"); // Max 10%

        // Transfer tokens from user
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Get destination chain ID (simplified - you'd need to implement this mapping)
        uint256 destinationChainId = _getChainId(destinationChain);
        require(destinationChainId > 0, "Unsupported destination chain");

        // Get router config for destination chain
        (address routerAddress, QuoteLibrary.RouterType configuredType, bool isActive) = calldataGenerator.routers(destinationChainId, routerType);
        require(isActive, "Router not active on destination chain");

        // Get quote for the swap (simplified for V2-style routers)
        uint256 expectedAmountOut = 0;
        if (routerType == QuoteLibrary.RouterType.UNISWAP_V2 || 
            routerType == QuoteLibrary.RouterType.SUSHISWAP ||
            routerType == QuoteLibrary.RouterType.PANCAKESWAP) {
            expectedAmountOut = calldataGenerator.getUniswapV2Quote(
                routerAddress,
                tokenIn,
                tokenOut,
                amountIn
            );
        }
        require(expectedAmountOut > 0, "Unable to get quote");

        // Calculate minimum amount out with slippage
        uint256 amountOutMin = (expectedAmountOut * (10000 - slippageBps)) / 10000;

        // Generate swap calldata (simplified - using Uniswap V2 style)
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        // Note: For cross-chain swaps, the recipient should be the destination contract
        // For this example, we'll use a placeholder address and let the relay handle it
        address tempRecipient = address(0x1234567890123456789012345678901234567890);
        
        bytes memory swapCalldata = calldataGenerator.generateUniswapV2Calldata(
            amountIn,
            amountOutMin,
            path,
            tempRecipient, // Placeholder - actual recipient handled by cross-chain protocol
            block.timestamp + 1800 // 30 minute deadline
        );

        // Approve IXFI Gateway to spend tokens
        IERC20(tokenIn).approve(address(ixfiGateway), amountIn);

        // Execute cross-chain swap through IXFI Gateway
        ixfiGateway.callContractWithToken(
            destinationChain,
            destinationAddress, // This is already a string
            swapCalldata,
            "IXFI", // Assuming we're swapping IXFI
            amountIn
        );

        emit SwapInitiated(
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            expectedAmountOut,
            destinationChain,
            routerType
        );
    }

    /**
     * @notice Helper function to map chain name to chain ID
     * @param chainName Name of the chain
     * @return chainId Chain ID
     */
    function _getChainId(string memory chainName) internal pure returns (uint256 chainId) {
        bytes32 nameHash = keccak256(bytes(chainName));
        
        if (nameHash == keccak256(bytes("ethereum"))) return 1;
        if (nameHash == keccak256(bytes("bsc"))) return 56;
        if (nameHash == keccak256(bytes("polygon"))) return 137;
        if (nameHash == keccak256(bytes("arbitrum"))) return 42161;
        if (nameHash == keccak256(bytes("optimism"))) return 10;
        if (nameHash == keccak256(bytes("avalanche"))) return 43114;
        if (nameHash == keccak256(bytes("crossfi"))) return 4158;
        
        return 0; // Unsupported chain
    }

    /**
     * @notice Helper function to get router address (simplified for demonstration)
     * @param chainId Chain ID
     * @param routerType Router type
     * @return routerAddress Address of the router
     */
    function _getRouterAddress(uint256 chainId, QuoteLibrary.RouterType routerType) 
        internal 
        pure 
        returns (address routerAddress) 
    {
        // Simplified hardcoded router addresses for demonstration
        // In production, this would query the SwapCalldataGenerator
        
        if (chainId == 1) { // Ethereum
            if (routerType == QuoteLibrary.RouterType.UNISWAP_V2) {
                return 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
            }
            if (routerType == QuoteLibrary.RouterType.SUSHISWAP) {
                return 0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F;
            }
        } else if (chainId == 56) { // BSC
            if (routerType == QuoteLibrary.RouterType.PANCAKESWAP) {
                return 0x10ED43C718714eb63d5aA57B78B54704E256024E;
            }
        }
        
        return address(0); // Not configured
    }

    /**
     * @notice Example: Execute a local swap on the current chain
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @param routerType Type of DEX router to use
     * @param slippageBps Slippage tolerance in basis points
     */
    function executeLocalSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        QuoteLibrary.RouterType routerType,
        uint256 slippageBps
    ) external {
        require(amountIn > 0, "Amount must be > 0");
        require(slippageBps <= 1000, "Slippage too high"); // Max 10%

        // Transfer tokens from user
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Get router config
        (address routerAddress, QuoteLibrary.RouterType configuredType, bool isActive) = calldataGenerator.routers(block.chainid, routerType);
        require(isActive, "Router not active");

        // Get quote for the swap (simplified for V2-style routers)
        uint256 expectedAmountOut = 0;
        if (routerType == QuoteLibrary.RouterType.UNISWAP_V2 || 
            routerType == QuoteLibrary.RouterType.SUSHISWAP ||
            routerType == QuoteLibrary.RouterType.PANCAKESWAP) {
            expectedAmountOut = calldataGenerator.getUniswapV2Quote(
                routerAddress,
                tokenIn,
                tokenOut,
                amountIn
            );
        }
        require(expectedAmountOut > 0, "Unable to get quote");

        // Calculate minimum amount out with slippage
        uint256 amountOutMin = (expectedAmountOut * (10000 - slippageBps)) / 10000;

        // Generate swap calldata
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        bytes memory swapCalldata = calldataGenerator.generateUniswapV2Calldata(
            amountIn,
            amountOutMin,
            path,
            address(this), // Receive tokens to this contract
            block.timestamp + 300 // 5 minute deadline
        );

        // Approve router to spend input tokens
        IERC20(tokenIn).approve(routerAddress, amountIn);

        // Execute the swap
        uint256 balanceBefore = IERC20(tokenOut).balanceOf(address(this));
        
        (bool success, ) = routerAddress.call(swapCalldata);
        require(success, "Swap failed");

        uint256 balanceAfter = IERC20(tokenOut).balanceOf(address(this));
        uint256 amountOut = balanceAfter - balanceBefore;

        require(amountOut >= amountOutMin, "Insufficient output amount");

        // Transfer output tokens to user
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);

        emit LocalSwapExecuted(
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            routerType
        );
    }

    /**
     * @notice Example: Get a quote for a potential swap using Uniswap V2
     * @param chainId Chain ID where swap will occur
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @param routerType Type of DEX router to use
     * @return amountOut Expected output amount
     */
    function getSwapQuote(
        uint256 chainId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        QuoteLibrary.RouterType routerType
    ) external view returns (uint256 amountOut) {
        (address routerAddress, QuoteLibrary.RouterType configuredType, bool isActive) = calldataGenerator.routers(chainId, routerType);
        require(isActive, "Router not active");
        
        if (routerType == QuoteLibrary.RouterType.UNISWAP_V2 || 
            routerType == QuoteLibrary.RouterType.SUSHISWAP ||
            routerType == QuoteLibrary.RouterType.PANCAKESWAP) {
            return calldataGenerator.getUniswapV2Quote(
                routerAddress,
                tokenIn,
                tokenOut,
                amountIn
            );
        }
        
        // For other router types, you would implement similar quote functions
        // This is a simplified example
        revert("Quote not implemented for this router type");
    }

    /**
     * @notice Example: Generate swap calldata without executing
     * @param chainId Chain ID where swap will occur
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @param amountOutMin Minimum amount of output tokens
     * @param recipient Recipient address
     * @param routerType Type of DEX router to use
     * @return Generated swap calldata
     */
    function generateSwapCalldata(
        uint256 chainId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        address recipient,
        QuoteLibrary.RouterType routerType
    ) external view returns (bytes memory) {
        // Generate calldata based on router type
        if (routerType == QuoteLibrary.RouterType.UNISWAP_V2 || 
            routerType == QuoteLibrary.RouterType.SUSHISWAP ||
            routerType == QuoteLibrary.RouterType.PANCAKESWAP) {
            
            address[] memory path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;
            
            return calldataGenerator.generateUniswapV2Calldata(
                amountIn,
                amountOutMin,
                path,
                recipient,
                block.timestamp + 1800 // 30 minute deadline
            );
        }
        
        revert("Calldata generation not implemented for this router type");
    }

    /**
     * @notice Example: Batch multiple swaps using Multicall (simplified version)
     * @param swaps Array of swap parameters
     */
    function batchSwaps(SwapParams[] calldata swaps) external {
        require(swaps.length > 0, "No swaps provided");
        require(swaps.length <= 10, "Too many swaps"); // Limit for gas

        for (uint256 i = 0; i < swaps.length; i++) {
            SwapParams memory swap = swaps[i];
            
            // Transfer tokens from user for this swap
            IERC20(swap.tokenIn).safeTransferFrom(msg.sender, address(this), swap.amountIn);

            // Get router address
            address routerAddress = _getRouterAddress(block.chainid, swap.routerType);
            require(routerAddress != address(0), "Router not configured");

            // Generate simple swap calldata for V2-style routers
            address[] memory path = new address[](2);
            path[0] = swap.tokenIn;
            path[1] = swap.tokenOut;
            
            bytes memory swapCalldata = calldataGenerator.generateUniswapV2Calldata(
                swap.amountIn,
                swap.amountOutMin,
                path,
                address(this),
                block.timestamp + 300
            );

            // Approve and execute
            IERC20(swap.tokenIn).approve(routerAddress, swap.amountIn);
            
            (bool success, ) = routerAddress.call(swapCalldata);
            require(success, "Swap failed");
        }

        // Transfer all output tokens to user
        for (uint256 i = 0; i < swaps.length; i++) {
            uint256 balance = IERC20(swaps[i].tokenOut).balanceOf(address(this));
            if (balance > 0) {
                IERC20(swaps[i].tokenOut).safeTransfer(msg.sender, balance);
            }
        }
    }

    /**
     * @notice Example: Handle different router types with specific logic
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @param routerType Type of DEX router to use
     * @param extraData Additional data specific to router type
     */
    function advancedSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        QuoteLibrary.RouterType routerType,
        bytes calldata extraData
    ) external {
        require(amountIn > 0, "Amount must be > 0");

        // Transfer tokens from user
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        if (routerType == QuoteLibrary.RouterType.UNISWAP_V3) {
            _handleUniswapV3Swap(tokenIn, tokenOut, amountIn, extraData);
        } else if (routerType == QuoteLibrary.RouterType.CURVE) {
            _handleCurveSwap(tokenIn, tokenOut, amountIn, extraData);
        } else if (routerType == QuoteLibrary.RouterType.BALANCER) {
            _handleBalancerSwap(tokenIn, tokenOut, amountIn, extraData);
        } else {
            // Default to standard swap
            _handleStandardSwap(tokenIn, tokenOut, amountIn, routerType);
        }
    }

    // Internal helper functions

    function _handleUniswapV3Swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        bytes calldata extraData
    ) internal {
        // Decode Uniswap V3 specific data (fee tier, path, etc.)
        (uint24 fee, uint256 amountOutMin) = abi.decode(extraData, (uint24, uint256));
        
        // For Uniswap V3, we would need to implement the exact input swap logic
        // This is a simplified example that demonstrates the pattern
        
        // In practice, you would:
        // 1. Generate the proper V3 path with encoded fees
        // 2. Call the Uniswap V3 router with exactInputSingle or exactInput
        // 3. Handle the token transfers and approvals
        
        // Simplified implementation using standard swap logic
        _handleStandardSwap(tokenIn, tokenOut, amountIn, QuoteLibrary.RouterType.UNISWAP_V3);
    }

    function _handleCurveSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        bytes calldata extraData
    ) internal {
        // Decode Curve specific data
        (uint256 minAmountOut) = abi.decode(extraData, (uint256));
        
        // Generate calldata using CalldataLibrary (simplified)
        bytes memory swapCalldata = CalldataLibrary.generateCurveSwapCalldata(
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut
        );

        // Execute swap...
        // Implementation details would go here
    }

    function _handleBalancerSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        bytes calldata extraData
    ) internal {
        // Simplified Balancer swap implementation
        // In practice, you would implement proper Balancer integration
        revert("Balancer swap not implemented in this example");
    }

    function _handleStandardSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        QuoteLibrary.RouterType routerType
    ) internal {
        // Get router address
        address routerAddress = _getRouterAddress(block.chainid, routerType);
        require(routerAddress != address(0), "Router not configured");

        // Get quote (simplified for V2-style routers)
        uint256 expectedAmountOut = 0;
        if (routerType == QuoteLibrary.RouterType.UNISWAP_V2 || 
            routerType == QuoteLibrary.RouterType.SUSHISWAP ||
            routerType == QuoteLibrary.RouterType.PANCAKESWAP) {
            expectedAmountOut = calldataGenerator.getUniswapV2Quote(
                routerAddress,
                tokenIn,
                tokenOut,
                amountIn
            );
        }
        require(expectedAmountOut > 0, "Unable to get quote");

        uint256 amountOutMin = (expectedAmountOut * 9700) / 10000; // 3% slippage

        // Generate swap calldata
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        bytes memory swapCalldata = calldataGenerator.generateUniswapV2Calldata(
            amountIn,
            amountOutMin,
            path,
            msg.sender,
            block.timestamp + 300 // 5 minute deadline
        );

        // Execute swap...
        // Implementation details would go here
    }

    // Emergency functions

    /**
     * @notice Emergency function to recover stuck tokens
     * @param token Token address to recover
     * @param amount Amount to recover (0 = all balance)
     * @param to Recipient address
     */
    function emergencyRecoverTokens(
        address token,
        uint256 amount,
        address to
    ) external {
        require(msg.sender == address(this), "Only self"); // Could add proper access control
        
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 amountToRecover = amount == 0 ? balance : amount;
        
        require(amountToRecover <= balance, "Insufficient balance");
        
        IERC20(token).safeTransfer(to, amountToRecover);
    }

    // Structs and interfaces

    struct SwapParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOutMin;
        QuoteLibrary.RouterType routerType;
    }

    // View functions

    /**
     * @notice Get supported router types for a chain
     * @param chainId Chain ID to check
     * @return supportedRouters Array of supported router types
     */
    function getSupportedRouters(uint256 chainId) 
        external 
        view 
        returns (QuoteLibrary.RouterType[] memory supportedRouters) 
    {
        // This would need to be implemented in the SwapCalldataGenerator
        // For now, return common router types
        supportedRouters = new QuoteLibrary.RouterType[](4);
        supportedRouters[0] = QuoteLibrary.RouterType.UNISWAP_V2;
        supportedRouters[1] = QuoteLibrary.RouterType.UNISWAP_V3;
        supportedRouters[2] = QuoteLibrary.RouterType.CURVE;
        supportedRouters[3] = QuoteLibrary.RouterType.BALANCER;
    }

    /**
     * @notice Check if a chain is supported
     * @param chainId Chain ID to check
     * @return supported True if chain is supported
     */
    function isChainSupported(uint256 chainId) external view returns (bool supported) {
        return calldataGenerator.supportedChains(chainId);
    }
}
