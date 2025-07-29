# Supported DEXes

The IXFI Protocol integrates with a comprehensive list of decentralized exchanges across multiple blockchains to provide optimal liquidity aggregation and routing. This document outlines all supported DEXes, their capabilities, and integration details.

## Multi-Chain DEX Support

### Ethereum Mainnet

#### Automated Market Makers (AMMs)

**Uniswap V2 & V3**
- **Type**: Concentrated Liquidity (V3), Constant Product (V2)
- **Fees**: 0.05%, 0.3%, 1% (V3); 0.3% (V2)
- **Liquidity**: Highest on Ethereum
- **Integration**: Native support with optimized routing
- **Special Features**: Multiple fee tiers, concentrated liquidity positions

**SushiSwap V2 & V3**
- **Type**: Fork of Uniswap with additional features
- **Fees**: 0.25%, 0.3%, 1%
- **Liquidity**: High across diverse token pairs
- **Integration**: Full routing and aggregation support
- **Special Features**: Onsen rewards, cross-chain bridges

**Curve Finance**
- **Type**: Stablecoin and similar-asset optimized AMM
- **Fees**: 0.04% - 0.4%
- **Liquidity**: Dominant for stablecoin swaps
- **Integration**: Custom routing for stable assets
- **Special Features**: Low slippage for correlated assets

**Balancer V2**
- **Type**: Weighted pools, stable pools, boosted pools
- **Fees**: Variable (0.01% - 10%)
- **Liquidity**: Multi-token pools with custom weights
- **Integration**: Advanced pool types support
- **Special Features**: Weighted pools, flash loans

#### Aggregators & Advanced Protocols

**1inch V5**
- **Type**: DEX aggregator
- **Integration**: Secondary aggregation for complex routes
- **Features**: Chi gas tokens, partial fill protection
- **Use Case**: Backup routing and validation

**0x Protocol**
- **Type**: Order book + AMM hybrid
- **Integration**: RFQ and on-chain liquidity
- **Features**: Professional market makers
- **Use Case**: Large trades and institutional flows

**Kyber Network**
- **Type**: On-chain liquidity protocol
- **Integration**: Dynamic market maker support
- **Features**: Amplified liquidity, elastic supply
- **Use Case**: Alternative routing for specific pairs

### Polygon

**QuickSwap**
- **Type**: Uniswap V3 fork with concentrated liquidity
- **Fees**: 0.01%, 0.05%, 0.3%, 1%
- **Liquidity**: Leading DEX on Polygon
- **Integration**: Full V3 routing support
- **Special Features**: Dragon's lair staking, perps

**SushiSwap**
- **Type**: Multi-chain AMM deployment
- **Fees**: 0.25%, 0.3%
- **Integration**: Cross-chain liquidity access
- **Features**: Onsen incentives

**Curve (Polygon)**
- **Type**: Stablecoin-optimized pools
- **Fees**: 0.04% - 0.4%
- **Integration**: Polygon-specific stable routing
- **Features**: Cross-chain gauge voting

### Binance Smart Chain

**PancakeSwap V2 & V3**
- **Type**: Leading BSC AMM with V3 concentrated liquidity
- **Fees**: 0.01%, 0.05%, 0.25%, 1% (V3); 0.25% (V2)
- **Liquidity**: Highest on BSC
- **Integration**: Full V2/V3 support with CAKE farms
- **Special Features**: Syrup pools, lottery, prediction markets

**Thena**
- **Type**: Solidly fork with ve(3,3) mechanics
- **Fees**: Variable based on volatility
- **Integration**: Stable and volatile pair optimization
- **Features**: Vote-escrowed tokenomics

**Apeswap**
- **Type**: Community-driven AMM
- **Fees**: 0.2% - 0.3%
- **Integration**: Alternative routing option
- **Features**: Jungle farms, lending

**Biswap**
- **Type**: Multi-chain AMM with low fees
- **Fees**: 0.1% - 0.2%
- **Integration**: Cost-effective routing
- **Features**: Launchpads, lottery

### Arbitrum

**Uniswap V3**
- **Type**: Native V3 deployment
- **Fees**: 0.05%, 0.3%, 1%
- **Liquidity**: Primary liquidity source on Arbitrum
- **Integration**: Full concentrated liquidity support
- **Features**: L2 cost efficiency

**SushiSwap**
- **Type**: Cross-chain AMM deployment
- **Fees**: 0.25%, 0.3%
- **Integration**: Multi-chain liquidity access
- **Features**: Reduced gas costs

**Camelot**
- **Type**: Native Arbitrum AMM with advanced features
- **Fees**: Dynamic fees based on volatility
- **Integration**: Specialized Arbitrum routing
- **Features**: Nitro pools, escrowed tokens

**Ramses**
- **Type**: Uniswap V3 fork with ve(3,3) mechanics
- **Fees**: 0.01%, 0.05%, 0.3%, 1%
- **Integration**: Optimized for Arbitrum ecosystem
- **Features**: Voter rewards, gauge system

**GMX**
- **Type**: Perpetual exchange with spot swaps
- **Fees**: 0.2% - 0.8%
- **Integration**: Large trade execution
- **Features**: Zero slippage for supported assets

**Zyberswap**
- **Type**: Community-focused AMM
- **Fees**: 0.25% - 0.3%
- **Integration**: Alternative routing
- **Features**: Social trading features

### Optimism

**Uniswap V3**
- **Type**: Native V3 concentrated liquidity
- **Fees**: 0.05%, 0.3%, 1%
- **Liquidity**: Primary OP liquidity
- **Integration**: Full L2 optimization
- **Features**: Cheap transactions, fast finality

**Beethoven X**
- **Type**: Balancer V2 fork
- **Fees**: Variable pool fees
- **Integration**: Weighted and stable pools
- **Features**: Boosted pools, yield farming

**Velodrome**
- **Type**: Solidly fork with ve(3,3) mechanics
- **Fees**: Dynamic based on pair type
- **Integration**: Optimized stable/volatile routing
- **Features**: Vote-escrowed VELO, bribes

### Avalanche

**Trader Joe V2**
- **Type**: Concentrated liquidity with bins
- **Fees**: Variable bin-based pricing
- **Integration**: Liquidity book protocol support
- **Features**: Zero slippage swaps in active bin

**Platypus Finance**
- **Type**: Single-sided stablecoin AMM
- **Fees**: 0.1% - 0.3%
- **Integration**: Stable asset optimization
- **Features**: Single-sided liquidity, coverage ratio

**Pangolin**
- **Type**: Uniswap V2 fork
- **Fees**: 0.3%
- **Integration**: Basic AMM routing
- **Features**: AVAX ecosystem integration

**SushiSwap**
- **Type**: Multi-chain deployment
- **Fees**: 0.25% - 0.3%
- **Integration**: Cross-chain liquidity
- **Features**: Avalanche-specific incentives

### Fantom

**SpookySwap**
- **Type**: Native Fantom AMM
- **Fees**: 0.2% - 0.3%
- **Integration**: Fantom ecosystem optimization
- **Features**: BOO staking, farms

**SpiritSwap**
- **Type**: Solidly-based ve(3,3) AMM
- **Fees**: Variable based on pair type
- **Integration**: Stable/volatile optimization
- **Features**: SPIRIT incentives, gauges

**Beethoven X**
- **Type**: Balancer V2 fork for Fantom
- **Fees**: Variable pool fees
- **Integration**: Weighted pools support
- **Features**: Fantom-specific incentives

### Base

**Uniswap V3**
- **Type**: Native Coinbase L2 deployment
- **Fees**: 0.05%, 0.3%, 1%
- **Integration**: Full Base ecosystem support
- **Features**: Low-cost transactions

**Aerodrome**
- **Type**: Velodrome fork for Base
- **Fees**: Dynamic ve(3,3) model
- **Integration**: Base-native routing
- **Features**: AERO tokenomics

### Layer 2 & Sidechains

**xDAI/Gnosis Chain**
- **SushiSwap**: Cross-chain AMM
- **Curve**: Stablecoin optimization
- **Balancer**: Multi-asset pools

**Moonbeam**
- **SushiSwap**: Polkadot ecosystem bridge
- **Curve**: Cross-chain stable swaps

## Integration Architecture

### Router Classification

```solidity
enum RouterType {
    UNISWAP_V2,      // Constant product AMM
    UNISWAP_V3,      // Concentrated liquidity
    CURVE,           // Stable asset AMM
    BALANCER,        // Weighted pools
    SOLIDLY,         // ve(3,3) mechanics
    AGGREGATOR,      // Meta-aggregators
    ORDERBOOK,       // Order book DEXes
    HYBRID           // Mixed models
}
```

### Liquidity Detection

```javascript
class LiquidityDetector {
    constructor() {
        this.dexRegistry = new Map();
        this.poolCache = new Map();
        this.lastUpdate = new Map();
    }

    async detectAvailableLiquidity(tokenA, tokenB, chainId) {
        const dexes = this.dexRegistry.get(chainId) || [];
        const liquiditySources = [];

        for (const dex of dexes) {
            try {
                const liquidity = await this.checkDEXLiquidity(dex, tokenA, tokenB);
                if (liquidity.available) {
                    liquiditySources.push({
                        dex: dex.name,
                        type: dex.type,
                        liquidity: liquidity.amount,
                        fees: liquidity.fees,
                        slippage: liquidity.estimatedSlippage
                    });
                }
            } catch (error) {
                console.warn(`Failed to check ${dex.name}:`, error);
            }
        }

        return liquiditySources.sort((a, b) => b.liquidity - a.liquidity);
    }

    async checkDEXLiquidity(dex, tokenA, tokenB) {
        switch (dex.type) {
            case 'UNISWAP_V2':
                return this.checkUniswapV2Liquidity(dex, tokenA, tokenB);
            case 'UNISWAP_V3':
                return this.checkUniswapV3Liquidity(dex, tokenA, tokenB);
            case 'CURVE':
                return this.checkCurveLiquidity(dex, tokenA, tokenB);
            case 'BALANCER':
                return this.checkBalancerLiquidity(dex, tokenA, tokenB);
            default:
                return { available: false };
        }
    }

    async checkUniswapV2Liquidity(dex, tokenA, tokenB) {
        const pairAddress = await this.getUniswapV2Pair(dex.factory, tokenA, tokenB);
        if (pairAddress === ethers.ZeroAddress) {
            return { available: false };
        }

        const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);
        const reserves = await pairContract.getReserves();
        
        return {
            available: true,
            amount: Math.min(Number(reserves.reserve0), Number(reserves.reserve1)),
            fees: 0.003, // 0.3%
            estimatedSlippage: this.estimateV2Slippage(reserves, tokenA, tokenB)
        };
    }

    async checkUniswapV3Liquidity(dex, tokenA, tokenB) {
        const feeTiers = [100, 500, 3000, 10000]; // 0.01%, 0.05%, 0.3%, 1%
        let bestLiquidity = { available: false };

        for (const fee of feeTiers) {
            try {
                const poolAddress = await this.getUniswapV3Pool(dex.factory, tokenA, tokenB, fee);
                if (poolAddress !== ethers.ZeroAddress) {
                    const poolContract = new ethers.Contract(poolAddress, POOL_V3_ABI, provider);
                    const liquidity = await poolContract.liquidity();
                    
                    if (Number(liquidity) > (bestLiquidity.amount || 0)) {
                        bestLiquidity = {
                            available: true,
                            amount: Number(liquidity),
                            fees: fee / 10000,
                            feeTier: fee,
                            estimatedSlippage: this.estimateV3Slippage(liquidity, fee)
                        };
                    }
                }
            } catch (error) {
                // Pool doesn't exist for this fee tier
                continue;
            }
        }

        return bestLiquidity;
    }

    async checkCurveLiquidity(dex, tokenA, tokenB) {
        // Check Curve registry for available pools
        const registry = new ethers.Contract(dex.registry, CURVE_REGISTRY_ABI, provider);
        
        try {
            const poolAddress = await registry.find_pool_for_coins(tokenA, tokenB);
            if (poolAddress === ethers.ZeroAddress) {
                return { available: false };
            }

            const poolContract = new ethers.Contract(poolAddress, CURVE_POOL_ABI, provider);
            const balances = await poolContract.get_balances();
            
            return {
                available: true,
                amount: Math.min(...balances.map(b => Number(b))),
                fees: 0.0004, // Typical Curve fee
                poolType: 'stable',
                estimatedSlippage: this.estimateCurveSlippage(balances)
            };
        } catch (error) {
            return { available: false };
        }
    }

    async checkBalancerLiquidity(dex, tokenA, tokenB) {
        // Query Balancer subgraph for pools containing both tokens
        const query = `
            query {
                pools(
                    where: {
                        tokensList_contains: ["${tokenA.toLowerCase()}", "${tokenB.toLowerCase()}"]
                    }
                    orderBy: totalLiquidity
                    orderDirection: desc
                    first: 5
                ) {
                    id
                    totalLiquidity
                    swapFee
                    poolType
                    tokens {
                        address
                        balance
                        weight
                    }
                }
            }
        `;

        try {
            const response = await this.querySubgraph(dex.subgraphUrl, query);
            const pools = response.data.pools;

            if (pools.length === 0) {
                return { available: false };
            }

            const bestPool = pools[0];
            return {
                available: true,
                amount: Number(bestPool.totalLiquidity),
                fees: Number(bestPool.swapFee),
                poolId: bestPool.id,
                poolType: bestPool.poolType,
                estimatedSlippage: this.estimateBalancerSlippage(bestPool)
            };
        } catch (error) {
            return { available: false };
        }
    }

    estimateV2Slippage(reserves, tokenA, tokenB) {
        // Simplified slippage estimation for demonstration
        const reserve0 = Number(reserves.reserve0);
        const reserve1 = Number(reserves.reserve1);
        const minReserve = Math.min(reserve0, reserve1);
        
        // Lower liquidity = higher slippage
        if (minReserve < 1000) return 0.05; // 5%
        if (minReserve < 10000) return 0.02; // 2%
        if (minReserve < 100000) return 0.01; // 1%
        return 0.005; // 0.5%
    }

    estimateV3Slippage(liquidity, feeTier) {
        // V3 slippage depends on concentrated liquidity and fee tier
        const liquidityNum = Number(liquidity);
        const baseFee = feeTier / 10000;
        
        if (liquidityNum < 1000) return baseFee * 10;
        if (liquidityNum < 10000) return baseFee * 5;
        if (liquidityNum < 100000) return baseFee * 2;
        return baseFee;
    }

    estimateCurveSlippage(balances) {
        // Curve has very low slippage for stable assets
        const minBalance = Math.min(...balances.map(b => Number(b)));
        
        if (minBalance < 1000) return 0.02; // 2%
        if (minBalance < 10000) return 0.005; // 0.5%
        return 0.001; // 0.1%
    }

    estimateBalancerSlippage(pool) {
        const totalLiquidity = Number(pool.totalLiquidity);
        
        if (totalLiquidity < 10000) return 0.03; // 3%
        if (totalLiquidity < 100000) return 0.01; // 1%
        return 0.005; // 0.5%
    }

    async querySubgraph(url, query) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        return await response.json();
    }
}
```

## DEX-Specific Optimizations

### Curve Finance Integration

Curve requires special handling for stable asset swaps:

```javascript
class CurveOptimizer {
    async getOptimalCurveRoute(tokenIn, tokenOut, amountIn) {
        // Check for direct pools first
        const directPool = await this.findDirectPool(tokenIn, tokenOut);
        if (directPool) {
            return {
                pools: [directPool],
                route: [tokenIn, tokenOut],
                expectedOutput: await this.quoteCurveSwap(directPool, tokenIn, tokenOut, amountIn)
            };
        }

        // Check for meta pools (pools that contain other pools)
        const metaRoute = await this.findMetaPoolRoute(tokenIn, tokenOut);
        if (metaRoute) {
            return metaRoute;
        }

        // Multi-hop through base pools
        return await this.findMultiHopRoute(tokenIn, tokenOut, amountIn);
    }

    async findDirectPool(tokenIn, tokenOut) {
        const curveRegistry = new ethers.Contract(CURVE_REGISTRY, REGISTRY_ABI, provider);
        return await curveRegistry.find_pool_for_coins(tokenIn, tokenOut);
    }

    async quoteCurveSwap(poolAddress, tokenIn, tokenOut, amountIn) {
        const pool = new ethers.Contract(poolAddress, CURVE_POOL_ABI, provider);
        const registry = new ethers.Contract(CURVE_REGISTRY, REGISTRY_ABI, provider);
        
        // Get coin indices
        const [i, j] = await registry.get_coin_indices(poolAddress, tokenIn, tokenOut);
        
        // Get quote
        return await pool.get_dy(i, j, amountIn);
    }
}
```

### Balancer V2 Integration

Balancer supports multiple pool types requiring different strategies:

```javascript
class BalancerOptimizer {
    async getOptimalBalancerRoute(tokenIn, tokenOut, amountIn) {
        const pools = await this.findBalancerPools(tokenIn, tokenOut);
        
        let bestRoute = null;
        let bestOutput = 0;

        for (const pool of pools) {
            try {
                const output = await this.quoteBalancerSwap(pool, tokenIn, tokenOut, amountIn);
                if (output > bestOutput) {
                    bestOutput = output;
                    bestRoute = {
                        pool,
                        expectedOutput: output,
                        poolType: pool.poolType
                    };
                }
            } catch (error) {
                console.warn(`Failed to quote Balancer pool ${pool.id}:`, error);
            }
        }

        return bestRoute;
    }

    async findBalancerPools(tokenIn, tokenOut) {
        // Query Balancer subgraph for relevant pools
        const query = `
            query {
                pools(
                    where: {
                        tokensList_contains: ["${tokenIn.toLowerCase()}", "${tokenOut.toLowerCase()}"]
                        swapEnabled: true
                    }
                    orderBy: totalLiquidity
                    orderDirection: desc
                ) {
                    id
                    poolType
                    swapFee
                    totalLiquidity
                    tokens {
                        address
                        balance
                        weight
                    }
                }
            }
        `;

        const response = await this.querySubgraph(BALANCER_SUBGRAPH_URL, query);
        return response.data.pools;
    }

    async quoteBalancerSwap(pool, tokenIn, tokenOut, amountIn) {
        const vault = new ethers.Contract(BALANCER_VAULT, VAULT_ABI, provider);
        
        // Prepare single swap
        const singleSwap = {
            poolId: pool.id,
            kind: 0, // GIVEN_IN
            assetIn: tokenIn,
            assetOut: tokenOut,
            amount: amountIn,
            userData: '0x'
        };

        const funds = {
            sender: ethers.ZeroAddress,
            fromInternalBalance: false,
            recipient: ethers.ZeroAddress,
            toInternalBalance: false
        };

        // Query swap (doesn't execute)
        return await vault.queryBatchSwap(0, [singleSwap], [tokenIn, tokenOut], funds);
    }
}
```

## Performance Metrics

### Liquidity Depth Analysis

```javascript
class LiquidityAnalyzer {
    async analyzeLiquidityDepth(dexName, tokenPair, chainId) {
        const metrics = {
            totalLiquidity: 0,
            priceImpact: {},
            slippageAnalysis: {},
            volumeMetrics: {}
        };

        // Analyze different trade sizes
        const tradeSizes = [1000, 5000, 10000, 50000, 100000]; // USD equivalent
        
        for (const size of tradeSizes) {
            const quote = await this.getQuoteForSize(dexName, tokenPair, size, chainId);
            metrics.priceImpact[size] = quote.priceImpact;
            metrics.slippageAnalysis[size] = quote.slippage;
        }

        // Get 24h volume data
        metrics.volumeMetrics = await this.get24hVolumeData(dexName, tokenPair, chainId);

        return metrics;
    }

    async getQuoteForSize(dexName, tokenPair, usdSize, chainId) {
        // Convert USD size to token amount
        const tokenPrice = await this.getTokenPrice(tokenPair.tokenIn);
        const tokenAmount = usdSize / tokenPrice;

        // Get quote from specific DEX
        const quote = await this.getDEXQuote(dexName, tokenPair, tokenAmount, chainId);
        
        return {
            inputAmount: tokenAmount,
            outputAmount: quote.outputAmount,
            priceImpact: this.calculatePriceImpact(tokenAmount, quote.outputAmount, tokenPrice),
            slippage: quote.slippage,
            gasEstimate: quote.gasEstimate
        };
    }

    calculatePriceImpact(amountIn, amountOut, marketPrice) {
        const executionPrice = amountOut / amountIn;
        return Math.abs((marketPrice - executionPrice) / marketPrice);
    }
}
```

## Integration Status

### Mainnet Status
- ✅ **Uniswap V2/V3**: Full integration with all fee tiers
- ✅ **SushiSwap**: Complete V2/V3 support
- ✅ **Curve**: All pool types supported
- ✅ **Balancer V2**: Weighted, stable, and boosted pools
- ✅ **1inch**: Secondary aggregation
- ⚠️ **0x Protocol**: RFQ integration pending
- ⚠️ **Kyber Network**: Dynamic MMM support in progress

### Layer 2 Status
- ✅ **Polygon**: QuickSwap, SushiSwap, Curve
- ✅ **Arbitrum**: Uniswap V3, Camelot, GMX, Ramses
- ✅ **Optimism**: Uniswap V3, Velodrome, Beethoven X
- ✅ **Base**: Uniswap V3, Aerodrome
- ⚠️ **zkSync Era**: Integration in development
- ⚠️ **Polygon zkEVM**: Integration planned

### Sidechain Status
- ✅ **BSC**: PancakeSwap V2/V3, Thena, Biswap
- ✅ **Avalanche**: Trader Joe V2, Platypus, Pangolin
- ✅ **Fantom**: SpookySwap, SpiritSwap, Beethoven X
- ⚠️ **Cronos**: Integration planned
- ⚠️ **Celo**: Integration planned

## Adding New DEXes

### Integration Requirements

1. **Smart Contract Audit**: All DEX integrations must be audited
2. **Liquidity Threshold**: Minimum $100k TVL required
3. **Reliability**: 99%+ uptime over 30-day period
4. **API Stability**: Consistent interface and minimal breaking changes
5. **Community Support**: Active development and community

### Integration Process

1. **Technical Assessment**: Review DEX architecture and APIs
2. **Security Review**: Audit smart contracts and integration code
3. **Testing Phase**: Extensive testing on testnets
4. **Liquidity Analysis**: Evaluate impact on routing efficiency
5. **Mainnet Deployment**: Gradual rollout with monitoring
6. **Performance Monitoring**: Continuous tracking of metrics

### Contributing New DEX Integrations

Developers can contribute new DEX integrations following our [Integration Guide](../guides/integration.md). All contributions must include:

- Smart contract integration code
- Comprehensive test suite
- Documentation updates
- Security analysis report
- Performance benchmarks

## Resources

- [DEX Aggregation Overview](overview.md)
- [Routing Algorithm](routing-algorithm.md)
- [Quote System](quote-system.md)
- [Router Types](router-types.md)
- [Integration Examples](../examples/dex-aggregation.md)
