// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CalldataLibrary  
 * @notice Library for generating calldata for different DEX routers
 */
library CalldataLibrary {

    /**
     * @notice Generate Uniswap V2 style swap calldata
     */
    function generateUniswapV2Calldata(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) internal pure returns (bytes memory) {
        return abi.encodeWithSignature(
            "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
            amountIn,
            amountOutMin,
            path,
            to,
            deadline
        );
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
    ) internal pure returns (bytes memory) {
        bytes memory params = abi.encode(
            path,
            recipient,
            deadline,
            amountIn,
            amountOutMin
        );
        
        return abi.encodeWithSignature(
            "exactInput((bytes,address,uint256,uint256,uint256))",
            params
        );
    }

    /**
     * @notice Generate Curve swap calldata (simplified implementation)
     */
    function generateCurveSwapCalldata(
        address,
        address,
        uint256 dx,
        uint256 minDy
    ) internal pure returns (bytes memory) {
        return abi.encodeWithSignature(
            "exchange(int128,int128,uint256,uint256)",
            int128(0),
            int128(1),  
            dx,
            minDy
        );
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
    ) internal pure returns (bytes memory) {
        return abi.encodeWithSignature(
            "swap(address,address,uint256,uint256,bytes)",
            tokenIn,
            tokenOut,
            amount,
            minReturn,
            data
        );
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
    ) internal pure returns (bytes memory) {
        return abi.encodeWithSignature(
            "multiSwap((address,uint256,uint256,uint256,address,string,bool,bytes))",
            fromToken,
            fromAmount,
            toAmount,
            expectedAmount,
            beneficiary,
            "", // referrer
            false, // useReduxToken
            swapData
        );
    }

    /**
     * @notice Generate 0x Protocol swap calldata
     */
    function generateZeroXCalldata(
        bytes32 orderHash,
        bytes calldata signature,
        uint128 takerTokenFillAmount
    ) internal pure returns (bytes memory) {
        return abi.encodeWithSignature(
            "fillLimitOrder(bytes32,bytes,uint128)",
            orderHash,
            signature,
            takerTokenFillAmount
        );
    }

    /**
     * @notice Generate Kyber Network swap calldata
     */
    function generateKyberCalldata(
        address src,
        uint256 srcAmount,
        address dest,
        uint256 minConversionRate
    ) internal pure returns (bytes memory) {
        return abi.encodeWithSignature(
            "swapTokenToToken(address,uint256,address,uint256)",
            src,
            srcAmount,
            dest,
            minConversionRate
        );
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
    ) internal pure returns (bytes memory) {
        return abi.encodeWithSignature(
            "dodoSwapV1(address,address,uint256,uint256,address[],uint256,bool,uint256)",
            fromToken,
            toToken,
            fromTokenAmount,
            minReturnAmount,
            dodoPairs,
            directions,
            isIncentive,
            deadLine
        );
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
    ) internal pure returns (bytes memory) {
        return abi.encodeWithSignature(
            "convertByPath(address[],uint256,uint256,address,address,uint256)",
            path,
            amount,
            minReturn,
            beneficiary,
            affiliateAccount,
            affiliateFee
        );
    }
}
