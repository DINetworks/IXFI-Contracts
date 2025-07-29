# CrossChainAggregator API

The CrossChainAggregator contract is the core component of IXFI's DEX aggregation system, enabling optimal token swaps across 37+ protocols and seamless cross-chain operations.

## Contract Interface

```solidity
interface ICrossChainAggregator {
    // Quote functions
    function getOptimalQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256[] memory routerTypes
    ) external view returns (uint256 bestAmount, uint256 bestRouter);
    
    function getAllQuotes(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (QuoteResult[] memory);
    
    // Swap execution
    function executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 routerType,
        bytes calldata swapData
    ) external payable returns (uint256 amountOut);
    
    // Cross-chain operations
    function crossChainSwap(
        SwapData calldata swapData,
        string calldata destinationChain,
        address destinationToken,
        bytes calldata destinationSwapData,
        address destinationRouter,
        uint256 amountOutMin
    ) external;
    
    // Batch operations
    function multiSwap(
        SwapParams[] memory swaps
    ) external payable returns (uint256[] memory amountsOut);
}
```

## Data Structures

### SwapData

```solidity
struct SwapData {
    address tokenIn;           // Input token address
    address tokenOut;          // Output token address (IXFI for source chain)
    uint256 amountIn;          // Input amount
    uint256 amountOutMin;      // Minimum output amount (slippage protection)
    address to;                // Recipient address
    uint256 deadline;          // Transaction deadline
    bytes routerCalldata;      // Encoded function call for DEX router
    address router;            // DEX router address
}
```

### SwapParams

```solidity
struct SwapParams {
    address tokenIn;
    address tokenOut;
    uint256 amountIn;
    uint256 minAmountOut;
    uint256 routerType;
    bytes swapData;
    address recipient;
}
```

### QuoteResult

```solidity
struct QuoteResult {
    uint256 routerType;        // DEX protocol identifier (0-36)
    uint256 amountOut;         // Expected output amount
    uint256 gasEstimate;       // Estimated gas cost
    uint256 priceImpact;       // Price impact in basis points
    bool success;              // Whether quote was successful
}
```

### CrossChainSwapRequest

```solidity
struct CrossChainSwapRequest {
    address user;              // Original user address
    string destinationChain;   // Target chain name
    address destinationToken;  // Target token on destination chain
    uint256 amountOutMin;      // Minimum amount out on destination
    uint256 deadline;          // Swap deadline
    bytes destinationSwapData; // Swap calldata for destination chain
    address destinationRouter; // Router address on destination chain
}
```

## Core Functions

### getOptimalQuote

```solidity
function getOptimalQuote(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256[] memory routerTypes
) external view returns (uint256 bestAmount, uint256 bestRouter)
```

Get the best quote from specified DEX protocols.

**Parameters:**
- `tokenIn`: Input token contract address
- `tokenOut`: Output token contract address  
- `amountIn`: Amount of input tokens to swap
- `routerTypes`: Array of router type IDs to check (0-36)

**Returns:**
- `bestAmount`: Maximum output tokens from best route
- `bestRouter`: Router type ID of the best quote

**Usage Example:**
```solidity
// Get best quote from Uniswap V2, V3 and SushiSwap
uint256[] memory routers = new uint256[](3);
routers[0] = 0;  // Uniswap V2
routers[1] = 10; // Uniswap V3
routers[2] = 1;  // SushiSwap V2

(uint256 bestAmount, uint256 bestRouter) = aggregator.getOptimalQuote(
    0xA0b86a33E6441e1a02c4e4670dd96EA0f25A632, // USDC
    0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2, // WETH
    1000e6, // 1000 USDC
    routers
);
```

### getAllQuotes

```solidity
function getAllQuotes(
    address tokenIn,
    address tokenOut,
    uint256 amountIn
) external view returns (QuoteResult[] memory)
```

Get quotes from all 37 supported DEX protocols.

**Parameters:**
- `tokenIn`: Input token contract address
- `tokenOut`: Output token contract address
- `amountIn`: Amount of input tokens to swap

**Returns:**
- Array of `QuoteResult` structs with quotes from each protocol

**Usage Example:**
```solidity
QuoteResult[] memory quotes = aggregator.getAllQuotes(
    0xA0b86a33E6441e1a02c4e4670dd96EA0f25A632, // USDC
    0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2, // WETH
    1000e6 // 1000 USDC
);

// Find best non-zero quote
uint256 bestAmount = 0;
uint256 bestRouter = 0;
for (uint i = 0; i < quotes.length; i++) {
    if (quotes[i].success && quotes[i].amountOut > bestAmount) {
        bestAmount = quotes[i].amountOut;
        bestRouter = quotes[i].routerType;
    }
}
```

### executeSwap

```solidity
function executeSwap(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    uint256 routerType,
    bytes calldata swapData
) external payable returns (uint256 amountOut)
```

Execute a token swap through the specified DEX protocol.

**Parameters:**
- `tokenIn`: Input token address (use `address(0)` for ETH)
- `tokenOut`: Output token address
- `amountIn`: Exact amount of input tokens
- `minAmountOut`: Minimum acceptable output (slippage protection)
- `routerType`: DEX protocol to use (0-36)
- `swapData`: Protocol-specific calldata for the swap

**Returns:**
- `amountOut`: Actual amount of output tokens received

**Usage Example:**
```solidity
// Approve tokens first
IERC20(tokenIn).approve(address(aggregator), amountIn);

// Execute swap
uint256 amountOut = aggregator.executeSwap{value: msg.value}(
    0xA0b86a33E6441e1a02c4e4670dd96EA0f25A632, // USDC
    0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2, // WETH  
    1000e6, // 1000 USDC
    1.8e18, // Minimum 1.8 WETH (with slippage)
    10, // Uniswap V3
    swapCalldata
);
```

### crossChainSwap

```solidity
function crossChainSwap(
    SwapData calldata swapData,
    string calldata destinationChain,
    address destinationToken,
    bytes calldata destinationSwapData,
    address destinationRouter,
    uint256 amountOutMin
) external
```

Execute a cross-chain token swap: TokenA (Chain A) → IXFI → TokenB (Chain B).

**Parameters:**
- `swapData`: Source chain swap parameters (TokenA → IXFI)
- `destinationChain`: Target chain name ("ethereum", "bsc", "polygon", etc.)
- `destinationToken`: Target token address on destination chain
- `destinationSwapData`: Encoded swap data for destination chain
- `destinationRouter`: Router address on destination chain
- `amountOutMin`: Minimum output on destination chain

**Usage Example:**
```solidity
SwapData memory sourceSwap = SwapData({
    tokenIn: 0xA0b86a33E6441e1a02c4e4670dd96EA0f25A632, // USDC on Ethereum
    tokenOut: ixfiToken, // IXFI
    amountIn: 1000e6,
    amountOutMin: 990e18, // 990 IXFI minimum
    to: address(this),
    deadline: block.timestamp + 1800,
    routerCalldata: uniswapCalldata,
    router: uniswapRouter
});

// Swap USDC on Ethereum for BNB on BSC
aggregator.crossChainSwap(
    sourceSwap,
    "bsc",
    0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c, // WBNB on BSC
    pancakeSwapCalldata,
    pancakeSwapRouter,
    0.3e18 // Minimum 0.3 BNB
);
```

### multiSwap

```solidity
function multiSwap(
    SwapParams[] memory swaps
) external payable returns (uint256[] memory amountsOut)
```

Execute multiple swaps in a single transaction for gas efficiency.

**Parameters:**
- `swaps`: Array of swap parameters

**Returns:**
- `amountsOut`: Array of output amounts for each swap

**Usage Example:**
```solidity
SwapParams[] memory swaps = new SwapParams[](2);

// Swap 1: USDC → WETH
swaps[0] = SwapParams({
    tokenIn: 0xA0b86a33E6441e1a02c4e4670dd96EA0f25A632,
    tokenOut: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2,
    amountIn: 500e6,
    minAmountOut: 0.9e18,
    routerType: 10, // Uniswap V3
    swapData: uniswapCalldata,
    recipient: msg.sender
});

// Swap 2: DAI → USDT  
swaps[1] = SwapParams({
    tokenIn: 0x6B175474E89094C44Da98b954EedeAC495271d0F,
    tokenOut: 0xdAC17F958D2ee523a2206206994597C13D831ec7,
    amountIn: 200e18,
    minAmountOut: 199e6,
    routerType: 30, // Curve
    swapData: curveCalldata,
    recipient: msg.sender
});

uint256[] memory amountsOut = aggregator.multiSwap(swaps);
```

## View Functions

### getSupportedTokens

```solidity
function getSupportedTokens(uint256 chainId) external view returns (address[] memory)
```

Get all supported tokens on a specific chain.

### getRouterAddress

```solidity
function getRouterAddress(uint256 routerType, uint256 chainId) external view returns (address)
```

Get the router contract address for a specific protocol and chain.

### isRouterSupported

```solidity
function isRouterSupported(uint256 routerType, uint256 chainId) external view returns (bool)
```

Check if a router is supported on a specific chain.

### getSwapFee

```solidity
function getSwapFee(uint256 routerType) external view returns (uint256)
```

Get the protocol fee for a specific router type.

## Events

### SwapExecuted

```solidity
event SwapExecuted(
    address indexed user,
    address indexed tokenIn,
    address indexed tokenOut,
    uint256 amountIn,
    uint256 amountOut,
    uint256 routerType
)
```

Emitted when a single swap is executed.

### CrossChainSwapInitiated

```solidity
event CrossChainSwapInitiated(
    address indexed user,
    address indexed tokenIn,
    uint256 amountIn,
    string destinationChain,
    address indexed destinationToken,
    bytes32 swapId
)
```

Emitted when a cross-chain swap is initiated on the source chain.

### CrossChainSwapCompleted

```solidity
event CrossChainSwapCompleted(
    bytes32 indexed swapId,
    address indexed user,
    address indexed tokenOut,
    uint256 amountOut
)
```

Emitted when a cross-chain swap is completed on the destination chain.

### SwapFailed

```solidity
event SwapFailed(
    bytes32 indexed swapId,
    address indexed user,
    string reason
)
```

Emitted when a swap fails and requires manual intervention.

## Error Codes

### SwapErrors

```solidity
error InsufficientOutputAmount(uint256 amountOut, uint256 minAmountOut);
error SwapExpired(uint256 deadline, uint256 currentTime);
error UnsupportedRouter(uint256 routerType);
error InvalidTokenPair(address tokenIn, address tokenOut);
error InsufficientBalance(address token, uint256 required, uint256 available);
error RouterCallFailed(address router, bytes calldata);
error InvalidChain(string chainName);
error AmountMismatch(uint256 expected, uint256 actual);
```

### Usage Examples

```solidity
try aggregator.executeSwap(
    tokenIn,
    tokenOut,
    amountIn,
    minAmountOut,
    routerType,
    swapData
) returns (uint256 amountOut) {
    // Swap successful
    emit SwapSuccess(amountOut);
} catch SwapErrors.InsufficientOutputAmount(uint256 actual, uint256 minimum) {
    // Handle slippage exceeded
    emit SlippageExceeded(actual, minimum);
} catch SwapErrors.SwapExpired(uint256 deadline, uint256 current) {
    // Handle expired transaction
    emit TransactionExpired(deadline, current);
} catch {
    // Handle other errors
    emit SwapFailed("Unknown error");
}
```

## Gas Optimization

### Batch Operations

```solidity
// Instead of individual swaps (high gas)
aggregator.executeSwap(params1);
aggregator.executeSwap(params2);
aggregator.executeSwap(params3);

// Use batch operation (lower gas)
SwapParams[] memory swaps = new SwapParams[](3);
swaps[0] = params1;
swaps[1] = params2;
swaps[2] = params3;
aggregator.multiSwap(swaps);
```

### Calldata Optimization

```solidity
// Optimize swap data size
bytes memory optimizedCalldata = abi.encodeWithSelector(
    IRouter.swapExactTokensForTokens.selector,
    amountIn,
    amountOutMin,
    path,
    to,
    deadline
);
```

## Security Best Practices

### Input Validation

```solidity
// Always validate inputs
require(tokenIn != address(0), "Invalid token");
require(amountIn > 0, "Invalid amount");
require(minAmountOut > 0, "Invalid minimum");
require(deadline > block.timestamp, "Expired deadline");
```

### Slippage Protection

```solidity
// Calculate appropriate slippage
uint256 minAmountOut = expectedOut.mul(995).div(1000); // 0.5% slippage

// Or use dynamic slippage based on market conditions
uint256 dynamicSlippage = calculateSlippage(tokenIn, tokenOut, amountIn);
uint256 minAmountOut = expectedOut.mul(10000 - dynamicSlippage).div(10000);
```

### Deadline Management

```solidity
// Use reasonable deadlines
uint256 deadline = block.timestamp + 300; // 5 minutes

// For cross-chain operations, use longer deadlines
uint256 crossChainDeadline = block.timestamp + 1800; // 30 minutes
```

## Integration Patterns

### Basic Integration

```solidity
contract MyDApp {
    ICrossChainAggregator public aggregator;
    
    constructor(address _aggregator) {
        aggregator = ICrossChainAggregator(_aggregator);
    }
    
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 slippage
    ) external {
        // Get optimal quote
        uint256[] memory allRouters = new uint256[](37);
        for (uint i = 0; i < 37; i++) {
            allRouters[i] = i;
        }
        
        (uint256 bestAmount, uint256 bestRouter) = aggregator.getOptimalQuote(
            tokenIn,
            tokenOut,
            amountIn,
            allRouters
        );
        
        // Calculate minimum output
        uint256 minAmountOut = bestAmount.mul(10000 - slippage).div(10000);
        
        // Execute swap
        aggregator.executeSwap(
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            bestRouter,
            generateSwapData(tokenIn, tokenOut, amountIn, bestRouter)
        );
    }
}
```

### Advanced Integration with MEV Protection

```solidity
contract MEVProtectedSwap {
    using SafeERC20 for IERC20;
    
    ICrossChainAggregator public aggregator;
    mapping(bytes32 => bool) public usedNonces;
    
    struct SwapOrder {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 deadline;
        bytes32 nonce;
        bytes signature;
    }
    
    function executeSwapWithSignature(SwapOrder calldata order) external {
        // Verify signature and nonce
        require(block.timestamp <= order.deadline, "Order expired");
        require(!usedNonces[order.nonce], "Nonce used");
        
        bytes32 hash = keccak256(abi.encode(order));
        address signer = ECDSA.recover(hash, order.signature);
        
        usedNonces[order.nonce] = true;
        
        // Execute swap
        IERC20(order.tokenIn).safeTransferFrom(signer, address(this), order.amountIn);
        
        uint256 amountOut = aggregator.executeSwap(
            order.tokenIn,
            order.tokenOut,
            order.amountIn,
            order.minAmountOut,
            getBestRouter(order.tokenIn, order.tokenOut, order.amountIn),
            ""
        );
        
        IERC20(order.tokenOut).safeTransfer(signer, amountOut);
    }
}
```

## Next Steps

- **[Learn about MulticallLibraryV2](multicall-library.md)** - Batch operations
- **[Explore QuoteLibrary](quote-library.md)** - Price calculation engine  
- **[Study Integration Examples](../examples/dex-aggregation.md)** - Real-world patterns
- **[Read Security Guide](../guides/security.md)** - Best practices
