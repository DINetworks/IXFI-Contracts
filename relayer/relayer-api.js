const express = require('express');
const IXFIRelayer = require('./IXFIRelayer');
const config = require('./config.json');

/**
 * IXFI Relayer Monitoring API
 * Provides REST endpoints for monitoring and managing the relayer
 */
class RelayerAPI {
    constructor(relayer) {
        this.relayer = relayer;
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', async (req, res) => {
            try {
                const health = await this.relayer.getHealth();
                res.json(health);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Get failed transactions
        this.app.get('/failed-transactions', (req, res) => {
            try {
                const failedTxs = this.relayer.getFailedTransactions();
                res.json({
                    count: failedTxs.length,
                    transactions: failedTxs
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Trigger manual compensation for a specific transaction
        this.app.post('/compensate/:commandId', async (req, res) => {
            try {
                const { commandId } = req.params;
                const result = await this.relayer.triggerManualCompensation(commandId);
                res.json(result);
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        });

        // Get relayer status
        this.app.get('/status', (req, res) => {
            res.json({
                isRunning: this.relayer.isRunning,
                processedEvents: this.relayer.processedEvents.size,
                failedTransactions: this.relayer.failedTransactions.size,
                uptime: process.uptime(),
                memory: process.memoryUsage()
            });
        });

        // Emergency stop endpoint (for manual intervention)
        this.app.post('/emergency-stop', async (req, res) => {
            try {
                await this.relayer.stop();
                res.json({ message: 'Relayer stopped successfully' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Get specific failed transaction details
        this.app.get('/failed-transactions/:commandId', (req, res) => {
            try {
                const { commandId } = req.params;
                const failedTxs = this.relayer.getFailedTransactions();
                const transaction = failedTxs.find(tx => tx.commandId === commandId);
                
                if (!transaction) {
                    return res.status(404).json({ error: 'Transaction not found' });
                }
                
                res.json(transaction);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    start(port = 3000) {
        this.app.listen(port, () => {
            console.log(`🌐 Relayer API server running on port ${port}`);
            console.log(`📊 Health check: http://localhost:${port}/health`);
            console.log(`❌ Failed transactions: http://localhost:${port}/failed-transactions`);
            console.log(`📈 Status: http://localhost:${port}/status`);
        });
    }
}

// Start the relayer and API if this file is run directly
if (require.main === module) {
    async function main() {
        try {
            console.log('🚀 Starting IXFI Relayer with Failure Recovery...');
            
            const relayer = new IXFIRelayer(config);
            const api = new RelayerAPI(relayer);
            
            // Start API server
            const port = config.healthCheckPort || 3000;
            api.start(port);
            
            // Start relayer
            await relayer.start();
            
        } catch (error) {
            console.error('❌ Failed to start relayer:', error);
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

module.exports = RelayerAPI;
