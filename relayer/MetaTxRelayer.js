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
     * Execute batch meta-transactions with gas credit management
     * @param {Object} request - Batch meta-transaction request
     * @param {string} request.targetChain - Target chain for execution
     * @param {Array} request.metaTxs - Array of meta-transaction data
     * @param {string} request.signature - User's signature for the batch
     * @param {string} request.from - User's address
     * @param {number} request.nonce - User's nonce
     * @param {number} request.deadline - Transaction deadline
     * @returns {Object} Execution result
     */
    async executeBatchMetaTransactions(request) {
        const { targetChain, metaTxs, signature, from, nonce, deadline } = request;
        const startTime = Date.now();
        
        console.log(`\n🚀 Processing batch meta-transaction for user: ${from}`);
        console.log(`📍 Target chain: ${targetChain}`);
        console.log(`📦 Batch size: ${metaTxs.length} transactions`);
        
        try {
            this.metrics.totalTransactions++;
            
            // Encode meta-transaction data for the batch
            const metaTxData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["tuple(address to,uint256 value,bytes data)[]"],
                [metaTxs]
            );
            
            // Step 1: Estimate total gas required for the batch
            const gasEstimate = await this.estimateBatchGas(targetChain, from, metaTxData, signature, nonce, deadline);
            console.log(`⛽ Estimated batch gas: ${gasEstimate}`);
            
            // Step 2: Check if user has enough credits on CrossFi
            const hasEnoughCredits = await this.checkGasCreditsForBatch(from, targetChain, gasEstimate);
            if (!hasEnoughCredits) {
                console.log('❌ Insufficient gas credits for batch');
                this.metrics.failedTransactions++;
                return {
                    success: false,
                    error: 'Insufficient gas credits',
                    gasEstimate,
                    userAddress: from
                };
            }
            
            console.log('✅ User has sufficient gas credits for batch');
            
            // Step 3: Execute the batch meta-transaction on target chain
            const executionResult = await this.executeBatchOnTargetChain(
                targetChain, from, metaTxData, signature, nonce, deadline
            );
            
            if (!executionResult.success) {
                console.log('❌ Batch meta-transaction execution failed');
                this.metrics.failedTransactions++;
                return {
                    success: false,
                    error: 'Batch transaction execution failed',
                    details: executionResult.error,
                    gasEstimate
                };
            }
            
            console.log('✅ Batch meta-transaction executed successfully');
            console.log(`⛽ Actual gas used: ${executionResult.gasUsed}`);
            console.log(`📊 Batch ID: ${executionResult.batchId}`);
            
            // Step 4: Deduct gas credits from user's balance on CrossFi
            const creditDeductionResult = await this.deductGasCreditsForBatch(
                from, targetChain, executionResult.gasUsed
            );
            
            if (!creditDeductionResult.success) {
                console.log('⚠️  Warning: Failed to deduct gas credits for batch');
                // Note: Transaction succeeded but credit deduction failed
            }
            
            // Update metrics
            this.metrics.successfulTransactions++;
            this.metrics.totalGasUsed += Number(executionResult.gasUsed);
            this.metrics.creditsConsumed += Number(executionResult.gasUsed);
            
            const processingTime = Date.now() - startTime;
            console.log(`✅ Batch meta-transaction completed in ${processingTime}ms`);
            
            return {
                success: true,
                transactionHash: executionResult.transactionHash,
                batchId: executionResult.batchId,
                gasUsed: executionResult.gasUsed,
                successes: executionResult.successes,
                processingTime,
                chainId: (await this.providers.get(targetChain).getNetwork()).chainId
            };
            
        } catch (error) {
            console.error('❌ Batch meta-transaction processing failed:', error);
            this.metrics.failedTransactions++;
            this.metrics.errors++;
            
            return {
                success: false,
                error: error.message,
                userAddress: from,
                targetChain
            };
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
        // Convert single transaction to batch format
        const batchRequest = {
            targetChain: request.targetChain,
            metaTxs: [request.metaTx],
            signature: request.signature,
            from: request.metaTx.from,
            nonce: request.metaTx.nonce,
            deadline: request.metaTx.deadline
        };
        
        const result = await this.executeBatchMetaTransactions(batchRequest);
        
        // Convert batch result back to single transaction format
        if (result.success) {
            return {
                success: true,
                transactionHash: result.transactionHash,
                gasUsed: result.gasUsed,
                processingTime: result.processingTime,
                chainId: result.chainId
            };
        }
        
        return result;
    }

    /**
     * Check if user has enough gas credits for batch transaction
     * @param {string} userAddress - User's address
     * @param {string} targetChain - Target chain name
     * @param {number} gasRequired - Gas required for batch transaction
     * @returns {boolean} True if user has enough credits
     */
    async checkGasCreditsForBatch(userAddress, targetChain, gasRequired) {
        try {
            // Get current gas price on target chain
            const provider = this.providers.get(targetChain);
            const feeData = await provider.getFeeData();
            const gasPrice = feeData.gasPrice;
            
            // Get native token price (simplified - in production, use actual price feeds)
            const nativeTokenPrice = await this.getNativeTokenPrice(targetChain);
            
            // Calculate required credits using the vault's function
            const creditsRequired = await this.vaultContract.calculateCreditsForGas(
                gasRequired,
                gasPrice,
                ethers.parseUnits(nativeTokenPrice.toString(), 8) // Convert to 8 decimals
            );
            
            const hasEnough = await this.vaultContract.hasEnoughCredits(userAddress, creditsRequired);
            const userCredits = await this.vaultContract.getCreditBalance(userAddress);
            
            console.log(`💳 User credits: ${userCredits}`);
            console.log(`💰 Credits needed: ${creditsRequired}`);
            console.log(`⛽ Gas price: ${ethers.formatUnits(gasPrice, 'gwei')} Gwei`);
            console.log(`💵 ${targetChain} token price: $${nativeTokenPrice}`);
            
            return hasEnough;
        } catch (error) {
            console.error('❌ Failed to check gas credits for batch:', error);
            return false;
        }
    }

    /**
     * Get native token price in USD (simplified implementation)
     * @param {string} chainName - Chain name
     * @returns {number} Price in USD
     */
    async getNativeTokenPrice(chainName) {
        // Simplified price mapping - in production, use real price feeds
        const prices = {
            'ethereum': 3000,
            'polygon': 1.2,
            'bsc': 600,
            'avalanche': 40,
            'arbitrum': 3000,
            'optimism': 3000,
            'crossfi': 0.2 // XFI price
        };
        
        return prices[chainName] || 1;
    }

    /**
     * Estimate gas for batch meta-transaction
     * @param {string} targetChain - Target chain name
     * @param {string} from - User address
     * @param {string} metaTxData - Encoded batch data
     * @param {string} signature - User signature
     * @param {number} nonce - User nonce
     * @param {number} deadline - Transaction deadline
     * @returns {number} Estimated gas
     */
    async estimateBatchGas(targetChain, from, metaTxData, signature, nonce, deadline) {
        try {
            const gateway = this.gatewayContracts.get(targetChain);
            if (!gateway) {
                throw new Error(`No gateway found for chain: ${targetChain}`);
            }
            
            const gasEstimate = await gateway.executeMetaTransactions.estimateGas(
                from, metaTxData, signature, nonce, deadline
            );
            
            return Number(gasEstimate);
        } catch (error) {
            console.error(`❌ Failed to estimate batch gas on ${targetChain}:`, error);
            // Return conservative estimate
            return 500000;
        }
    }

    /**
     * Execute batch meta-transaction on target chain
     * @param {string} targetChain - Target chain name
     * @param {string} from - User address
     * @param {string} metaTxData - Encoded batch data
     * @param {string} signature - User signature
     * @param {number} nonce - User nonce
     * @param {number} deadline - Transaction deadline
     * @returns {Object} Execution result
     */
    async executeBatchOnTargetChain(targetChain, from, metaTxData, signature, nonce, deadline) {
        try {
            const gateway = this.gatewayContracts.get(targetChain);
            if (!gateway) {
                throw new Error(`No gateway found for chain: ${targetChain}`);
            }
            
            const tx = await gateway.executeMetaTransactions(
                from, metaTxData, signature, nonce, deadline
            );
            
            const receipt = await tx.wait();
            
            // Extract batch ID from BatchTransactionExecuted event
            const batchEvent = receipt.logs.find(log => {
                try {
                    const parsed = gateway.interface.parseLog(log);
                    return parsed.name === 'BatchTransactionExecuted';
                } catch (e) {
                    return false;
                }
            });
            
            let batchId = null;
            if (batchEvent) {
                const parsed = gateway.interface.parseLog(batchEvent);
                batchId = Number(parsed.args.batchId);
            }
            
            // Get successes from transaction result
            const successes = await gateway.getBatchSuccesses(batchId);
            
            return {
                success: true,
                transactionHash: receipt.hash,
                gasUsed: Number(receipt.gasUsed),
                batchId,
                successes
            };
            
        } catch (error) {
            console.error(`❌ Failed to execute batch on ${targetChain}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Deduct gas credits for batch transaction
     * @param {string} userAddress - User's address
     * @param {string} targetChain - Target chain name
     * @param {number} gasUsed - Actual gas used
     * @returns {Object} Deduction result
     */
    async deductGasCreditsForBatch(userAddress, targetChain, gasUsed) {
        try {
            // Get actual gas price used
            const provider = this.providers.get(targetChain);
            const feeData = await provider.getFeeData();
            const gasPrice = feeData.gasPrice;
            
            // Get native token price
            const nativeTokenPrice = await this.getNativeTokenPrice(targetChain);
            
            // Calculate credits to deduct
            const creditsToDeduct = await this.vaultContract.calculateCreditsForGas(
                gasUsed,
                gasPrice,
                ethers.parseUnits(nativeTokenPrice.toString(), 8)
            );
            
            const result = await this.vaultContract.consumeCredits(userAddress, creditsToDeduct);
            await result.wait();
            
            console.log(`✅ Deducted ${creditsToDeduct} credits from user ${userAddress}`);
            
            return {
                success: true,
                creditsDeducted: creditsToDeduct
            };
            
        } catch (error) {
            console.error('❌ Failed to deduct gas credits for batch:', error);
            return {
                success: false,
                error: error.message
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
            console.log(`💰 Credits needed: ${gasRequired}`);
            
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
            "function hasEnoughCredits(address user, uint256 gasUsd) external view returns (bool)",
            "function getCreditBalance(address user) external view returns (uint256)",
            "function calculateCreditsForGas(uint256 gasUsed, uint256 gasPrice, uint256 nativeTokenPriceUsd) external pure returns (uint256)",
            "function calculateCreditsFromIXFI(uint256 ixfiAmount) external view returns (uint256)",
            "function consumeCredits(address user, uint256 gasUsd) external returns (bool)",
            "function deposit(uint256 amount) external",
            "function deposit() external payable",
            "function withdraw(uint256 amount) external",
            "function setGatewayAuthorization(address gateway, bool authorized) external",
            "function getDepositBalance(address user) external view returns (uint256)",
            "function getIXFIPrice() external view returns (uint128 price, uint128 timestamp)",
            "event CreditsUsed(address indexed user, address indexed gateway, uint256 creditsUsed, uint256 gasUsd)",
            "event Deposited(address indexed user, uint256 ixfiAmount, uint256 creditsAdded)",
            "event Withdrawn(address indexed user, uint256 ixfiAmount, uint256 creditsDeducted)"
        ];
    }

    getGatewayABI() {
        return [
            "function executeMetaTransactions(address from, bytes metaTxData, bytes signature, uint256 nonce, uint256 deadline) external returns (bool[] memory successes)",
            "function _executeMetaTransaction(address from, tuple(address to, uint256 value, bytes data) metaTx) external returns (bool success)",
            "function getNonce(address user) external view returns (uint256)",
            "function setRelayerAuthorization(address relayer, bool authorized) external",
            "function isRelayerAuthorized(address relayer) external view returns (bool)",
            "function getBatchTransactionLog(uint256 batchId) external view returns (tuple(address user, address relayer, bytes metaTxData, uint256 gasUsed, uint256 timestamp, bool[] successes))",
            "function getBatchSuccesses(uint256 batchId) external view returns (bool[] memory)",
            "function getBatchTransactions(uint256 batchId) external view returns (tuple(address to, uint256 value, bytes data)[] memory)",
            "function getTotalBatchCount() external view returns (uint256)",
            "event MetaTransactionExecuted(address indexed user, address indexed relayer, address indexed target, bool success)",
            "event BatchTransactionExecuted(uint256 indexed batchId, address indexed user, address indexed relayer, uint256 gasUsed, uint256 transactionCount)"
        ];
    }
}

module.exports = MetaTxRelayer;
