# Routing Algorithm

The IXFI Protocol employs a sophisticated multi-dimensional routing algorithm that optimizes for multiple factors including price, gas costs, slippage, and execution reliability across all supported DEXes and chains.

## Algorithm Overview

The routing engine uses a hybrid approach combining:

1. **Graph-based pathfinding** for multi-hop routes
2. **Dynamic programming** for optimal split optimization  
3. **Machine learning** for gas price prediction and slippage estimation
4. **Real-time liquidity monitoring** for route validation
5. **Historical performance analysis** for reliability scoring

## Core Routing Components

### 1. Liquidity Graph Construction

The algorithm builds a dynamic liquidity graph where:
- **Nodes** represent tokens on different chains
- **Edges** represent available trading pairs with associated costs
- **Weights** combine multiple factors (price impact, fees, gas costs)

```javascript
class LiquidityGraph {
    constructor() {
        this.nodes = new Map(); // tokenAddress -> NodeData
        this.edges = new Map(); // edgeId -> EdgeData
        this.chainBridges = new Map(); // chainId -> bridges
        this.lastUpdate = new Map();
    }

    buildGraph(supportedTokens, supportedDEXes, supportedChains) {
        // Build nodes for each token on each chain
        for (const chain of supportedChains) {
            for (const token of supportedTokens) {
                const nodeId = `${chain.id}:${token.address}`;
                this.nodes.set(nodeId, {
                    chainId: chain.id,
                    tokenAddress: token.address,
                    tokenSymbol: token.symbol,
                    decimals: token.decimals,
                    isNative: token.isNative,
                    bridges: this.getAvailableBridges(token, chain.id)
                });
            }
        }

        // Build edges for each DEX pair
        for (const chain of supportedChains) {
            for (const dex of supportedDEXes.filter(d => d.chainId === chain.id)) {
                this.addDEXEdges(dex, chain.id);
            }
        }

        // Add cross-chain bridge edges
        this.addBridgeEdges(supportedChains);
    }

    addDEXEdges(dex, chainId) {
        const pairs = this.getDEXPairs(dex);
        
        for (const pair of pairs) {
            const edgeId = `${chainId}:${dex.name}:${pair.tokenA}:${pair.tokenB}`;
            
            this.edges.set(edgeId, {
                type: 'DEX_SWAP',
                chainId: chainId,
                dexName: dex.name,
                dexType: dex.type,
                tokenA: pair.tokenA,
                tokenB: pair.tokenB,
                fee: pair.fee,
                liquidity: pair.liquidity,
                lastUpdate: Date.now(),
                gasEstimate: this.estimateDEXGas(dex.type),
                reliability: dex.reliability || 0.99
            });

            // Add reverse edge
            const reverseEdgeId = `${chainId}:${dex.name}:${pair.tokenB}:${pair.tokenA}`;
            this.edges.set(reverseEdgeId, {
                ...this.edges.get(edgeId),
                tokenA: pair.tokenB,
                tokenB: pair.tokenA
            });
        }
    }

    addBridgeEdges(supportedChains) {
        for (const fromChain of supportedChains) {
            for (const toChain of supportedChains) {
                if (fromChain.id === toChain.id) continue;

                const bridges = this.getChainBridges(fromChain.id, toChain.id);
                
                for (const bridge of bridges) {
                    for (const token of bridge.supportedTokens) {
                        const edgeId = `bridge:${fromChain.id}:${toChain.id}:${token}`;
                        
                        this.edges.set(edgeId, {
                            type: 'BRIDGE',
                            fromChain: fromChain.id,
                            toChain: toChain.id,
                            token: token,
                            bridgeName: bridge.name,
                            fee: bridge.fee,
                            timeEstimate: bridge.timeEstimate,
                            gasEstimate: bridge.gasEstimate,
                            reliability: bridge.reliability,
                            minAmount: bridge.minAmount,
                            maxAmount: bridge.maxAmount
                        });
                    }
                }
            }
        }
    }

    updateEdgeWeights(amountIn, priorityWeights = {}) {
        const defaultWeights = {
            priceImpact: 0.4,
            gasCost: 0.3,
            fee: 0.2,
            reliability: 0.1
        };

        const weights = { ...defaultWeights, ...priorityWeights };

        for (const [edgeId, edge] of this.edges) {
            if (edge.type === 'DEX_SWAP') {
                edge.weight = this.calculateDEXWeight(edge, amountIn, weights);
            } else if (edge.type === 'BRIDGE') {
                edge.weight = this.calculateBridgeWeight(edge, amountIn, weights);
            }
        }
    }

    calculateDEXWeight(edge, amountIn, weights) {
        // Price impact component
        const priceImpact = this.estimatePriceImpact(edge, amountIn);
        const priceImpactScore = Math.min(priceImpact * 10, 1); // Normalize to 0-1

        // Gas cost component (normalized by trade size)
        const gasCostUSD = this.estimateGasCostUSD(edge.gasEstimate, edge.chainId);
        const tradeSizeUSD = this.getTradeValueUSD(edge.tokenA, amountIn);
        const gasCostRatio = gasCostUSD / Math.max(tradeSizeUSD, 1);
        const gasCostScore = Math.min(gasCostRatio * 100, 1);

        // Fee component
        const feeScore = edge.fee;

        // Reliability component (inverted - higher reliability = lower weight)
        const reliabilityScore = 1 - edge.reliability;

        return (
            weights.priceImpact * priceImpactScore +
            weights.gasCost * gasCostScore +
            weights.fee * feeScore +
            weights.reliability * reliabilityScore
        );
    }

    calculateBridgeWeight(edge, amountIn, weights) {
        // Bridge fee component
        const bridgeFeeUSD = this.getBridgeFeeUSD(edge, amountIn);
        const tradeSizeUSD = this.getTradeValueUSD(edge.token, amountIn);
        const feeRatio = bridgeFeeUSD / Math.max(tradeSizeUSD, 1);

        // Time penalty (longer bridges get higher weight)
        const timePenalty = edge.timeEstimate / 3600; // Hours normalized

        // Gas cost for bridge transactions
        const gasCostUSD = this.estimateGasCostUSD(edge.gasEstimate, edge.fromChain);
        const gasCostRatio = gasCostUSD / Math.max(tradeSizeUSD, 1);

        // Reliability component
        const reliabilityScore = 1 - edge.reliability;

        return (
            weights.fee * feeRatio +
            weights.gasCost * gasCostRatio +
            weights.reliability * reliabilityScore +
            0.1 * timePenalty // Time has fixed 10% weight for bridges
        );
    }
}
```

### 2. Multi-Dimensional Pathfinding

The core pathfinding algorithm uses a modified Dijkstra's algorithm with multiple optimization criteria:

```javascript
class AdvancedPathfinder {
    constructor(liquidityGraph) {
        this.graph = liquidityGraph;
        this.cache = new Map();
        this.maxHops = 4; // Prevent excessive multi-hop routes
    }

    async findOptimalRoute(fromToken, fromChain, toToken, toChain, amountIn, preferences = {}) {
        // Check cache first
        const cacheKey = this.getCacheKey(fromToken, fromChain, toToken, toChain, amountIn);
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < 30000) { // 30 second cache
                return cached.route;
            }
        }

        // Update graph weights based on current conditions
        this.graph.updateEdgeWeights(amountIn, preferences.weights);

        // Find all possible routes
        const routes = await this.findAllRoutes(fromToken, fromChain, toToken, toChain, amountIn);

        // Score and rank routes
        const scoredRoutes = await Promise.all(
            routes.map(route => this.scoreRoute(route, amountIn, preferences))
        );

        // Sort by score (lower is better)
        scoredRoutes.sort((a, b) => a.score - b.score);

        const bestRoute = scoredRoutes[0];
        
        // Cache the result
        this.cache.set(cacheKey, {
            route: bestRoute,
            timestamp: Date.now()
        });

        return bestRoute;
    }

    async findAllRoutes(fromToken, fromChain, toToken, toChain, amountIn, maxRoutes = 10) {
        const startNode = `${fromChain}:${fromToken}`;
        const endNode = `${toChain}:${toToken}`;
        
        if (startNode === endNode) {
            return []; // Same token, no route needed
        }

        const routes = [];
        const visited = new Set();
        const queue = [{
            currentNode: startNode,
            path: [startNode],
            totalWeight: 0,
            hops: 0,
            crossChainCount: 0
        }];

        while (queue.length > 0 && routes.length < maxRoutes) {
            queue.sort((a, b) => a.totalWeight - b.totalWeight);
            const current = queue.shift();

            if (current.currentNode === endNode) {
                routes.push({
                    path: current.path,
                    totalWeight: current.totalWeight,
                    hops: current.hops,
                    crossChainCount: current.crossChainCount
                });
                continue;
            }

            if (current.hops >= this.maxHops) continue;
            if (visited.has(current.currentNode)) continue;

            visited.add(current.currentNode);

            // Get all edges from current node
            const edges = this.getEdgesFromNode(current.currentNode);

            for (const edge of edges) {
                const nextNode = this.getEdgeDestination(edge, current.currentNode);
                
                if (current.path.includes(nextNode)) continue; // Avoid cycles

                const newCrossChainCount = edge.type === 'BRIDGE' 
                    ? current.crossChainCount + 1 
                    : current.crossChainCount;

                // Limit cross-chain hops
                if (newCrossChainCount > 2) continue;

                queue.push({
                    currentNode: nextNode,
                    path: [...current.path, nextNode],
                    totalWeight: current.totalWeight + edge.weight,
                    hops: current.hops + 1,
                    crossChainCount: newCrossChainCount
                });
            }
        }

        return routes;
    }

    async scoreRoute(route, amountIn, preferences) {
        const steps = await this.convertPathToSteps(route.path, amountIn);
        
        let totalOutput = amountIn;
        let totalGasCost = 0;
        let totalTime = 0;
        let totalFees = 0;
        let minReliability = 1;

        for (const step of steps) {
            const stepResult = await this.simulateStep(step, totalOutput);
            
            totalOutput = stepResult.outputAmount;
            totalGasCost += stepResult.gasCost;
            totalTime += stepResult.timeEstimate;
            totalFees += stepResult.fees;
            minReliability = Math.min(minReliability, stepResult.reliability);
        }

        // Calculate efficiency score
        const efficiency = totalOutput / amountIn; // Output ratio
        const gasCostRatio = totalGasCost / this.getTradeValueUSD(route.path[0], amountIn);
        const feeRatio = totalFees / this.getTradeValueUSD(route.path[0], amountIn);

        // Composite score (lower is better)
        const score = (
            (2 - efficiency) * (preferences.prioritizeOutput || 0.4) +
            gasCostRatio * (preferences.prioritizeGas || 0.3) +
            feeRatio * (preferences.prioritizeFees || 0.2) +
            (1 - minReliability) * (preferences.prioritizeReliability || 0.1) +
            (totalTime / 3600) * 0.05 // Time penalty
        );

        return {
            ...route,
            score,
            steps,
            estimatedOutput: totalOutput,
            totalGasCost,
            totalTime,
            totalFees,
            reliability: minReliability,
            efficiency
        };
    }

    async convertPathToSteps(path, amountIn) {
        const steps = [];
        
        for (let i = 0; i < path.length - 1; i++) {
            const fromNode = path[i];
            const toNode = path[i + 1];
            
            const edge = this.findEdgeBetweenNodes(fromNode, toNode);
            if (!edge) {
                throw new Error(`No edge found between ${fromNode} and ${toNode}`);
            }

            steps.push({
                type: edge.type,
                fromNode,
                toNode,
                edge,
                stepIndex: i
            });
        }

        return steps;
    }

    async simulateStep(step, inputAmount) {
        if (step.type === 'DEX_SWAP') {
            return this.simulateDEXSwap(step, inputAmount);
        } else if (step.type === 'BRIDGE') {
            return this.simulateBridge(step, inputAmount);
        }
        
        throw new Error(`Unknown step type: ${step.type}`);
    }

    async simulateDEXSwap(step, inputAmount) {
        const edge = step.edge;
        
        // Get actual quote from DEX
        const quote = await this.getDEXQuote(
            edge.dexName,
            edge.tokenA,
            edge.tokenB,
            inputAmount,
            edge.chainId
        );

        return {
            outputAmount: quote.outputAmount,
            gasCost: quote.gasCostUSD,
            timeEstimate: 60, // 1 minute for DEX swaps
            fees: quote.fees,
            reliability: edge.reliability,
            priceImpact: quote.priceImpact,
            dexUsed: edge.dexName
        };
    }

    async simulateBridge(step, inputAmount) {
        const edge = step.edge;
        
        // Get bridge quote
        const quote = await this.getBridgeQuote(
            edge.bridgeName,
            edge.token,
            inputAmount,
            edge.fromChain,
            edge.toChain
        );

        return {
            outputAmount: quote.outputAmount,
            gasCost: quote.gasCostUSD,
            timeEstimate: edge.timeEstimate,
            fees: quote.bridgeFee,
            reliability: edge.reliability,
            bridgeUsed: edge.bridgeName
        };
    }
}
```

### 3. Route Splitting and Optimization

For large trades, the algorithm can split orders across multiple DEXes to minimize price impact:

```javascript
class RouteSplitter {
    constructor(pathfinder) {
        this.pathfinder = pathfinder;
        this.maxSplits = 5;
        this.minSplitSize = 100; // Minimum $100 per split
    }

    async findOptimalSplit(fromToken, fromChain, toToken, toChain, amountIn, maxSplits = this.maxSplits) {
        // First, find the best single route
        const singleRoute = await this.pathfinder.findOptimalRoute(
            fromToken, fromChain, toToken, toChain, amountIn
        );

        if (amountIn < this.minSplitSize * maxSplits) {
            return [singleRoute]; // Not worth splitting small amounts
        }

        // Find multiple routes
        const routes = await this.pathfinder.findAllRoutes(
            fromToken, fromChain, toToken, toChain, amountIn, 20
        );

        if (routes.length < 2) {
            return [singleRoute]; // Only one route available
        }

        // Dynamic programming approach to find optimal splits
        const bestSplit = await this.optimizeSplit(routes, amountIn, maxSplits);
        
        return bestSplit.efficiency > singleRoute.efficiency ? bestSplit.routes : [singleRoute];
    }

    async optimizeSplit(routes, totalAmount, maxSplits) {
        const dp = new Map();
        
        const solve = async (remainingAmount, splitsUsed, usedRoutes) => {
            const key = `${remainingAmount}-${splitsUsed}-${usedRoutes.join(',')}`;
            
            if (dp.has(key)) {
                return dp.get(key);
            }

            if (splitsUsed >= maxSplits || remainingAmount <= 0) {
                return { efficiency: 0, routes: [] };
            }

            let bestResult = { efficiency: 0, routes: [] };

            for (let i = 0; i < routes.length; i++) {
                if (usedRoutes.includes(i)) continue;

                const route = routes[i];
                const maxAmountForRoute = await this.getMaxAmountForRoute(route);
                
                for (let splitRatio = 0.1; splitRatio <= 1; splitRatio += 0.1) {
                    const splitAmount = Math.min(
                        remainingAmount * splitRatio,
                        maxAmountForRoute
                    );

                    if (splitAmount < this.minSplitSize) continue;

                    const routeResult = await this.simulateRouteWithAmount(route, splitAmount);
                    const recursiveResult = await solve(
                        remainingAmount - splitAmount,
                        splitsUsed + 1,
                        [...usedRoutes, i]
                    );

                    const combinedEfficiency = 
                        (routeResult.efficiency * splitAmount + 
                         recursiveResult.efficiency * (remainingAmount - splitAmount)) / remainingAmount;

                    if (combinedEfficiency > bestResult.efficiency) {
                        bestResult = {
                            efficiency: combinedEfficiency,
                            routes: [
                                { ...routeResult, amount: splitAmount },
                                ...recursiveResult.routes
                            ]
                        };
                    }
                }
            }

            dp.set(key, bestResult);
            return bestResult;
        };

        return await solve(totalAmount, 0, []);
    }

    async simulateRouteWithAmount(route, amount) {
        const steps = await this.pathfinder.convertPathToSteps(route.path, amount);
        
        let currentAmount = amount;
        let totalGasCost = 0;
        let totalFees = 0;
        
        for (const step of steps) {
            const result = await this.pathfinder.simulateStep(step, currentAmount);
            currentAmount = result.outputAmount;
            totalGasCost += result.gasCost;
            totalFees += result.fees;
        }

        return {
            route,
            inputAmount: amount,
            outputAmount: currentAmount,
            efficiency: currentAmount / amount,
            totalGasCost,
            totalFees
        };
    }

    async getMaxAmountForRoute(route) {
        // Calculate maximum amount this route can handle before significant slippage
        let maxAmount = Infinity;

        for (let i = 0; i < route.path.length - 1; i++) {
            const edge = this.pathfinder.findEdgeBetweenNodes(route.path[i], route.path[i + 1]);
            
            if (edge.type === 'DEX_SWAP') {
                const dexMaxAmount = await this.getDEXMaxAmount(edge);
                maxAmount = Math.min(maxAmount, dexMaxAmount);
            } else if (edge.type === 'BRIDGE') {
                maxAmount = Math.min(maxAmount, edge.maxAmount || Infinity);
            }
        }

        return maxAmount;
    }

    async getDEXMaxAmount(edge) {
        // Estimate maximum amount before 5% price impact
        const liquidity = edge.liquidity;
        const maxSlippage = 0.05; // 5%
        
        switch (edge.dexType) {
            case 'UNISWAP_V2':
                return liquidity * maxSlippage / (1 + maxSlippage);
            case 'UNISWAP_V3':
                return liquidity * 0.1; // Conservative estimate for V3
            case 'CURVE':
                return liquidity * 0.2; // Curve handles larger amounts better
            case 'BALANCER':
                return liquidity * 0.15;
            default:
                return liquidity * 0.1;
        }
    }
}
```

### 4. Real-time Route Validation

Before executing, routes are validated in real-time:

```javascript
class RouteValidator {
    constructor() {
        this.validationCache = new Map();
        this.cacheTimeout = 10000; // 10 seconds
    }

    async validateRoute(route, amountIn) {
        const cacheKey = this.getValidationCacheKey(route, amountIn);
        
        if (this.validationCache.has(cacheKey)) {
            const cached = this.validationCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.result;
            }
        }

        const validation = await this.performValidation(route, amountIn);
        
        this.validationCache.set(cacheKey, {
            result: validation,
            timestamp: Date.now()
        });

        return validation;
    }

    async performValidation(route, amountIn) {
        const validationResult = {
            isValid: true,
            warnings: [],
            errors: [],
            updatedEstimates: {}
        };

        let currentAmount = amountIn;

        for (const step of route.steps) {
            try {
                const stepValidation = await this.validateStep(step, currentAmount);
                
                if (!stepValidation.isValid) {
                    validationResult.isValid = false;
                    validationResult.errors.push({
                        step: step.stepIndex,
                        error: stepValidation.error
                    });
                    break;
                }

                // Check for significant changes from original estimates
                const originalEstimate = step.originalEstimate;
                const currentEstimate = stepValidation.currentEstimate;
                
                const priceDiff = Math.abs(
                    (currentEstimate.outputAmount - originalEstimate.outputAmount) / 
                    originalEstimate.outputAmount
                );

                if (priceDiff > 0.02) { // 2% difference
                    validationResult.warnings.push({
                        step: step.stepIndex,
                        type: 'PRICE_CHANGE',
                        originalOutput: originalEstimate.outputAmount,
                        currentOutput: currentEstimate.outputAmount,
                        difference: priceDiff
                    });
                }

                validationResult.updatedEstimates[step.stepIndex] = currentEstimate;
                currentAmount = currentEstimate.outputAmount;

            } catch (error) {
                validationResult.isValid = false;
                validationResult.errors.push({
                    step: step.stepIndex,
                    error: error.message
                });
                break;
            }
        }

        return validationResult;
    }

    async validateStep(step, inputAmount) {
        if (step.type === 'DEX_SWAP') {
            return this.validateDEXStep(step, inputAmount);
        } else if (step.type === 'BRIDGE') {
            return this.validateBridgeStep(step, inputAmount);
        }

        throw new Error(`Unknown step type: ${step.type}`);
    }

    async validateDEXStep(step, inputAmount) {
        const edge = step.edge;
        
        // Check if DEX is still operational
        const dexStatus = await this.checkDEXStatus(edge.dexName, edge.chainId);
        if (!dexStatus.operational) {
            return {
                isValid: false,
                error: `DEX ${edge.dexName} is currently not operational: ${dexStatus.reason}`
            };
        }

        // Get fresh quote
        try {
            const currentQuote = await this.getDEXQuote(
                edge.dexName,
                edge.tokenA,
                edge.tokenB,
                inputAmount,
                edge.chainId
            );

            // Check minimum output
            if (currentQuote.outputAmount <= 0) {
                return {
                    isValid: false,
                    error: 'No liquidity available for this trade size'
                };
            }

            // Check for excessive slippage
            if (currentQuote.priceImpact > 0.1) { // 10%
                return {
                    isValid: false,
                    error: `Price impact too high: ${(currentQuote.priceImpact * 100).toFixed(2)}%`
                };
            }

            return {
                isValid: true,
                currentEstimate: currentQuote
            };

        } catch (error) {
            return {
                isValid: false,
                error: `Failed to get quote from ${edge.dexName}: ${error.message}`
            };
        }
    }

    async validateBridgeStep(step, inputAmount) {
        const edge = step.edge;
        
        // Check bridge status
        const bridgeStatus = await this.checkBridgeStatus(edge.bridgeName);
        if (!bridgeStatus.operational) {
            return {
                isValid: false,
                error: `Bridge ${edge.bridgeName} is currently not operational: ${bridgeStatus.reason}`
            };
        }

        // Check amount limits
        if (inputAmount < edge.minAmount) {
            return {
                isValid: false,
                error: `Amount ${inputAmount} below minimum ${edge.minAmount}`
            };
        }

        if (inputAmount > edge.maxAmount) {
            return {
                isValid: false,
                error: `Amount ${inputAmount} above maximum ${edge.maxAmount}`
            };
        }

        // Get fresh bridge quote
        try {
            const currentQuote = await this.getBridgeQuote(
                edge.bridgeName,
                edge.token,
                inputAmount,
                edge.fromChain,
                edge.toChain
            );

            return {
                isValid: true,
                currentEstimate: currentQuote
            };

        } catch (error) {
            return {
                isValid: false,
                error: `Failed to get bridge quote: ${error.message}`
            };
        }
    }

    async checkDEXStatus(dexName, chainId) {
        // Implementation would check DEX health endpoints
        // For now, return operational status
        return { operational: true };
    }

    async checkBridgeStatus(bridgeName) {
        // Implementation would check bridge health endpoints
        return { operational: true };
    }
}
```

## Performance Optimizations

### 1. Parallel Route Discovery

```javascript
class ParallelRouteFinder {
    constructor(maxConcurrency = 10) {
        this.maxConcurrency = maxConcurrency;
        this.semaphore = new Semaphore(maxConcurrency);
    }

    async findRoutesParallel(requests) {
        const chunks = this.chunkArray(requests, this.maxConcurrency);
        const allResults = [];

        for (const chunk of chunks) {
            const chunkPromises = chunk.map(request => 
                this.semaphore.acquire().then(release => 
                    this.findRoute(request).finally(release)
                )
            );
            
            const chunkResults = await Promise.allSettled(chunkPromises);
            allResults.push(...chunkResults);
        }

        return allResults
            .filter(result => result.status === 'fulfilled')
            .map(result => result.value);
    }

    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }
}
```

### 2. Intelligent Caching

```javascript
class RoutingCache {
    constructor() {
        this.routeCache = new LRU({ max: 1000 });
        this.quoteCache = new LRU({ max: 5000 });
        this.liquidityCache = new LRU({ max: 2000 });
    }

    getCachedRoute(key, maxAge = 30000) {
        const cached = this.routeCache.get(key);
        if (cached && Date.now() - cached.timestamp < maxAge) {
            return cached.route;
        }
        return null;
    }

    cacheRoute(key, route) {
        this.routeCache.set(key, {
            route,
            timestamp: Date.now()
        });
    }

    getCachedQuote(dexName, tokenA, tokenB, amountIn, maxAge = 15000) {
        const key = `${dexName}:${tokenA}:${tokenB}:${amountIn}`;
        const cached = this.quoteCache.get(key);
        
        if (cached && Date.now() - cached.timestamp < maxAge) {
            return cached.quote;
        }
        return null;
    }

    cacheQuote(dexName, tokenA, tokenB, amountIn, quote) {
        const key = `${dexName}:${tokenA}:${tokenB}:${amountIn}`;
        this.quoteCache.set(key, {
            quote,
            timestamp: Date.now()
        });
    }
}
```

## Advanced Features

### Machine Learning Integration

The routing algorithm incorporates ML models for:

1. **Gas Price Prediction**: Predicting optimal transaction timing
2. **Slippage Estimation**: More accurate slippage predictions based on historical data
3. **Liquidity Prediction**: Anticipating liquidity changes
4. **Route Success Probability**: Estimating the likelihood of successful execution

### Dynamic Rebalancing

For routes that cross multiple chains or take significant time, the algorithm supports dynamic rebalancing:

```javascript
class DynamicRebalancer {
    async monitorAndRebalance(routeExecution) {
        const monitoring = setInterval(async () => {
            const currentState = await this.checkExecutionState(routeExecution);
            
            if (this.shouldRebalance(currentState)) {
                const newRoute = await this.findAlternativeRoute(
                    currentState.remainingSteps,
                    currentState.currentAmount
                );
                
                if (newRoute.efficiency > currentState.projectedEfficiency * 1.05) {
                    await this.executeRebalance(routeExecution, newRoute);
                }
            }
        }, 30000); // Check every 30 seconds

        routeExecution.on('complete', () => clearInterval(monitoring));
        routeExecution.on('failed', () => clearInterval(monitoring));
    }
}
```

## Best Practices

### Route Selection Criteria

1. **Minimize Price Impact**: Prioritize routes with lower slippage
2. **Optimize Gas Efficiency**: Consider gas costs relative to trade size
3. **Balance Speed vs Cost**: Offer fast and economical route options
4. **Ensure Reliability**: Factor in DEX and bridge uptime history
5. **Liquidity Awareness**: Validate sufficient liquidity before execution

### Error Handling

1. **Graceful Degradation**: Fall back to simpler routes if complex ones fail
2. **Real-time Validation**: Verify routes before execution
3. **Partial Execution**: Support partial fills for large orders
4. **Rollback Capability**: Ability to reverse failed multi-step routes

### Performance Monitoring

1. **Route Success Rates**: Track execution success by route type
2. **Slippage Accuracy**: Monitor predicted vs actual slippage
3. **Gas Estimation**: Validate gas estimates against actual usage
4. **Execution Time**: Track route completion times

## Resources

- [DEX Aggregation Overview](overview.md)
- [Supported DEXes](supported-dexes.md)
- [Quote System](quote-system.md)
- [Router Types](router-types.md)
- [Performance Benchmarks](../resources/benchmarks.md)
