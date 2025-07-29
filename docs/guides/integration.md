# Integration Guides

Welcome to the IXFI Protocol integration documentation. This section provides comprehensive guides for integrating IXFI's cross-chain infrastructure into your applications, wallets, exchanges, and dApps.

## Quick Start Guide

### Prerequisites

Before integrating with IXFI Protocol, ensure you have:

1. **Node.js Environment** (v16 or later)
2. **Web3 Library** (ethers.js v5+ or web3.js)
3. **Smart Contract ABIs** (provided in artifacts/)
4. **API Keys** for supported blockchains
5. **Basic Understanding** of cross-chain operations

### Installation

```bash
# Install required dependencies
npm install ethers @ixfi/sdk axios

# For React applications
npm install @ixfi/react-hooks

# For advanced features
npm install @ixfi/multicall @ixfi/gas-oracle
```

### Basic Setup

```javascript
import { ethers } from 'ethers';
import { IXFIGateway, CrossChainAggregator } from '@ixfi/sdk';

// Initialize providers for supported chains
const providers = {
    ethereum: new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC),
    polygon: new ethers.JsonRpcProvider(process.env.POLYGON_RPC),
    bsc: new ethers.JsonRpcProvider(process.env.BSC_RPC),
    avalanche: new ethers.JsonRpcProvider(process.env.AVALANCHE_RPC)
};

// Initialize IXFI Gateway
const gateway = new IXFIGateway({
    providers,
    defaultChain: 'ethereum',
    relayerEndpoint: 'https://relayer.ixfi.com'
});

// Initialize Cross-Chain Aggregator
const aggregator = new CrossChainAggregator({
    gateway,
    supportedDEXs: ['uniswap', 'sushiswap', 'pancakeswap']
});
```

## Integration Types

### 1. Wallet Integration

Perfect for wallet providers wanting to offer cross-chain functionality.

#### Features Included:
- Cross-chain token transfers
- Multi-chain balance aggregation
- Gasless transactions
- DEX aggregation

#### Sample Implementation:

```javascript
class IXFIWalletIntegration {
    constructor(walletProvider) {
        this.wallet = walletProvider;
        this.gateway = new IXFIGateway({
            signer: walletProvider.getSigner()
        });
    }

    async getMultiChainBalance(userAddress) {
        const chains = ['ethereum', 'polygon', 'bsc', 'avalanche'];
        const balances = {};

        for (const chain of chains) {
            try {
                const balance = await this.gateway.getBalance(userAddress, chain);
                balances[chain] = {
                    native: balance.native,
                    ixfi: balance.ixfi,
                    tokens: balance.tokens
                };
            } catch (error) {
                console.error(`Failed to get balance for ${chain}:`, error);
                balances[chain] = null;
            }
        }

        return balances;
    }

    async transferCrossChain(params) {
        const {
            fromChain,
            toChain,
            token,
            amount,
            recipientAddress,
            gasless = false
        } = params;

        try {
            if (gasless) {
                return await this.gateway.transferWithGasCredits({
                    fromChain,
                    toChain,
                    token,
                    amount,
                    recipient: recipientAddress
                });
            } else {
                return await this.gateway.transfer({
                    fromChain,
                    toChain,
                    token,
                    amount,
                    recipient: recipientAddress
                });
            }
        } catch (error) {
            throw new Error(`Cross-chain transfer failed: ${error.message}`);
        }
    }

    async swapAndBridge(params) {
        const {
            fromChain,
            toChain,
            fromToken,
            toToken,
            amountIn,
            recipientAddress,
            slippageTolerance = 0.5
        } = params;

        // Get optimal route
        const route = await this.gateway.getOptimalRoute({
            fromChain,
            toChain,
            fromToken,
            toToken,
            amountIn,
            slippageTolerance
        });

        // Execute swap and bridge
        return await this.gateway.executeRoute({
            route,
            recipient: recipientAddress
        });
    }
}

// Usage in wallet
const ixfiIntegration = new IXFIWalletIntegration(walletProvider);

// Get user balances across all chains
const balances = await ixfiIntegration.getMultiChainBalance(userAddress);

// Transfer tokens cross-chain
const transfer = await ixfiIntegration.transferCrossChain({
    fromChain: 'ethereum',
    toChain: 'polygon',
    token: 'USDC',
    amount: ethers.parseUnits('100', 6),
    recipientAddress: '0x...',
    gasless: true
});
```

### 2. Exchange Integration

For centralized and decentralized exchanges wanting to offer cross-chain trading.

#### Features Included:
- Cross-chain order routing
- Liquidity aggregation
- Automated market making
- Risk management

#### Sample Implementation:

```javascript
class IXFIExchangeIntegration {
    constructor(exchangeConfig) {
        this.config = exchangeConfig;
        this.gateway = new IXFIGateway(exchangeConfig.gateway);
        this.aggregator = new CrossChainAggregator(exchangeConfig.aggregator);
        this.orderBook = new Map();
    }

    async createCrossChainOrder(order) {
        const {
            trader,
            fromChain,
            toChain,
            fromToken,
            toToken,
            amountIn,
            minAmountOut,
            deadline
        } = order;

        // Validate order
        await this.validateOrder(order);

        // Get best execution route
        const route = await this.aggregator.getBestRoute({
            fromChain,
            toChain,
            fromToken,
            toToken,
            amountIn
        });

        if (route.outputAmount < minAmountOut) {
            throw new Error('Insufficient output amount');
        }

        // Create order in system
        const orderId = this.generateOrderId();
        this.orderBook.set(orderId, {
            ...order,
            route,
            status: 'pending',
            createdAt: Date.now()
        });

        return {
            orderId,
            route,
            estimatedOutput: route.outputAmount,
            estimatedTime: route.estimatedTime,
            fees: route.fees
        };
    }

    async executeOrder(orderId) {
        const order = this.orderBook.get(orderId);
        if (!order) {
            throw new Error('Order not found');
        }

        try {
            // Update order status
            order.status = 'executing';
            this.orderBook.set(orderId, order);

            // Execute the cross-chain route
            const result = await this.aggregator.executeRoute(order.route);

            // Update order with results
            order.status = 'completed';
            order.executionHash = result.transactionHash;
            order.actualOutput = result.outputAmount;
            order.completedAt = Date.now();
            
            this.orderBook.set(orderId, order);

            return result;
        } catch (error) {
            order.status = 'failed';
            order.error = error.message;
            order.failedAt = Date.now();
            this.orderBook.set(orderId, order);
            
            throw error;
        }
    }

    async getOrderStatus(orderId) {
        const order = this.orderBook.get(orderId);
        if (!order) {
            throw new Error('Order not found');
        }

        // If order is executing, check cross-chain status
        if (order.status === 'executing' && order.executionHash) {
            const status = await this.gateway.getTransactionStatus(order.executionHash);
            
            if (status.completed) {
                order.status = 'completed';
                order.actualOutput = status.outputAmount;
                order.completedAt = Date.now();
                this.orderBook.set(orderId, order);
            }
        }

        return {
            orderId,
            status: order.status,
            createdAt: order.createdAt,
            completedAt: order.completedAt,
            route: order.route,
            actualOutput: order.actualOutput,
            error: order.error
        };
    }

    async validateOrder(order) {
        // Check if chains are supported
        const supportedChains = await this.gateway.getSupportedChains();
        if (!supportedChains.includes(order.fromChain) || !supportedChains.includes(order.toChain)) {
            throw new Error('Unsupported chain');
        }

        // Check token support
        const supportedTokens = await this.gateway.getSupportedTokens(order.fromChain);
        if (!supportedTokens.includes(order.fromToken)) {
            throw new Error('Unsupported token');
        }

        // Check deadline
        if (order.deadline && order.deadline < Date.now()) {
            throw new Error('Order deadline passed');
        }

        return true;
    }

    generateOrderId() {
        return `ixfi_order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Usage in exchange
const exchange = new IXFIExchangeIntegration({
    gateway: { /* gateway config */ },
    aggregator: { /* aggregator config */ }
});

// Create cross-chain order
const order = await exchange.createCrossChainOrder({
    trader: '0x...',
    fromChain: 'ethereum',
    toChain: 'bsc',
    fromToken: 'USDC',
    toToken: 'USDT',
    amountIn: ethers.parseUnits('1000', 6),
    minAmountOut: ethers.parseUnits('995', 18),
    deadline: Date.now() + (30 * 60 * 1000) // 30 minutes
});

// Execute order
const result = await exchange.executeOrder(order.orderId);
```

### 3. DeFi Protocol Integration

For DeFi protocols wanting to expand to multiple chains.

#### Features Included:
- Cross-chain yield farming
- Multi-chain governance
- Liquidity migration
- Risk distribution

#### Sample Implementation:

```javascript
class IXFIDeFiIntegration {
    constructor(protocolConfig) {
        this.config = protocolConfig;
        this.gateway = new IXFIGateway(protocolConfig.gateway);
        this.multicall = new MulticallLibrary(protocolConfig.multicall);
        this.positions = new Map();
    }

    async deployToNewChain(chainName, deploymentConfig) {
        const {
            governanceToken,
            stakingContract,
            liquidityPools,
            initialParams
        } = deploymentConfig;

        try {
            // Deploy governance token on new chain
            const tokenDeployment = await this.gateway.deployContract({
                chain: chainName,
                contractName: 'GovernanceToken',
                constructorArgs: [
                    governanceToken.name,
                    governanceToken.symbol,
                    governanceToken.initialSupply
                ]
            });

            // Deploy staking contract
            const stakingDeployment = await this.gateway.deployContract({
                chain: chainName,
                contractName: 'StakingContract',
                constructorArgs: [
                    tokenDeployment.address,
                    initialParams.stakingRewards
                ]
            });

            // Set up liquidity pools
            const poolDeployments = [];
            for (const pool of liquidityPools) {
                const poolDeployment = await this.gateway.deployContract({
                    chain: chainName,
                    contractName: 'LiquidityPool',
                    constructorArgs: [
                        pool.tokenA,
                        pool.tokenB,
                        pool.fee
                    ]
                });
                poolDeployments.push(poolDeployment);
            }

            // Register new chain in protocol
            await this.registerNewChain({
                chainName,
                contracts: {
                    governanceToken: tokenDeployment.address,
                    stakingContract: stakingDeployment.address,
                    liquidityPools: poolDeployments.map(p => p.address)
                }
            });

            return {
                chainName,
                deployments: {
                    governanceToken: tokenDeployment,
                    stakingContract: stakingDeployment,
                    liquidityPools: poolDeployments
                }
            };

        } catch (error) {
            throw new Error(`Deployment to ${chainName} failed: ${error.message}`);
        }
    }

    async migrateLiquidity(migrationParams) {
        const {
            fromChain,
            toChain,
            poolAddress,
            amount,
            userAddress
        } = migrationParams;

        // Get user's liquidity position
        const position = await this.getUserPosition(fromChain, poolAddress, userAddress);
        
        if (position.amount < amount) {
            throw new Error('Insufficient liquidity position');
        }

        try {
            // Remove liquidity from source chain
            const removeTx = await this.gateway.callContract({
                chain: fromChain,
                contract: poolAddress,
                method: 'removeLiquidity',
                args: [amount, userAddress]
            });

            // Wait for removal confirmation
            await this.gateway.waitForTransaction(removeTx.hash);

            // Add liquidity to destination chain
            const addTx = await this.gateway.callContract({
                chain: toChain,
                contract: this.getPoolAddress(toChain, poolAddress),
                method: 'addLiquidity',
                args: [amount, userAddress]
            });

            // Update position tracking
            await this.updateUserPosition({
                userAddress,
                fromChain,
                toChain,
                poolAddress,
                amount
            });

            return {
                removeTx: removeTx.hash,
                addTx: addTx.hash,
                migratedAmount: amount
            };

        } catch (error) {
            throw new Error(`Liquidity migration failed: ${error.message}`);
        }
    }

    async getCrossChainYield(userAddress) {
        const supportedChains = await this.gateway.getSupportedChains();
        const yieldData = {};

        // Get yield data from all chains in parallel
        const yieldPromises = supportedChains.map(async (chain) => {
            try {
                const chainYield = await this.getChainYield(chain, userAddress);
                return { chain, yield: chainYield };
            } catch (error) {
                console.error(`Failed to get yield for ${chain}:`, error);
                return { chain, yield: null };
            }
        });

        const results = await Promise.all(yieldPromises);
        
        results.forEach(({ chain, yield: yieldInfo }) => {
            yieldData[chain] = yieldInfo;
        });

        return {
            totalYield: this.calculateTotalYield(yieldData),
            chainBreakdown: yieldData,
            recommendations: this.getYieldOptimizationRecommendations(yieldData)
        };
    }

    async executeMultiChainGovernance(proposal) {
        const {
            proposalId,
            targetChains,
            actions,
            executionDelay
        } = proposal;

        // Validate proposal across all target chains
        for (const chain of targetChains) {
            await this.validateGovernanceAction(chain, actions[chain]);
        }

        // Execute actions on all chains
        const executionResults = {};
        
        for (const chain of targetChains) {
            try {
                const result = await this.executeGovernanceAction(chain, actions[chain]);
                executionResults[chain] = {
                    success: true,
                    transactionHash: result.hash,
                    executedAt: Date.now()
                };
            } catch (error) {
                executionResults[chain] = {
                    success: false,
                    error: error.message,
                    failedAt: Date.now()
                };
            }
        }

        return {
            proposalId,
            executionResults,
            overallSuccess: Object.values(executionResults).every(r => r.success)
        };
    }

    async getChainYield(chain, userAddress) {
        const contracts = this.config.chainContracts[chain];
        
        // Use multicall for efficient data fetching
        const calls = [
            {
                target: contracts.stakingContract,
                callData: this.encodeCall('getStakingRewards', [userAddress])
            },
            {
                target: contracts.liquidityPool,
                callData: this.encodeCall('getLiquidityRewards', [userAddress])
            },
            {
                target: contracts.farmingContract,
                callData: this.encodeCall('getFarmingRewards', [userAddress])
            }
        ];

        const results = await this.multicall.aggregate(chain, calls);
        
        return {
            stakingRewards: this.decodeResult(results[0]),
            liquidityRewards: this.decodeResult(results[1]),
            farmingRewards: this.decodeResult(results[2]),
            totalRewards: this.calculateTotalRewards(results)
        };
    }

    calculateTotalYield(yieldData) {
        let total = 0;
        
        Object.values(yieldData).forEach(chainYield => {
            if (chainYield && chainYield.totalRewards) {
                total += parseFloat(ethers.formatEther(chainYield.totalRewards));
            }
        });

        return total;
    }

    getYieldOptimizationRecommendations(yieldData) {
        const recommendations = [];
        
        // Find best yielding chains
        const sortedChains = Object.entries(yieldData)
            .filter(([, data]) => data && data.totalRewards)
            .sort(([, a], [, b]) => b.totalRewards - a.totalRewards);

        if (sortedChains.length > 1) {
            const [bestChain, bestYield] = sortedChains[0];
            const [worstChain, worstYield] = sortedChains[sortedChains.length - 1];
            
            if (bestYield.totalRewards > worstYield.totalRewards * 1.2) {
                recommendations.push({
                    type: 'migrate',
                    from: worstChain,
                    to: bestChain,
                    expectedIncrease: bestYield.totalRewards - worstYield.totalRewards,
                    reason: 'Higher yield available'
                });
            }
        }

        return recommendations;
    }
}

// Usage in DeFi protocol
const defiProtocol = new IXFIDeFiIntegration({
    gateway: { /* gateway config */ },
    multicall: { /* multicall config */ },
    chainContracts: { /* contract addresses per chain */ }
});

// Deploy to new chain
const deployment = await defiProtocol.deployToNewChain('arbitrum', {
    governanceToken: {
        name: 'Protocol Token',
        symbol: 'PROTO',
        initialSupply: ethers.parseEther('1000000')
    },
    stakingContract: {},
    liquidityPools: [
        { tokenA: 'USDC', tokenB: 'PROTO', fee: 3000 }
    ],
    initialParams: {
        stakingRewards: ethers.parseEther('100')
    }
});

// Get cross-chain yield for user
const yieldData = await defiProtocol.getCrossChainYield('0x...');
```

### 4. Mobile App Integration

For mobile applications requiring cross-chain functionality.

#### Features Included:
- Mobile-optimized SDK
- Offline transaction caching
- Push notifications
- Simplified UX patterns

#### Sample Implementation:

```javascript
// React Native integration
import { IXFIMobileSDK } from '@ixfi/mobile-sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PushNotification from 'react-native-push-notification';

class IXFIMobileIntegration {
    constructor() {
        this.sdk = new IXFIMobileSDK({
            storage: AsyncStorage,
            notifications: PushNotification
        });
        
        this.initializeNotifications();
    }

    async initialize(walletPrivateKey) {
        try {
            await this.sdk.initialize({
                privateKey: walletPrivateKey,
                enableOfflineMode: true,
                enableNotifications: true
            });

            // Set up event listeners
            this.sdk.on('transactionComplete', this.handleTransactionComplete.bind(this));
            this.sdk.on('crossChainConfirmed', this.handleCrossChainConfirmed.bind(this));
            this.sdk.on('error', this.handleError.bind(this));

            return true;
        } catch (error) {
            console.error('Failed to initialize IXFI SDK:', error);
            return false;
        }
    }

    async quickSwap(params) {
        const {
            fromToken,
            toToken,
            amount,
            fromChain,
            toChain
        } = params;

        try {
            // Show loading state
            this.showLoading('Finding best route...');

            // Get optimal route
            const route = await this.sdk.getOptimalRoute({
                fromToken,
                toToken,
                amount,
                fromChain,
                toChain
            });

            // Show route confirmation
            const confirmed = await this.showRouteConfirmation(route);
            if (!confirmed) return null;

            // Execute swap
            this.updateLoading('Executing swap...');
            const result = await this.sdk.executeSwap(route);

            // Cache transaction for offline viewing
            await this.cacheTransaction(result);

            this.hideLoading();
            this.showSuccess('Swap initiated successfully!');

            return result;

        } catch (error) {
            this.hideLoading();
            this.showError(`Swap failed: ${error.message}`);
            throw error;
        }
    }

    async getPortfolio() {
        try {
            // Try to get cached data first
            const cachedPortfolio = await this.getCachedPortfolio();
            
            // Return cached data immediately for better UX
            if (cachedPortfolio) {
                // Fetch fresh data in background
                this.refreshPortfolioInBackground();
                return cachedPortfolio;
            }

            // Fetch fresh data if no cache
            const portfolio = await this.sdk.getMultiChainPortfolio();
            await this.cachePortfolio(portfolio);
            
            return portfolio;

        } catch (error) {
            console.error('Failed to get portfolio:', error);
            
            // Return cached data as fallback
            return await this.getCachedPortfolio() || {
                totalValue: 0,
                chains: {},
                lastUpdated: null
            };
        }
    }

    async enableNotifications() {
        try {
            const permission = await PushNotification.requestPermissions();
            if (permission.alert) {
                await this.sdk.subscribeToNotifications({
                    transactionUpdates: true,
                    priceAlerts: true,
                    crossChainConfirmations: true
                });
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to enable notifications:', error);
            return false;
        }
    }

    initializeNotifications() {
        PushNotification.configure({
            onNotification: (notification) => {
                if (notification.userInteraction) {
                    // User tapped notification
                    this.handleNotificationTap(notification);
                }
            }
        });
    }

    handleTransactionComplete(transaction) {
        PushNotification.localNotification({
            title: 'Transaction Complete',
            message: `Your ${transaction.type} transaction has been confirmed`,
            data: { transactionId: transaction.id }
        });
    }

    handleCrossChainConfirmed(confirmation) {
        PushNotification.localNotification({
            title: 'Cross-Chain Transfer Complete',
            message: `Your tokens have arrived on ${confirmation.destinationChain}`,
            data: { confirmationId: confirmation.id }
        });
    }

    handleError(error) {
        if (error.severity === 'high') {
            PushNotification.localNotification({
                title: 'Transaction Failed',
                message: error.message,
                data: { errorId: error.id }
            });
        }
    }

    async cacheTransaction(transaction) {
        const cached = await AsyncStorage.getItem('ixfi_transactions') || '[]';
        const transactions = JSON.parse(cached);
        
        transactions.unshift({
            ...transaction,
            cachedAt: Date.now()
        });

        // Keep only last 50 transactions
        const trimmed = transactions.slice(0, 50);
        
        await AsyncStorage.setItem('ixfi_transactions', JSON.stringify(trimmed));
    }

    async getCachedPortfolio() {
        try {
            const cached = await AsyncStorage.getItem('ixfi_portfolio');
            if (cached) {
                const portfolio = JSON.parse(cached);
                
                // Check if cache is still fresh (5 minutes)
                const isFresh = Date.now() - portfolio.cachedAt < 5 * 60 * 1000;
                if (isFresh) {
                    return portfolio.data;
                }
            }
            return null;
        } catch (error) {
            console.error('Failed to get cached portfolio:', error);
            return null;
        }
    }

    async cachePortfolio(portfolio) {
        try {
            const cacheData = {
                data: portfolio,
                cachedAt: Date.now()
            };
            
            await AsyncStorage.setItem('ixfi_portfolio', JSON.stringify(cacheData));
        } catch (error) {
            console.error('Failed to cache portfolio:', error);
        }
    }

    async refreshPortfolioInBackground() {
        try {
            const portfolio = await this.sdk.getMultiChainPortfolio();
            await this.cachePortfolio(portfolio);
            
            // Emit event for UI to refresh
            this.sdk.emit('portfolioUpdated', portfolio);
        } catch (error) {
            console.error('Background portfolio refresh failed:', error);
        }
    }

    // UI helper methods
    showLoading(message) {
        // Implement loading UI
        console.log('Loading:', message);
    }

    updateLoading(message) {
        // Update loading message
        console.log('Loading update:', message);
    }

    hideLoading() {
        // Hide loading UI
        console.log('Loading complete');
    }

    showSuccess(message) {
        // Show success message
        console.log('Success:', message);
    }

    showError(message) {
        // Show error message
        console.log('Error:', message);
    }

    async showRouteConfirmation(route) {
        // Show route confirmation dialog
        return new Promise((resolve) => {
            // Implement confirmation UI
            resolve(true); // User confirmed
        });
    }

    handleNotificationTap(notification) {
        // Handle notification tap - navigate to relevant screen
        const { data } = notification;
        
        if (data.transactionId) {
            // Navigate to transaction details
            console.log('Navigate to transaction:', data.transactionId);
        } else if (data.confirmationId) {
            // Navigate to confirmation details
            console.log('Navigate to confirmation:', data.confirmationId);
        }
    }
}

// Usage in React Native app
const ixfiMobile = new IXFIMobileIntegration();

// Initialize with user's wallet
await ixfiMobile.initialize(userPrivateKey);

// Enable notifications
await ixfiMobile.enableNotifications();

// Quick swap functionality
const swapResult = await ixfiMobile.quickSwap({
    fromToken: 'USDC',
    toToken: 'USDT',
    amount: ethers.parseUnits('100', 6),
    fromChain: 'ethereum',
    toChain: 'polygon'
});

// Get user portfolio
const portfolio = await ixfiMobile.getPortfolio();
```

## Next Steps

1. **Choose Your Integration Type**: Select the integration guide that best fits your use case
2. **Set Up Development Environment**: Install required dependencies and tools
3. **Get API Access**: Register for IXFI Protocol API access and obtain necessary keys
4. **Start with Basic Examples**: Begin with simple cross-chain transfers before moving to complex integrations
5. **Test on Testnets**: Use testnet environments for development and testing
6. **Deploy to Production**: Follow our deployment guide for production release

## Support Resources

- **Technical Documentation**: [API Reference](../api-reference/)
- **Code Examples**: [Integration Examples](../examples/)
- **Developer Support**: [Discord Community](https://discord.gg/ixfi)
- **Bug Reports**: [GitHub Issues](https://github.com/ixfi/contracts/issues)
- **Feature Requests**: [Feature Request Form](https://forms.ixfi.com/features)

## Advanced Topics

- [Custom Relayer Setup](custom-relayer.md)
- [Gas Optimization Strategies](gas-optimization.md)
- [Security Best Practices](security-practices.md)
- [Monitoring and Analytics](monitoring.md)
- [Troubleshooting Guide](troubleshooting.md)
