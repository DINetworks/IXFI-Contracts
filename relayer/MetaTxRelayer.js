const { ethers } = require('ethers');
const express = require('express');

/**
 * @title MetaTxRelayer
 * @notice Relayer service that coordinates between CrossFi GasCreditVault and MetaTxGateways on other chains
 * @dev Checks gas credits on CrossFi, executes meta-transactions on target chains, then deducts credits
 */
class MetaTxRelayer {
    constructor(config) {
        this.config = config;
        this.providers = new Map();
        this.wallets = new Map();
        this.vaultContract = null;
        this.gatewayContracts = new Map();
        
        // Metrics for monitoring
        this.metrics = {
            totalTransactions: 0,
            successfulTransactions: 0,
            failedTransactions: 0,
            totalGasUsed: 0,
            creditsConsumed: 0,
            errors: 0,
            startTime: Date.now()
        };

        this.init();
    }

    async init() {
        console.log('🔄 Initializing MetaTxRelayer...');
        
        try {
            // Setup providers for all chains
            for (const [chainName, chainConfig] of Object.entries(this.config.chains)) {
                console.log(`🔗 Connecting to ${chainName}...`);
                
                const provider = new ethers.JsonRpcProvider(chainConfig.rpc);
                this.providers.set(chainName, provider);
                
                const wallet = new ethers.Wallet(this.config.relayerPrivateKey, provider);
                this.wallets.set(chainName, wallet);
                
                console.log(`✅ ${chainName} connected - Relayer: ${wallet.address}`);
            }

            // Setup CrossFi GasCreditVault
            const crossfiProvider = this.providers.get('crossfi');
            const crossfiWallet = this.wallets.get('crossfi');
            
            this.vaultContract = new ethers.Contract(
                this.config.chains.crossfi.gasCreditVault,
                this.getVaultABI(),
                crossfiWallet
            );

            console.log('✅ GasCreditVault connected on CrossFi');

            // Setup MetaTxGateways on all chains
            for (const [chainName, chainConfig] of Object.entries(this.config.chains)) {
                if (chainConfig.metaTxGateway) {
                    const wallet = this.wallets.get(chainName);
                    const gateway = new ethers.Contract(
                        chainConfig.metaTxGateway,
                        this.getGatewayABI(),
                        wallet
                    );
                    this.gatewayContracts.set(chainName, gateway);
                    console.log(`✅ MetaTxGateway connected on ${chainName}`);
                }
            }

            // Start health monitoring server
            this.startHealthServer();
            
            console.log('🎉 MetaTxRelayer initialized successfully!');
            console.log(`🏥 Health endpoint: http://localhost:${this.config.healthPort || 3001}/health`);
            
        } catch (error) {
            console.error('❌ Failed to initialize MetaTxRelayer:', error);
            throw error;
        }
    }

    /**
     * Execute a meta-transaction with gas credit management
     * @param {Object} request - Meta-transaction request
     * @param {string} request.targetChain - Target chain for execution
     * @param {Object} request.metaTx - Meta-transaction data
     * @param {string} request.signature - User's signature
     * @returns {Object} Execution result
     */
    async executeMetaTransaction(request) {
        const { targetChain, metaTx, signature } = request;
        const startTime = Date.now();
        
        console.log(`\n🚀 Processing meta-transaction for user: ${metaTx.from}`);
        console.log(`📍 Target chain: ${targetChain}`);
        console.log(`🎯 Target contract: ${metaTx.to}`);
        
        try {
            this.metrics.totalTransactions++;
            
            // Step 1: Estimate gas required for the transaction
            const gasEstimate = await this.estimateGas(targetChain, metaTx);
            console.log(`⛽ Estimated gas: ${gasEstimate}`);
            
            // Step 2: Check if user has enough credits on CrossFi
            const hasEnoughCredits = await this.checkGasCredits(metaTx.from, gasEstimate);
            if (!hasEnoughCredits) {
                console.log('❌ Insufficient gas credits');
                this.metrics.failedTransactions++;
                return {
                    success: false,
                    error: 'Insufficient gas credits',
                    gasEstimate,
                    userAddress: metaTx.from
                };
            }
            
            console.log('✅ User has sufficient gas credits');
            
            // Step 3: Execute the meta-transaction on target chain
            const executionResult = await this.executeOnTargetChain(targetChain, metaTx, signature);
            
            if (!executionResult.success) {
                console.log('❌ Meta-transaction execution failed');
                this.metrics.failedTransactions++;
                return {
                    success: false,
                    error: 'Transaction execution failed',
                    details: executionResult.error,
                    gasEstimate
                };
            }
            
            console.log('✅ Meta-transaction executed successfully');
            console.log(`⛽ Actual gas used: ${executionResult.gasUsed}`);
            
            // Step 4: Deduct gas credits from user's balance on CrossFi
            const creditDeductionResult = await this.deductGasCredits(metaTx.from, executionResult.gasUsed);
            
            if (!creditDeductionResult.success) {
                console.log('⚠️  Warning: Failed to deduct gas credits');
                // Note: Transaction succeeded but credit deduction failed
                // This should be handled by monitoring/alerting systems
            }
            
            // Update metrics
            this.metrics.successfulTransactions++;
            this.metrics.totalGasUsed += Number(executionResult.gasUsed);
            this.metrics.creditsConsumed += Number(executionResult.gasUsed);
            
            const processingTime = Date.now() - startTime;
            console.log(`✅ Meta-transaction completed in ${processingTime}ms`);
            
            return {
                success: true,
                transactionHash: executionResult.transactionHash,
                gasUsed: executionResult.gasUsed,
                processingTime,
                chainId: (await this.providers.get(targetChain).getNetwork()).chainId
            };
            
        } catch (error) {
            console.error('❌ Meta-transaction processing failed:', error);
            this.metrics.failedTransactions++;
            this.metrics.errors++;
            
            return {
                success: false,
                error: error.message,
                userAddress: metaTx.from,
                targetChain
            };
        }
    }

    /**
     * Check if user has enough gas credits on CrossFi
     * @param {string} userAddress - User's address
     * @param {number} gasRequired - Gas required for transaction
     * @returns {boolean} True if user has enough credits
     */
    async checkGasCredits(userAddress, gasRequired) {
        try {
            const hasEnough = await this.vaultContract.hasEnoughCredits(userAddress, gasRequired);
            const userCredits = await this.vaultContract.getCreditBalance(userAddress);
            
            console.log(`💳 User credits: ${userCredits}`);
            console.log(`💰 Credits needed: ${await this.vaultContract.calculateCreditsForGas(gasRequired)}`);
            
            return hasEnough;
        } catch (error) {
            console.error('❌ Failed to check gas credits:', error);
            return false;
        }
    }

    /**
     * Execute meta-transaction on target chain
     * @param {string} targetChain - Target chain name
     * @param {Object} metaTx - Meta-transaction data
     * @param {string} signature - User's signature
     * @returns {Object} Execution result
     */
    async executeOnTargetChain(targetChain, metaTx, signature) {
        try {
            const gateway = this.gatewayContracts.get(targetChain);
            if (!gateway) {
                throw new Error(`No gateway found for chain: ${targetChain}`);
            }
            
            console.log(`📡 Executing on ${targetChain}...`);
            
            // Estimate gas for the meta-transaction
            const gasEstimate = await gateway.executeMetaTransaction.estimateGas(metaTx, signature);
            console.log(`⛽ Gateway gas estimate: ${gasEstimate}`);
            
            // Execute the transaction
            const tx = await gateway.executeMetaTransaction(metaTx, signature, {
                gasLimit: gasEstimate * 120n / 100n // Add 20% buffer
            });
            
            console.log(`📝 Transaction sent: ${tx.hash}`);
            
            // Wait for confirmation
            const receipt = await tx.wait();
            
            return {
                success: receipt.status === 1,
                transactionHash: tx.hash,
                gasUsed: receipt.gasUsed,
                blockNumber: receipt.blockNumber
            };
            
        } catch (error) {
            console.error(`❌ Failed to execute on ${targetChain}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Deduct gas credits from user's balance on CrossFi
     * @param {string} userAddress - User's address
     * @param {bigint} gasUsed - Actual gas used
     * @returns {Object} Deduction result
     */
    async deductGasCredits(userAddress, gasUsed) {
        try {
            console.log(`💳 Deducting credits for ${gasUsed} gas...`);
            
            // Call the vault contract to consume credits
            const tx = await this.vaultContract.consumeCredits(userAddress, gasUsed);
            const receipt = await tx.wait();
            
            console.log(`✅ Credits deducted - TX: ${tx.hash}`);
            
            return {
                success: receipt.status === 1,
                transactionHash: tx.hash
            };
            
        } catch (error) {
            console.error('❌ Failed to deduct gas credits:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Estimate gas for a meta-transaction
     * @param {string} targetChain - Target chain name
     * @param {Object} metaTx - Meta-transaction data
     * @returns {number} Gas estimate
     */
    async estimateGas(targetChain, metaTx) {
        try {
            // Simple estimation based on data size and base costs
            const baseGas = 21000; // Base transaction cost
            const dataGas = metaTx.data ? (metaTx.data.length - 2) / 2 * 16 : 0; // ~16 gas per byte
            const callGas = 50000; // Estimated call overhead
            
            return baseGas + dataGas + callGas;
        } catch (error) {
            console.error('❌ Failed to estimate gas:', error);
            return 100000; // Conservative default
        }
    }

    /**
     * Start health monitoring server
     */
    startHealthServer() {
        const app = express();
        app.use(express.json());
        
        // Health check endpoint
        app.get('/health', (req, res) => {
            const uptime = Date.now() - this.metrics.startTime;
            const successRate = this.metrics.totalTransactions > 0 
                ? (this.metrics.successfulTransactions / this.metrics.totalTransactions * 100).toFixed(2)
                : 0;
            
            res.json({
                status: 'healthy',
                uptime: Math.floor(uptime / 1000),
                metrics: {
                    ...this.metrics,
                    successRate: `${successRate}%`,
                    avgGasPerTx: this.metrics.successfulTransactions > 0 
                        ? Math.floor(this.metrics.totalGasUsed / this.metrics.successfulTransactions)
                        : 0
                },
                chains: Object.keys(this.config.chains),
                relayerAddress: this.wallets.get('crossfi')?.address
            });
        });
        
        // Submit meta-transaction endpoint
        app.post('/execute', async (req, res) => {
            try {
                const { targetChain, metaTx, signature } = req.body;
                
                if (!targetChain || !metaTx || !signature) {
                    return res.status(400).json({
                        error: 'Missing required fields: targetChain, metaTx, signature'
                    });
                }
                
                const result = await this.executeMetaTransaction({
                    targetChain,
                    metaTx,
                    signature
                });
                
                res.json(result);
                
            } catch (error) {
                console.error('❌ API error:', error);
                res.status(500).json({
                    error: 'Internal server error',
                    message: error.message
                });
            }
        });
        
        const port = this.config.healthPort || 3001;
        app.listen(port, () => {
            console.log(`🏥 Health server running on port ${port}`);
        });
    }

    /**
     * Get contract ABIs
     */
    getVaultABI() {
        return [
            "function hasEnoughCredits(address user, uint256 estimatedGas) external view returns (bool)",
            "function getCreditBalance(address user) external view returns (uint256)",
            "function calculateCreditsForGas(uint256 gasAmount) external view returns (uint256)",
            "function consumeCredits(address user, uint256 gasUsed) external returns (bool)",
            "event CreditsUsed(address indexed user, address indexed gateway, uint256 creditsUsed, uint256 gasUsed)"
        ];
    }

    getGatewayABI() {
        return [
            "function executeMetaTransaction(tuple(address from, address to, uint256 value, bytes data, uint256 nonce, uint256 deadline) metaTx, bytes signature) external returns (bool)",
            "function getNonce(address user) external view returns (uint256)",
            "event MetaTransactionExecuted(address indexed user, address indexed relayer, address indexed target, uint256 gasUsed, bool success)"
        ];
    }
}

module.exports = MetaTxRelayer;
