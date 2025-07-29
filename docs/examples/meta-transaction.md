# Meta-Transaction Example

This example demonstrates how to implement gasless transactions using IXFI Protocol's meta-transaction infrastructure, allowing users to execute swaps without holding native tokens for gas.

## Overview

Meta-transactions enable users to execute blockchain operations without paying gas fees directly. Instead, a relayer pays the gas and is compensated through alternative mechanisms.

## Basic Meta-Transaction Implementation

### Frontend Implementation

```javascript
// examples/meta-transaction/frontend.js
import { ethers } from 'ethers';
import { IXFIGateway, MetaTxGateway } from '@ixfi/sdk';

class MetaTransactionExample {
  constructor(providerUrl, userPrivateKey, relayerUrl) {
    this.provider = new ethers.providers.JsonRpcProvider(providerUrl);
    this.userWallet = new ethers.Wallet(userPrivateKey, this.provider);
    this.relayerUrl = relayerUrl;
    
    // Initialize IXFI components
    this.gateway = new IXFIGateway({
      provider: this.provider
    });
    
    this.metaTxGateway = new MetaTxGateway({
      provider: this.provider,
      relayerUrl: this.relayerUrl
    });
  }

  /**
   * Execute a gasless token swap using meta-transactions
   */
  async executeGaslessSwap() {
    const swapParams = {
      tokenIn: '0xA0b86a33E6441e1a02c4e4670dd96EA0f25A632', // USDC
      tokenOut: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
      amountIn: ethers.utils.parseUnits('100', 6), // 100 USDC
      minAmountOut: ethers.utils.parseUnits('95', 6), // 95 USDT (5% slippage)
      routerType: 0, // Uniswap V2
      to: this.userWallet.address,
      deadline: Math.floor(Date.now() / 1000) + 1800 // 30 minutes
    };

    try {
      console.log('Creating meta-transaction for gasless swap...');
      
      // Step 1: Create meta-transaction data
      const metaTxData = await this.createMetaTransactionData(swapParams);
      
      // Step 2: Sign meta-transaction
      const signature = await this.signMetaTransaction(metaTxData);
      
      // Step 3: Submit to relayer
      const txHash = await this.submitToRelayer(metaTxData, signature);
      
      // Step 4: Monitor execution
      const receipt = await this.monitorMetaTransaction(txHash);
      
      console.log('Gasless swap completed!');
      return {
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice
      };
      
    } catch (error) {
      console.error('Gasless swap failed:', error);
      throw error;
    }
  }

  /**
   * Create meta-transaction data structure
   */
  async createMetaTransactionData(swapParams) {
    // Get the current nonce for the user
    const nonce = await this.metaTxGateway.getUserNonce(this.userWallet.address);
    
    // Encode the swap function call
    const swapCalldata = this.gateway.interface.encodeFunctionData(
      'executeSwap',
      [swapParams]
    );

    // Create meta-transaction structure
    const metaTx = {
      from: this.userWallet.address,
      to: this.gateway.address,
      value: 0,
      gas: 300000, // Estimated gas limit
      nonce: nonce,
      data: swapCalldata,
      chainId: await this.provider.getNetwork().then(n => n.chainId)
    };

    return metaTx;
  }

  /**
   * Sign meta-transaction using EIP-712
   */
  async signMetaTransaction(metaTxData) {
    // EIP-712 domain separator
    const domain = {
      name: 'IXFI Meta Transaction Gateway',
      version: '1',
      chainId: metaTxData.chainId,
      verifyingContract: this.metaTxGateway.address
    };

    // EIP-712 types
    const types = {
      MetaTransaction: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'gas', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'data', type: 'bytes' }
      ]
    };

    // Sign the structured data
    const signature = await this.userWallet._signTypedData(domain, types, metaTxData);
    
    return signature;
  }

  /**
   * Submit meta-transaction to relayer network
   */
  async submitToRelayer(metaTxData, signature) {
    const relayRequest = {
      metaTransaction: metaTxData,
      signature: signature,
      gasPrice: await this.provider.getGasPrice(),
      timestamp: Date.now()
    };

    const response = await fetch(`${this.relayerUrl}/relay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(relayRequest)
    });

    if (!response.ok) {
      throw new Error(`Relayer error: ${response.status}`);
    }

    const result = await response.json();
    return result.transactionHash;
  }

  /**
   * Monitor meta-transaction execution
   */
  async monitorMetaTransaction(txHash) {
    console.log('Monitoring meta-transaction:', txHash);
    
    // Poll for transaction confirmation
    let receipt = null;
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes
    
    while (!receipt && attempts < maxAttempts) {
      try {
        receipt = await this.provider.getTransactionReceipt(txHash);
        if (receipt) {
          break;
        }
      } catch (error) {
        console.log('Waiting for transaction confirmation...');
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      attempts++;
    }

    if (!receipt) {
      throw new Error('Transaction confirmation timeout');
    }

    return receipt;
  }

  /**
   * Execute batch meta-transactions
   */
  async executeBatchGaslessSwaps(swapParamsArray) {
    console.log(`Executing ${swapParamsArray.length} gasless swaps in batch...`);
    
    const metaTxDataArray = [];
    const signatures = [];
    
    // Create and sign all meta-transactions
    for (const swapParams of swapParamsArray) {
      const metaTxData = await this.createMetaTransactionData(swapParams);
      const signature = await this.signMetaTransaction(metaTxData);
      
      metaTxDataArray.push(metaTxData);
      signatures.push(signature);
    }

    // Submit batch to relayer
    const batchRequest = {
      metaTransactions: metaTxDataArray,
      signatures: signatures,
      gasPrice: await this.provider.getGasPrice(),
      timestamp: Date.now()
    };

    const response = await fetch(`${this.relayerUrl}/relay-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(batchRequest)
    });

    const result = await response.json();
    return result.transactionHashes;
  }

  /**
   * Check if user can execute gasless transaction
   */
  async canExecuteGasless(userAddress, swapAmount) {
    try {
      const response = await fetch(`${this.relayerUrl}/can-relay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user: userAddress,
          amount: swapAmount.toString()
        })
      });

      const result = await response.json();
      return {
        canRelay: result.canRelay,
        reason: result.reason,
        suggestedGasPrice: result.suggestedGasPrice,
        estimatedCost: result.estimatedCost
      };
      
    } catch (error) {
      console.error('Failed to check gasless eligibility:', error);
      return { canRelay: false, reason: 'Relayer unavailable' };
    }
  }
}

// Usage example
async function main() {
  const metaTxExample = new MetaTransactionExample(
    process.env.ETHEREUM_RPC_URL,
    process.env.USER_PRIVATE_KEY,
    process.env.RELAYER_URL
  );

  // Check if gasless transaction is possible
  const eligibility = await metaTxExample.canExecuteGasless(
    '0x742d35Cc6B67298b82e81F6C9B8a8A7e9ad86D12',
    ethers.utils.parseUnits('100', 6)
  );

  console.log('Gasless eligibility:', eligibility);

  if (eligibility.canRelay) {
    // Execute gasless swap
    const result = await metaTxExample.executeGaslessSwap();
    console.log('Gasless swap result:', result);
  }
}

// Run example
main().catch(console.error);
```

### Smart Contract Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IMetaTxGateway.sol";
import "./interfaces/IIXFIGateway.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract MetaTransactionGateway is IMetaTxGateway, EIP712, ReentrancyGuard, AccessControl {
    using ECDSA for bytes32;

    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant META_TRANSACTION_TYPEHASH = keccak256(
        "MetaTransaction(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"
    );

    IIXFIGateway public immutable ixfiGateway;
    
    mapping(address => uint256) public nonces;
    mapping(address => bool) public trustedForwarders;
    mapping(bytes32 => bool) public executedTransactions;

    event MetaTransactionExecuted(
        address indexed user,
        address indexed relayer,
        bytes32 indexed txHash,
        bool success,
        bytes returnData
    );

    event RelayerAdded(address indexed relayer);
    event RelayerRemoved(address indexed relayer);

    constructor(
        address _ixfiGateway,
        string memory _name,
        string memory _version
    ) EIP712(_name, _version) {
        ixfiGateway = IIXFIGateway(_ixfiGateway);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Execute a meta-transaction on behalf of a user
     * @param metaTx The meta-transaction data
     * @param signature The user's signature
     */
    function executeMetaTransaction(
        MetaTransaction calldata metaTx,
        bytes calldata signature
    ) external override nonReentrant onlyRole(RELAYER_ROLE) returns (bool success, bytes memory returnData) {
        // Verify signature
        require(_verifySignature(metaTx, signature), "Invalid signature");
        
        // Check nonce
        require(metaTx.nonce == nonces[metaTx.from], "Invalid nonce");
        
        // Generate transaction hash
        bytes32 txHash = _getMetaTransactionHash(metaTx);
        require(!executedTransactions[txHash], "Transaction already executed");
        
        // Mark as executed
        executedTransactions[txHash] = true;
        nonces[metaTx.from]++;

        // Execute the transaction
        (success, returnData) = metaTx.to.call{
            value: metaTx.value,
            gas: metaTx.gas
        }(abi.encodePacked(metaTx.data, metaTx.from));

        emit MetaTransactionExecuted(
            metaTx.from,
            msg.sender,
            txHash,
            success,
            returnData
        );
    }

    /**
     * @dev Execute multiple meta-transactions in batch
     */
    function executeMetaTransactionBatch(
        MetaTransaction[] calldata metaTxs,
        bytes[] calldata signatures
    ) external override nonReentrant onlyRole(RELAYER_ROLE) returns (bool[] memory successes, bytes[] memory returnDatas) {
        require(metaTxs.length == signatures.length, "Array length mismatch");
        require(metaTxs.length <= 10, "Too many transactions");

        successes = new bool[](metaTxs.length);
        returnDatas = new bytes[](metaTxs.length);

        for (uint256 i = 0; i < metaTxs.length; i++) {
            (successes[i], returnDatas[i]) = this.executeMetaTransaction(
                metaTxs[i],
                signatures[i]
            );
        }
    }

    /**
     * @dev Execute gasless swap using meta-transaction
     */
    function executeGaslessSwap(
        MetaTransaction calldata metaTx,
        bytes calldata signature,
        SwapParams calldata swapParams
    ) external onlyRole(RELAYER_ROLE) returns (uint256 amountOut) {
        // Verify and execute meta-transaction
        (bool success, bytes memory returnData) = this.executeMetaTransaction(metaTx, signature);
        require(success, "Meta-transaction failed");

        // Decode swap result
        amountOut = abi.decode(returnData, (uint256));

        // Charge relayer fee (if configured)
        _chargeRelayerFee(metaTx.from, swapParams.tokenOut, amountOut);
    }

    /**
     * @dev Execute gasless cross-chain swap
     */
    function executeGaslessCrossChainSwap(
        MetaTransaction calldata metaTx,
        bytes calldata signature,
        CrossChainSwapParams calldata swapParams
    ) external payable onlyRole(RELAYER_ROLE) {
        // Verify signature
        require(_verifySignature(metaTx, signature), "Invalid signature");
        
        // Execute cross-chain swap through IXFI Gateway
        ixfiGateway.crossChainSwap{value: msg.value}(swapParams);
        
        // Update nonce
        nonces[metaTx.from]++;
    }

    /**
     * @dev Verify meta-transaction signature
     */
    function _verifySignature(
        MetaTransaction calldata metaTx,
        bytes calldata signature
    ) internal view returns (bool) {
        bytes32 structHash = keccak256(
            abi.encode(
                META_TRANSACTION_TYPEHASH,
                metaTx.from,
                metaTx.to,
                metaTx.value,
                metaTx.gas,
                metaTx.nonce,
                keccak256(metaTx.data)
            )
        );

        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = hash.recover(signature);
        
        return signer == metaTx.from;
    }

    /**
     * @dev Generate meta-transaction hash
     */
    function _getMetaTransactionHash(
        MetaTransaction calldata metaTx
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                metaTx.from,
                metaTx.to,
                metaTx.value,
                metaTx.gas,
                metaTx.nonce,
                metaTx.data
            )
        );
    }

    /**
     * @dev Charge relayer fee from successful swap
     */
    function _chargeRelayerFee(
        address user,
        address token,
        uint256 swapOutput
    ) internal {
        // Calculate relayer fee (e.g., 0.1% of output)
        uint256 relayerFee = swapOutput * 10 / 10000;
        
        if (relayerFee > 0) {
            IERC20(token).transferFrom(user, msg.sender, relayerFee);
        }
    }

    /**
     * @dev Add a new relayer
     */
    function addRelayer(address relayer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(RELAYER_ROLE, relayer);
        emit RelayerAdded(relayer);
    }

    /**
     * @dev Remove a relayer
     */
    function removeRelayer(address relayer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(RELAYER_ROLE, relayer);
        emit RelayerRemoved(relayer);
    }

    /**
     * @dev Get user's current nonce
     */
    function getUserNonce(address user) external view override returns (uint256) {
        return nonces[user];
    }

    /**
     * @dev Check if transaction has been executed
     */
    function isTransactionExecuted(bytes32 txHash) external view returns (bool) {
        return executedTransactions[txHash];
    }

    /**
     * @dev Estimate gas cost for meta-transaction
     */
    function estimateGasCost(
        MetaTransaction calldata metaTx
    ) external view returns (uint256) {
        // Base gas cost for meta-transaction execution
        uint256 baseCost = 21000; // Standard transaction cost
        uint256 overheadCost = 50000; // Meta-transaction overhead
        
        return baseCost + overheadCost + metaTx.gas;
    }

    /**
     * @dev Emergency pause function
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        // Implement pause functionality
    }

    /**
     * @dev Recover stuck funds
     */
    function recoverFunds(
        address token,
        address to,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(0)) {
            payable(to).transfer(amount);
        } else {
            IERC20(token).transfer(to, amount);
        }
    }
}
```

### Relayer Network Implementation

```javascript
// relayer/meta-tx-relayer.js
const express = require('express');
const { ethers } = require('ethers');
const { Redis } = require('ioredis');

class MetaTxRelayer {
  constructor(config) {
    this.config = config;
    this.provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    this.redis = new Redis(config.redisUrl);
    
    // Initialize contracts
    this.metaTxGateway = new ethers.Contract(
      config.metaTxGatewayAddress,
      require('./abi/MetaTxGateway.json'),
      this.wallet
    );
    
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', relayer: this.wallet.address });
    });

    // Check if relayer can execute transaction
    this.app.post('/can-relay', async (req, res) => {
      try {
        const { user, amount } = req.body;
        const canRelay = await this.canRelayTransaction(user, amount);
        res.json(canRelay);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Relay single meta-transaction
    this.app.post('/relay', async (req, res) => {
      try {
        const { metaTransaction, signature } = req.body;
        const txHash = await this.relayMetaTransaction(metaTransaction, signature);
        res.json({ transactionHash: txHash });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Relay batch meta-transactions
    this.app.post('/relay-batch', async (req, res) => {
      try {
        const { metaTransactions, signatures } = req.body;
        const txHashes = await this.relayBatchMetaTransactions(metaTransactions, signatures);
        res.json({ transactionHashes: txHashes });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get relayer stats
    this.app.get('/stats', async (req, res) => {
      const stats = await this.getRelayerStats();
      res.json(stats);
    });
  }

  async canRelayTransaction(user, amount) {
    // Check relayer balance
    const balance = await this.wallet.getBalance();
    const minBalance = ethers.utils.parseEther('0.1'); // Minimum 0.1 ETH
    
    if (balance.lt(minBalance)) {
      return {
        canRelay: false,
        reason: 'Insufficient relayer balance'
      };
    }

    // Check user's swap amount vs minimum threshold
    const minSwapAmount = ethers.utils.parseUnits('10', 6); // $10 minimum
    if (ethers.BigNumber.from(amount).lt(minSwapAmount)) {
      return {
        canRelay: false,
        reason: 'Swap amount below minimum threshold'
      };
    }

    // Check rate limiting
    const userTxCount = await this.redis.get(`user_tx_count:${user}`) || 0;
    if (parseInt(userTxCount) >= this.config.maxTxPerUser) {
      return {
        canRelay: false,
        reason: 'Rate limit exceeded'
      };
    }

    const gasPrice = await this.provider.getGasPrice();
    const estimatedCost = gasPrice.mul(300000); // Estimated gas limit

    return {
      canRelay: true,
      suggestedGasPrice: gasPrice.toString(),
      estimatedCost: estimatedCost.toString()
    };
  }

  async relayMetaTransaction(metaTx, signature) {
    // Validate meta-transaction
    await this.validateMetaTransaction(metaTx, signature);

    // Check rate limiting
    await this.checkRateLimit(metaTx.from);

    try {
      // Execute meta-transaction
      const tx = await this.metaTxGateway.executeMetaTransaction(
        metaTx,
        signature,
        {
          gasLimit: 500000,
          gasPrice: await this.provider.getGasPrice()
        }
      );

      // Update rate limiting
      await this.updateRateLimit(metaTx.from);

      // Store transaction for monitoring
      await this.storeTransaction(tx.hash, metaTx.from);

      console.log(`Meta-transaction relayed: ${tx.hash}`);
      return tx.hash;

    } catch (error) {
      console.error('Failed to relay meta-transaction:', error);
      throw error;
    }
  }

  async relayBatchMetaTransactions(metaTxs, signatures) {
    // Validate all transactions
    for (let i = 0; i < metaTxs.length; i++) {
      await this.validateMetaTransaction(metaTxs[i], signatures[i]);
    }

    try {
      const tx = await this.metaTxGateway.executeMetaTransactionBatch(
        metaTxs,
        signatures,
        {
          gasLimit: 1000000 * metaTxs.length,
          gasPrice: await this.provider.getGasPrice()
        }
      );

      // Update rate limiting for all users
      for (const metaTx of metaTxs) {
        await this.updateRateLimit(metaTx.from);
      }

      return [tx.hash]; // Batch returns single transaction
      
    } catch (error) {
      console.error('Failed to relay batch meta-transactions:', error);
      throw error;
    }
  }

  async validateMetaTransaction(metaTx, signature) {
    // Verify signature
    const isValid = await this.verifySignature(metaTx, signature);
    if (!isValid) {
      throw new Error('Invalid signature');
    }

    // Check nonce
    const currentNonce = await this.metaTxGateway.getUserNonce(metaTx.from);
    if (metaTx.nonce !== currentNonce.toNumber()) {
      throw new Error('Invalid nonce');
    }

    // Check if already executed
    const txHash = this.getMetaTransactionHash(metaTx);
    const isExecuted = await this.metaTxGateway.isTransactionExecuted(txHash);
    if (isExecuted) {
      throw new Error('Transaction already executed');
    }
  }

  async verifySignature(metaTx, signature) {
    // This would implement EIP-712 signature verification
    // For now, simplified verification
    return true;
  }

  getMetaTransactionHash(metaTx) {
    return ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['address', 'address', 'uint256', 'uint256', 'uint256', 'bytes'],
        [metaTx.from, metaTx.to, metaTx.value, metaTx.gas, metaTx.nonce, metaTx.data]
      )
    );
  }

  async checkRateLimit(user) {
    const key = `user_tx_count:${user}`;
    const count = await this.redis.get(key) || 0;
    
    if (parseInt(count) >= this.config.maxTxPerUser) {
      throw new Error('Rate limit exceeded');
    }
  }

  async updateRateLimit(user) {
    const key = `user_tx_count:${user}`;
    await this.redis.incr(key);
    await this.redis.expire(key, 3600); // 1 hour window
  }

  async storeTransaction(txHash, user) {
    const txData = {
      hash: txHash,
      user: user,
      timestamp: Date.now(),
      relayer: this.wallet.address
    };

    await this.redis.setex(
      `tx:${txHash}`,
      86400, // 24 hours
      JSON.stringify(txData)
    );
  }

  async getRelayerStats() {
    const balance = await this.wallet.getBalance();
    const txCount = await this.redis.get('total_tx_count') || 0;
    
    return {
      relayerAddress: this.wallet.address,
      balance: ethers.utils.formatEther(balance),
      totalTransactions: parseInt(txCount),
      isActive: true
    };
  }

  start(port = 3000) {
    this.app.listen(port, () => {
      console.log(`Meta-transaction relayer running on port ${port}`);
      console.log(`Relayer address: ${this.wallet.address}`);
    });
  }
}

// Configuration and startup
const config = {
  rpcUrl: process.env.RPC_URL,
  privateKey: process.env.RELAYER_PRIVATE_KEY,
  metaTxGatewayAddress: process.env.META_TX_GATEWAY_ADDRESS,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  maxTxPerUser: 10
};

const relayer = new MetaTxRelayer(config);
relayer.start();

module.exports = MetaTxRelayer;
```

### React Hook Integration

```javascript
// hooks/useMetaTransaction.js
import { useState, useCallback } from 'react';
import { ethers } from 'ethers';

export const useMetaTransaction = (relayerUrl) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const executeGaslessTransaction = useCallback(async (
    contractAddress,
    functionName,
    params,
    signer
  ) => {
    setLoading(true);
    setError(null);

    try {
      // Create meta-transaction data
      const contract = new ethers.Contract(contractAddress, abi, signer);
      const nonce = await getUserNonce(signer.address);
      
      const metaTx = {
        from: signer.address,
        to: contractAddress,
        value: 0,
        gas: 300000,
        nonce: nonce,
        data: contract.interface.encodeFunctionData(functionName, params),
        chainId: await signer.getChainId()
      };

      // Sign meta-transaction
      const signature = await signMetaTransaction(metaTx, signer);

      // Submit to relayer
      const response = await fetch(`${relayerUrl}/relay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metaTransaction: metaTx,
          signature: signature
        })
      });

      if (!response.ok) {
        throw new Error(`Relayer error: ${response.status}`);
      }

      const result = await response.json();
      return result.transactionHash;

    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [relayerUrl]);

  const checkGaslessEligibility = useCallback(async (userAddress, amount) => {
    try {
      const response = await fetch(`${relayerUrl}/can-relay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: userAddress, amount: amount.toString() })
      });

      return await response.json();
    } catch (err) {
      console.error('Failed to check gasless eligibility:', err);
      return { canRelay: false, reason: 'Relayer unavailable' };
    }
  }, [relayerUrl]);

  return {
    executeGaslessTransaction,
    checkGaslessEligibility,
    loading,
    error
  };
};
```

## Testing

```javascript
// test/meta-transaction.test.js
describe('Meta-Transaction Example', () => {
  let metaTxExample;
  let user;
  let relayer;

  beforeEach(async () => {
    [user, relayer] = await ethers.getSigners();
    
    metaTxExample = new MetaTransactionExample(
      provider.connection.url,
      user.privateKey,
      'http://localhost:3000'
    );
  });

  it('should execute gasless swap successfully', async () => {
    const eligibility = await metaTxExample.canExecuteGasless(
      user.address,
      ethers.utils.parseUnits('100', 6)
    );

    expect(eligibility.canRelay).to.be.true;

    const result = await metaTxExample.executeGaslessSwap();
    expect(result.transactionHash).to.be.a('string');
  });

  it('should batch multiple gasless swaps', async () => {
    const swaps = [
      { /* swap 1 params */ },
      { /* swap 2 params */ }
    ];

    const txHashes = await metaTxExample.executeBatchGaslessSwaps(swaps);
    expect(txHashes).to.have.length(2);
  });
});
```

## Resources

- [EIP-712 Typed Data Signing](https://eips.ethereum.org/EIPS/eip-712)
- [OpenZeppelin Meta-Transactions](https://docs.openzeppelin.com/contracts/4.x/api/metatx)
- [Gas Optimization Guide](../guides/gas-optimization.md)
- [Security Best Practices](../guides/security.md)
- [API Reference](../api-reference/meta-tx-gateway.md)
