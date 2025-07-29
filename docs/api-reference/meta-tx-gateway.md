# MetaTx Gateway

The MetaTx Gateway enables gasless transactions and meta-transaction functionality for the IXFI Protocol. It allows users to execute transactions without holding native tokens for gas fees, improving accessibility and user experience.

## Overview

The MetaTx Gateway provides:

- **Gasless Transactions**: Execute transactions without native tokens
- **EIP-2771 Compliance**: Standard meta-transaction support
- **Flexible Fee Models**: Multiple payment options for transaction fees
- **Relayer Network**: Decentralized network of transaction relayers
- **Batch Execution**: Execute multiple transactions in a single meta-transaction

## Smart Contract Interface

### Core Functions

#### executeMetaTransaction

Execute a meta-transaction on behalf of a user.

```solidity
function executeMetaTransaction(
    address user,
    address target,
    bytes calldata functionSignature,
    uint256 nonce,
    bytes calldata signature
) external returns (bool success, bytes memory returnData)
```

**Parameters:**
- `user`: Address of the user initiating the transaction
- `target`: Target contract address
- `functionSignature`: Encoded function call data
- `nonce`: User's current nonce for meta-transactions
- `signature`: User's signature for the meta-transaction

**Returns:**
- `success`: Whether the meta-transaction executed successfully
- `returnData`: Return data from the target function call

**Usage Example:**
```javascript
const metaTxGateway = new ethers.Contract(gatewayAddress, gatewayABI, relayerSigner);

// Prepare meta-transaction
const functionSignature = targetContract.interface.encodeFunctionData("transfer", [
    recipientAddress,
    ethers.parseEther("100")
]);

const nonce = await metaTxGateway.getNonce(userAddress);

// Create signature
const domain = {
    name: "IXFI MetaTx Gateway",
    version: "1",
    chainId: await provider.getNetwork().then(n => n.chainId),
    verifyingContract: gatewayAddress
};

const types = {
    MetaTransaction: [
        { name: "user", type: "address" },
        { name: "target", type: "address" },
        { name: "functionSignature", type: "bytes" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" }
    ]
};

const values = {
    user: userAddress,
    target: targetContractAddress,
    functionSignature: functionSignature,
    nonce: nonce,
    deadline: Math.floor(Date.now() / 1000) + 3600 // 1 hour
};

const signature = await userSigner._signTypedData(domain, types, values);

// Execute meta-transaction
const result = await metaTxGateway.executeMetaTransaction(
    userAddress,
    targetContractAddress,
    functionSignature,
    nonce,
    signature
);

console.log("Meta-transaction executed:", result.success);
```

#### executeMetaTransactionWithCredits

Execute a meta-transaction using pre-paid gas credits.

```solidity
function executeMetaTransactionWithCredits(
    address user,
    address target,
    bytes calldata functionSignature,
    uint256 nonce,
    uint256 maxGasPrice,
    bytes calldata signature
) external returns (bool success, bytes memory returnData)
```

**Parameters:**
- `user`: User address
- `target`: Target contract address
- `functionSignature`: Encoded function call
- `nonce`: User's nonce
- `maxGasPrice`: Maximum gas price user agrees to pay
- `signature`: User's signature

#### batchExecuteMetaTransactions

Execute multiple meta-transactions in a single call.

```solidity
function batchExecuteMetaTransactions(
    MetaTransactionData[] calldata transactions
) external returns (BatchExecutionResult memory)
```

**Parameters:**
```solidity
struct MetaTransactionData {
    address user;
    address target;
    bytes functionSignature;
    uint256 nonce;
    bytes signature;
}

struct BatchExecutionResult {
    bool[] successes;
    bytes[] returnData;
    uint256 totalGasUsed;
    uint256 failedCount;
}
```

**Usage Example:**
```javascript
const transactions = [
    {
        user: userAddress,
        target: tokenContract.address,
        functionSignature: tokenContract.interface.encodeFunctionData("approve", [spenderAddress, amount1]),
        nonce: nonce1,
        signature: signature1
    },
    {
        user: userAddress,
        target: dexContract.address,
        functionSignature: dexContract.interface.encodeFunctionData("swap", [swapParams]),
        nonce: nonce2,
        signature: signature2
    }
];

const batchResult = await metaTxGateway.batchExecuteMetaTransactions(transactions);

console.log("Batch execution results:");
batchResult.successes.forEach((success, index) => {
    console.log(`Transaction ${index}: ${success ? 'Success' : 'Failed'}`);
});
console.log(`Total gas used: ${batchResult.totalGasUsed}`);
console.log(`Failed transactions: ${batchResult.failedCount}`);
```

### Gas Credit Management

#### addGasCredits

Add gas credits for a user account.

```solidity
function addGasCredits(
    address user,
    uint256 amount
) external payable
```

**Parameters:**
- `user`: User address to credit
- `amount`: Amount of gas credits to add (in wei equivalent)

#### getGasCredits

Get the current gas credit balance for a user.

```solidity
function getGasCredits(address user) external view returns (uint256)
```

#### withdrawGasCredits

Allow users to withdraw unused gas credits.

```solidity
function withdrawGasCredits(uint256 amount) external
```

#### sponsorGasCredits

Allow third parties to sponsor gas credits for users.

```solidity
function sponsorGasCredits(
    address user,
    uint256 amount,
    string memory sponsorMessage
) external payable
```

### Relayer Management

#### registerRelayer

Register a new relayer in the network.

```solidity
function registerRelayer(
    address relayerAddress,
    uint256 stake,
    string memory endpoint
) external
```

**Parameters:**
- `relayerAddress`: Address of the relayer
- `stake`: Amount of tokens to stake
- `endpoint`: API endpoint for the relayer

#### updateRelayerStatus

Update relayer status (active/inactive).

```solidity
function updateRelayerStatus(
    address relayer,
    bool isActive
) external onlyOwner
```

#### slashRelayer

Slash a relayer's stake for misbehavior.

```solidity
function slashRelayer(
    address relayer,
    uint256 slashAmount,
    string memory reason
) external onlyOwner
```

### View Functions

#### getNonce

Get the current nonce for a user's meta-transactions.

```solidity
function getNonce(address user) external view returns (uint256)
```

#### isValidSignature

Verify if a meta-transaction signature is valid.

```solidity
function isValidSignature(
    address user,
    address target,
    bytes calldata functionSignature,
    uint256 nonce,
    bytes calldata signature
) external view returns (bool)
```

#### getRelayerInfo

Get information about a registered relayer.

```solidity
function getRelayerInfo(address relayer) external view returns (RelayerInfo memory)
```

**Returns:**
```solidity
struct RelayerInfo {
    bool isActive;
    uint256 stake;
    string endpoint;
    uint256 successfulTxs;
    uint256 failedTxs;
    uint256 lastActive;
}
```

#### estimateMetaTxGas

Estimate gas cost for a meta-transaction.

```solidity
function estimateMetaTxGas(
    address user,
    address target,
    bytes calldata functionSignature
) external view returns (uint256)
```

## JavaScript SDK Integration

### MetaTxGateway Class

```javascript
class MetaTxGateway {
    constructor(config) {
        this.contract = new ethers.Contract(
            config.contractAddress,
            config.abi,
            config.provider
        );
        this.relayerEndpoint = config.relayerEndpoint;
        this.domain = {
            name: "IXFI MetaTx Gateway",
            version: "1",
            chainId: config.chainId,
            verifyingContract: config.contractAddress
        };
        this.types = {
            MetaTransaction: [
                { name: "user", type: "address" },
                { name: "target", type: "address" },
                { name: "functionSignature", type: "bytes" },
                { name: "nonce", type: "uint256" },
                { name: "deadline", type: "uint256" }
            ]
        };
    }

    async executeGaslessTransaction(userSigner, target, functionSignature, options = {}) {
        try {
            const userAddress = await userSigner.getAddress();
            const nonce = await this.contract.getNonce(userAddress);
            const deadline = options.deadline || Math.floor(Date.now() / 1000) + 3600;

            // Create meta-transaction data
            const metaTxData = {
                user: userAddress,
                target: target,
                functionSignature: functionSignature,
                nonce: nonce,
                deadline: deadline
            };

            // Sign the meta-transaction
            const signature = await userSigner._signTypedData(
                this.domain,
                this.types,
                metaTxData
            );

            // Submit to relayer
            const response = await this.submitToRelayer({
                ...metaTxData,
                signature
            });

            return {
                success: true,
                transactionHash: response.transactionHash,
                relayerUsed: response.relayerAddress
            };

        } catch (error) {
            throw new Error(`Gasless transaction failed: ${error.message}`);
        }
    }

    async batchGaslessTransactions(userSigner, transactions, options = {}) {
        try {
            const userAddress = await userSigner.getAddress();
            let nonce = await this.contract.getNonce(userAddress);
            const deadline = options.deadline || Math.floor(Date.now() / 1000) + 3600;

            // Sign each transaction
            const signedTransactions = [];
            for (const tx of transactions) {
                const metaTxData = {
                    user: userAddress,
                    target: tx.target,
                    functionSignature: tx.functionSignature,
                    nonce: nonce++,
                    deadline: deadline
                };

                const signature = await userSigner._signTypedData(
                    this.domain,
                    this.types,
                    metaTxData
                );

                signedTransactions.push({
                    ...metaTxData,
                    signature
                });
            }

            // Submit batch to relayer
            const response = await this.submitBatchToRelayer(signedTransactions);

            return {
                success: true,
                transactionHash: response.transactionHash,
                batchResults: response.results
            };

        } catch (error) {
            throw new Error(`Batch gasless transaction failed: ${error.message}`);
        }
    }

    async addGasCredits(userSigner, amount, beneficiary = null) {
        try {
            const userAddress = await userSigner.getAddress();
            const target = beneficiary || userAddress;

            const tx = await this.contract.connect(userSigner).addGasCredits(target, amount, {
                value: amount
            });

            await tx.wait();

            return {
                success: true,
                transactionHash: tx.hash,
                creditsAdded: ethers.formatEther(amount)
            };

        } catch (error) {
            throw new Error(`Failed to add gas credits: ${error.message}`);
        }
    }

    async getGasCreditsBalance(userAddress) {
        try {
            const balance = await this.contract.getGasCredits(userAddress);
            return {
                balance: ethers.formatEther(balance),
                balanceWei: balance.toString()
            };
        } catch (error) {
            throw new Error(`Failed to get gas credits: ${error.message}`);
        }
    }

    async estimateGaslessTransactionCost(target, functionSignature) {
        try {
            const gasEstimate = await this.contract.estimateMetaTxGas(
                ethers.ZeroAddress, // Placeholder address
                target,
                functionSignature
            );

            // Get current gas price from relayer
            const gasPriceResponse = await fetch(`${this.relayerEndpoint}/gas-price`);
            const { gasPrice } = await gasPriceResponse.json();

            const totalCost = gasEstimate * BigInt(gasPrice);

            return {
                gasEstimate: gasEstimate.toString(),
                gasPrice: gasPrice,
                totalCost: ethers.formatEther(totalCost),
                totalCostWei: totalCost.toString()
            };

        } catch (error) {
            throw new Error(`Failed to estimate cost: ${error.message}`);
        }
    }

    async submitToRelayer(metaTxData) {
        const response = await fetch(`${this.relayerEndpoint}/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metaTxData)
        });

        if (!response.ok) {
            throw new Error(`Relayer error: ${response.statusText}`);
        }

        return await response.json();
    }

    async submitBatchToRelayer(transactions) {
        const response = await fetch(`${this.relayerEndpoint}/submit-batch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ transactions })
        });

        if (!response.ok) {
            throw new Error(`Batch relayer error: ${response.statusText}`);
        }

        return await response.json();
    }

    async getRelayerStatus() {
        try {
            const response = await fetch(`${this.relayerEndpoint}/status`);
            return await response.json();
        } catch (error) {
            throw new Error(`Failed to get relayer status: ${error.message}`);
        }
    }

    async waitForTransaction(transactionHash, timeout = 60000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            try {
                const response = await fetch(`${this.relayerEndpoint}/transaction/${transactionHash}`);
                const txData = await response.json();
                
                if (txData.status === 'confirmed') {
                    return txData;
                } else if (txData.status === 'failed') {
                    throw new Error(`Transaction failed: ${txData.error}`);
                }
                
                // Wait 2 seconds before checking again
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
                if (Date.now() - startTime >= timeout) {
                    throw new Error('Transaction timeout');
                }
            }
        }
        
        throw new Error('Transaction timeout');
    }
}
```

### React Hook

```jsx
import { useState, useCallback } from 'react';
import { MetaTxGateway } from '@ixfi/sdk';

export function useMetaTxGateway(config) {
    const [metaTxGateway] = useState(() => new MetaTxGateway(config));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const executeGaslessTransaction = useCallback(async (userSigner, target, functionSignature, options) => {
        setLoading(true);
        setError(null);

        try {
            const result = await metaTxGateway.executeGaslessTransaction(
                userSigner,
                target,
                functionSignature,
                options
            );
            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [metaTxGateway]);

    const batchGaslessTransactions = useCallback(async (userSigner, transactions, options) => {
        setLoading(true);
        setError(null);

        try {
            const result = await metaTxGateway.batchGaslessTransactions(
                userSigner,
                transactions,
                options
            );
            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [metaTxGateway]);

    const addGasCredits = useCallback(async (userSigner, amount, beneficiary) => {
        setLoading(true);
        setError(null);

        try {
            const result = await metaTxGateway.addGasCredits(userSigner, amount, beneficiary);
            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [metaTxGateway]);

    const getGasCreditsBalance = useCallback(async (userAddress) => {
        try {
            return await metaTxGateway.getGasCreditsBalance(userAddress);
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [metaTxGateway]);

    const estimateGaslessTransactionCost = useCallback(async (target, functionSignature) => {
        try {
            return await metaTxGateway.estimateGaslessTransactionCost(target, functionSignature);
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [metaTxGateway]);

    return {
        executeGaslessTransaction,
        batchGaslessTransactions,
        addGasCredits,
        getGasCreditsBalance,
        estimateGaslessTransactionCost,
        loading,
        error,
        gateway: metaTxGateway
    };
}

// Usage in React component
function GaslessTransactionInterface() {
    const { 
        executeGaslessTransaction, 
        getGasCreditsBalance,
        addGasCredits,
        loading, 
        error 
    } = useMetaTxGateway({
        contractAddress: '0x...',
        abi: metaTxGatewayABI,
        provider: provider,
        relayerEndpoint: 'https://relayer.ixfi.com'
    });

    const [creditsBalance, setCreditsBalance] = useState(null);

    const handleGaslessSwap = async () => {
        try {
            const functionSignature = swapContract.interface.encodeFunctionData("swap", [
                tokenIn,
                tokenOut,
                amountIn,
                minAmountOut,
                userAddress
            ]);

            const result = await executeGaslessTransaction(
                userSigner,
                swapContract.address,
                functionSignature
            );

            console.log('Gasless swap executed:', result.transactionHash);
        } catch (err) {
            console.error('Gasless swap failed:', err);
        }
    };

    const handleAddCredits = async () => {
        try {
            const amount = ethers.parseEther('0.1'); // 0.1 ETH worth of credits
            const result = await addGasCredits(userSigner, amount);
            console.log('Credits added:', result);
            
            // Refresh balance
            const newBalance = await getGasCreditsBalance(userAddress);
            setCreditsBalance(newBalance);
        } catch (err) {
            console.error('Failed to add credits:', err);
        }
    };

    return (
        <div>
            <div>
                <h3>Gas Credits Balance</h3>
                <p>{creditsBalance ? creditsBalance.balance : 'Loading...'} ETH</p>
                <button onClick={handleAddCredits} disabled={loading}>
                    Add Credits
                </button>
            </div>

            <div>
                <h3>Gasless Transaction</h3>
                <button onClick={handleGaslessSwap} disabled={loading}>
                    {loading ? 'Executing...' : 'Execute Gasless Swap'}
                </button>
            </div>

            {error && <div className="error">Error: {error}</div>}
        </div>
    );
}
```

## Advanced Features

### Custom Relayer Integration

```javascript
class CustomRelayer {
    constructor(config) {
        this.gateway = new MetaTxGateway(config.gateway);
        this.relayerWallet = new ethers.Wallet(config.privateKey, config.provider);
        this.endpoint = config.endpoint;
        this.gasOracle = config.gasOracle;
        this.pendingTransactions = new Map();
    }

    async startRelayerService() {
        // Express.js server for relayer API
        const express = require('express');
        const app = express();
        app.use(express.json());

        app.post('/submit', this.handleMetaTransaction.bind(this));
        app.post('/submit-batch', this.handleBatchMetaTransactions.bind(this));
        app.get('/status', this.getStatus.bind(this));
        app.get('/transaction/:hash', this.getTransactionStatus.bind(this));
        app.get('/gas-price', this.getGasPrice.bind(this));

        const port = process.env.PORT || 3000;
        app.listen(port, () => {
            console.log(`Relayer service running on port ${port}`);
        });
    }

    async handleMetaTransaction(req, res) {
        try {
            const { user, target, functionSignature, nonce, signature, deadline } = req.body;

            // Validate the meta-transaction
            const isValid = await this.gateway.contract.isValidSignature(
                user,
                target,
                functionSignature,
                nonce,
                signature
            );

            if (!isValid) {
                return res.status(400).json({ error: 'Invalid signature' });
            }

            // Check if user has sufficient gas credits
            const gasEstimate = await this.gateway.contract.estimateMetaTxGas(
                user,
                target,
                functionSignature
            );

            const gasPrice = await this.gasOracle.getGasPrice();
            const gasCost = gasEstimate * gasPrice;

            const userCredits = await this.gateway.contract.getGasCredits(user);
            if (userCredits < gasCost) {
                return res.status(400).json({ 
                    error: 'Insufficient gas credits',
                    required: ethers.formatEther(gasCost),
                    available: ethers.formatEther(userCredits)
                });
            }

            // Execute the meta-transaction
            const tx = await this.gateway.contract.connect(this.relayerWallet).executeMetaTransactionWithCredits(
                user,
                target,
                functionSignature,
                nonce,
                gasPrice,
                signature,
                {
                    gasLimit: gasEstimate + BigInt(50000), // Add buffer
                    gasPrice: gasPrice
                }
            );

            // Track the transaction
            this.pendingTransactions.set(tx.hash, {
                user,
                target,
                status: 'pending',
                submittedAt: Date.now()
            });

            res.json({
                success: true,
                transactionHash: tx.hash,
                relayerAddress: this.relayerWallet.address
            });

            // Wait for confirmation in background
            this.waitForConfirmation(tx.hash);

        } catch (error) {
            console.error('Meta-transaction execution failed:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async handleBatchMetaTransactions(req, res) {
        try {
            const { transactions } = req.body;

            // Validate all transactions
            for (const tx of transactions) {
                const isValid = await this.gateway.contract.isValidSignature(
                    tx.user,
                    tx.target,
                    tx.functionSignature,
                    tx.nonce,
                    tx.signature
                );

                if (!isValid) {
                    return res.status(400).json({ 
                        error: `Invalid signature for transaction with nonce ${tx.nonce}` 
                    });
                }
            }

            // Execute batch
            const metaTxData = transactions.map(tx => ({
                user: tx.user,
                target: tx.target,
                functionSignature: tx.functionSignature,
                nonce: tx.nonce,
                signature: tx.signature
            }));

            const batchTx = await this.gateway.contract.connect(this.relayerWallet).batchExecuteMetaTransactions(
                metaTxData
            );

            // Track batch transaction
            this.pendingTransactions.set(batchTx.hash, {
                type: 'batch',
                count: transactions.length,
                status: 'pending',
                submittedAt: Date.now()
            });

            res.json({
                success: true,
                transactionHash: batchTx.hash,
                batchSize: transactions.length
            });

            // Wait for confirmation
            this.waitForConfirmation(batchTx.hash);

        } catch (error) {
            console.error('Batch execution failed:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async waitForConfirmation(transactionHash) {
        try {
            const receipt = await this.relayerWallet.provider.waitForTransaction(transactionHash);
            
            const pendingTx = this.pendingTransactions.get(transactionHash);
            if (pendingTx) {
                pendingTx.status = receipt.status === 1 ? 'confirmed' : 'failed';
                pendingTx.confirmedAt = Date.now();
                pendingTx.gasUsed = receipt.gasUsed.toString();
            }

        } catch (error) {
            const pendingTx = this.pendingTransactions.get(transactionHash);
            if (pendingTx) {
                pendingTx.status = 'failed';
                pendingTx.error = error.message;
            }
        }
    }

    getStatus(req, res) {
        const relayerBalance = this.relayerWallet.provider.getBalance(this.relayerWallet.address);
        
        res.json({
            relayerAddress: this.relayerWallet.address,
            balance: ethers.formatEther(relayerBalance),
            pendingTransactions: this.pendingTransactions.size,
            uptime: process.uptime(),
            chainId: this.relayerWallet.provider.network.chainId
        });
    }

    getTransactionStatus(req, res) {
        const { hash } = req.params;
        const transaction = this.pendingTransactions.get(hash);
        
        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        res.json(transaction);
    }

    async getGasPrice(req, res) {
        try {
            const gasPrice = await this.gasOracle.getGasPrice();
            res.json({ gasPrice: gasPrice.toString() });
        } catch (error) {
            res.status(500).json({ error: 'Failed to get gas price' });
        }
    }
}
```

### Gas Credits Management System

```javascript
class GasCreditsManager {
    constructor(metaTxGateway) {
        this.gateway = metaTxGateway;
        this.subscriptions = new Map();
        this.refillThresholds = new Map();
    }

    async createSubscription(userAddress, monthlyLimit, autoRefill = true) {
        const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const subscription = {
            id: subscriptionId,
            user: userAddress,
            monthlyLimit: monthlyLimit,
            currentUsage: 0,
            autoRefill: autoRefill,
            createdAt: Date.now(),
            lastRefill: Date.now()
        };

        this.subscriptions.set(subscriptionId, subscription);

        if (autoRefill) {
            await this.gateway.addGasCredits(userAddress, monthlyLimit);
        }

        return subscriptionId;
    }

    async checkAndRefillCredits(userAddress) {
        const userSubscriptions = Array.from(this.subscriptions.values())
            .filter(sub => sub.user === userAddress && sub.autoRefill);

        for (const subscription of userSubscriptions) {
            const currentBalance = await this.gateway.getGasCreditsBalance(userAddress);
            const threshold = this.refillThresholds.get(userAddress) || ethers.parseEther('0.01');

            if (BigInt(currentBalance.balanceWei) < threshold) {
                const refillAmount = subscription.monthlyLimit / 4; // Quarter of monthly limit
                await this.gateway.addGasCredits(userAddress, refillAmount);
                
                subscription.currentUsage += Number(ethers.formatEther(refillAmount));
                subscription.lastRefill = Date.now();

                console.log(`Auto-refilled ${ethers.formatEther(refillAmount)} ETH for user ${userAddress}`);
            }
        }
    }

    setRefillThreshold(userAddress, threshold) {
        this.refillThresholds.set(userAddress, threshold);
    }

    async getUsageStats(userAddress, period = 30) {
        const subscription = Array.from(this.subscriptions.values())
            .find(sub => sub.user === userAddress);

        if (!subscription) {
            return null;
        }

        const periodStart = Date.now() - (period * 24 * 60 * 60 * 1000);
        
        return {
            subscriptionId: subscription.id,
            monthlyLimit: ethers.formatEther(subscription.monthlyLimit),
            currentUsage: subscription.currentUsage,
            usagePercentage: (subscription.currentUsage / Number(ethers.formatEther(subscription.monthlyLimit))) * 100,
            daysUntilReset: Math.ceil((subscription.createdAt + (30 * 24 * 60 * 60 * 1000) - Date.now()) / (24 * 60 * 60 * 1000)),
            lastRefill: new Date(subscription.lastRefill).toISOString()
        };
    }

    async sponsorUserCredits(sponsorSigner, userAddress, amount, message = '') {
        try {
            const result = await this.gateway.contract.connect(sponsorSigner).sponsorGasCredits(
                userAddress,
                amount,
                message,
                { value: amount }
            );

            return {
                success: true,
                transactionHash: result.hash,
                sponsoredAmount: ethers.formatEther(amount),
                beneficiary: userAddress,
                message: message
            };

        } catch (error) {
            throw new Error(`Failed to sponsor gas credits: ${error.message}`);
        }
    }
}
```

## Best Practices

### Security Considerations

1. **Signature Validation**: Always validate signatures before execution
2. **Nonce Management**: Prevent replay attacks with proper nonce handling  
3. **Gas Limit Checks**: Prevent gas griefing attacks
4. **Rate Limiting**: Implement rate limits for relayer endpoints

### Performance Optimization

1. **Batch Transactions**: Group multiple operations when possible
2. **Gas Price Optimization**: Use dynamic gas pricing
3. **Caching**: Cache gas estimates and nonce values
4. **Load Balancing**: Distribute load across multiple relayers

### User Experience

1. **Clear Error Messages**: Provide actionable error feedback
2. **Progress Indicators**: Show transaction status updates
3. **Fallback Options**: Offer regular transactions as backup
4. **Cost Transparency**: Display gas costs and credits clearly

## Resources

- [IXFI Gateway API](ixfi-gateway.md)
- [Cross-Chain Meta-Transactions](../cross-chain/meta-transactions.md)
- [Integration Examples](../examples/)
- [Relayer Network Guide](../core-concepts/relayer-network.md)
