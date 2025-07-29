# Router Types

The IXFI Protocol supports multiple router types, each optimized for different trading scenarios and requirements. This document explains the various router implementations and their use cases.

## Overview

IXFI Protocol implements several router types to handle different trading patterns:

1. **Simple Router** - Direct swaps on single DEXes
2. **Multi-hop Router** - Complex routes through multiple pools
3. **Cross-chain Router** - Routes spanning multiple blockchains
4. **Aggregation Router** - Combines multiple DEXes for optimal execution
5. **Split Router** - Divides large orders across multiple routes
6. **Flash Router** - Atomic multi-step operations using flash loans

## Router Architecture

### Base Router Interface

All routers implement a common interface for consistency:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IIXFIRouter.sol";

interface IIXFIRouter {
    struct SwapParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOutMin;
        address[] pools;
        uint256 deadline;
        address recipient;
        bytes extraData;
    }

    struct Route {
        address[] tokens;
        address[] pools;
        uint256[] fees;
        bytes[] swapData;
    }

    function swapExactTokensForTokens(
        SwapParams calldata params
    ) external payable returns (uint256 amountOut);

    function getAmountsOut(
        uint256 amountIn,
        Route calldata route
    ) external view returns (uint256[] memory amounts);

    function quote(
        address tokenA,
        address tokenB,
        uint256 amountIn
    ) external view returns (uint256 amountOut, Route memory optimalRoute);

    function getSupportedDEXes() external view returns (address[] memory);
    function getRouterType() external pure returns (string memory);
}
```

### Router Registry

```solidity
contract IXFIRouterRegistry {
    mapping(string => address) public routers;
    mapping(address => bool) public authorizedRouters;
    address public governance;

    event RouterRegistered(string indexed routerType, address indexed router);
    event RouterUpdated(string indexed routerType, address indexed oldRouter, address indexed newRouter);

    modifier onlyGovernance() {
        require(msg.sender == governance, "Not authorized");
        _;
    }

    constructor(address _governance) {
        governance = _governance;
    }

    function registerRouter(string calldata routerType, address router) external onlyGovernance {
        require(router != address(0), "Invalid router address");
        
        address oldRouter = routers[routerType];
        routers[routerType] = router;
        authorizedRouters[router] = true;
        
        if (oldRouter != address(0)) {
            authorizedRouters[oldRouter] = false;
            emit RouterUpdated(routerType, oldRouter, router);
        } else {
            emit RouterRegistered(routerType, router);
        }
    }

    function getRouter(string calldata routerType) external view returns (address) {
        return routers[routerType];
    }

    function isAuthorizedRouter(address router) external view returns (bool) {
        return authorizedRouters[router];
    }
}
```

## 1. Simple Router

The Simple Router handles direct swaps on single DEXes with minimal complexity:

```solidity
contract IXFISimpleRouter is IIXFIRouter {
    using SafeERC20 for IERC20;

    struct DEXConfig {
        address router;
        uint256 fee;
        bytes4 swapSelector;
        bool isActive;
    }

    mapping(string => DEXConfig) public dexConfigs;
    mapping(address => mapping(address => address)) public pairAddresses;
    
    address public immutable WETH;
    uint256 public constant MAX_SLIPPAGE = 500; // 5%

    constructor(address _weth) {
        WETH = _weth;
        _initializeDEXes();
    }

    function swapExactTokensForTokens(
        SwapParams calldata params
    ) external payable override returns (uint256 amountOut) {
        require(params.deadline >= block.timestamp, "Expired");
        require(params.pools.length == 1, "Simple router supports single pool only");
        
        address pool = params.pools[0];
        string memory dexName = _getDEXName(pool);
        DEXConfig memory config = dexConfigs[dexName];
        
        require(config.isActive, "DEX not active");

        // Handle native ETH
        if (params.tokenIn == address(0)) {
            require(msg.value >= params.amountIn, "Insufficient ETH");
            return _swapETHForTokens(config, params);
        } else if (params.tokenOut == address(0)) {
            return _swapTokensForETH(config, params);
        } else {
            return _swapTokensForTokens(config, params);
        }
    }

    function _swapTokensForTokens(
        DEXConfig memory config,
        SwapParams calldata params
    ) internal returns (uint256 amountOut) {
        IERC20(params.tokenIn).safeTransferFrom(
            msg.sender,
            address(this),
            params.amountIn
        );

        IERC20(params.tokenIn).safeApprove(config.router, params.amountIn);

        if (config.swapSelector == IUniswapV2Router.swapExactTokensForTokens.selector) {
            return _executeUniswapV2Swap(config, params);
        } else if (config.swapSelector == IUniswapV3Router.exactInputSingle.selector) {
            return _executeUniswapV3Swap(config, params);
        } else {
            revert("Unsupported DEX");
        }
    }

    function _executeUniswapV2Swap(
        DEXConfig memory config,
        SwapParams calldata params
    ) internal returns (uint256 amountOut) {
        address[] memory path = new address[](2);
        path[0] = params.tokenIn;
        path[1] = params.tokenOut;

        uint256[] memory amounts = IUniswapV2Router(config.router)
            .swapExactTokensForTokens(
                params.amountIn,
                params.amountOutMin,
                path,
                params.recipient,
                params.deadline
            );

        return amounts[amounts.length - 1];
    }

    function _executeUniswapV3Swap(
        DEXConfig memory config,
        SwapParams calldata params
    ) internal returns (uint256 amountOut) {
        IUniswapV3Router.ExactInputSingleParams memory swapParams = 
            IUniswapV3Router.ExactInputSingleParams({
                tokenIn: params.tokenIn,
                tokenOut: params.tokenOut,
                fee: uint24(config.fee),
                recipient: params.recipient,
                deadline: params.deadline,
                amountIn: params.amountIn,
                amountOutMinimum: params.amountOutMin,
                sqrtPriceLimitX96: 0
            });

        return IUniswapV3Router(config.router).exactInputSingle(swapParams);
    }

    function quote(
        address tokenA,
        address tokenB,
        uint256 amountIn
    ) external view override returns (uint256 amountOut, Route memory optimalRoute) {
        address bestPool;
        uint256 bestOutput = 0;
        string memory bestDEX;

        // Check all configured DEXes
        string[] memory dexNames = _getAllDEXNames();
        
        for (uint256 i = 0; i < dexNames.length; i++) {
            DEXConfig memory config = dexConfigs[dexNames[i]];
            if (!config.isActive) continue;

            try this.getAmountOut(tokenA, tokenB, amountIn, dexNames[i]) returns (uint256 output) {
                if (output > bestOutput) {
                    bestOutput = output;
                    bestPool = _getPoolAddress(tokenA, tokenB, dexNames[i]);
                    bestDEX = dexNames[i];
                }
            } catch {
                // Skip failed quotes
            }
        }

        require(bestOutput > 0, "No liquidity found");

        optimalRoute.tokens = new address[](2);
        optimalRoute.tokens[0] = tokenA;
        optimalRoute.tokens[1] = tokenB;
        
        optimalRoute.pools = new address[](1);
        optimalRoute.pools[0] = bestPool;
        
        optimalRoute.fees = new uint256[](1);
        optimalRoute.fees[0] = dexConfigs[bestDEX].fee;

        return (bestOutput, optimalRoute);
    }

    function getAmountOut(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        string calldata dexName
    ) external view returns (uint256 amountOut) {
        DEXConfig memory config = dexConfigs[dexName];
        require(config.isActive, "DEX not active");

        if (config.swapSelector == IUniswapV2Router.swapExactTokensForTokens.selector) {
            return _getUniswapV2AmountOut(tokenA, tokenB, amountIn, config);
        } else if (config.swapSelector == IUniswapV3Router.exactInputSingle.selector) {
            return _getUniswapV3AmountOut(tokenA, tokenB, amountIn, config);
        } else {
            revert("Unsupported DEX");
        }
    }

    function _initializeDEXes() internal {
        // Uniswap V2
        dexConfigs["UNISWAP_V2"] = DEXConfig({
            router: 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D,
            fee: 3000, // 0.3%
            swapSelector: IUniswapV2Router.swapExactTokensForTokens.selector,
            isActive: true
        });

        // Uniswap V3
        dexConfigs["UNISWAP_V3"] = DEXConfig({
            router: 0xE592427A0AEce92De3Edee1F18E0157C05861564,
            fee: 3000, // 0.3% default
            swapSelector: IUniswapV3Router.exactInputSingle.selector,
            isActive: true
        });

        // SushiSwap
        dexConfigs["SUSHISWAP"] = DEXConfig({
            router: 0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F,
            fee: 3000, // 0.3%
            swapSelector: IUniswapV2Router.swapExactTokensForTokens.selector,
            isActive: true
        });
    }

    function getRouterType() external pure override returns (string memory) {
        return "SIMPLE";
    }
}
```

## 2. Multi-hop Router

The Multi-hop Router enables complex routing through multiple intermediary tokens:

```solidity
contract IXFIMultiHopRouter is IIXFIRouter {
    using SafeERC20 for IERC20;

    struct HopData {
        address pool;
        address tokenIn;
        address tokenOut;
        uint256 fee;
        bytes swapData;
    }

    uint256 public constant MAX_HOPS = 4;
    mapping(address => bool) public authorizedCallers;

    event MultiHopSwap(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 hops
    );

    function swapExactTokensForTokens(
        SwapParams calldata params
    ) external payable override returns (uint256 amountOut) {
        require(params.deadline >= block.timestamp, "Expired");
        require(params.pools.length <= MAX_HOPS, "Too many hops");
        require(params.pools.length > 0, "No pools specified");

        Route memory route = _decodeRoute(params);
        return _executeMultiHopSwap(route, params);
    }

    function _executeMultiHopSwap(
        Route memory route,
        SwapParams calldata params
    ) internal returns (uint256 finalAmount) {
        uint256 currentAmount = params.amountIn;
        
        // Transfer initial tokens
        if (params.tokenIn != address(0)) {
            IERC20(params.tokenIn).safeTransferFrom(
                msg.sender,
                address(this),
                params.amountIn
            );
        }

        // Execute each hop
        for (uint256 i = 0; i < route.pools.length; i++) {
            currentAmount = _executeHop(
                route.tokens[i],
                route.tokens[i + 1],
                route.pools[i],
                currentAmount,
                route.swapData[i],
                i == route.pools.length - 1 ? params.recipient : address(this)
            );
        }

        require(currentAmount >= params.amountOutMin, "Insufficient output");
        
        emit MultiHopSwap(
            msg.sender,
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            currentAmount,
            route.pools.length
        );

        return currentAmount;
    }

    function _executeHop(
        address tokenIn,
        address tokenOut,
        address pool,
        uint256 amountIn,
        bytes memory swapData,
        address recipient
    ) internal returns (uint256 amountOut) {
        string memory dexType = _getDEXType(pool);
        
        if (keccak256(abi.encodePacked(dexType)) == keccak256("UNISWAP_V2")) {
            return _executeUniswapV2Hop(tokenIn, tokenOut, pool, amountIn, recipient);
        } else if (keccak256(abi.encodePacked(dexType)) == keccak256("UNISWAP_V3")) {
            return _executeUniswapV3Hop(tokenIn, tokenOut, pool, amountIn, swapData, recipient);
        } else if (keccak256(abi.encodePacked(dexType)) == keccak256("CURVE")) {
            return _executeCurveHop(tokenIn, tokenOut, pool, amountIn, swapData, recipient);
        } else {
            revert("Unsupported DEX type");
        }
    }

    function _executeUniswapV2Hop(
        address tokenIn,
        address tokenOut,
        address pool,
        uint256 amountIn,
        address recipient
    ) internal returns (uint256 amountOut) {
        IUniswapV2Pair pair = IUniswapV2Pair(pool);
        
        (uint256 reserve0, uint256 reserve1,) = pair.getReserves();
        bool token0IsInput = tokenIn < tokenOut;
        
        (uint256 reserveIn, uint256 reserveOut) = token0IsInput 
            ? (reserve0, reserve1) 
            : (reserve1, reserve0);

        amountOut = _getAmountOut(amountIn, reserveIn, reserveOut);
        
        IERC20(tokenIn).safeTransfer(pool, amountIn);
        
        (uint256 amount0Out, uint256 amount1Out) = token0IsInput 
            ? (uint256(0), amountOut) 
            : (amountOut, uint256(0));
            
        pair.swap(amount0Out, amount1Out, recipient, "");
        
        return amountOut;
    }

    function _executeUniswapV3Hop(
        address tokenIn,
        address tokenOut,
        address pool,
        uint256 amountIn,
        bytes memory swapData,
        address recipient
    ) internal returns (uint256 amountOut) {
        // Decode fee from swap data
        uint24 fee = abi.decode(swapData, (uint24));
        
        IUniswapV3Pool v3Pool = IUniswapV3Pool(pool);
        
        bool zeroForOne = tokenIn < tokenOut;
        
        IERC20(tokenIn).safeTransfer(pool, amountIn);
        
        (int256 amount0, int256 amount1) = v3Pool.swap(
            recipient,
            zeroForOne,
            int256(amountIn),
            zeroForOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1,
            ""
        );
        
        amountOut = uint256(-(zeroForOne ? amount1 : amount0));
        return amountOut;
    }

    function _executeCurveHop(
        address tokenIn,
        address tokenOut,
        address pool,
        uint256 amountIn,
        bytes memory swapData,
        address recipient
    ) internal returns (uint256 amountOut) {
        // Decode token indices for Curve
        (int128 i, int128 j, uint256 minAmountOut) = abi.decode(swapData, (int128, int128, uint256));
        
        IERC20(tokenIn).safeApprove(pool, amountIn);
        
        ICurvePool curvePool = ICurvePool(pool);
        
        uint256 balanceBefore = IERC20(tokenOut).balanceOf(recipient);
        curvePool.exchange(i, j, amountIn, minAmountOut);
        uint256 balanceAfter = IERC20(tokenOut).balanceOf(recipient);
        
        amountOut = balanceAfter - balanceBefore;
        return amountOut;
    }

    function quote(
        address tokenA,
        address tokenB,
        uint256 amountIn
    ) external view override returns (uint256 amountOut, Route memory optimalRoute) {
        // Find optimal multi-hop route
        Route[] memory candidateRoutes = _findCandidateRoutes(tokenA, tokenB, amountIn);
        
        uint256 bestOutput = 0;
        uint256 bestRouteIndex = 0;

        for (uint256 i = 0; i < candidateRoutes.length; i++) {
            try this.getAmountsOut(amountIn, candidateRoutes[i]) returns (uint256[] memory amounts) {
                uint256 output = amounts[amounts.length - 1];
                if (output > bestOutput) {
                    bestOutput = output;
                    bestRouteIndex = i;
                }
            } catch {
                // Skip failed routes
            }
        }

        require(bestOutput > 0, "No viable route found");
        
        return (bestOutput, candidateRoutes[bestRouteIndex]);
    }

    function _findCandidateRoutes(
        address tokenA,
        address tokenB,
        uint256 amountIn
    ) internal view returns (Route[] memory routes) {
        // Implementation would use graph algorithms to find optimal paths
        // This is simplified for demonstration
        
        address[] memory intermediateTokens = _getPopularIntermediateTokens();
        routes = new Route[](intermediateTokens.length + 1);
        
        // Direct route
        routes[0] = _createDirectRoute(tokenA, tokenB);
        
        // Routes through intermediate tokens
        for (uint256 i = 0; i < intermediateTokens.length; i++) {
            routes[i + 1] = _create2HopRoute(tokenA, tokenB, intermediateTokens[i]);
        }
        
        return routes;
    }

    function getRouterType() external pure override returns (string memory) {
        return "MULTI_HOP";
    }
}
```

## 3. Cross-chain Router

The Cross-chain Router handles swaps across different blockchains:

```solidity
contract IXFICrossChainRouter is IIXFIRouter {
    using SafeERC20 for IERC20;

    struct CrossChainParams {
        uint256 sourceChain;
        uint256 destinationChain;
        address bridgeAdapter;
        bytes bridgeData;
        address destinationRouter;
        bytes destinationSwapData;
    }

    mapping(uint256 => mapping(address => bool)) public supportedTokens;
    mapping(address => bool) public authorizedBridges;
    mapping(uint256 => address) public chainRouters;

    event CrossChainSwapInitiated(
        address indexed user,
        uint256 indexed sourceChain,
        uint256 indexed destinationChain,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        bytes32 swapId
    );

    function swapExactTokensForTokens(
        SwapParams calldata params
    ) external payable override returns (uint256 amountOut) {
        CrossChainParams memory crossChainParams = abi.decode(
            params.extraData,
            (CrossChainParams)
        );
        
        return _executeCrossChainSwap(params, crossChainParams);
    }

    function _executeCrossChainSwap(
        SwapParams calldata params,
        CrossChainParams memory crossChainParams
    ) internal returns (uint256 amountOut) {
        require(
            authorizedBridges[crossChainParams.bridgeAdapter],
            "Unauthorized bridge"
        );
        
        bytes32 swapId = keccak256(
            abi.encodePacked(
                msg.sender,
                params.tokenIn,
                params.tokenOut,
                params.amountIn,
                block.timestamp
            )
        );

        // Step 1: Handle source chain operations
        if (params.tokenIn != _getBridgeToken(crossChainParams.sourceChain)) {
            // Swap to bridge token on source chain
            uint256 bridgeAmount = _swapToBridgeToken(
                params.tokenIn,
                params.amountIn,
                crossChainParams.sourceChain
            );
            params.amountIn = bridgeAmount;
        }

        // Step 2: Initiate bridge transfer
        IBridgeAdapter bridge = IBridgeAdapter(crossChainParams.bridgeAdapter);
        
        IERC20(params.tokenIn).safeApprove(crossChainParams.bridgeAdapter, params.amountIn);
        
        uint256 bridgeFee = bridge.calculateFee(
            crossChainParams.sourceChain,
            crossChainParams.destinationChain,
            params.amountIn
        );
        
        bridge.bridgeTokens{value: bridgeFee}(
            params.tokenIn,
            params.amountIn,
            crossChainParams.destinationChain,
            params.recipient,
            crossChainParams.bridgeData
        );

        emit CrossChainSwapInitiated(
            msg.sender,
            crossChainParams.sourceChain,
            crossChainParams.destinationChain,
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            swapId
        );

        // Return estimated output (actual output depends on destination chain execution)
        return _estimateCrossChainOutput(params, crossChainParams);
    }

    function _swapToBridgeToken(
        address tokenIn,
        uint256 amountIn,
        uint256 chainId
    ) internal returns (uint256 bridgeAmount) {
        address bridgeToken = _getBridgeToken(chainId);
        
        if (tokenIn == bridgeToken) {
            return amountIn;
        }

        // Use simple router to swap to bridge token
        IIXFIRouter simpleRouter = IIXFIRouter(chainRouters[chainId]);
        
        SwapParams memory swapParams = SwapParams({
            tokenIn: tokenIn,
            tokenOut: bridgeToken,
            amountIn: amountIn,
            amountOutMin: 0, // Will calculate proper minimum
            pools: new address[](1),
            deadline: block.timestamp + 300,
            recipient: address(this),
            extraData: ""
        });
        
        // Get best pool for swap
        (, Route memory route) = simpleRouter.quote(tokenIn, bridgeToken, amountIn);
        swapParams.pools[0] = route.pools[0];
        swapParams.amountOutMin = _calculateMinOutput(route, amountIn);

        return simpleRouter.swapExactTokensForTokens(swapParams);
    }

    function quote(
        address tokenA,
        address tokenB,
        uint256 amountIn
    ) external view override returns (uint256 amountOut, Route memory optimalRoute) {
        // For cross-chain quotes, we need to estimate the full journey
        CrossChainParams memory params = _getOptimalCrossChainRoute(tokenA, tokenB);
        
        // Estimate source chain swap (if needed)
        uint256 bridgeAmount = amountIn;
        if (tokenA != _getBridgeToken(params.sourceChain)) {
            (, Route memory sourceRoute) = IIXFIRouter(chainRouters[params.sourceChain])
                .quote(tokenA, _getBridgeToken(params.sourceChain), amountIn);
            uint256[] memory sourceAmounts = IIXFIRouter(chainRouters[params.sourceChain])
                .getAmountsOut(amountIn, sourceRoute);
            bridgeAmount = sourceAmounts[sourceAmounts.length - 1];
        }

        // Estimate bridge fee
        IBridgeAdapter bridge = IBridgeAdapter(params.bridgeAdapter);
        uint256 bridgeFee = bridge.calculateFee(
            params.sourceChain,
            params.destinationChain,
            bridgeAmount
        );
        uint256 destinationAmount = bridgeAmount - bridgeFee;

        // Estimate destination chain swap (if needed)
        uint256 finalAmount = destinationAmount;
        if (_getBridgeToken(params.destinationChain) != tokenB) {
            (, Route memory destRoute) = IIXFIRouter(chainRouters[params.destinationChain])
                .quote(_getBridgeToken(params.destinationChain), tokenB, destinationAmount);
            uint256[] memory destAmounts = IIXFIRouter(chainRouters[params.destinationChain])
                .getAmountsOut(destinationAmount, destRoute);
            finalAmount = destAmounts[destAmounts.length - 1];
        }

        // Build cross-chain route representation
        optimalRoute = _buildCrossChainRoute(tokenA, tokenB, params);
        
        return (finalAmount, optimalRoute);
    }

    function getRouterType() external pure override returns (string memory) {
        return "CROSS_CHAIN";
    }
}
```

## 4. Aggregation Router

The Aggregation Router combines quotes from multiple DEXes for optimal pricing:

```solidity
contract IXFIAggregationRouter is IIXFIRouter {
    using SafeERC20 for IERC20;

    struct AggregationResult {
        address[] dexes;
        uint256[] amounts;
        uint256[] expectedOutputs;
        uint256 totalOutput;
        bytes[] swapData;
    }

    mapping(address => uint256) public dexWeights;
    uint256 public constant PRECISION = 1e18;
    uint256 public maxSlippageAggregation = 300; // 3%

    function swapExactTokensForTokens(
        SwapParams calldata params
    ) external payable override returns (uint256 totalAmountOut) {
        AggregationResult memory result = abi.decode(params.extraData, (AggregationResult));
        
        require(result.dexes.length > 0, "No DEXes specified");
        require(result.amounts.length == result.dexes.length, "Mismatched arrays");
        
        // Transfer tokens from user
        IERC20(params.tokenIn).safeTransferFrom(
            msg.sender,
            address(this),
            params.amountIn
        );

        // Execute swaps across multiple DEXes
        for (uint256 i = 0; i < result.dexes.length; i++) {
            if (result.amounts[i] == 0) continue;
            
            uint256 outputAmount = _executeAggregatedSwap(
                result.dexes[i],
                params.tokenIn,
                params.tokenOut,
                result.amounts[i],
                result.swapData[i]
            );
            
            totalAmountOut += outputAmount;
        }

        require(totalAmountOut >= params.amountOutMin, "Insufficient output");

        // Transfer final tokens to recipient
        IERC20(params.tokenOut).safeTransfer(params.recipient, totalAmountOut);
        
        return totalAmountOut;
    }

    function _executeAggregatedSwap(
        address dex,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        bytes memory swapData
    ) internal returns (uint256 amountOut) {
        uint256 balanceBefore = IERC20(tokenOut).balanceOf(address(this));
        
        IERC20(tokenIn).safeApprove(dex, amountIn);
        
        // Execute the swap using the DEX-specific data
        (bool success, bytes memory result) = dex.call(swapData);
        require(success, "Aggregated swap failed");
        
        uint256 balanceAfter = IERC20(tokenOut).balanceOf(address(this));
        amountOut = balanceAfter - balanceBefore;
        
        return amountOut;
    }

    function quote(
        address tokenA,
        address tokenB,
        uint256 amountIn
    ) external view override returns (uint256 amountOut, Route memory optimalRoute) {
        // Get quotes from all available DEXes
        address[] memory availableDEXes = getSupportedDEXes();
        uint256[] memory individualQuotes = new uint256[](availableDEXes.length);
        uint256[] memory liquidityWeights = new uint256[](availableDEXes.length);
        
        uint256 totalLiquidity = 0;
        
        for (uint256 i = 0; i < availableDEXes.length; i++) {
            try this._getIndividualQuote(availableDEXes[i], tokenA, tokenB, amountIn) 
                returns (uint256 quote, uint256 liquidity) {
                individualQuotes[i] = quote;
                liquidityWeights[i] = liquidity;
                totalLiquidity += liquidity;
            } catch {
                // DEX not available or no liquidity
                individualQuotes[i] = 0;
                liquidityWeights[i] = 0;
            }
        }

        // Calculate optimal distribution
        AggregationResult memory result = _calculateOptimalDistribution(
            availableDEXes,
            individualQuotes,
            liquidityWeights,
            amountIn,
            totalLiquidity
        );

        optimalRoute = _buildAggregationRoute(tokenA, tokenB, result);
        
        return (result.totalOutput, optimalRoute);
    }

    function _calculateOptimalDistribution(
        address[] memory dexes,
        uint256[] memory quotes,
        uint256[] memory weights,
        uint256 totalAmount,
        uint256 totalLiquidity
    ) internal pure returns (AggregationResult memory result) {
        result.dexes = dexes;
        result.amounts = new uint256[](dexes.length);
        result.expectedOutputs = new uint256[](dexes.length);
        result.swapData = new bytes[](dexes.length);
        
        // Simple distribution based on liquidity weights
        // More sophisticated algorithms could optimize for price impact
        for (uint256 i = 0; i < dexes.length; i++) {
            if (weights[i] > 0 && quotes[i] > 0) {
                result.amounts[i] = (totalAmount * weights[i]) / totalLiquidity;
                result.expectedOutputs[i] = (quotes[i] * result.amounts[i]) / totalAmount;
                result.totalOutput += result.expectedOutputs[i];
            }
        }
        
        return result;
    }

    function getRouterType() external pure override returns (string memory) {
        return "AGGREGATION";
    }
}
```

## 5. Split Router

The Split Router divides large orders to minimize price impact:

```solidity
contract IXFISplitRouter is IIXFIRouter {
    using SafeERC20 for IERC20;

    struct SplitOrder {
        uint256[] amounts;
        address[] pools;
        uint256[] delays;
        uint256 totalParts;
    }

    mapping(bytes32 => SplitOrder) public splitOrders;
    mapping(bytes32 => uint256) public executedParts;
    
    uint256 public constant MAX_SPLITS = 10;
    uint256 public constant MIN_SPLIT_DELAY = 60; // 1 minute

    event SplitOrderCreated(bytes32 indexed orderId, address indexed user, uint256 totalParts);
    event SplitOrderPartExecuted(bytes32 indexed orderId, uint256 part, uint256 amountOut);

    function createSplitOrder(
        SwapParams calldata params,
        uint256 splits,
        uint256 delayBetweenSplits
    ) external returns (bytes32 orderId) {
        require(splits <= MAX_SPLITS, "Too many splits");
        require(delayBetweenSplits >= MIN_SPLIT_DELAY, "Delay too short");
        
        orderId = keccak256(
            abi.encodePacked(
                msg.sender,
                params.tokenIn,
                params.tokenOut,
                params.amountIn,
                block.timestamp
            )
        );

        SplitOrder storage order = splitOrders[orderId];
        order.totalParts = splits;
        order.amounts = new uint256[](splits);
        order.pools = new address[](splits);
        order.delays = new uint256[](splits);

        // Calculate split amounts (could be optimized based on liquidity)
        uint256 baseAmount = params.amountIn / splits;
        uint256 remainder = params.amountIn % splits;

        for (uint256 i = 0; i < splits; i++) {
            order.amounts[i] = baseAmount + (i < remainder ? 1 : 0);
            order.pools[i] = params.pools[0]; // Simplified - could optimize per split
            order.delays[i] = i * delayBetweenSplits;
        }

        // Transfer all tokens upfront
        IERC20(params.tokenIn).safeTransferFrom(
            msg.sender,
            address(this),
            params.amountIn
        );

        emit SplitOrderCreated(orderId, msg.sender, splits);
        
        return orderId;
    }

    function executeSplitOrderPart(
        bytes32 orderId,
        uint256 partIndex,
        SwapParams calldata params
    ) external returns (uint256 amountOut) {
        SplitOrder storage order = splitOrders[orderId];
        require(partIndex < order.totalParts, "Invalid part index");
        require(
            block.timestamp >= order.delays[partIndex],
            "Part not ready for execution"
        );
        
        // Check if part already executed
        require(
            (executedParts[orderId] & (1 << partIndex)) == 0,
            "Part already executed"
        );

        // Mark part as executed
        executedParts[orderId] |= (1 << partIndex);

        // Execute the swap for this part
        amountOut = _executeSingleSplit(
            order.pools[partIndex],
            params.tokenIn,
            params.tokenOut,
            order.amounts[partIndex],
            params.recipient
        );

        emit SplitOrderPartExecuted(orderId, partIndex, amountOut);
        
        return amountOut;
    }

    function _executeSingleSplit(
        address pool,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        address recipient
    ) internal returns (uint256 amountOut) {
        // Get the appropriate router for this pool
        IIXFIRouter router = _getRouterForPool(pool);
        
        IERC20(tokenIn).safeApprove(address(router), amountIn);
        
        SwapParams memory splitParams = SwapParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            amountOutMin: 0, // Calculate based on current market
            pools: new address[](1),
            deadline: block.timestamp + 300,
            recipient: recipient,
            extraData: ""
        });
        splitParams.pools[0] = pool;

        return router.swapExactTokensForTokens(splitParams);
    }

    function getRouterType() external pure override returns (string memory) {
        return "SPLIT";
    }
}
```

## 6. Flash Router

The Flash Router enables atomic multi-step operations using flash loans:

```solidity
contract IXFIFlashRouter is IIXFIRouter, IFlashLoanReceiver {
    using SafeERC20 for IERC20;

    struct FlashOperation {
        address[] tokens;
        uint256[] amounts;
        address[] pools;
        bytes[] swapData;
        address finalRecipient;
        uint256 expectedProfit;
    }

    mapping(address => bool) public authorizedFlashProviders;
    uint256 public constant MAX_FLASH_FEE = 100; // 1%

    event FlashSwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 profit
    );

    function swapExactTokensForTokens(
        SwapParams calldata params
    ) external payable override returns (uint256 amountOut) {
        FlashOperation memory operation = abi.decode(params.extraData, (FlashOperation));
        
        // Initiate flash loan
        IFlashLoanProvider provider = _getBestFlashProvider(operation.tokens[0], operation.amounts[0]);
        
        require(
            authorizedFlashProviders[address(provider)],
            "Unauthorized flash provider"
        );

        provider.flashLoan(
            operation.tokens[0],
            operation.amounts[0],
            abi.encode(operation, msg.sender)
        );

        return operation.expectedProfit; // Return expected profit from arbitrage
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 fee,
        bytes calldata params
    ) external override returns (bool) {
        require(authorizedFlashProviders[msg.sender], "Unauthorized caller");
        
        (FlashOperation memory operation, address originalCaller) = abi.decode(
            params,
            (FlashOperation, address)
        );

        uint256 totalOwed = amount + fee;
        uint256 currentAmount = amount;

        // Execute the operation steps
        for (uint256 i = 0; i < operation.pools.length; i++) {
            currentAmount = _executeFlashStep(
                operation.tokens[i],
                operation.tokens[i + 1],
                operation.pools[i],
                currentAmount,
                operation.swapData[i]
            );
        }

        // Ensure we have enough to repay the flash loan + profit
        require(currentAmount > totalOwed, "Insufficient profit from flash operation");
        
        uint256 profit = currentAmount - totalOwed;

        // Repay flash loan
        IERC20(asset).safeTransfer(msg.sender, totalOwed);
        
        // Send profit to original caller
        if (profit > 0) {
            IERC20(operation.tokens[operation.tokens.length - 1])
                .safeTransfer(originalCaller, profit);
        }

        emit FlashSwapExecuted(
            originalCaller,
            operation.tokens[0],
            operation.tokens[operation.tokens.length - 1],
            amount,
            currentAmount,
            profit
        );

        return true;
    }

    function _executeFlashStep(
        address tokenIn,
        address tokenOut,
        address pool,
        uint256 amountIn,
        bytes memory swapData
    ) internal returns (uint256 amountOut) {
        // Determine pool type and execute appropriate swap
        string memory poolType = _getPoolType(pool);
        
        if (keccak256(abi.encodePacked(poolType)) == keccak256("UNISWAP_V2")) {
            return _executeUniswapV2Flash(tokenIn, tokenOut, pool, amountIn);
        } else if (keccak256(abi.encodePacked(poolType)) == keccak256("UNISWAP_V3")) {
            return _executeUniswapV3Flash(tokenIn, tokenOut, pool, amountIn, swapData);
        } else {
            revert("Unsupported pool type for flash operation");
        }
    }

    function quote(
        address tokenA,
        address tokenB,
        uint256 amountIn
    ) external view override returns (uint256 amountOut, Route memory optimalRoute) {
        // For flash router, we look for arbitrage opportunities
        return _findArbitrageOpportunity(tokenA, tokenB, amountIn);
    }

    function _findArbitrageOpportunity(
        address tokenA,
        address tokenB,
        uint256 amountIn
    ) internal view returns (uint256 profit, Route memory route) {
        // Look for triangular arbitrage opportunities
        address[] memory intermediateTokens = _getArbitrageTokens();
        
        uint256 bestProfit = 0;
        Route memory bestRoute;

        for (uint256 i = 0; i < intermediateTokens.length; i++) {
            // A -> Intermediate -> B -> A
            uint256 step1Out = _getQuickQuote(tokenA, intermediateTokens[i], amountIn);
            if (step1Out == 0) continue;
            
            uint256 step2Out = _getQuickQuote(intermediateTokens[i], tokenB, step1Out);
            if (step2Out == 0) continue;
            
            uint256 step3Out = _getQuickQuote(tokenB, tokenA, step2Out);
            if (step3Out <= amountIn) continue;
            
            uint256 arbitrageProfit = step3Out - amountIn;
            
            if (arbitrageProfit > bestProfit) {
                bestProfit = arbitrageProfit;
                bestRoute = _buildArbitrageRoute(tokenA, tokenB, intermediateTokens[i]);
            }
        }

        return (bestProfit, bestRoute);
    }

    function getRouterType() external pure override returns (string memory) {
        return "FLASH";
    }
}
```

## Router Selection Strategy

```javascript
class RouterSelector {
    constructor() {
        this.routerTypes = [
            'SIMPLE',
            'MULTI_HOP', 
            'CROSS_CHAIN',
            'AGGREGATION',
            'SPLIT',
            'FLASH'
        ];
    }

    selectOptimalRouter(request) {
        const {
            fromToken,
            toToken,
            fromChain,
            toChain,
            amountIn,
            userPreferences
        } = request;

        // Cross-chain requirement
        if (fromChain !== toChain) {
            return 'CROSS_CHAIN';
        }

        // Large order optimization
        if (amountIn > this.getLargeOrderThreshold(fromToken)) {
            if (userPreferences.minimizeSlippage) {
                return 'SPLIT';
            } else if (userPreferences.optimizeForPrice) {
                return 'AGGREGATION';
            }
        }

        // Arbitrage opportunity
        if (userPreferences.enableArbitrage && this.hasArbitrageOpportunity(fromToken, toToken)) {
            return 'FLASH';
        }

        // Direct pair availability
        if (this.hasDirectPair(fromToken, toToken)) {
            return 'SIMPLE';
        }

        // Default to multi-hop for complex routes
        return 'MULTI_HOP';
    }

    getLargeOrderThreshold(token) {
        // Dynamic thresholds based on token liquidity
        const liquidityTiers = {
            'ETH': 50,     // 50 ETH
            'USDC': 100000, // 100k USDC
            'USDT': 100000, // 100k USDT
            'WBTC': 5,      // 5 WBTC
            'default': 10000 // $10k USD equivalent
        };

        return liquidityTiers[token] || liquidityTiers.default;
    }
}
```

## Performance Comparison

| Router Type | Best Use Case | Avg Gas Cost | Execution Time | Complexity |
|-------------|---------------|--------------|----------------|------------|
| Simple | Direct swaps | 150k gas | 1-2 blocks | Low |
| Multi-hop | No direct pair | 300k gas | 1-2 blocks | Medium |
| Cross-chain | Different chains | 400k+ gas | 5-30 minutes | High |
| Aggregation | Best price | 500k gas | 2-3 blocks | Medium |
| Split | Large orders | 200k per split | Variable | Medium |
| Flash | Arbitrage | 600k gas | 1 block | High |

## Best Practices

1. **Router Selection**: Choose based on trade characteristics and user preferences
2. **Gas Optimization**: Consider gas costs relative to trade size
3. **Slippage Management**: Set appropriate slippage tolerances for each router type
4. **Error Handling**: Implement robust fallback mechanisms
5. **Security**: Validate all external calls and user inputs

## Resources

- [DEX Aggregation Overview](overview.md)
- [Supported DEXes](supported-dexes.md)
- [Routing Algorithm](routing-algorithm.md)
- [Quote System](quote-system.md)
- [Integration Examples](../examples/basic-swap.md)
