const express = require('express');
const { ethers } = require('ethers');
const MetaTxRelayer = require('./MetaTxRelayer');

/**
 * MetaTx Relayer API
 * Provides REST endpoints for executing meta-transactions and monitoring the relayer
 */
class MetaTxAPI {
    constructor(relayer) {
        this.relayer = relayer;
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });

        // CORS headers for web3 dApps
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            const uptime = Date.now() - this.relayer.metrics.startTime;
            const successRate = this.relayer.metrics.totalTransactions > 0 
                ? (this.relayer.metrics.successfulTransactions / this.relayer.metrics.totalTransactions * 100).toFixed(2)
                : 0;
            
            res.json({
                status: 'healthy',
                service: 'MetaTx Relayer',
                uptime: Math.floor(uptime / 1000),
                metrics: {
                    ...this.relayer.metrics,
                    successRate: `${successRate}%`,
                    avgGasPerTx: this.relayer.metrics.successfulTransactions > 0 
                        ? Math.floor(this.relayer.metrics.totalGasUsed / this.relayer.metrics.successfulTransactions)
                        : 0
                },
                chains: Object.keys(this.relayer.config.chains),
                relayerAddress: this.relayer.wallets.get('crossfi')?.address
            });
        });

        // Execute single meta-transaction
        this.app.post('/execute', async (req, res) => {
            try {
                const { targetChain, metaTx, signature } = req.body;
                
                if (!targetChain || !metaTx || !signature) {
                    return res.status(400).json({
                        error: 'Missing required fields: targetChain, metaTx, signature'
                    });
                }

                // Validate metaTx structure
                if (!metaTx.from || !metaTx.nonce || !metaTx.deadline) {
                    return res.status(400).json({
                        error: 'Invalid metaTx structure. Required: from, nonce, deadline'
                    });
                }
                
                const result = await this.relayer.executeMetaTransaction({
                    targetChain,
                    metaTx,
                    signature
                });
                
                res.json(result);
                
            } catch (error) {
                console.error('❌ Execute API error:', error);
                res.status(500).json({
                    error: 'Internal server error',
                    message: error.message
                });
            }
        });

        // Execute batch meta-transactions
        this.app.post('/execute-batch', async (req, res) => {
            try {
                const { targetChain, metaTxs, signature, from, nonce, deadline } = req.body;
                
                if (!targetChain || !metaTxs || !signature || !from || nonce === undefined || !deadline) {
                    return res.status(400).json({
                        error: 'Missing required fields: targetChain, metaTxs, signature, from, nonce, deadline'
                    });
                }

                if (!Array.isArray(metaTxs) || metaTxs.length === 0) {
                    return res.status(400).json({
                        error: 'metaTxs must be a non-empty array'
                    });
                }

                // Validate each transaction in the batch
                for (let i = 0; i < metaTxs.length; i++) {
                    const tx = metaTxs[i];
                    if (!tx.to || tx.value === undefined || !tx.data) {
                        return res.status(400).json({
                            error: `Invalid transaction at index ${i}. Required: to, value, data`
                        });
                    }
                }
                
                const result = await this.relayer.executeBatchMetaTransactions({
                    targetChain,
                    metaTxs,
                    signature,
                    from,
                    nonce,
                    deadline
                });
                
                res.json(result);
                
            } catch (error) {
                console.error('❌ Batch execute API error:', error);
                res.status(500).json({
                    error: 'Internal server error',
                    message: error.message
                });
            }
        });

        // Check gas credits for a user
        this.app.get('/credits/:userAddress', async (req, res) => {
            try {
                const { userAddress } = req.params;
                
                if (!ethers.isAddress(userAddress)) {
                    return res.status(400).json({
                        error: 'Invalid user address'
                    });
                }

                const credits = await this.relayer.vaultContract.getCreditBalance(userAddress);
                const ixfiBalance = await this.relayer.vaultContract.getDepositBalance(userAddress);
                
                res.json({
                    userAddress,
                    creditBalance: credits.toString(),
                    ixfiBalance: ixfiBalance.toString()
                });
                
            } catch (error) {
                console.error('❌ Credits API error:', error);
                res.status(500).json({
                    error: 'Internal server error',
                    message: error.message
                });
            }
        });

        // Estimate gas for batch transaction
        this.app.post('/estimate-batch', async (req, res) => {
            try {
                const { targetChain, metaTxs, from, signature, nonce, deadline } = req.body;
                
                if (!targetChain || !metaTxs || !from) {
                    return res.status(400).json({
                        error: 'Missing required fields: targetChain, metaTxs, from'
                    });
                }

                // Encode meta-transaction data for estimation
                const metaTxData = ethers.AbiCoder.defaultAbiCoder().encode(
                    ["tuple(address to,uint256 value,bytes data)[]"],
                    [metaTxs]
                );
                
                const gasEstimate = await this.relayer.estimateBatchGas(
                    targetChain, from, metaTxData, signature || '0x', nonce || 0, deadline || 0
                );

                // Get gas price and calculate cost
                const provider = this.relayer.providers.get(targetChain);
                const feeData = await provider.getFeeData();
                const gasPrice = feeData.gasPrice;
                const nativeTokenPrice = await this.relayer.getNativeTokenPrice(targetChain);
                
                // Calculate required credits
                const creditsRequired = await this.relayer.vaultContract.calculateCreditsForGas(
                    gasEstimate,
                    gasPrice,
                    ethers.parseUnits(nativeTokenPrice.toString(), 8)
                );
                
                res.json({
                    gasEstimate,
                    gasPrice: gasPrice.toString(),
                    gasCostNative: (BigInt(gasEstimate) * gasPrice).toString(),
                    nativeTokenPrice,
                    creditsRequired: creditsRequired.toString(),
                    targetChain
                });
                
            } catch (error) {
                console.error('❌ Estimate API error:', error);
                res.status(500).json({
                    error: 'Internal server error',
                    message: error.message
                });
            }
        });

        // Get supported chains
        this.app.get('/chains', (req, res) => {
            const chains = Object.keys(this.relayer.config.chains).map(chainName => {
                const config = this.relayer.config.chains[chainName];
                return {
                    name: chainName,
                    chainId: config.chainId,
                    rpc: config.rpc,
                    hasGateway: !!config.metaTxGateway,
                    gatewayAddress: config.metaTxGateway,
                    isGasCreditHub: chainName === 'crossfi'
                };
            });
            
            res.json({ chains });
        });

        // Get relayer status and configuration
        this.app.get('/status', (req, res) => {
            const status = {
                relayerAddress: this.relayer.wallets.get('crossfi')?.address,
                chains: Object.keys(this.relayer.config.chains),
                metrics: this.relayer.metrics,
                config: {
                    healthPort: this.relayer.config.healthPort,
                    supportedChains: Object.keys(this.relayer.config.chains).length
                }
            };
            
            res.json(status);
        });

        // Error handling middleware
        this.app.use((error, req, res, next) => {
            console.error('❌ Unhandled API error:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
            });
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Endpoint not found',
                availableEndpoints: [
                    'GET /health',
                    'POST /execute',
                    'POST /execute-batch',
                    'GET /credits/:userAddress',
                    'POST /estimate-batch',
                    'GET /chains',
                    'GET /status'
                ]
            });
        });
    }

    start(port = 3001) {
        this.app.listen(port, () => {
            console.log(`🌐 MetaTx Relayer API server running on port ${port}`);
            console.log(`📊 Health check: http://localhost:${port}/health`);
            console.log(`🚀 Execute endpoint: http://localhost:${port}/execute`);
            console.log(`📦 Batch execute: http://localhost:${port}/execute-batch`);
            console.log(`💳 Check credits: http://localhost:${port}/credits/:userAddress`);
            console.log(`📈 Status: http://localhost:${port}/status`);
        });
    }
}

// Start the relayer and API if this file is run directly
if (require.main === module) {
    async function main() {
        try {
            console.log('🚀 Starting MetaTx Relayer with API...');
            
            // Load configuration
            let config;
            try {
                config = require('./meta-tx-config.json');
            } catch (error) {
                console.error('❌ Failed to load meta-tx-config.json');
                console.log('💡 Please copy meta-tx-config.example.json to meta-tx-config.json and configure it');
                process.exit(1);
            }
            
            const relayer = new MetaTxRelayer(config);
            const api = new MetaTxAPI(relayer);
            
            // Start API server
            const port = config.apiPort || 3001;
            api.start(port);
            
        } catch (error) {
            console.error('❌ Failed to start MetaTx Relayer API:', error);
            process.exit(1);
        }
    }

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Received SIGINT, shutting down gracefully...');
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
        process.exit(0);
    });

    main().catch(console.error);
}

module.exports = MetaTxAPI;
