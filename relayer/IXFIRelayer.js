const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

/**
 * IXFI GMP Relayer
 * Monitors events on source chains and executes commands on destination chains
 */
class IXFIRelayer {
    constructor(config) {
        this.config = config;
        this.providers = {};
        this.contracts = {};
        this.signers = {};
        this.isRunning = false;
        this.processedEvents = new Set();
        this.failedTransactions = new Map(); // Track failed transactions for retry/compensation
        this.compensationQueue = new Map(); // Queue for compensation transactions
        
        // Load processed events from file
        this.loadProcessedEvents();
        this.loadFailedTransactions();
        
        this.setupProviders();
        this.setupContracts();
        this.setupSigners();
    }

    setupProviders() {
        console.log('🔌 Setting up providers...');
        for (const chainName of Object.keys(this.config.chains)) {
            const chainConfig = this.config.chains[chainName];
            this.providers[chainName] = new ethers.JsonRpcProvider(chainConfig.rpc);
            console.log(`✅ Provider for ${chainName}: ${chainConfig.rpc}`);
        }
    }

    setupContracts() {
        console.log('📄 Setting up contracts...');
        const ixfiAbi = this.loadIXFIABI();
        
        for (const chainName of Object.keys(this.config.chains)) {
            const chainConfig = this.config.chains[chainName];
            this.contracts[chainName] = new ethers.Contract(
                chainConfig.ixfiAddress,
                ixfiAbi,
                this.providers[chainName]
            );
            console.log(`✅ Contract for ${chainName}: ${chainConfig.ixfiAddress}`);
        }
    }

    setupSigners() {
        console.log('🔑 Setting up signers...');
        for (const chainName of Object.keys(this.config.chains)) {
            this.signers[chainName] = new ethers.Wallet(
                this.config.relayerPrivateKey,
                this.providers[chainName]
            );
            console.log(`✅ Signer for ${chainName}: ${this.signers[chainName].address}`);
        }
    }

    loadIXFIABI() {
        try {
            const artifactPath = path.join(__dirname, '../artifacts/contracts/IXFI.sol/IXFI.json');
            const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
            return artifact.abi;
        } catch (error) {
            console.error('❌ Failed to load IXFI ABI:', error.message);
            throw error;
        }
    }

    loadProcessedEvents() {
        try {
            const filePath = path.join(__dirname, 'processed_events.json');
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                this.processedEvents = new Set(data);
                console.log(`📁 Loaded ${this.processedEvents.size} processed events`);
            }
        } catch (error) {
            console.log('📁 No previous processed events found, starting fresh');
        }
    }

    loadFailedTransactions() {
        try {
            const filePath = path.join(__dirname, 'failed_transactions.json');
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                this.failedTransactions = new Map(data);
                console.log(`📁 Loaded ${this.failedTransactions.size} failed transactions`);
            }
        } catch (error) {
            console.log('📁 No previous failed transactions found, starting fresh');
        }
    }

    saveFailedTransactions() {
        try {
            const filePath = path.join(__dirname, 'failed_transactions.json');
            fs.writeFileSync(filePath, JSON.stringify([...this.failedTransactions], null, 2));
        } catch (error) {
            console.error('❌ Failed to save failed transactions:', error.message);
        }
    }

    saveProcessedEvents() {
        try {
            const filePath = path.join(__dirname, 'processed_events.json');
            fs.writeFileSync(filePath, JSON.stringify([...this.processedEvents], null, 2));
        } catch (error) {
            console.error('❌ Failed to save processed events:', error.message);
        }
    }

    async start() {
        console.log('🚀 Starting IXFI Relayer...');
        this.isRunning = true;

        // Verify relayer is whitelisted on all chains
        await this.verifyRelayerStatus();

        // Start monitoring all chains
        const monitoringPromises = Object.keys(this.config.chains).map(chainName => 
            this.monitorChain(chainName)
        );

        // Start periodic cleanup
        this.startPeriodicCleanup();

        // Start retry/compensation processor
        this.startRetryProcessor();

        await Promise.all(monitoringPromises);
    }

    async verifyRelayerStatus() {
        console.log('🔍 Verifying relayer status on all chains...');
        
        for (const chainName of Object.keys(this.config.chains)) {
            try {
                const isWhitelisted = await this.contracts[chainName].isWhitelistedRelayer(
                    this.signers[chainName].address
                );
                
                if (isWhitelisted) {
                    console.log(`✅ Relayer whitelisted on ${chainName}`);
                } else {
                    console.log(`❌ Relayer NOT whitelisted on ${chainName}`);
                    throw new Error(`Relayer not whitelisted on ${chainName}`);
                }
            } catch (error) {
                console.error(`❌ Failed to verify relayer status on ${chainName}:`, error.message);
                throw error;
            }
        }
    }

    async monitorChain(chainName) {
        console.log(`👀 Starting to monitor ${chainName}...`);
        
        const contract = this.contracts[chainName];
        const provider = this.providers[chainName];

        // Get the latest block number
        let lastProcessedBlock = await provider.getBlockNumber() - 10; // Start 10 blocks back for safety

        while (this.isRunning) {
            try {
                const currentBlock = await provider.getBlockNumber();
                
                if (currentBlock > lastProcessedBlock) {
                    await this.processBlocks(chainName, lastProcessedBlock + 1, currentBlock);
                    lastProcessedBlock = currentBlock;
                }
                
                // Wait before next check
                await this.sleep(this.config.pollingInterval || 5000);
                
            } catch (error) {
                console.error(`❌ Error monitoring ${chainName}:`, error.message);
                await this.sleep(10000); // Wait longer on error
            }
        }
    }

    async processBlocks(sourceChain, fromBlock, toBlock) {
        console.log(`🔍 Processing blocks ${fromBlock}-${toBlock} on ${sourceChain}`);
        
        const contract = this.contracts[sourceChain];

        try {
            // Get ContractCall events
            const contractCallFilter = contract.filters.ContractCall();
            const contractCallEvents = await contract.queryFilter(contractCallFilter, fromBlock, toBlock);
            
            // Get ContractCallWithToken events
            const contractCallWithTokenFilter = contract.filters.ContractCallWithToken();
            const contractCallWithTokenEvents = await contract.queryFilter(contractCallWithTokenFilter, fromBlock, toBlock);

            // Get TokenSent events
            const tokenSentFilter = contract.filters.TokenSent();
            const tokenSentEvents = await contract.queryFilter(tokenSentFilter, fromBlock, toBlock);

            // Process each event type
            for (const event of contractCallEvents) {
                await this.handleContractCall(sourceChain, event);
            }

            for (const event of contractCallWithTokenEvents) {
                await this.handleContractCallWithToken(sourceChain, event);
            }

            for (const event of tokenSentEvents) {
                await this.handleTokenSent(sourceChain, event);
            }

        } catch (error) {
            console.error(`❌ Error processing blocks ${fromBlock}-${toBlock} on ${sourceChain}:`, error.message);
        }
    }

    async handleContractCall(sourceChain, event) {
        const eventId = `${event.transactionHash}-${event.logIndex}`;
        
        if (this.processedEvents.has(eventId)) {
            return; // Already processed
        }

        console.log(`📞 Processing ContractCall from ${sourceChain}`);
        console.log(`   Sender: ${event.args.sender}`);
        console.log(`   Destination: ${event.args.destinationChain}`);
        console.log(`   Contract: ${event.args.destinationContractAddress}`);

        try {
            const destinationChain = event.args.destinationChain;
            
            if (!this.config.chains[destinationChain]) {
                console.log(`⚠️  Destination chain ${destinationChain} not supported, skipping`);
                return;
            }

            // Create command to approve contract call
            const commandId = ethers.id(`${event.transactionHash}-${event.logIndex}`);
            const commands = [{
                commandType: 0, // COMMAND_APPROVE_CONTRACT_CALL
                data: ethers.AbiCoder.defaultAbiCoder().encode(
                    ['string', 'string', 'address', 'bytes32', 'bytes32', 'uint256', 'bytes'],
                    [
                        sourceChain,
                        event.args.sender,
                        event.args.destinationContractAddress,
                        event.args.payloadHash,
                        event.transactionHash,
                        event.logIndex,
                        event.args.payload // Include the actual payload
                    ]
                )
            }];

            await this.executeCommands(destinationChain, commandId, commands, {
                type: 'ContractCall',
                sourceChain,
                event: event.args
            });
            
            this.processedEvents.add(eventId);
            this.saveProcessedEvents();
            
        } catch (error) {
            console.error(`❌ Failed to handle ContractCall:`, error.message);
        }
    }

    async handleContractCallWithToken(sourceChain, event) {
        const eventId = `${event.transactionHash}-${event.logIndex}`;
        
        if (this.processedEvents.has(eventId)) {
            return; // Already processed
        }

        console.log(`💰 Processing ContractCallWithToken from ${sourceChain}`);
        console.log(`   Sender: ${event.args.sender}`);
        console.log(`   Destination: ${event.args.destinationChain}`);
        console.log(`   Contract: ${event.args.destinationContractAddress}`);
        console.log(`   Amount: ${ethers.formatEther(event.args.amount)} ${event.args.symbol}`);

        try {
            const destinationChain = event.args.destinationChain;
            
            if (!this.config.chains[destinationChain]) {
                console.log(`⚠️  Destination chain ${destinationChain} not supported, skipping`);
                return;
            }

            // Create command to approve contract call with mint
            const commandId = ethers.id(`${event.transactionHash}-${event.logIndex}`);
            const commands = [{
                commandType: 1, // COMMAND_APPROVE_CONTRACT_CALL_WITH_MINT
                data: ethers.AbiCoder.defaultAbiCoder().encode(
                    ['string', 'string', 'address', 'bytes32', 'string', 'uint256', 'bytes32', 'uint256', 'bytes'],
                    [
                        sourceChain,
                        event.args.sender,
                        event.args.destinationContractAddress,
                        event.args.payloadHash,
                        event.args.symbol,
                        event.args.amount,
                        event.transactionHash,
                        event.logIndex,
                        event.args.payload // Include the actual payload
                    ]
                )
            }];

            await this.executeCommands(destinationChain, commandId, commands, {
                type: 'ContractCallWithToken',
                sourceChain,
                event: event.args
            });
            
            this.processedEvents.add(eventId);
            this.saveProcessedEvents();
            
        } catch (error) {
            console.error(`❌ Failed to handle ContractCallWithToken:`, error.message);
        }
    }

    async handleTokenSent(sourceChain, event) {
        const eventId = `${event.transactionHash}-${event.logIndex}`;
        
        if (this.processedEvents.has(eventId)) {
            return; // Already processed
        }

        console.log(`💸 Processing TokenSent from ${sourceChain}`);
        console.log(`   Sender: ${event.args.sender}`);
        console.log(`   Destination: ${event.args.destinationChain}`);
        console.log(`   To: ${event.args.destinationAddress}`);
        console.log(`   Amount: ${ethers.formatEther(event.args.amount)} ${event.args.symbol}`);

        try {
            const destinationChain = event.args.destinationChain;
            
            if (!this.config.chains[destinationChain]) {
                console.log(`⚠️  Destination chain ${destinationChain} not supported, skipping`);
                return;
            }

            // Create command to mint tokens
            const commandId = ethers.id(`${event.transactionHash}-${event.logIndex}`);
            const commands = [{
                commandType: 4, // COMMAND_MINT_TOKEN
                data: ethers.AbiCoder.defaultAbiCoder().encode(
                    ['address', 'uint256', 'string'],
                    [
                        event.args.destinationAddress,
                        event.args.amount,
                        event.args.symbol
                    ]
                )
            }];

            await this.executeCommands(destinationChain, commandId, commands, {
                type: 'TokenSent',
                sourceChain,
                event: event.args
            });
            
            this.processedEvents.add(eventId);
            this.saveProcessedEvents();
            
        } catch (error) {
            console.error(`❌ Failed to handle TokenSent:`, error.message);
        }
    }

    async executeCommands(destinationChain, commandId, commands, sourceEvent = null) {
        console.log(`⚡ Executing commands on ${destinationChain}`);
        
        const transactionKey = `${commandId}-${destinationChain}`;
        
        try {
            const signer = this.signers[destinationChain];
            const contract = this.contracts[destinationChain].connect(signer);

            // Create signature
            const hash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ['bytes32', 'tuple(uint256,bytes)[]'],
                    [commandId, commands.map(cmd => [cmd.commandType, cmd.data])]
                )
            );
            
            const signature = await signer.signMessage(ethers.getBytes(hash));

            // Check if command already executed
            const isExecuted = await contract.isCommandExecuted(commandId);
            if (isExecuted) {
                console.log(`⚠️  Command ${commandId} already executed on ${destinationChain}`);
                return { success: true, alreadyExecuted: true };
            }

            // Execute the command
            const tx = await contract.execute(commandId, commands, signature, {
                gasLimit: this.config.gasLimit || 500000,
                gasPrice: this.config.gasPrice ? ethers.parseUnits(this.config.gasPrice, 'gwei') : undefined
            });

            console.log(`📝 Transaction sent: ${tx.hash}`);
            
            const receipt = await tx.wait();
            console.log(`✅ Commands executed successfully on ${destinationChain} (Gas used: ${receipt.gasUsed})`);
            
            // Remove from failed transactions if it was retried successfully
            if (this.failedTransactions.has(transactionKey)) {
                this.failedTransactions.delete(transactionKey);
                this.saveFailedTransactions();
                console.log(`🔄 Successfully retried failed transaction: ${transactionKey}`);
            }
            
            return { success: true, txHash: tx.hash, gasUsed: receipt.gasUsed };
            
        } catch (error) {
            console.error(`❌ Failed to execute commands on ${destinationChain}:`, error.message);
            
            // Store failed transaction for retry/compensation
            const failedTx = {
                commandId,
                destinationChain,
                commands,
                sourceEvent,
                error: error.message,
                timestamp: Date.now(),
                retryCount: (this.failedTransactions.get(transactionKey)?.retryCount || 0) + 1,
                maxRetries: this.config.maxRetries || 3
            };
            
            this.failedTransactions.set(transactionKey, failedTx);
            this.saveFailedTransactions();
            
            // If max retries exceeded, queue for compensation
            if (failedTx.retryCount >= failedTx.maxRetries) {
                console.log(`🚨 Max retries exceeded for ${transactionKey}, queuing compensation`);
                await this.queueCompensation(failedTx);
            }
            
            return { success: false, error: error.message, retryCount: failedTx.retryCount };
        }
    }

    startPeriodicCleanup() {
        // Clean up old processed events every hour
        setInterval(() => {
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            
            // Keep events for 24 hours
            if (this.processedEvents.size > 10000) {
                console.log('🧹 Cleaning up old processed events...');
                // In a real implementation, you'd want to track timestamps
                // For now, just keep the most recent 5000 events
                const eventsArray = [...this.processedEvents];
                this.processedEvents = new Set(eventsArray.slice(-5000));
                this.saveProcessedEvents();
            }
        }, 60 * 60 * 1000); // Every hour
    }

    startRetryProcessor() {
        // Process failed transactions for retry every 30 seconds
        setInterval(async () => {
            await this.processFailedTransactions();
        }, 30 * 1000);
    }

    async processFailedTransactions() {
        if (this.failedTransactions.size === 0) return;

        console.log(`🔄 Processing ${this.failedTransactions.size} failed transactions...`);

        for (const [key, failedTx] of this.failedTransactions) {
            try {
                // Skip if max retries exceeded
                if (failedTx.retryCount >= failedTx.maxRetries) {
                    continue;
                }

                // Wait between retries (exponential backoff)
                const timeSinceLastTry = Date.now() - failedTx.timestamp;
                const retryDelay = Math.min(60000 * Math.pow(2, failedTx.retryCount), 600000); // Max 10 minutes

                if (timeSinceLastTry < retryDelay) {
                    continue; // Not time to retry yet
                }

                console.log(`🔄 Retrying failed transaction: ${key} (attempt ${failedTx.retryCount + 1})`);

                // Update timestamp before retry
                failedTx.timestamp = Date.now();

                const result = await this.executeCommands(
                    failedTx.destinationChain,
                    failedTx.commandId,
                    failedTx.commands,
                    failedTx.sourceEvent
                );

                if (result.success) {
                    console.log(`✅ Successfully retried transaction: ${key}`);
                }

            } catch (error) {
                console.error(`❌ Error during retry of ${key}:`, error.message);
            }
        }
    }

    async queueCompensation(failedTx) {
        console.log(`💰 Queuing compensation for failed transaction: ${failedTx.commandId}`);

        if (!failedTx.sourceEvent) {
            console.log(`⚠️  No source event data for compensation: ${failedTx.commandId}`);
            return;
        }

        const { sourceChain, event } = failedTx.sourceEvent;

        try {
            // Create compensation transaction based on the original event type
            if (failedTx.sourceEvent.type === 'TokenSent' || failedTx.sourceEvent.type === 'ContractCallWithToken') {
                await this.createTokenCompensation(sourceChain, event);
            }
            // Note: ContractCall without tokens doesn't need token compensation
            // but you might want to emit a failure event or notify the user

        } catch (error) {
            console.error(`❌ Failed to create compensation:`, error.message);
        }
    }

    async createTokenCompensation(sourceChain, originalEvent) {
        console.log(`🔄 Creating token compensation on ${sourceChain}`);

        try {
            const signer = this.signers[sourceChain];
            const contract = this.contracts[sourceChain].connect(signer);

            // Create a compensation mint command
            const compensationId = ethers.id(`compensation-${Date.now()}-${Math.random()}`);
            const commands = [{
                commandType: 4, // COMMAND_MINT_TOKEN
                data: ethers.AbiCoder.defaultAbiCoder().encode(
                    ['address', 'uint256', 'string'],
                    [
                        originalEvent.sender, // Refund to original sender
                        originalEvent.amount,
                        originalEvent.symbol
                    ]
                )
            }];

            const result = await this.executeCommands(sourceChain, compensationId, commands);

            if (result.success) {
                console.log(`✅ Compensation transaction successful: ${result.txHash}`);
            } else {
                console.log(`❌ Compensation transaction failed: ${result.error}`);
            }

        } catch (error) {
            console.error(`❌ Failed to execute compensation:`, error.message);
        }
    }

    // Manual compensation trigger (can be called via API)
    async triggerManualCompensation(commandId) {
        const transactionKey = [...this.failedTransactions.keys()].find(key => key.includes(commandId));
        
        if (!transactionKey) {
            throw new Error(`Failed transaction not found: ${commandId}`);
        }

        const failedTx = this.failedTransactions.get(transactionKey);
        await this.queueCompensation(failedTx);
        
        return { success: true, message: 'Compensation triggered' };
    }

    // Get failed transactions (for monitoring/admin)
    getFailedTransactions() {
        return [...this.failedTransactions.entries()].map(([key, value]) => ({
            key,
            ...value
        }));
    }

    async stop() {
        console.log('🛑 Stopping IXFI Relayer...');
        this.isRunning = false;
        this.saveProcessedEvents();
        this.saveFailedTransactions();
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Health check endpoint
    async getHealth() {
        const health = {
            status: 'healthy',
            chains: {},
            processedEvents: this.processedEvents.size,
            failedTransactions: this.failedTransactions.size,
            relayerAddress: this.signers[Object.keys(this.signers)[0]]?.address
        };

        // Check if there are critical failures
        const criticalFailures = [...this.failedTransactions.values()].filter(
            tx => tx.retryCount >= tx.maxRetries
        );

        if (criticalFailures.length > 0) {
            health.status = 'degraded';
            health.criticalFailures = criticalFailures.length;
        }

        for (const chainName of Object.keys(this.config.chains)) {
            try {
                const provider = this.providers[chainName];
                const blockNumber = await provider.getBlockNumber();
                const balance = await provider.getBalance(this.signers[chainName].address);
                
                health.chains[chainName] = {
                    status: 'connected',
                    blockNumber,
                    balance: ethers.formatEther(balance),
                    ixfiAddress: this.config.chains[chainName].ixfiAddress
                };
            } catch (error) {
                health.chains[chainName] = {
                    status: 'error',
                    error: error.message
                };
                health.status = 'degraded';
            }
        }

        return health;
    }
}

module.exports = IXFIRelayer;
