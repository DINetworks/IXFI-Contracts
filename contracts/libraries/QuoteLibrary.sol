// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Router interfaces for price quotes
interface IUniswapV2Router {
    function getAmountsOut(uint amountIn, address[] calldata path)
        external view returns (uint[] memory amounts);
}

interface IUniswapV3Quoter {
    function quoteExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint160 sqrtPriceLimitX96
    ) external returns (uint256 amountOut);
}

// Curve pool interfaces
interface ICurvePool {
    function get_dy(int128 i, int128 j, uint256 dx) external view returns (uint256);
    function coins(uint256 i) external view returns (address);
    function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) external returns (uint256);
}

interface ICurveRegistry {
    function find_pool_for_coins(address from, address to) external view returns (address);
    function get_coin_indices(address pool, address from, address to) external view returns (int128, int128, bool);
}

// Balancer interfaces
interface IBalancerVault {
    struct SingleSwap {
        bytes32 poolId;
        uint8 kind; // 0 = GIVEN_IN, 1 = GIVEN_OUT
        address assetIn;
        address assetOut;
        uint256 amount;
        bytes userData;
    }

    struct FundManagement {
        address sender;
        bool fromInternalBalance;
        address payable recipient;
        bool toInternalBalance;
    }

    function queryBatchSwap(
        uint8 kind,
        BatchSwapStep[] memory swaps,
        address[] memory assets,
        FundManagement memory funds
    ) external returns (int256[] memory);

    function batchSwap(
        uint8 kind,
        BatchSwapStep[] memory swaps,
        address[] memory assets,
        FundManagement memory funds,
        int256[] memory limits,
        uint256 deadline
    ) external returns (int256[] memory);

    struct BatchSwapStep {
        bytes32 poolId;
        uint256 assetInIndex;
        uint256 assetOutIndex;
        uint256 amount;
        bytes userData;
    }
}

// 1inch interfaces
interface IOneInchV5Router {
    function getExpectedReturn(
        address fromToken,
        address destToken,
        uint256 amount,
        uint256 parts,
        uint256 flags
    ) external view returns (uint256 returnAmount, uint256[] memory distribution);
    
    function swap(
        address fromToken,
        address destToken,
        uint256 amount,
        uint256 minReturn,
        bytes calldata data
    ) external returns (uint256);
}

// ParaSwap interfaces
interface IParaSwapV5 {
    struct SellData {
        address fromToken;
        uint256 fromAmount;
        uint256 toAmount;
        uint256 expectedAmount;
        address beneficiary;
        string referrer;
        bool useReduxToken;
        bytes data;
    }
    
    function multiSwap(SellData calldata data) external payable returns (uint256);
    
    function getRate(
        address srcToken,
        address destToken,
        uint256 srcAmount
    ) external view returns (uint256);
}

// 0x Protocol interfaces
interface IZeroXV4 {
    function fillLimitOrder(
        bytes32 orderHash,
        bytes calldata signature,
        uint128 takerTokenFillAmount
    ) external payable returns (uint128 takerTokenFilledAmount, uint128 makerTokenFilledAmount);
}

// Kyber Network interfaces
interface IKyberNetworkProxy {
    function getExpectedRate(
        address src,
        address dest,
        uint256 srcQty
    ) external view returns (uint256 expectedRate, uint256 slippageRate);
    
    function swapTokenToToken(
        address src,
        uint256 srcAmount,
        address dest,
        uint256 minConversionRate
    ) external returns (uint256);
}

// DODO interfaces
interface IDODOProxy {
    function dodoSwapV1(
        address fromToken,
        address toToken,
        uint256 fromTokenAmount,
        uint256 minReturnAmount,
        address[] memory dodoPairs,
        uint256 directions,
        bool isIncentive,
        uint256 deadLine
    ) external payable returns (uint256 returnAmount);
    
    function querySellQuoteTokenForBaseToken(
        address dodoPool,
        uint256 amount
    ) external view returns (uint256);
}

// Bancor interfaces
interface IBancorNetwork {
    function convertByPath(
        address[] memory path,
        uint256 amount,
        uint256 minReturn,
        address beneficiary,
        address affiliateAccount,
        uint256 affiliateFee
    ) external payable returns (uint256);
    
    function rateByPath(
        address[] memory path,
        uint256 amount
    ) external view returns (uint256);
}

// Velodrome/Aerodrome interfaces (Solidly forks)
interface IVelodromeRouter {
    struct Route {
        address from;
        address to;
        bool stable;
    }
    
    function getAmountsOut(uint amountIn, Route[] memory routes)
        external view returns (uint[] memory amounts);
        
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        Route[] calldata routes,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

// Ramses interfaces (Uniswap V3 fork with concentrated liquidity)
interface IRamsesV3Quoter {
    function quoteExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint160 sqrtPriceLimitX96
    ) external returns (uint256 amountOut);
}

// Solidly interfaces
interface ISolidlyRouter {
    struct Route {
        address from;
        address to;
        bool stable;
    }
    
    function getAmountsOut(uint amountIn, Route[] memory routes)
        external view returns (uint[] memory amounts);
}

// Thena interfaces (BSC)
interface IThenaRouter {
    struct Route {
        address from;
        address to;
        bool stable;
    }
    
    function getAmountsOut(uint amountIn, Route[] memory routes)
        external view returns (uint[] memory amounts);
}

// Camelot interfaces (Arbitrum)
interface ICamelotRouter {
    function getAmountsOut(uint amountIn, address[] calldata path)
        external view returns (uint[] memory amounts);
}

// Chronos interfaces
interface IChronosRouter {
    struct Route {
        address from;
        address to;
        bool stable;
    }
    
    function getAmountsOut(uint amountIn, Route[] memory routes)
        external view returns (uint[] memory amounts);
}

// ZyberSwap interfaces (Arbitrum)
interface IZyberSwapRouter {
    function getAmountsOut(uint amountIn, address[] calldata path)
        external view returns (uint[] memory amounts);
}

// Beethoven X interfaces (Fantom/Optimism - Balancer fork)
interface IBeethovenXVault {
    struct SingleSwap {
        bytes32 poolId;
        uint8 kind;
        address assetIn;
        address assetOut;
        uint256 amount;
        bytes userData;
    }

    struct FundManagement {
        address sender;
        bool fromInternalBalance;
        address payable recipient;
        bool toInternalBalance;
    }

    function queryBatchSwap(
        uint8 kind,
        IBalancerVault.BatchSwapStep[] memory swaps,
        address[] memory assets,
        FundManagement memory funds
    ) external returns (int256[] memory);
}

// Platypus interfaces (Avalanche stableswap)
interface IPlatypusPool {
    function quotePotentialSwap(
        address fromToken,
        address toToken,
        uint256 fromAmount
    ) external view returns (uint256 potentialOutcome, uint256 haircut);
    
    function swap(
        address fromToken,
        address toToken,
        uint256 fromAmount,
        uint256 minimumToAmount,
        address to,
        uint256 deadline
    ) external returns (uint256 actualToAmount, uint256 haircut);
}

// Wombat interfaces (Multi-chain stableswap)
interface IWombatPool {
    function quotePotentialSwap(
        address fromToken,
        address toToken,
        int256 fromAmount
    ) external view returns (uint256 potentialOutcome, uint256 haircut);
    
    function swap(
        address fromToken,
        address toToken,
        uint256 fromAmount,
        uint256 minimumToAmount,
        address to,
        uint256 deadline
    ) external returns (uint256 actualToAmount, uint256 haircut);
}

// GMX Swap interfaces
interface IGMXRouter {
    function swap(
        address[] memory path,
        uint256 amountIn,
        uint256 minOut,
        address receiver
    ) external;
    
    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut, uint256 feeAmount);
}

// Maverick interfaces (concentrated liquidity)
interface IMaverickPool {
    function calculateSwap(
        address recipient,
        bool tokenAIn,
        int256 amountSpecified,
        uint256 sqrtPriceLimitD18
    ) external view returns (int256 amountIn, int256 amountOut);
}

// Algebra interfaces (Uniswap V3 fork)
interface IAlgebraQuoter {
    function quoteExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint160 limitSqrtPrice
    ) external returns (uint256 amountOut);
}

/**
 * @title QuoteLibrary
 * @notice Library for getting price quotes from different DEX protocols
 */
library QuoteLibrary {
    
    // Router types - Extended with more famous DEXes
    enum RouterType {
        UNISWAP_V2,
        UNISWAP_V3,
        SUSHISWAP,
        SUSHISWAP_V3,
        PANCAKESWAP,
        PANCAKESWAP_V3,
        QUICKSWAP,
        CURVE,
        BALANCER,
        ONE_INCH,
        PARASWAP,
        ZEROX_PROTOCOL,
        KYBER_NETWORK,
        DODO,
        BANCOR,
        SHIBASWAP,
        TRADERJOE,
        SPOOKYSWAP,
        SPIRITSWAP,
        APESWAP,
        BISWAP,
        MDEX,
        // Additional 15 DEXes
        VELODROME,
        AERODROME,
        RAMSES,
        SOLIDLY,
        THENA,
        CAMELOT,
        CHRONOS,
        ZYBERSWAP,
        BEETHOVEN_X,
        PLATYPUS,
        WOMBAT,
        GMXSWAP,
        MAVERICK,
        ALGEBRA,
        RETRO
    }

    // Router configurations
    struct RouterConfig {
        address routerAddress;
        RouterType routerType;
        bool isActive;
    }

    // Pool configurations for specific token pairs
    struct PoolConfig {
        address poolAddress;
        bytes32 poolId; // For Balancer
        bool isActive;
    }

    /**
     * @notice Get quote from Uniswap V2 style router
     */
    function getUniswapV2Quote(
        address router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256) {
        // Create path array
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        uint256[] memory amounts = IUniswapV2Router(router).getAmountsOut(amountIn, path);
        return amounts[1]; // Return output amount
    }

    /**
     * @notice Get quote from Uniswap V3 router
     * @dev Note: This function is not view because Uniswap V3 quoter modifies state
     */
    function getUniswapV3Quote(
        address router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal returns (uint256) {
        // For Uniswap V3, we'd need to specify fee tier and use the quoter contract
        // This is a simplified version - in practice, you'd check multiple fee tiers
        try IUniswapV3Quoter(router).quoteExactInputSingle(
            tokenIn,
            tokenOut,
            3000, // 0.3% fee tier
            amountIn,
            0 // sqrtPriceLimitX96
        ) returns (uint256 amountOut) {
            return amountOut;
        } catch {
            // Try 0.05% fee tier
            try IUniswapV3Quoter(router).quoteExactInputSingle(
                tokenIn,
                tokenOut,
                500,
                amountIn,
                0
            ) returns (uint256 amountOut) {
                return amountOut;
            } catch {
                return 0;
            }
        }
    }

    /**
     * @notice Get quote from SushiSwap V3 (uses same interface as Uniswap V3)
     */
    function getSushiswapV3Quote(
        address router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal returns (uint256) {
        return getUniswapV3Quote(router, tokenIn, tokenOut, amountIn);
    }

    /**
     * @notice Get quote from PancakeSwap V3 (uses same interface as Uniswap V3)
     */
    function getPancakeswapV3Quote(
        address router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal returns (uint256) {
        return getUniswapV3Quote(router, tokenIn, tokenOut, amountIn);
    }

    /**
     * @notice Get quote from Curve pool (real implementation)
     */
    function getCurveQuote(
        uint256 chainId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        mapping(uint256 => address) storage curveRegistries,
        mapping(uint256 => mapping(bytes32 => PoolConfig)) storage poolConfigs
    ) internal view returns (uint256) {
        address curveRegistry = curveRegistries[chainId];
        if (curveRegistry == address(0)) {
            return 0; // No Curve registry configured
        }
        
        // Check if we have a specific pool configured for this pair
        bytes32 pairHash = keccak256(abi.encodePacked(tokenIn, tokenOut));
        PoolConfig memory poolConfig = poolConfigs[chainId][pairHash];
        
        address pool;
        if (poolConfig.isActive && poolConfig.poolAddress != address(0)) {
            pool = poolConfig.poolAddress;
        } else {
            // Try to find pool through registry
            try ICurveRegistry(curveRegistry).find_pool_for_coins(tokenIn, tokenOut) returns (address foundPool) {
                pool = foundPool;
            } catch {
                return 0; // No pool found
            }
        }
        
        if (pool == address(0)) {
            return 0;
        }
        
        // Get coin indices
        try ICurveRegistry(curveRegistry).get_coin_indices(pool, tokenIn, tokenOut) 
            returns (int128 i, int128 j, bool /* underlying */) {
            
            // Get quote from pool
            try ICurvePool(pool).get_dy(i, j, amountIn) returns (uint256 dy) {
                return dy;
            } catch {
                return 0;
            }
        } catch {
            return 0;
        }
    }

    /**
     * @notice Get quote from Balancer pool (real implementation)
     */
    function getBalancerQuote(
        uint256 chainId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        mapping(uint256 => address) storage balancerVaults,
        mapping(uint256 => mapping(bytes32 => PoolConfig)) storage poolConfigs
    ) internal returns (uint256) {
        address balancerVault = balancerVaults[chainId];
        if (balancerVault == address(0)) {
            return 0; // No Balancer vault configured
        }
        
        // Check if we have a specific pool configured for this pair
        bytes32 pairHash = keccak256(abi.encodePacked(tokenIn, tokenOut));
        PoolConfig memory poolConfig = poolConfigs[chainId][pairHash];
        
        if (!poolConfig.isActive || poolConfig.poolAddress == address(0) || poolConfig.poolId == bytes32(0)) {
            return 0; // No pool configured for this pair
        }
        
        // Prepare batch swap for quote
        IBalancerVault.BatchSwapStep[] memory swaps = new IBalancerVault.BatchSwapStep[](1);
        swaps[0] = IBalancerVault.BatchSwapStep({
            poolId: poolConfig.poolId,
            assetInIndex: 0,
            assetOutIndex: 1,
            amount: amountIn,
            userData: "0x"
        });
        
        address[] memory assets = new address[](2);
        assets[0] = tokenIn;
        assets[1] = tokenOut;
        
        IBalancerVault.FundManagement memory funds = IBalancerVault.FundManagement({
            sender: address(this),
            fromInternalBalance: false,
            recipient: payable(address(this)),
            toInternalBalance: false
        });
        
        try IBalancerVault(balancerVault).queryBatchSwap(0, swaps, assets, funds) 
            returns (int256[] memory deltas) {
            // Return absolute value of output delta (will be negative for output)
            return deltas.length > 1 && deltas[1] < 0 ? uint256(-deltas[1]) : 0;
        } catch {
            return 0;
        }
    }

    /**
     * @notice Get quote from 1inch aggregator
     */
    function getOneInchQuote(
        address router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256) {
        try IOneInchV5Router(router).getExpectedReturn(
            tokenIn,
            tokenOut,
            amountIn,
            10, // parts
            0   // flags
        ) returns (uint256 returnAmount, uint256[] memory) {
            return returnAmount;
        } catch {
            return 0;
        }
    }

    /**
     * @notice Get quote from ParaSwap
     */
    function getParaSwapQuote(
        address router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256) {
        try IParaSwapV5(router).getRate(
            tokenIn,
            tokenOut,
            amountIn
        ) returns (uint256 rate) {
            return rate;
        } catch {
            return 0;
        }
    }

    /**
     * @notice Get quote from Kyber Network
     */
    function getKyberQuote(
        address router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256) {
        try IKyberNetworkProxy(router).getExpectedRate(
            tokenIn,
            tokenOut,
            amountIn
        ) returns (uint256 expectedRate, uint256) {
            // Convert rate to actual amount
            return (amountIn * expectedRate) / 1e18;
        } catch {
            return 0;
        }
    }

    /**
     * @notice Get quote from DODO
     */
    function getDODOQuote(
        address router,
        address poolAddress,
        uint256 amountIn
    ) internal view returns (uint256) {
        try IDODOProxy(router).querySellQuoteTokenForBaseToken(
            poolAddress,
            amountIn
        ) returns (uint256 amount) {
            return amount;
        } catch {
            return 0;
        }
    }

    /**
     * @notice Get quote from Bancor
     */
    function getBancorQuote(
        address router,
        address[] memory path,
        uint256 amountIn
    ) internal view returns (uint256) {
        try IBancorNetwork(router).rateByPath(
            path,
            amountIn
        ) returns (uint256 amount) {
            return amount;
        } catch {
            return 0;
        }
    }
    function getExpectedOutput(
        uint256 chainId,
        RouterType routerType,
        address tokenIn,
        address tokenOut,
        uint256 amount,
        mapping(uint256 => mapping(RouterType => RouterConfig)) storage routers,
        mapping(uint256 => address) storage curveRegistries,
        mapping(uint256 => address) storage balancerVaults,
        mapping(uint256 => mapping(bytes32 => PoolConfig)) storage poolConfigs
    ) internal returns (uint256 expectedOutput) {
        RouterConfig memory config = routers[chainId][routerType];
        require(config.isActive, "Router not active");
        
        if (routerType == RouterType.UNISWAP_V2 || 
            routerType == RouterType.SUSHISWAP || 
            routerType == RouterType.PANCAKESWAP || 
            routerType == RouterType.QUICKSWAP ||
            routerType == RouterType.SHIBASWAP ||
            routerType == RouterType.TRADERJOE ||
            routerType == RouterType.SPOOKYSWAP ||
            routerType == RouterType.SPIRITSWAP ||
            routerType == RouterType.APESWAP ||
            routerType == RouterType.BISWAP ||
            routerType == RouterType.MDEX) {
            return getUniswapV2Quote(config.routerAddress, tokenIn, tokenOut, amount);
        } else if (routerType == RouterType.UNISWAP_V3) {
            return getUniswapV3Quote(config.routerAddress, tokenIn, tokenOut, amount);
        } else if (routerType == RouterType.SUSHISWAP_V3) {
            return getSushiswapV3Quote(config.routerAddress, tokenIn, tokenOut, amount);
        } else if (routerType == RouterType.PANCAKESWAP_V3) {
            return getPancakeswapV3Quote(config.routerAddress, tokenIn, tokenOut, amount);
        } else if (routerType == RouterType.CURVE) {
            return getCurveQuote(chainId, tokenIn, tokenOut, amount, curveRegistries, poolConfigs);
        } else if (routerType == RouterType.BALANCER) {
            return getBalancerQuote(chainId, tokenIn, tokenOut, amount, balancerVaults, poolConfigs);
        } else if (routerType == RouterType.ONE_INCH) {
            return getOneInchQuote(config.routerAddress, tokenIn, tokenOut, amount);
        } else if (routerType == RouterType.PARASWAP) {
            return getParaSwapQuote(config.routerAddress, tokenIn, tokenOut, amount);
        } else if (routerType == RouterType.KYBER_NETWORK) {
            return getKyberQuote(config.routerAddress, tokenIn, tokenOut, amount);
        } else if (routerType == RouterType.DODO) {
            // For DODO, we need pool address which should be configured separately
            return 0; // Placeholder - would need pool configuration
        } else if (routerType == RouterType.BANCOR) {
            // For Bancor, we need path which should be configured separately
            return 0; // Placeholder - would need path configuration
        } else if (routerType == RouterType.VELODROME) {
            return getVelodromeQuote(config, tokenIn, tokenOut, amount);
        } else if (routerType == RouterType.RAMSES) {
            return getRamsesQuote(config, tokenIn, tokenOut, amount);
        } else if (routerType == RouterType.SOLIDLY) {
            return getSolidlyQuote(config, tokenIn, tokenOut, amount);
        } else if (routerType == RouterType.THENA) {
            return getThenaQuote(config, tokenIn, tokenOut, amount);
        } else if (routerType == RouterType.CAMELOT) {
            return getCamelotQuote(config, tokenIn, tokenOut, amount);
        } else if (routerType == RouterType.CHRONOS) {
            return getChronosQuote(config, tokenIn, tokenOut, amount);
        } else if (routerType == RouterType.ZYBERSWAP) {
            return getZyberSwapQuote(config, tokenIn, tokenOut, amount);
        } else if (routerType == RouterType.BEETHOVEN_X) {
            return getBeethovenXQuote(config, tokenIn, tokenOut, amount);
        } else if (routerType == RouterType.PLATYPUS) {
            return getPlatypusQuote(config, tokenIn, tokenOut, amount);
        } else if (routerType == RouterType.WOMBAT) {
            return getWombatQuote(config, tokenIn, tokenOut, amount);
        } else if (routerType == RouterType.GMXSWAP) {
            return getGMXQuote(config, tokenIn, tokenOut, amount);
        } else if (routerType == RouterType.MAVERICK) {
            return getMaverickQuote(config, tokenIn, tokenOut, amount);
        } else if (routerType == RouterType.ALGEBRA) {
            return getAlgebraQuote(config, tokenIn, tokenOut, amount);
        } else if (routerType == RouterType.AERODROME) {
            return getAerodromeQuote(config, tokenIn, tokenOut, amount);
        } else if (routerType == RouterType.ZEROX_PROTOCOL) {
            // 0x Protocol requires order book data, return 0 for now
            return 0; // Placeholder - would need order book integration
        }
        
        revert("Unsupported router type");
    }

    function getVelodromeQuote(
        RouterConfig memory config,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256) {
        try IVelodromeRouter(config.routerAddress).getAmountsOut(
            amountIn,
            getVelodromeRoute(tokenIn, tokenOut)
        ) returns (uint[] memory amounts) {
            return amounts[amounts.length - 1];
        } catch {
            return 0;
        }
    }

    function getRamsesQuote(
        RouterConfig memory config,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal returns (uint256) {
        try IRamsesV3Quoter(config.routerAddress).quoteExactInputSingle(
            tokenIn,
            tokenOut,
            3000, // 0.3% fee tier
            amountIn,
            0
        ) returns (uint256 amountOut) {
            return amountOut;
        } catch {
            return 0;
        }
    }

    function getSolidlyQuote(
        RouterConfig memory config,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256) {
        try ISolidlyRouter(config.routerAddress).getAmountsOut(
            amountIn,
            getSolidlyRoute(tokenIn, tokenOut)
        ) returns (uint[] memory amounts) {
            return amounts[amounts.length - 1];
        } catch {
            return 0;
        }
    }

    function getThenaQuote(
        RouterConfig memory config,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256) {
        try IThenaRouter(config.routerAddress).getAmountsOut(
            amountIn,
            getThenaRoute(tokenIn, tokenOut)
        ) returns (uint[] memory amounts) {
            return amounts[amounts.length - 1];
        } catch {
            return 0;
        }
    }

    function getCamelotQuote(
        RouterConfig memory config,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        try ICamelotRouter(config.routerAddress).getAmountsOut(amountIn, path) returns (uint[] memory amounts) {
            return amounts[1];
        } catch {
            return 0;
        }
    }

    function getChronosQuote(
        RouterConfig memory config,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256) {
        try IChronosRouter(config.routerAddress).getAmountsOut(
            amountIn,
            getChronosRoute(tokenIn, tokenOut)
        ) returns (uint[] memory amounts) {
            return amounts[amounts.length - 1];
        } catch {
            return 0;
        }
    }

    function getZyberSwapQuote(
        RouterConfig memory config,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        try IZyberSwapRouter(config.routerAddress).getAmountsOut(amountIn, path) returns (uint[] memory amounts) {
            return amounts[1];
        } catch {
            return 0;
        }
    }

    function getBeethovenXQuote(
        RouterConfig memory config,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal returns (uint256) {
        // Placeholder for Beethoven X (Balancer fork) quote
        return 0;
    }

    function getPlatypusQuote(
        RouterConfig memory config,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256) {
        try IPlatypusPool(config.routerAddress).quotePotentialSwap(
            tokenIn,
            tokenOut,
            amountIn
        ) returns (uint256 potentialOutcome, uint256) {
            return potentialOutcome;
        } catch {
            return 0;
        }
    }

    function getWombatQuote(
        RouterConfig memory config,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256) {
        try IWombatPool(config.routerAddress).quotePotentialSwap(
            tokenIn,
            tokenOut,
            int256(amountIn)
        ) returns (uint256 potentialOutcome, uint256) {
            return potentialOutcome;
        } catch {
            return 0;
        }
    }

    function getGMXQuote(
        RouterConfig memory config,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256) {
        try IGMXRouter(config.routerAddress).getAmountOut(
            tokenIn,
            tokenOut,
            amountIn
        ) returns (uint256 amountOut, uint256) {
            return amountOut;
        } catch {
            return 0;
        }
    }

    function getMaverickQuote(
        RouterConfig memory config,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256) {
        // Placeholder for Maverick concentrated liquidity quote
        return 0;
    }

    function getAlgebraQuote(
        RouterConfig memory config,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal returns (uint256) {
        try IAlgebraQuoter(config.routerAddress).quoteExactInputSingle(
            tokenIn,
            tokenOut,
            amountIn,
            0
        ) returns (uint256 amountOut) {
            return amountOut;
        } catch {
            return 0;
        }
    }

    function getAerodromeQuote(
        RouterConfig memory config,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256) {
        return getVelodromeQuote(config, tokenIn, tokenOut, amountIn);
    }

    // Helper functions for Solidly-based DEXes
    function getVelodromeRoute(address tokenIn, address tokenOut) 
        internal 
        pure 
        returns (IVelodromeRouter.Route[] memory) {
        IVelodromeRouter.Route[] memory routes = new IVelodromeRouter.Route[](1);
        routes[0] = IVelodromeRouter.Route({
            from: tokenIn,
            to: tokenOut,
            stable: false
        });
        return routes;
    }

    function getSolidlyRoute(address tokenIn, address tokenOut) 
        internal 
        pure 
        returns (ISolidlyRouter.Route[] memory) {
        ISolidlyRouter.Route[] memory routes = new ISolidlyRouter.Route[](1);
        routes[0] = ISolidlyRouter.Route({
            from: tokenIn,
            to: tokenOut,
            stable: false
        });
        return routes;
    }

    function getThenaRoute(address tokenIn, address tokenOut) 
        internal 
        pure 
        returns (IThenaRouter.Route[] memory) {
        IThenaRouter.Route[] memory routes = new IThenaRouter.Route[](1);
        routes[0] = IThenaRouter.Route({
            from: tokenIn,
            to: tokenOut,
            stable: false
        });
        return routes;
    }

    function getChronosRoute(address tokenIn, address tokenOut) 
        internal 
        pure 
        returns (IChronosRouter.Route[] memory) {
        IChronosRouter.Route[] memory routes = new IChronosRouter.Route[](1);
        routes[0] = IChronosRouter.Route({
            from: tokenIn,
            to: tokenOut,
            stable: false
        });
        return routes;
    }
}
