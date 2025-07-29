# MulticallLibraryV2 API Reference

The MulticallLibraryV2 provides efficient batch execution of multiple function calls in a single transaction, optimized for gas efficiency and error handling.

## Overview

MulticallLibraryV2 enables developers to execute multiple contract calls atomically, reducing gas costs and improving user experience by bundling operations together.

## Library Interface

```solidity
library MulticallLibraryV2 {
    struct Call {
        address target;
        bytes callData;
        uint256 gasLimit;
    }
    
    struct CallWithValue {
        address target;
        bytes callData;
        uint256 value;
        uint256 gasLimit;
    }
    
    struct Result {
        bool success;
        bytes returnData;
        uint256 gasUsed;
    }
    
    function multicall(Call[] memory calls) external returns (Result[] memory results);
    function multicallWithValue(CallWithValue[] memory calls) external payable returns (Result[] memory results);
    function tryMulticall(Call[] memory calls) external returns (Result[] memory results);
    function aggregate(Call[] memory calls) external returns (uint256 blockNumber, bytes[] memory returnData);
}
```

## Core Functions

### multicall

Executes multiple calls and reverts if any call fails.

```solidity
function multicall(Call[] memory calls) external returns (Result[] memory results)
```

**Parameters:**
- `calls`: Array of Call structs containing target addresses and call data

**Returns:**
- `results`: Array of Result structs with success status, return data, and gas used

**Example:**
```solidity
MulticallLibraryV2.Call[] memory calls = new MulticallLibraryV2.Call[](2);

calls[0] = MulticallLibraryV2.Call({
    target: tokenAddress,
    callData: abi.encodeWithSignature("transfer(address,uint256)", recipient, amount),
    gasLimit: 100000
});

calls[1] = MulticallLibraryV2.Call({
    target: stakingAddress,
    callData: abi.encodeWithSignature("stake(uint256)", amount),
    gasLimit: 150000
});

MulticallLibraryV2.Result[] memory results = MulticallLibraryV2.multicall(calls);
```

### multicallWithValue

Executes multiple calls with ETH value, reverting if any call fails.

```solidity
function multicallWithValue(CallWithValue[] memory calls) external payable returns (Result[] memory results)
```

**Parameters:**
- `calls`: Array of CallWithValue structs including ETH value for each call

**Returns:**
- `results`: Array of Result structs with execution details

**Example:**
```solidity
MulticallLibraryV2.CallWithValue[] memory calls = new MulticallLibraryV2.CallWithValue[](2);

calls[0] = MulticallLibraryV2.CallWithValue({
    target: wethAddress,
    callData: abi.encodeWithSignature("deposit()"),
    value: 1 ether,
    gasLimit: 50000
});

calls[1] = MulticallLibraryV2.CallWithValue({
    target: dexAddress,
    callData: abi.encodeWithSignature("swap(address,address,uint256)", tokenA, tokenB, amount),
    value: 0,
    gasLimit: 200000
});

MulticallLibraryV2.Result[] memory results = MulticallLibraryV2.multicallWithValue{value: 1 ether}(calls);
```

### tryMulticall

Executes multiple calls without reverting on individual call failures.

```solidity
function tryMulticall(Call[] memory calls) external returns (Result[] memory results)
```

**Parameters:**
- `calls`: Array of Call structs to execute

**Returns:**
- `results`: Array of Result structs, including failed calls

**Example:**
```solidity
MulticallLibraryV2.Call[] memory calls = new MulticallLibraryV2.Call[](3);

// Some calls might fail, but execution continues
calls[0] = MulticallLibraryV2.Call({
    target: tokenA,
    callData: abi.encodeWithSignature("transfer(address,uint256)", recipient, amount1),
    gasLimit: 100000
});

calls[1] = MulticallLibraryV2.Call({
    target: tokenB,
    callData: abi.encodeWithSignature("transfer(address,uint256)", recipient, amount2),
    gasLimit: 100000
});

calls[2] = MulticallLibraryV2.Call({
    target: invalidAddress, // This might fail
    callData: abi.encodeWithSignature("someFunction()"),
    gasLimit: 50000
});

MulticallLibraryV2.Result[] memory results = MulticallLibraryV2.tryMulticall(calls);

// Check individual results
for (uint i = 0; i < results.length; i++) {
    if (results[i].success) {
        // Handle successful call
    } else {
        // Handle failed call
        string memory error = abi.decode(results[i].returnData, (string));
    }
}
```

### aggregate

Legacy function for basic multicall aggregation.

```solidity
function aggregate(Call[] memory calls) external returns (uint256 blockNumber, bytes[] memory returnData)
```

**Parameters:**
- `calls`: Array of Call structs to execute

**Returns:**
- `blockNumber`: Current block number
- `returnData`: Array of return data from each call

## Advanced Usage Patterns

### 1. DeFi Batch Operations

```solidity
contract DeFiBatchOperations {
    using MulticallLibraryV2 for MulticallLibraryV2.Call[];
    
    function swapAndStake(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        address dexRouter,
        address stakingContract
    ) external {
        MulticallLibraryV2.Call[] memory calls = new MulticallLibraryV2.Call[](3);
        
        // 1. Approve token for DEX
        calls[0] = MulticallLibraryV2.Call({
            target: tokenIn,
            callData: abi.encodeWithSignature("approve(address,uint256)", dexRouter, amountIn),
            gasLimit: 50000
        });
        
        // 2. Swap tokens
        calls[1] = MulticallLibraryV2.Call({
            target: dexRouter,
            callData: abi.encodeWithSignature(
                "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
                amountIn,
                0, // Accept any amount of tokens out
                getPath(tokenIn, tokenOut),
                address(this),
                block.timestamp + 300
            ),
            gasLimit: 200000
        });
        
        // 3. Stake received tokens
        calls[2] = MulticallLibraryV2.Call({
            target: stakingContract,
            callData: abi.encodeWithSignature("stakeAll()"),
            gasLimit: 150000
        });
        
        MulticallLibraryV2.Result[] memory results = MulticallLibraryV2.multicall(calls);
        
        // Verify all operations succeeded
        for (uint i = 0; i < results.length; i++) {
            require(results[i].success, "Batch operation failed");
        }
    }
}
```

### 2. NFT Batch Minting

```solidity
contract NFTBatchMinter {
    function batchMint(
        address nftContract,
        address[] memory recipients,
        uint256[] memory tokenIds
    ) external {
        require(recipients.length == tokenIds.length, "Array length mismatch");
        
        MulticallLibraryV2.Call[] memory calls = new MulticallLibraryV2.Call[](recipients.length);
        
        for (uint i = 0; i < recipients.length; i++) {
            calls[i] = MulticallLibraryV2.Call({
                target: nftContract,
                callData: abi.encodeWithSignature(
                    "mint(address,uint256)",
                    recipients[i],
                    tokenIds[i]
                ),
                gasLimit: 100000
            });
        }
        
        MulticallLibraryV2.Result[] memory results = MulticallLibraryV2.multicall(calls);
        
        uint256 successCount = 0;
        for (uint i = 0; i < results.length; i++) {
            if (results[i].success) {
                successCount++;
            }
        }
        
        emit BatchMintCompleted(successCount, recipients.length);
    }
}
```

### 3. Cross-Chain Batch Operations

```solidity
contract CrossChainBatchOps {
    IIXFIGateway public gateway;
    
    function batchCrossChainCalls(
        string[] memory destinationChains,
        address[] memory targetContracts,
        bytes[] memory payloads
    ) external {
        require(
            destinationChains.length == targetContracts.length &&
            targetContracts.length == payloads.length,
            "Array length mismatch"
        );
        
        MulticallLibraryV2.Call[] memory calls = new MulticallLibraryV2.Call[](destinationChains.length);
        
        for (uint i = 0; i < destinationChains.length; i++) {
            calls[i] = MulticallLibraryV2.Call({
                target: address(gateway),
                callData: abi.encodeWithSignature(
                    "callContract(string,string,bytes)",
                    destinationChains[i],
                    Strings.toHexString(uint160(targetContracts[i]), 20),
                    payloads[i]
                ),
                gasLimit: 200000
            });
        }
        
        MulticallLibraryV2.Result[] memory results = MulticallLibraryV2.tryMulticall(calls);
        
        emit BatchCrossChainCompleted(results);
    }
}
```

## Gas Optimization Features

### Dynamic Gas Limit Adjustment

```solidity
library GasOptimizedMulticall {
    function optimizedMulticall(
        MulticallLibraryV2.Call[] memory calls,
        uint256 baseGasPerCall
    ) external returns (MulticallLibraryV2.Result[] memory results) {
        results = new MulticallLibraryV2.Result[](calls.length);
        
        for (uint256 i = 0; i < calls.length; i++) {
            uint256 gasStart = gasleft();
            
            // Adjust gas limit based on remaining gas
            uint256 adjustedGasLimit = calls[i].gasLimit;
            if (gasStart < calls[i].gasLimit + baseGasPerCall) {
                adjustedGasLimit = gasStart - baseGasPerCall;
            }
            
            (bool success, bytes memory returnData) = calls[i].target.call{
                gas: adjustedGasLimit
            }(calls[i].callData);
            
            uint256 gasUsed = gasStart - gasleft();
            
            results[i] = MulticallLibraryV2.Result({
                success: success,
                returnData: returnData,
                gasUsed: gasUsed
            });
            
            if (!success && calls[i].gasLimit == adjustedGasLimit) {
                // If call failed and we used full gas limit, revert
                revert("Multicall failed");
            }
        }
        
        return results;
    }
}
```

### Gas Estimation

```solidity
contract MulticallGasEstimator {
    function estimateMulticallGas(
        MulticallLibraryV2.Call[] memory calls
    ) external returns (uint256[] memory gasEstimates) {
        gasEstimates = new uint256[](calls.length);
        
        for (uint256 i = 0; i < calls.length; i++) {
            try this.estimateSingleCall(calls[i]) returns (uint256 estimate) {
                gasEstimates[i] = estimate;
            } catch {
                gasEstimates[i] = calls[i].gasLimit; // Fallback to provided limit
            }
        }
        
        return gasEstimates;
    }
    
    function estimateSingleCall(
        MulticallLibraryV2.Call memory call
    ) external returns (uint256) {
        return ITargetContract(call.target).estimateGas(call.callData);
    }
}
```

## Error Handling

### Custom Error Types

```solidity
library MulticallErrors {
    error CallFailed(uint256 callIndex, address target, bytes callData, bytes reason);
    error InsufficientGas(uint256 callIndex, uint256 required, uint256 available);
    error InvalidCallData(uint256 callIndex, bytes callData);
    error TargetNotContract(uint256 callIndex, address target);
}
```

### Enhanced Error Reporting

```solidity
contract EnhancedMulticall {
    using MulticallLibraryV2 for MulticallLibraryV2.Call[];
    
    function safeMulticall(
        MulticallLibraryV2.Call[] memory calls
    ) external returns (MulticallLibraryV2.Result[] memory results) {
        results = new MulticallLibraryV2.Result[](calls.length);
        
        for (uint256 i = 0; i < calls.length; i++) {
            // Validate target is a contract
            if (calls[i].target.code.length == 0) {
                revert MulticallErrors.TargetNotContract(i, calls[i].target);
            }
            
            // Check gas availability
            if (gasleft() < calls[i].gasLimit + 5000) {
                revert MulticallErrors.InsufficientGas(i, calls[i].gasLimit, gasleft());
            }
            
            uint256 gasStart = gasleft();
            
            (bool success, bytes memory returnData) = calls[i].target.call{
                gas: calls[i].gasLimit
            }(calls[i].callData);
            
            uint256 gasUsed = gasStart - gasleft();
            
            results[i] = MulticallLibraryV2.Result({
                success: success,
                returnData: returnData,
                gasUsed: gasUsed
            });
            
            if (!success) {
                revert MulticallErrors.CallFailed(i, calls[i].target, calls[i].callData, returnData);
            }
        }
        
        return results;
    }
}
```

## Security Considerations

### Reentrancy Protection

```solidity
contract ReentrancyProtectedMulticall {
    bool private locked;
    
    modifier nonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }
    
    function secureMulticall(
        MulticallLibraryV2.Call[] memory calls
    ) external nonReentrant returns (MulticallLibraryV2.Result[] memory) {
        return MulticallLibraryV2.multicall(calls);
    }
}
```

### Access Control

```solidity
contract AccessControlledMulticall {
    mapping(address => bool) public authorized;
    mapping(address => bool) public allowedTargets;
    
    modifier onlyAuthorized() {
        require(authorized[msg.sender], "Not authorized");
        _;
    }
    
    function authorizedMulticall(
        MulticallLibraryV2.Call[] memory calls
    ) external onlyAuthorized returns (MulticallLibraryV2.Result[] memory) {
        // Validate all targets are allowed
        for (uint256 i = 0; i < calls.length; i++) {
            require(allowedTargets[calls[i].target], "Target not allowed");
        }
        
        return MulticallLibraryV2.multicall(calls);
    }
}
```

## Integration Examples

### Frontend JavaScript

```javascript
class MulticallManager {
    constructor(contractAddress, provider) {
        this.contract = new ethers.Contract(contractAddress, multicallABI, provider);
    }

    async prepareCalls(operations) {
        const calls = [];
        
        for (const op of operations) {
            const target = op.contract.address || op.contract.target;
            const callData = op.contract.interface.encodeFunctionData(op.method, op.args);
            
            calls.push({
                target: target,
                callData: callData,
                gasLimit: op.gasLimit || 200000
            });
        }
        
        return calls;
    }

    async executeMulticall(calls, options = {}) {
        try {
            const tx = await this.contract.multicall(calls, {
                gasLimit: options.gasLimit || 1000000,
                gasPrice: options.gasPrice
            });
            
            const receipt = await tx.wait();
            return this.parseResults(receipt);
        } catch (error) {
            console.error('Multicall failed:', error);
            throw error;
        }
    }

    async estimateGas(calls) {
        try {
            return await this.contract.estimateGas.multicall(calls);
        } catch (error) {
            console.error('Gas estimation failed:', error);
            return BigInt(1000000); // Fallback
        }
    }

    parseResults(receipt) {
        const results = [];
        
        // Parse MulticallExecuted events
        const events = receipt.logs.filter(log => 
            log.topics[0] === ethers.id("MulticallExecuted(uint256,bool,bytes)")
        );
        
        for (const event of events) {
            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
                ['uint256', 'bool', 'bytes'],
                event.data
            );
            
            results.push({
                callIndex: decoded[0],
                success: decoded[1],
                returnData: decoded[2]
            });
        }
        
        return results;
    }
}
```

### React Hook

```jsx
import { useState, useCallback } from 'react';
import { useContract, useSigner } from 'wagmi';

export function useMulticall(contractAddress) {
    const { data: signer } = useSigner();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const multicallContract = useContract({
        address: contractAddress,
        abi: multicallABI,
        signerOrProvider: signer
    });

    const executeBatch = useCallback(async (operations) => {
        if (!multicallContract) return;

        setIsLoading(true);
        setError(null);

        try {
            const manager = new MulticallManager(contractAddress, signer.provider);
            const calls = await manager.prepareCalls(operations);
            
            const gasEstimate = await manager.estimateGas(calls);
            const results = await manager.executeMulticall(calls, {
                gasLimit: gasEstimate * 110n / 100n // 10% buffer
            });

            return results;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [multicallContract, contractAddress, signer]);

    return {
        executeBatch,
        isLoading,
        error
    };
}
```

## Performance Metrics

| Operation Type | Gas Savings | Execution Time | Max Batch Size |
|----------------|-------------|----------------|----------------|
| Token Transfers | 60-80% | 40-60% faster | 50-100 calls |
| NFT Operations | 50-70% | 30-50% faster | 20-50 calls |
| DeFi Interactions | 40-60% | 50-70% faster | 10-30 calls |
| Cross-Chain Calls | 30-50% | 60-80% faster | 5-20 calls |

## Best Practices

### 1. Gas Optimization

- Set appropriate gas limits for each call
- Use `tryMulticall` for non-critical operations
- Batch similar operations together
- Monitor gas usage patterns

### 2. Error Handling

- Always check individual call results
- Implement proper fallback mechanisms
- Use descriptive error messages
- Log failed operations for debugging

### 3. Security

- Validate all target addresses
- Implement access controls where needed
- Use reentrancy protection
- Audit multicall implementations

### 4. User Experience

- Provide clear transaction previews
- Show individual operation status
- Implement retry mechanisms
- Optimize for mobile gas limits

## Resources

- [Cross-Chain Architecture](../core-concepts/cross-chain-architecture.md)
- [Gas Management](../cross-chain/gas-management.md)
- [Integration Examples](../examples/dex-aggregation.md)
- [Security Best Practices](../guides/security.md)
