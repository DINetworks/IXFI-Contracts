# Quote Library

The Quote Library provides efficient price discovery and optimal route calculation for cross-chain token swaps and transfers. It aggregates liquidity from multiple DEXs and cross-chain bridges to find the best execution paths.

## Overview

The Quote Library is a core component of the IXFI Protocol that handles:

- **Multi-DEX Price Aggregation**: Fetches quotes from multiple decentralized exchanges
- **Cross-Chain Route Optimization**: Finds optimal paths for cross-chain swaps
- **Real-time Price Updates**: Maintains up-to-date pricing information
- **Slippage Calculation**: Estimates price impact and slippage for trades
- **Gas Cost Estimation**: Includes transaction costs in route optimization

## Smart Contract Interface

### Core Functions

#### getQuote

Get a quote for a token swap without executing the transaction.

```solidity
function getQuote(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    bytes calldata dexData
) external view returns (QuoteResult memory)
```

**Parameters:**
- `tokenIn`: Address of the input token
- `tokenOut`: Address of the output token  
- `amountIn`: Amount of input tokens
- `dexData`: Encoded DEX-specific parameters

**Returns:**
```solidity
struct QuoteResult {
    uint256 amountOut;      // Expected output amount
    uint256 priceImpact;    // Price impact in basis points
    uint256 gasEstimate;    // Estimated gas cost
    address[] path;         // Swap path through tokens
    address dexUsed;        // DEX providing best quote
    uint256 timestamp;      // Quote timestamp
}
```

**Usage Example:**
```javascript
const quoteLibrary = new ethers.Contract(quoteLibraryAddress, quoteLibraryABI, provider);

const quote = await quoteLibrary.getQuote(
    usdcAddress,           // tokenIn
    usdtAddress,           // tokenOut
    ethers.parseUnits("1000", 6), // amountIn (1000 USDC)
    "0x"                   // dexData (empty for default)
);

console.log(`Expected output: ${ethers.formatUnits(quote.amountOut, 6)} USDT`);
console.log(`Price impact: ${quote.priceImpact / 100}%`);
console.log(`Gas estimate: ${quote.gasEstimate}`);
```

#### getCrossChainQuote

Get a quote for cross-chain token swap including bridge fees and timing.

```solidity
function getCrossChainQuote(
    string memory fromChain,
    string memory toChain,
    address tokenIn,
    address tokenOut,
    uint256 amountIn
) external view returns (CrossChainQuoteResult memory)
```

**Parameters:**
- `fromChain`: Source blockchain name
- `toChain`: Destination blockchain name
- `tokenIn`: Input token address on source chain
- `tokenOut`: Output token address on destination chain
- `amountIn`: Amount of input tokens

**Returns:**
```solidity
struct CrossChainQuoteResult {
    uint256 amountOut;           // Expected output amount
    uint256 totalFees;           // Total fees (bridge + gas + protocol)
    uint256 estimatedTime;       // Estimated completion time in seconds
    uint256 priceImpact;         // Total price impact
    RouteStep[] route;           // Step-by-step route
    uint256 minAmountOut;        // Minimum guaranteed output
}

struct RouteStep {
    string chain;                // Chain for this step
    address tokenIn;             // Input token
    address tokenOut;            // Output token
    uint256 amountIn;            // Input amount
    uint256 amountOut;           // Output amount
    address dex;                 // DEX or bridge used
    StepType stepType;           // SWAP, BRIDGE, or WRAP
}

enum StepType { SWAP, BRIDGE, WRAP }
```

**Usage Example:**
```javascript
const crossChainQuote = await quoteLibrary.getCrossChainQuote(
    "ethereum",                    // fromChain
    "polygon",                     // toChain
    usdcEthereumAddress,          // tokenIn
    usdtPolygonAddress,           // tokenOut
    ethers.parseUnits("1000", 6)  // amountIn
);

console.log(`Cross-chain output: ${ethers.formatUnits(crossChainQuote.amountOut, 6)} USDT`);
console.log(`Total fees: ${ethers.formatEther(crossChainQuote.totalFees)} ETH`);
console.log(`Estimated time: ${crossChainQuote.estimatedTime / 60} minutes`);
console.log(`Route steps: ${crossChainQuote.route.length}`);

// Log each route step
crossChainQuote.route.forEach((step, index) => {
    console.log(`Step ${index + 1}: ${step.stepType} on ${step.chain}`);
    console.log(`  ${ethers.formatUnits(step.amountIn, 6)} → ${ethers.formatUnits(step.amountOut, 6)}`);
});
```

#### getMultipleQuotes

Get quotes from multiple DEXs for comparison.

```solidity
function getMultipleQuotes(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    address[] calldata dexes
) external view returns (QuoteResult[] memory)
```

**Parameters:**
- `tokenIn`: Input token address
- `tokenOut`: Output token address
- `amountIn`: Amount of input tokens
- `dexes`: Array of DEX addresses to query

**Usage Example:**
```javascript
const dexAddresses = [
    uniswapV2Address,
    uniswapV3Address,
    sushiswapAddress,
    pancakeswapAddress
];

const quotes = await quoteLibrary.getMultipleQuotes(
    usdcAddress,
    usdtAddress,
    ethers.parseUnits("1000", 6),
    dexAddresses
);

// Find best quote
const bestQuote = quotes.reduce((best, current) => 
    current.amountOut > best.amountOut ? current : best
);

console.log(`Best quote: ${ethers.formatUnits(bestQuote.amountOut, 6)} USDT`);
console.log(`Best DEX: ${bestQuote.dexUsed}`);
```

#### getBestRoute

Get the optimal route for a token swap considering all available DEXs.

```solidity
function getBestRoute(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 maxSlippage
) external view returns (OptimalRoute memory)
```

**Parameters:**
- `tokenIn`: Input token address
- `tokenOut`: Output token address
- `amountIn`: Amount of input tokens
- `maxSlippage`: Maximum acceptable slippage in basis points

**Returns:**
```solidity
struct OptimalRoute {
    QuoteResult quote;           // Best quote found
    SwapStep[] steps;           // Detailed swap steps
    uint256 totalGasCost;       // Total estimated gas cost
    bool isDirectSwap;          // Whether direct swap is possible
    address[] intermediateTokens; // Tokens used in multi-hop
}

struct SwapStep {
    address dex;                // DEX to use for this step
    address tokenIn;            // Input token
    address tokenOut;           // Output token
    uint256 amountIn;           // Input amount
    uint256 minAmountOut;       // Minimum output (with slippage)
    bytes swapData;             // DEX-specific swap data
}
```

#### estimateGasCost

Estimate gas costs for a swap route.

```solidity
function estimateGasCost(
    OptimalRoute memory route,
    address user
) external view returns (uint256 totalGasCost)
```

#### getPriceImpact

Calculate price impact for a trade.

```solidity
function getPriceImpact(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    address dex
) external view returns (uint256 priceImpact)
```

### Configuration Functions

#### addDEX

Add a new DEX to the quote aggregation (admin only).

```solidity
function addDEX(
    address dexAddress,
    string memory dexName,
    bool isActive
) external onlyOwner
```

#### updateDEXStatus

Enable or disable a DEX for quote aggregation.

```solidity
function updateDEXStatus(
    address dexAddress,
    bool isActive
) external onlyOwner
```

#### setMaxSlippage

Set maximum allowed slippage for quotes.

```solidity
function setMaxSlippage(uint256 maxSlippage) external onlyOwner
```

#### setSupportedTokens

Configure which tokens are supported for quoting.

```solidity
function setSupportedTokens(
    address[] calldata tokens,
    bool[] calldata supported
) external onlyOwner
```

## JavaScript SDK Integration

### QuoteLibrary Class

```javascript
class QuoteLibrary {
    constructor(config) {
        this.contract = new ethers.Contract(
            config.contractAddress,
            config.abi,
            config.provider
        );
        this.supportedDEXs = config.supportedDEXs || [];
        this.cache = new Map();
        this.cacheTimeout = config.cacheTimeout || 30000; // 30 seconds
    }

    async getQuote(tokenIn, tokenOut, amountIn, options = {}) {
        const cacheKey = `${tokenIn}-${tokenOut}-${amountIn}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const quote = await this.contract.getQuote(
                tokenIn,
                tokenOut,
                amountIn,
                options.dexData || "0x"
            );

            // Cache the result
            this.cache.set(cacheKey, {
                data: quote,
                timestamp: Date.now()
            });

            return this.formatQuoteResult(quote);
        } catch (error) {
            throw new Error(`Failed to get quote: ${error.message}`);
        }
    }

    async getCrossChainQuote(fromChain, toChain, tokenIn, tokenOut, amountIn) {
        try {
            const quote = await this.contract.getCrossChainQuote(
                fromChain,
                toChain,
                tokenIn,
                tokenOut,
                amountIn
            );

            return this.formatCrossChainQuote(quote);
        } catch (error) {
            throw new Error(`Failed to get cross-chain quote: ${error.message}`);
        }
    }

    async getBestRoute(tokenIn, tokenOut, amountIn, maxSlippage = 50) {
        try {
            const route = await this.contract.getBestRoute(
                tokenIn,
                tokenOut,
                amountIn,
                maxSlippage
            );

            return this.formatOptimalRoute(route);
        } catch (error) {
            throw new Error(`Failed to get best route: ${error.message}`);
        }
    }

    async compareAllDEXs(tokenIn, tokenOut, amountIn) {
        try {
            const quotes = await this.contract.getMultipleQuotes(
                tokenIn,
                tokenOut,
                amountIn,
                this.supportedDEXs
            );

            return quotes
                .map(quote => this.formatQuoteResult(quote))
                .sort((a, b) => b.amountOut - a.amountOut);
        } catch (error) {
            throw new Error(`Failed to compare DEXs: ${error.message}`);
        }
    }

    formatQuoteResult(quote) {
        return {
            amountOut: ethers.formatUnits(quote.amountOut, 18),
            priceImpact: Number(quote.priceImpact) / 100, // Convert to percentage
            gasEstimate: Number(quote.gasEstimate),
            path: quote.path,
            dexUsed: quote.dexUsed,
            timestamp: Number(quote.timestamp),
            isExpired: Date.now() / 1000 - Number(quote.timestamp) > 300 // 5 minutes
        };
    }

    formatCrossChainQuote(quote) {
        return {
            amountOut: ethers.formatUnits(quote.amountOut, 18),
            totalFees: ethers.formatEther(quote.totalFees),
            estimatedTime: Number(quote.estimatedTime),
            priceImpact: Number(quote.priceImpact) / 100,
            route: quote.route.map(step => ({
                chain: step.chain,
                tokenIn: step.tokenIn,
                tokenOut: step.tokenOut,
                amountIn: ethers.formatUnits(step.amountIn, 18),
                amountOut: ethers.formatUnits(step.amountOut, 18),
                dex: step.dex,
                stepType: ['SWAP', 'BRIDGE', 'WRAP'][step.stepType]
            })),
            minAmountOut: ethers.formatUnits(quote.minAmountOut, 18)
        };
    }

    formatOptimalRoute(route) {
        return {
            quote: this.formatQuoteResult(route.quote),
            steps: route.steps.map(step => ({
                dex: step.dex,
                tokenIn: step.tokenIn,
                tokenOut: step.tokenOut,
                amountIn: ethers.formatUnits(step.amountIn, 18),
                minAmountOut: ethers.formatUnits(step.minAmountOut, 18),
                swapData: step.swapData
            })),
            totalGasCost: ethers.formatEther(route.totalGasCost),
            isDirectSwap: route.isDirectSwap,
            intermediateTokens: route.intermediateTokens
        };
    }

    clearCache() {
        this.cache.clear();
    }

    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}
```

### React Hook

```jsx
import { useState, useEffect, useCallback } from 'react';
import { QuoteLibrary } from '@ixfi/sdk';

export function useQuoteLibrary(config) {
    const [quoteLibrary] = useState(() => new QuoteLibrary(config));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const getQuote = useCallback(async (tokenIn, tokenOut, amountIn) => {
        setLoading(true);
        setError(null);
        
        try {
            const quote = await quoteLibrary.getQuote(tokenIn, tokenOut, amountIn);
            return quote;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [quoteLibrary]);

    const getCrossChainQuote = useCallback(async (fromChain, toChain, tokenIn, tokenOut, amountIn) => {
        setLoading(true);
        setError(null);
        
        try {
            const quote = await quoteLibrary.getCrossChainQuote(fromChain, toChain, tokenIn, tokenOut, amountIn);
            return quote;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [quoteLibrary]);

    const getBestRoute = useCallback(async (tokenIn, tokenOut, amountIn, maxSlippage) => {
        setLoading(true);
        setError(null);
        
        try {
            const route = await quoteLibrary.getBestRoute(tokenIn, tokenOut, amountIn, maxSlippage);
            return route;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [quoteLibrary]);

    return {
        getQuote,
        getCrossChainQuote,
        getBestRoute,
        loading,
        error,
        clearCache: quoteLibrary.clearCache.bind(quoteLibrary),
        getCacheStats: quoteLibrary.getCacheStats.bind(quoteLibrary)
    };
}

// Usage in React component
function SwapInterface() {
    const { getQuote, loading, error } = useQuoteLibrary({
        contractAddress: '0x...',
        abi: quoteLibraryABI,
        provider: provider
    });

    const [quote, setQuote] = useState(null);

    const handleGetQuote = async () => {
        try {
            const result = await getQuote(
                '0x...', // USDC
                '0x...', // USDT
                ethers.parseUnits('1000', 6)
            );
            setQuote(result);
        } catch (err) {
            console.error('Quote failed:', err);
        }
    };

    return (
        <div>
            <button onClick={handleGetQuote} disabled={loading}>
                {loading ? 'Getting Quote...' : 'Get Quote'}
            </button>
            
            {error && <div className="error">Error: {error}</div>}
            
            {quote && (
                <div className="quote-result">
                    <p>Output: {quote.amountOut} tokens</p>
                    <p>Price Impact: {quote.priceImpact}%</p>
                    <p>Gas Estimate: {quote.gasEstimate}</p>
                    <p>DEX: {quote.dexUsed}</p>
                </div>
            )}
        </div>
    );
}
```

## Advanced Features

### Quote Optimization Strategies

```javascript
class QuoteOptimizer {
    constructor(quoteLibrary) {
        this.quoteLibrary = quoteLibrary;
    }

    async findOptimalSplit(tokenIn, tokenOut, amountIn, maxSplits = 3) {
        // Split large trades across multiple DEXs for better execution
        const baseSplitAmount = amountIn / maxSplits;
        const strategies = [];

        for (let splits = 1; splits <= maxSplits; splits++) {
            const splitAmount = amountIn / splits;
            const quotes = await Promise.all(
                Array(splits).fill().map(() => 
                    this.quoteLibrary.getQuote(tokenIn, tokenOut, splitAmount)
                )
            );

            const totalOutput = quotes.reduce((sum, quote) => sum + parseFloat(quote.amountOut), 0);
            const totalGas = quotes.reduce((sum, quote) => sum + quote.gasEstimate, 0);

            strategies.push({
                splits,
                totalOutput,
                totalGas,
                avgPriceImpact: quotes.reduce((sum, quote) => sum + quote.priceImpact, 0) / splits,
                quotes
            });
        }

        // Find strategy with best output considering gas costs
        return strategies.reduce((best, current) => {
            const currentNetOutput = current.totalOutput - (current.totalGas * gasPrice);
            const bestNetOutput = best.totalOutput - (best.totalGas * gasPrice);
            return currentNetOutput > bestNetOutput ? current : best;
        });
    }

    async getTimeBasedQuotes(tokenIn, tokenOut, amountIn, intervals = 5) {
        // Get quotes over time to find optimal execution timing
        const quotes = [];
        
        for (let i = 0; i < intervals; i++) {
            const quote = await this.quoteLibrary.getQuote(tokenIn, tokenOut, amountIn);
            quotes.push({
                ...quote,
                timestamp: Date.now()
            });
            
            if (i < intervals - 1) {
                await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute
            }
        }

        return {
            quotes,
            bestQuote: quotes.reduce((best, current) => 
                parseFloat(current.amountOut) > parseFloat(best.amountOut) ? current : best
            ),
            volatility: this.calculateVolatility(quotes),
            trend: this.calculateTrend(quotes)
        };
    }

    calculateVolatility(quotes) {
        const prices = quotes.map(q => parseFloat(q.amountOut));
        const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
        return Math.sqrt(variance) / mean; // Coefficient of variation
    }

    calculateTrend(quotes) {
        if (quotes.length < 2) return 'insufficient-data';
        
        const first = parseFloat(quotes[0].amountOut);
        const last = parseFloat(quotes[quotes.length - 1].amountOut);
        const change = (last - first) / first;
        
        if (change > 0.001) return 'improving';
        if (change < -0.001) return 'declining';
        return 'stable';
    }
}
```

### Real-time Price Monitoring

```javascript
class PriceMonitor {
    constructor(quoteLibrary, options = {}) {
        this.quoteLibrary = quoteLibrary;
        this.monitoringPairs = new Map();
        this.priceAlerts = new Map();
        this.interval = options.interval || 30000; // 30 seconds
        this.isRunning = false;
    }

    startMonitoring(tokenPairs) {
        if (this.isRunning) return;
        
        this.isRunning = true;
        tokenPairs.forEach(pair => {
            this.monitoringPairs.set(`${pair.tokenIn}-${pair.tokenOut}`, pair);
        });

        this.monitoringLoop();
    }

    stopMonitoring() {
        this.isRunning = false;
    }

    setPriceAlert(tokenIn, tokenOut, targetPrice, condition = 'above') {
        const key = `${tokenIn}-${tokenOut}`;
        this.priceAlerts.set(key, { targetPrice, condition, triggered: false });
    }

    async monitoringLoop() {
        while (this.isRunning) {
            for (const [key, pair] of this.monitoringPairs) {
                try {
                    const quote = await this.quoteLibrary.getQuote(
                        pair.tokenIn,
                        pair.tokenOut,
                        pair.amountIn
                    );

                    this.processQuoteUpdate(key, quote);
                    this.checkPriceAlerts(key, quote);
                } catch (error) {
                    console.error(`Monitoring error for ${key}:`, error);
                }
            }

            await new Promise(resolve => setTimeout(resolve, this.interval));
        }
    }

    processQuoteUpdate(pairKey, quote) {
        const event = {
            pair: pairKey,
            quote,
            timestamp: Date.now()
        };

        // Emit price update event
        this.emit('priceUpdate', event);

        // Store price history
        if (!this.priceHistory) this.priceHistory = new Map();
        if (!this.priceHistory.has(pairKey)) {
            this.priceHistory.set(pairKey, []);
        }

        const history = this.priceHistory.get(pairKey);
        history.push(event);

        // Keep only last 100 entries
        if (history.length > 100) {
            history.shift();
        }
    }

    checkPriceAlerts(pairKey, quote) {
        const alert = this.priceAlerts.get(pairKey);
        if (!alert || alert.triggered) return;

        const currentPrice = parseFloat(quote.amountOut);
        const shouldTrigger = alert.condition === 'above' 
            ? currentPrice >= alert.targetPrice
            : currentPrice <= alert.targetPrice;

        if (shouldTrigger) {
            alert.triggered = true;
            this.emit('priceAlert', {
                pair: pairKey,
                targetPrice: alert.targetPrice,
                currentPrice,
                condition: alert.condition,
                quote
            });
        }
    }

    getPriceHistory(tokenIn, tokenOut, limit = 50) {
        const key = `${tokenIn}-${tokenOut}`;
        const history = this.priceHistory?.get(key) || [];
        return history.slice(-limit);
    }

    // Simple event emitter implementation
    emit(event, data) {
        if (this.listeners && this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }

    on(event, callback) {
        if (!this.listeners) this.listeners = {};
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }
}
```

## Best Practices

### Quote Management

1. **Cache Aggressively**: Quote data becomes stale quickly, but short-term caching improves UX
2. **Handle Failures Gracefully**: Always have fallback options when quotes fail
3. **Consider Gas Costs**: Include gas costs in route optimization
4. **Monitor Price Impact**: Large trades should be split to minimize impact

### Performance Optimization

1. **Batch Requests**: Use multicall when getting multiple quotes
2. **Parallel Processing**: Query multiple DEXs simultaneously
3. **Smart Caching**: Cache based on token pair and amount ranges
4. **Rate Limiting**: Respect API rate limits to avoid being blocked

### Integration Patterns

1. **Progressive Enhancement**: Start with basic quotes, add advanced features
2. **Error Boundaries**: Wrap quote components in error boundaries
3. **Loading States**: Always show loading states for better UX
4. **Real-time Updates**: Use WebSockets for live price feeds when available

## Resources

- [Cross-Chain Aggregator API](cross-chain-aggregator.md)
- [IXFI Gateway API](ixfi-gateway.md)
- [Integration Examples](../examples/)
- [DEX Aggregation Guide](../dex-aggregation/overview.md)
