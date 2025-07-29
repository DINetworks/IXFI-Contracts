// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./libraries/QuoteLibrary.sol";
import "./libraries/MulticallLibraryV2.sol";
import "./libraries/CalldataLibrary.sol";

interface IMulticall3Local {
    struct Call3 {
        address target;
        bool allowFailure;
        bytes callData;
    }
}

/**
 * @title SwapCalldataGenerator
 * @notice Helper contract to generate calldata for different DEX routers
 * @dev This contract helps generate the routerCalldata for cross-chain swaps
 */
contract SwapCalldataGenerator is Ownable {
    
    // Multicall3 address (same across most chains)
    address public constant MULTICALL3_ADDRESS = 0xcA11bde05977b3631167028862bE2a173976CA11;
    
    // Chain ID to router configurations  
    mapping(uint256 => mapping(QuoteLibrary.RouterType => QuoteLibrary.RouterConfig)) public routers;
    
    // Supported chains
    mapping(uint256 => bool) public supportedChains;
    
    // Curve protocol addresses per chain
    mapping(uint256 => address) public curveRegistries;
    
    // Balancer vault addresses per chain
    mapping(uint256 => address) public balancerVaults;
    
    // Chain -> token pair hash -> pool config
    mapping(uint256 => mapping(bytes32 => QuoteLibrary.PoolConfig)) public poolConfigs;
    
    event RouterConfigured(uint256 indexed chainId, QuoteLibrary.RouterType indexed routerType, address router);
    event ChainSupported(uint256 indexed chainId, bool supported);
    event CurveRegistryConfigured(uint256 indexed chainId, address registry);
    event BalancerVaultConfigured(uint256 indexed chainId, address vault);
    event PoolConfigured(uint256 indexed chainId, address tokenA, address tokenB, address pool, bytes32 poolId);

    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Generate Uniswap V2 style swap calldata
     */
    function generateUniswapV2Calldata(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external pure returns (bytes memory) {
        return CalldataLibrary.generateUniswapV2Calldata(amountIn, amountOutMin, path, to, deadline);
    }

    /**
     * @notice Generate Uniswap V3 exact input swap calldata
     */
    function generateUniswapV3ExactInputCalldata(
        uint256 amountIn,
        uint256 amountOutMin,
        bytes calldata path,
        address recipient,
        uint256 deadline
    ) external pure returns (bytes memory) {
        return CalldataLibrary.generateUniswapV3ExactInputCalldata(amountIn, amountOutMin, path, recipient, deadline);
    }

    /**
     * @notice Generate Curve swap calldata (simplified implementation)
     */
    function generateCurveSwapCalldata(
        address tokenIn,
        address tokenOut,
        uint256 dx,
        uint256 minDy
    ) external pure returns (bytes memory) {
        return CalldataLibrary.generateCurveSwapCalldata(tokenIn, tokenOut, dx, minDy);
    }

    /**
     * @notice Generate 1inch style aggregated swap calldata
     */
    function generate1inchCalldata(
        address tokenIn,
        address tokenOut,
        uint256 amount,
        uint256 minReturn,
        bytes calldata data
    ) external pure returns (bytes memory) {
        return CalldataLibrary.generate1inchCalldata(tokenIn, tokenOut, amount, minReturn, data);
    }

    /**
     * @notice Generate ParaSwap V5 swap calldata
     */
    function generateParaSwapCalldata(
        address fromToken,
        uint256 fromAmount,
        uint256 toAmount,
        uint256 expectedAmount,
        address beneficiary,
        bytes calldata swapData
    ) external pure returns (bytes memory) {
        return CalldataLibrary.generateParaSwapCalldata(fromToken, fromAmount, toAmount, expectedAmount, beneficiary, swapData);
    }

    /**
     * @notice Generate 0x Protocol swap calldata
     */
    function generateZeroXCalldata(
        bytes32 orderHash,
        bytes calldata signature,
        uint128 takerTokenFillAmount
    ) external pure returns (bytes memory) {
        return CalldataLibrary.generateZeroXCalldata(orderHash, signature, takerTokenFillAmount);
    }

    /**
     * @notice Generate Kyber Network swap calldata
     */
    function generateKyberCalldata(
        address src,
        uint256 srcAmount,
        address dest,
        uint256 minConversionRate
    ) external pure returns (bytes memory) {
        return CalldataLibrary.generateKyberCalldata(src, srcAmount, dest, minConversionRate);
    }

    /**
     * @notice Generate DODO swap calldata
     */
    function generateDODOCalldata(
        address fromToken,
        address toToken,
        uint256 fromTokenAmount,
        uint256 minReturnAmount,
        address[] calldata dodoPairs,
        uint256 directions,
        bool isIncentive,
        uint256 deadLine
    ) external pure returns (bytes memory) {
        return CalldataLibrary.generateDODOCalldata(fromToken, toToken, fromTokenAmount, minReturnAmount, dodoPairs, directions, isIncentive, deadLine);
    }

    /**
     * @notice Generate Bancor swap calldata
     */
    function generateBancorCalldata(
        address[] calldata path,
        uint256 amount,
        uint256 minReturn,
        address beneficiary,
        address affiliateAccount,
        uint256 affiliateFee
    ) external pure returns (bytes memory) {
        return CalldataLibrary.generateBancorCalldata(path, amount, minReturn, beneficiary, affiliateAccount, affiliateFee);
    }

    /**
     * @notice Get router configuration for a chain and type
     */
    function getRouterConfig(
        uint256 chainId,
        QuoteLibrary.RouterType routerType
    ) external view returns (QuoteLibrary.RouterConfig memory config) {
        return routers[chainId][routerType];
    }

    /**
     * @notice Get Multicall3 address (same across all chains)
     */
    function getMulticall3Address() external pure returns (address multicall3Address) {
        return MULTICALL3_ADDRESS;
    }

    /**
     * @notice Get optimal router using individual calls (includes all router types)
     */
    function getOptimalRouterMulticall(
        uint256 chainId,
        address tokenIn,
        address tokenOut,
        uint256 amount
    ) external returns (address routerAddress, QuoteLibrary.RouterType routerType, uint256 expectedOutput) {
        return MulticallLibrary.getOptimalRouter(
            chainId,
            tokenIn,
            tokenOut,
            amount,
            supportedChains,
            routers,
            curveRegistries,
            balancerVaults,
            poolConfigs
        );
    }

    /**
     * @notice Get expected output amount from a specific router
     */
    function getExpectedOutput(
        uint256 chainId,
        QuoteLibrary.RouterType routerType,
        address tokenIn,
        address tokenOut,
        uint256 amount
    ) external returns (uint256 expectedOutput) {
        return QuoteLibrary.getExpectedOutput(
            chainId,
            routerType,
            tokenIn,
            tokenOut,
            amount,
            routers,
            curveRegistries,
            balancerVaults,
            poolConfigs
        );
    }

    /**
     * @notice Get quote from Uniswap V2 style router (external for try-catch)
     */
    function getUniswapV2Quote(
        address router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256) {
        return QuoteLibrary.getUniswapV2Quote(router, tokenIn, tokenOut, amountIn);
    }

    // Admin functions

    /**
     * @notice Configure router for a specific chain
     */
    function configureRouter(
        uint256 chainId,
        QuoteLibrary.RouterType routerType,
        address routerAddress,
        bool isActive
    ) external onlyOwner {
        routers[chainId][routerType] = QuoteLibrary.RouterConfig({
            routerAddress: routerAddress,
            routerType: routerType,
            isActive: isActive
        });
        
        emit RouterConfigured(chainId, routerType, routerAddress);
    }

    /**
     * @notice Set chain support status
     */
    function setChainSupport(uint256 chainId, bool supported) external onlyOwner {
        supportedChains[chainId] = supported;
        emit ChainSupported(chainId, supported);
    }

    /**
     * @notice Batch configure multiple routers
     */
    function batchConfigureRouters(
        uint256[] calldata chainIds,
        QuoteLibrary.RouterType[] calldata routerTypes,
        address[] calldata routerAddresses,
        bool[] calldata activeStates
    ) external onlyOwner {
        require(
            chainIds.length == routerTypes.length &&
            routerTypes.length == routerAddresses.length &&
            routerAddresses.length == activeStates.length,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < chainIds.length; i++) {
            routers[chainIds[i]][routerTypes[i]] = QuoteLibrary.RouterConfig({
                routerAddress: routerAddresses[i],
                routerType: routerTypes[i],
                isActive: activeStates[i]
            });
            
            emit RouterConfigured(chainIds[i], routerTypes[i], routerAddresses[i]);
        }
    }

    /**
     * @notice Configure Curve registry for a chain
     */
    function setCurveRegistry(uint256 chainId, address registryAddress) external onlyOwner {
        curveRegistries[chainId] = registryAddress;
        emit CurveRegistryConfigured(chainId, registryAddress);
    }

    /**
     * @notice Configure Balancer vault for a chain
     */
    function setBalancerVault(uint256 chainId, address vaultAddress) external onlyOwner {
        balancerVaults[chainId] = vaultAddress;
        emit BalancerVaultConfigured(chainId, vaultAddress);
    }

    /**
     * @notice Configure specific pool for token pair
     */
    function configurePool(
        uint256 chainId,
        address tokenA,
        address tokenB,
        address poolAddress,
        bytes32 poolId,
        bool isActive
    ) external onlyOwner {
        bytes32 pairHash = keccak256(abi.encodePacked(tokenA, tokenB));
        poolConfigs[chainId][pairHash] = QuoteLibrary.PoolConfig({
            poolAddress: poolAddress,
            poolId: poolId,
            isActive: isActive
        });
        
        emit PoolConfigured(chainId, tokenA, tokenB, poolAddress, poolId);
    }

    /**
     * @notice Batch configure multiple pools
     */
    function batchConfigurePools(
        uint256[] calldata chainIds,
        address[] calldata tokenAs,
        address[] calldata tokenBs,
        address[] calldata poolAddresses,
        bytes32[] calldata poolIds,
        bool[] calldata activeStates
    ) external onlyOwner {
        require(
            chainIds.length == tokenAs.length &&
            tokenAs.length == tokenBs.length &&
            tokenBs.length == poolAddresses.length &&
            poolAddresses.length == poolIds.length &&
            poolIds.length == activeStates.length,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < chainIds.length; i++) {
            bytes32 pairHash = keccak256(abi.encodePacked(tokenAs[i], tokenBs[i]));
            poolConfigs[chainIds[i]][pairHash] = QuoteLibrary.PoolConfig({
                poolAddress: poolAddresses[i],
                poolId: poolIds[i],
                isActive: activeStates[i]
            });
            
            emit PoolConfigured(chainIds[i], tokenAs[i], tokenBs[i], poolAddresses[i], poolIds[i]);
        }
    }
}
