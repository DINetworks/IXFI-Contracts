# Events & Errors

This reference documents all events and custom errors used throughout the IXFI Protocol smart contracts, providing developers with comprehensive information for monitoring, debugging, and integration.

## Core Protocol Events

### IXFI Gateway Events

#### ContractCall
Emitted when a cross-chain contract call is initiated.

```solidity
event ContractCall(
    address indexed sender,
    string destinationChain,
    string destinationContractAddress,
    bytes32 indexed payloadHash,
    bytes payload
);
```

**Parameters:**
- `sender`: Address that initiated the call
- `destinationChain`: Target blockchain name
- `destinationContractAddress`: Target contract address
- `payloadHash`: Hash of the payload for verification
- `payload`: Encoded function call data

**Usage Example:**
```javascript
gateway.on("ContractCall", (sender, destinationChain, contractAddress, payloadHash, payload, event) => {
    console.log(`Cross-chain call from ${sender} to ${destinationChain}`);
    console.log(`Target contract: ${contractAddress}`);
    console.log(`Payload hash: ${payloadHash}`);
    console.log(`Transaction: ${event.transactionHash}`);
});
```

#### ContractCallWithToken
Emitted when a cross-chain contract call with token transfer is initiated.

```solidity
event ContractCallWithToken(
    address indexed sender,
    string destinationChain,
    string destinationContractAddress,
    bytes32 indexed payloadHash,
    bytes payload,
    string symbol,
    uint256 amount
);
```

**Parameters:**
- `sender`: Address that initiated the call
- `destinationChain`: Target blockchain name
- `destinationContractAddress`: Target contract address
- `payloadHash`: Hash of the payload
- `payload`: Encoded function call data
- `symbol`: Token symbol being transferred
- `amount`: Amount of tokens being transferred

#### TokenSent
Emitted when tokens are sent cross-chain.

```solidity
event TokenSent(
    address indexed sender,
    string destinationChain,
    string destinationAddress,
    string symbol,
    uint256 amount
);
```

#### Executed
Emitted when a cross-chain command is executed on the destination chain.

```solidity
event Executed(
    bytes32 indexed commandId,
    string sourceChain,
    string sourceAddress,
    bool success,
    bytes returnData
);
```

**Parameters:**
- `commandId`: Unique identifier for the command
- `sourceChain`: Originating blockchain name
- `sourceAddress`: Original caller's address
- `success`: Whether execution was successful
- `returnData`: Return data from the executed function

### IXFI Token Events

#### TokenMinted
Emitted when IXFI tokens are minted (cross-chain transfer in).

```solidity
event TokenMinted(
    address indexed to,
    uint256 amount,
    string indexed sourceChain,
    bytes32 indexed commandId
);
```

#### TokenBurned
Emitted when IXFI tokens are burned (cross-chain transfer out).

```solidity
event TokenBurned(
    address indexed from,
    uint256 amount,
    string indexed destinationChain,
    bytes32 indexed transferId
);
```

#### RelayerAdded
Emitted when a new relayer is added to the network.

```solidity
event RelayerAdded(address indexed relayer);
```

#### RelayerRemoved
Emitted when a relayer is removed from the network.

```solidity
event RelayerRemoved(address indexed relayer);
```

#### ChainAdded
Emitted when a new blockchain is added to the protocol.

```solidity
event ChainAdded(string indexed chainName, uint256 chainId);
```

#### ChainRemoved
Emitted when a blockchain is removed from the protocol.

```solidity
event ChainRemoved(string indexed chainName);
```

### DEX Aggregation Events

#### TokenSwap
Emitted when a token swap is executed through the aggregator.

```solidity
event TokenSwap(
    address indexed user,
    address indexed tokenIn,
    address indexed tokenOut,
    uint256 amountIn,
    uint256 amountOut,
    address dexUsed
);
```

#### RouteFound
Emitted when an optimal route is found for a swap.

```solidity
event RouteFound(
    address indexed tokenIn,
    address indexed tokenOut,
    uint256 amountIn,
    uint256 expectedOut,
    address[] dexPath,
    uint256 priceImpact
);
```

#### LiquidityAdded
Emitted when liquidity is added to a DEX through the aggregator.

```solidity
event LiquidityAdded(
    address indexed user,
    address indexed tokenA,
    address indexed tokenB,
    uint256 amountA,
    uint256 amountB,
    address dexUsed
);
```

### Meta Transaction Events

#### MetaTransactionExecuted
Emitted when a meta-transaction is executed.

```solidity
event MetaTransactionExecuted(
    address indexed user,
    address indexed relayer,
    address indexed target,
    bool success,
    bytes returnData
);
```

#### GaslessCreditsAdded
Emitted when gasless credits are added for a user.

```solidity
event GaslessCreditsAdded(
    address indexed user,
    uint256 amount,
    address indexed sponsor
);
```

#### GaslessCreditsUsed
Emitted when gasless credits are consumed.

```solidity
event GaslessCreditsUsed(
    address indexed user,
    uint256 amount,
    bytes32 indexed transactionId
);
```

## Protocol Errors

### Core Protocol Errors

#### InvalidChain
Thrown when an unsupported or invalid chain is specified.

```solidity
error InvalidChain(string chainName);
```

**Common Causes:**
- Chain not registered in the protocol
- Typo in chain name
- Chain temporarily disabled

**Resolution:**
```solidity
require(gateway.isValidChain(chainName), "Chain not supported");
```

#### InvalidRelayer
Thrown when an unauthorized relayer attempts to execute commands.

```solidity
error InvalidRelayer(address relayer);
```

**Common Causes:**
- Relayer not registered
- Relayer stake below minimum
- Relayer temporarily suspended

#### CommandAlreadyExecuted
Thrown when attempting to execute a command that has already been processed.

```solidity
error CommandAlreadyExecuted(bytes32 commandId);
```

**Common Causes:**
- Replay attack attempt
- Duplicate transaction submission
- Race condition in relayer network

#### InsufficientBalance
Thrown when a user doesn't have enough tokens for an operation.

```solidity
error InsufficientBalance(uint256 requested, uint256 available);
```

#### InvalidSignature
Thrown when signature verification fails.

```solidity
error InvalidSignature();
```

**Common Causes:**
- Wrong private key used for signing
- Signature malformed or corrupted
- Domain separator mismatch

#### PayloadExecutionFailed
Thrown when cross-chain payload execution fails.

```solidity
error PayloadExecutionFailed(string reason);
```

### DEX Aggregation Errors

#### InsufficientOutputAmount
Thrown when swap output is below minimum acceptable amount.

```solidity
error InsufficientOutputAmount(uint256 expected, uint256 actual);
```

#### NoLiquidityAvailable
Thrown when no liquidity is available for a trading pair.

```solidity
error NoLiquidityAvailable(address tokenA, address tokenB);
```

#### ExcessiveSlippage
Thrown when price slippage exceeds acceptable limits.

```solidity
error ExcessiveSlippage(uint256 slippage, uint256 maxSlippage);
```

#### InvalidPath
Thrown when the provided swap path is invalid.

```solidity
error InvalidPath(address[] path);
```

#### DEXNotSupported
Thrown when trying to use an unsupported DEX.

```solidity
error DEXNotSupported(address dex);
```

### Gas Management Errors

#### InsufficientGasPayment
Thrown when gas payment is insufficient for cross-chain operation.

```solidity
error InsufficientGasPayment(uint256 required, uint256 provided);
```

#### GasLimitExceeded
Thrown when gas limit exceeds maximum allowed.

```solidity
error GasLimitExceeded(uint256 gasLimit, uint256 maxGasLimit);
```

#### GasPriceOutOfRange
Thrown when gas price is outside acceptable range.

```solidity
error GasPriceOutOfRange(uint256 gasPrice, uint256 minPrice, uint256 maxPrice);
```

### Meta Transaction Errors

#### InvalidNonce
Thrown when meta-transaction nonce is invalid.

```solidity
error InvalidNonce(uint256 expected, uint256 provided);
```

#### TransactionExpired
Thrown when meta-transaction deadline has passed.

```solidity
error TransactionExpired(uint256 deadline, uint256 currentTime);
```

#### InsufficientGasCredits
Thrown when user doesn't have enough gas credits for gasless transaction.

```solidity
error InsufficientGasCredits(uint256 required, uint256 available);
```

#### RelayerNotAuthorized
Thrown when relayer is not authorized for meta-transactions.

```solidity
error RelayerNotAuthorized(address relayer);
```

## Event Monitoring Patterns

### Basic Event Listening

```javascript
// Listen to all gateway events
const gateway = new ethers.Contract(gatewayAddress, gatewayABI, provider);

// Cross-chain call monitoring
gateway.on("ContractCall", (sender, destinationChain, contractAddress, payloadHash, payload, event) => {
    console.log(`New cross-chain call:`, {
        sender,
        destinationChain,
        contractAddress,
        payloadHash,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
    });
});

// Token transfer monitoring
gateway.on("TokenSent", (sender, destinationChain, destinationAddress, symbol, amount, event) => {
    console.log(`Token transfer:`, {
        from: sender,
        to: destinationAddress,
        chain: destinationChain,
        token: symbol,
        amount: ethers.formatEther(amount)
    });
});
```

### Advanced Event Filtering

```javascript
// Filter events by user
const userFilter = gateway.filters.ContractCall(userAddress);
gateway.on(userFilter, (sender, destinationChain, contractAddress, payloadHash, payload, event) => {
    // Handle user-specific events
});

// Filter events by destination chain
const chainFilter = gateway.filters.ContractCall(null, "ethereum");
gateway.on(chainFilter, (sender, destinationChain, contractAddress, payloadHash, payload, event) => {
    // Handle Ethereum-specific events
});

// Get historical events
const fromBlock = await provider.getBlockNumber() - 1000;
const events = await gateway.queryFilter(gateway.filters.ContractCall(), fromBlock);

events.forEach(event => {
    console.log(`Historical event:`, event.args);
});
```

### Event Aggregation and Analytics

```javascript
class EventAnalytics {
    constructor(gatewayContract) {
        this.gateway = gatewayContract;
        this.metrics = {
            totalCalls: 0,
            chainDistribution: {},
            tokenTransfers: {},
            hourlyVolume: {}
        };
    }

    startMonitoring() {
        // Monitor contract calls
        this.gateway.on("ContractCall", (sender, destinationChain, contractAddress, payloadHash, payload, event) => {
            this.metrics.totalCalls++;
            
            if (!this.metrics.chainDistribution[destinationChain]) {
                this.metrics.chainDistribution[destinationChain] = 0;
            }
            this.metrics.chainDistribution[destinationChain]++;
            
            this.updateHourlyVolume();
        });

        // Monitor token transfers
        this.gateway.on("TokenSent", (sender, destinationChain, destinationAddress, symbol, amount, event) => {
            if (!this.metrics.tokenTransfers[symbol]) {
                this.metrics.tokenTransfers[symbol] = {
                    totalAmount: BigInt(0),
                    transferCount: 0
                };
            }
            
            this.metrics.tokenTransfers[symbol].totalAmount += amount;
            this.metrics.tokenTransfers[symbol].transferCount++;
        });
    }

    updateHourlyVolume() {
        const currentHour = Math.floor(Date.now() / (1000 * 60 * 60));
        if (!this.metrics.hourlyVolume[currentHour]) {
            this.metrics.hourlyVolume[currentHour] = 0;
        }
        this.metrics.hourlyVolume[currentHour]++;
    }

    getMetrics() {
        return {
            ...this.metrics,
            avgCallsPerHour: this.calculateAverageCallsPerHour(),
            topChains: this.getTopChains(),
            topTokens: this.getTopTokens()
        };
    }

    calculateAverageCallsPerHour() {
        const hours = Object.keys(this.metrics.hourlyVolume);
        if (hours.length === 0) return 0;
        
        const total = Object.values(this.metrics.hourlyVolume).reduce((sum, count) => sum + count, 0);
        return total / hours.length;
    }

    getTopChains() {
        return Object.entries(this.metrics.chainDistribution)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);
    }

    getTopTokens() {
        return Object.entries(this.metrics.tokenTransfers)
            .sort(([,a], [,b]) => Number(b.totalAmount - a.totalAmount))
            .slice(0, 5);
    }
}
```

## Error Handling Patterns

### Comprehensive Error Handling

```javascript
class ProtocolErrorHandler {
    constructor() {
        this.errorCounts = {};
        this.retryAttempts = {};
    }

    async handleTransaction(txFunction, retryCount = 3) {
        for (let attempt = 1; attempt <= retryCount; attempt++) {
            try {
                const result = await txFunction();
                
                // Reset retry count on success
                this.retryAttempts[txFunction.name] = 0;
                
                return result;
            } catch (error) {
                this.logError(error, attempt);
                
                if (this.isRetryableError(error) && attempt < retryCount) {
                    const delay = this.calculateBackoffDelay(attempt);
                    await this.sleep(delay);
                    continue;
                }
                
                throw this.enhanceError(error);
            }
        }
    }

    isRetryableError(error) {
        const retryablePatterns = [
            /network timeout/i,
            /insufficient funds/i,
            /gas price too low/i,
            /replacement transaction underpriced/i,
            /nonce too low/i
        ];

        return retryablePatterns.some(pattern => 
            pattern.test(error.message)
        );
    }

    enhanceError(error) {
        // Parse custom errors
        if (error.data) {
            const customError = this.parseCustomError(error.data);
            if (customError) {
                error.customError = customError;
                error.message = `${customError.name}: ${customError.message}`;
            }
        }

        // Add context
        error.timestamp = new Date().toISOString();
        error.errorCount = this.incrementErrorCount(error.message);

        return error;
    }

    parseCustomError(errorData) {
        const errorSignatures = {
            '0x1234...': { name: 'InvalidChain', decoder: (data) => `Chain ${data} not supported` },
            '0x5678...': { name: 'InsufficientBalance', decoder: (data) => `Insufficient balance` },
            // Add more error signatures
        };

        const signature = errorData.slice(0, 10);
        if (errorSignatures[signature]) {
            const errorInfo = errorSignatures[signature];
            return {
                name: errorInfo.name,
                message: errorInfo.decoder(errorData)
            };
        }

        return null;
    }

    calculateBackoffDelay(attempt) {
        return Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Max 30 seconds
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    logError(error, attempt) {
        console.error(`Transaction attempt ${attempt} failed:`, {
            message: error.message,
            code: error.code,
            data: error.data
        });
    }

    incrementErrorCount(errorMessage) {
        if (!this.errorCounts[errorMessage]) {
            this.errorCounts[errorMessage] = 0;
        }
        return ++this.errorCounts[errorMessage];
    }
}
```

### React Error Boundary

```jsx
import React from 'react';

class ProtocolErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Protocol error caught:', error, errorInfo);
        
        // Report to error tracking service
        this.reportError(error, errorInfo);
    }

    reportError(error, errorInfo) {
        // Parse protocol-specific errors
        const protocolError = this.parseProtocolError(error);
        
        // Send to monitoring service
        if (protocolError) {
            console.log('Protocol error detected:', protocolError);
        }
    }

    parseProtocolError(error) {
        if (error.customError) {
            return {
                type: 'protocol',
                name: error.customError.name,
                message: error.customError.message,
                severity: this.getErrorSeverity(error.customError.name)
            };
        }

        return null;
    }

    getErrorSeverity(errorName) {
        const severityMap = {
            'InvalidChain': 'high',
            'InsufficientBalance': 'medium',
            'InvalidSignature': 'high',
            'CommandAlreadyExecuted': 'low'
        };

        return severityMap[errorName] || 'medium';
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="error-boundary">
                    <h2>Something went wrong</h2>
                    <details>
                        <summary>Error details</summary>
                        <pre>{this.state.error?.message}</pre>
                        {this.state.error?.customError && (
                            <div>
                                <strong>Protocol Error:</strong> {this.state.error.customError.name}
                                <br />
                                <strong>Details:</strong> {this.state.error.customError.message}
                            </div>
                        )}
                    </details>
                    <button onClick={() => this.setState({ hasError: false, error: null })}>
                        Try again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
```

## Best Practices

### Event Monitoring

1. **Use Filters**: Filter events by user or specific parameters to reduce noise
2. **Handle Reconnections**: Implement robust connection handling for WebSocket providers
3. **Store Event History**: Cache important events for offline access
4. **Rate Limiting**: Implement rate limiting for high-frequency events

### Error Handling

1. **Categorize Errors**: Distinguish between user errors, network issues, and protocol errors
2. **Implement Retries**: Use exponential backoff for transient errors
3. **User Feedback**: Provide clear, actionable error messages to users
4. **Monitoring**: Track error patterns to identify systemic issues

### Performance

1. **Batch Event Queries**: Use `queryFilter` for historical data instead of individual calls
2. **Optimize Filters**: Use indexed parameters in event filters
3. **Connection Pooling**: Manage WebSocket connections efficiently
4. **Cleanup**: Remove event listeners when components unmount

## Resources

- [IXFI Gateway API](ixfi-gateway.md)
- [Cross-Chain Architecture](../core-concepts/cross-chain-architecture.md)
- [Integration Examples](../examples/)
- [Troubleshooting Guide](../resources/troubleshooting.md)
