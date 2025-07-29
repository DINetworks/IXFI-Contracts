// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./QuoteLibrary.sol";

// Multicall3 interface
interface IMulticall3 {
    struct Call3 {
        address target;
        bool allowFailure;
        bytes callData;
    }
}

/**
 * @title MulticallLibrary
 * @notice Library for handling multicall operations and optimal router selection
 */
library MulticallLibrary {

    /**
     * @notice Get optimal router using individual calls
     */
    function getOptimalRouter(
        uint256 chainId,
        address tokenIn,
        address tokenOut,
        uint256 amount,
        mapping(uint256 => bool) storage supportedChains,
        mapping(uint256 => mapping(QuoteLibrary.RouterType => QuoteLibrary.RouterConfig)) storage routers,
        mapping(uint256 => address) storage curveRegistries,
        mapping(uint256 => address) storage balancerVaults,
        mapping(uint256 => mapping(bytes32 => QuoteLibrary.PoolConfig)) storage poolConfigs
    ) internal returns (address routerAddress, QuoteLibrary.RouterType routerType, uint256 expectedOutput) {
        require(supportedChains[chainId], "Chain not supported");
        require(amount > 0, "Amount must be greater than 0");
        
        uint256 bestOutput = 0;
        address bestRouter = address(0);
        QuoteLibrary.RouterType bestType;
        bool routerFound = false;
        
        // Loop through all 37 router types (0-36)
        for (uint256 i = 0; i < 37; i++) {
            QuoteLibrary.RouterType rt = QuoteLibrary.RouterType(i);
            QuoteLibrary.RouterConfig memory config = routers[chainId][rt];
            
            if (config.isActive && config.routerAddress != address(0)) {
                uint256 output = QuoteLibrary.getExpectedOutput(
                    chainId,
                    rt,
                    tokenIn,
                    tokenOut,
                    amount,
                    routers,
                    curveRegistries,
                    balancerVaults,
                    poolConfigs
                );
                
                if (output > bestOutput) {
                    bestOutput = output;
                    bestRouter = config.routerAddress;
                    bestType = rt;
                    routerFound = true;
                }
            }
        }
        
        require(routerFound, "No successful quotes found");
        return (bestRouter, bestType, bestOutput);
    }

    /**
     * @notice Prepare multicall data for all active routers
     */
    function prepareMulticallQuotes(
        uint256 chainId,
        address tokenIn,
        address tokenOut,
        uint256 amount,
        mapping(uint256 => bool) storage supportedChains,
        mapping(uint256 => mapping(QuoteLibrary.RouterType => QuoteLibrary.RouterConfig)) storage routers
    ) internal view returns (IMulticall3.Call3[] memory calls) {
        require(supportedChains[chainId], "Chain not supported");
        require(amount > 0, "Amount must be greater than 0");
        
        uint256 activeCount = 0;
        // Count active routers from all 37 router types
        for (uint256 i = 0; i < 37; i++) {
            QuoteLibrary.RouterType rt = QuoteLibrary.RouterType(i);
            QuoteLibrary.RouterConfig memory config = routers[chainId][rt];
            if (config.isActive && config.routerAddress != address(0)) {
                activeCount++;
            }
        }
        
        calls = new IMulticall3.Call3[](activeCount);
        uint256 callIndex = 0;
        
        // Generate calls for all active routers
        for (uint256 i = 0; i < 37; i++) {
            QuoteLibrary.RouterType rt = QuoteLibrary.RouterType(i);
            QuoteLibrary.RouterConfig memory config = routers[chainId][rt];
            
            if (config.isActive && config.routerAddress != address(0)) {
                calls[callIndex] = IMulticall3.Call3({
                    target: config.routerAddress,
                    allowFailure: true,
                    callData: _generateQuoteCalldata(rt, tokenIn, tokenOut, amount)
                });
                callIndex++;
            }
        }
        
        return calls;
    }

    /**
     * @notice Generate calldata for price quotes based on router type
     */
    function _generateQuoteCalldata(
        QuoteLibrary.RouterType routerType,
        address tokenIn,
        address tokenOut,
        uint256 amount
    ) private pure returns (bytes memory) {
        // Uniswap V2 style routers (AMM with constant product)
        if (routerType == QuoteLibrary.RouterType.UNISWAP_V2 || 
            routerType == QuoteLibrary.RouterType.SUSHISWAP || 
            routerType == QuoteLibrary.RouterType.PANCAKESWAP || 
            routerType == QuoteLibrary.RouterType.QUICKSWAP ||
            routerType == QuoteLibrary.RouterType.SHIBASWAP ||
            routerType == QuoteLibrary.RouterType.TRADERJOE ||
            routerType == QuoteLibrary.RouterType.SPOOKYSWAP ||
            routerType == QuoteLibrary.RouterType.SPIRITSWAP ||
            routerType == QuoteLibrary.RouterType.APESWAP ||
            routerType == QuoteLibrary.RouterType.BISWAP ||
            routerType == QuoteLibrary.RouterType.MDEX ||
            routerType == QuoteLibrary.RouterType.CAMELOT ||
            routerType == QuoteLibrary.RouterType.ZYBERSWAP) {
            
            address[] memory path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;
            
            return abi.encodeWithSignature(
                "getAmountsOut(uint256,address[])",
                amount,
                path
            );
            
        // Uniswap V3 style routers (concentrated liquidity)
        } else if (routerType == QuoteLibrary.RouterType.UNISWAP_V3 ||
                   routerType == QuoteLibrary.RouterType.SUSHISWAP_V3 ||
                   routerType == QuoteLibrary.RouterType.PANCAKESWAP_V3 ||
                   routerType == QuoteLibrary.RouterType.RAMSES ||
                   routerType == QuoteLibrary.RouterType.ALGEBRA) {
            return abi.encodeWithSignature(
                "quoteExactInputSingle(address,address,uint24,uint256,uint160)",
                tokenIn,
                tokenOut,
                3000, // 0.3% fee tier
                amount,
                0
            );
            
        // Solidly style routers (Velodrome, Aerodrome, etc.)
        } else if (routerType == QuoteLibrary.RouterType.VELODROME ||
                   routerType == QuoteLibrary.RouterType.AERODROME ||
                   routerType == QuoteLibrary.RouterType.SOLIDLY ||
                   routerType == QuoteLibrary.RouterType.THENA ||
                   routerType == QuoteLibrary.RouterType.CHRONOS) {
            // Solidly-style routes with stable flag
            return abi.encodeWithSignature(
                "getAmountsOut(uint256,(address,address,bool)[])",
                amount,
                _getSolidlyRoute(tokenIn, tokenOut)
            );
            
        // Curve pools
        } else if (routerType == QuoteLibrary.RouterType.CURVE) {
            return abi.encodeWithSignature(
                "get_dy(int128,int128,uint256)",
                0, // token in index
                1, // token out index  
                amount
            );
            
        // Stableswap protocols (Platypus, Wombat)
        } else if (routerType == QuoteLibrary.RouterType.PLATYPUS ||
                   routerType == QuoteLibrary.RouterType.WOMBAT) {
            return abi.encodeWithSignature(
                "quotePotentialSwap(address,address,uint256)",
                tokenIn,
                tokenOut,
                amount
            );
            
        // GMX Router
        } else if (routerType == QuoteLibrary.RouterType.GMXSWAP) {
            return abi.encodeWithSignature(
                "getAmountOut(address,address,uint256)",
                tokenIn,
                tokenOut,
                amount
            );
            
        } else {
            // For unsupported or complex routers, return empty calldata
            return "";
        }
    }
    
    /**
     * @notice Helper function to create Solidly-style route
     */
    function _getSolidlyRoute(address tokenIn, address tokenOut) 
        private 
        pure 
        returns (bytes memory) {
        // Create a single route struct (from, to, stable)
        // For simplicity, we assume non-stable pairs
        return abi.encode(tokenIn, tokenOut, false);
    }
}
