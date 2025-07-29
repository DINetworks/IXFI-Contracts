# Security Guide

This comprehensive guide covers security considerations, best practices, and implementation strategies for IXFI Protocol integrations and deployments.

## Overview

Security is paramount in DeFi protocols. IXFI Protocol implements multiple layers of security:

1. **Smart Contract Security**: Secure coding practices and formal verification
2. **Access Control**: Role-based permissions and multi-signature governance
3. **Economic Security**: MEV protection and slippage controls
4. **Operational Security**: Monitoring, incident response, and emergency procedures
5. **Integration Security**: Secure API usage and key management

## Smart Contract Security

### Secure Coding Patterns

#### 1. Reentrancy Protection

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SecureSwap is ReentrancyGuard {
    mapping(address => uint256) private balances;

    function executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external nonReentrant {
        // Checks
        require(amountIn > 0, "Invalid amount");
        require(tokenIn != tokenOut, "Same token");
        
        // Effects
        balances[msg.sender] -= amountIn;
        
        // Interactions (external calls at the end)
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        
        uint256 amountOut = _performSwap(tokenIn, tokenOut, amountIn);
        require(amountOut >= minAmountOut, "Insufficient output");
        
        IERC20(tokenOut).transfer(msg.sender, amountOut);
    }
}
```

#### 2. Integer Overflow/Underflow Protection

```solidity
// Using OpenZeppelin's SafeMath (for Solidity < 0.8.0)
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract SafeMathExample {
    using SafeMath for uint256;

    function calculateFee(uint256 amount, uint256 feeBps) external pure returns (uint256) {
        // Safe multiplication and division
        return amount.mul(feeBps).div(10000);
    }
}

// For Solidity 0.8.0+, overflow protection is built-in
contract ModernSafeMath {
    function calculateFee(uint256 amount, uint256 feeBps) external pure returns (uint256) {
        // Automatic overflow/underflow protection
        return (amount * feeBps) / 10000;
    }
    
    function safeSubtraction(uint256 a, uint256 b) external pure returns (uint256) {
        require(a >= b, "Underflow");
        return a - b;
    }
}
```

#### 3. Access Control Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract SecureIXFIGateway is AccessControl, Pausable {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
    }

    modifier onlyOperator() {
        require(hasRole(OPERATOR_ROLE, msg.sender), "Not an operator");
        _;
    }

    modifier onlyRelayer() {
        require(hasRole(RELAYER_ROLE, msg.sender), "Not a relayer");
        _;
    }

    modifier onlyEmergency() {
        require(hasRole(EMERGENCY_ROLE, msg.sender), "Not emergency role");
        _;
    }

    function setProtocolFee(uint256 newFee) external onlyOperator {
        require(newFee <= 500, "Fee too high"); // Max 5%
        protocolFee = newFee;
    }

    function emergencyPause() external onlyEmergency {
        _pause();
    }

    function emergencyUnpause() external onlyEmergency {
        _unpause();
    }

    function executeMetaTransaction(bytes calldata data) external onlyRelayer whenNotPaused {
        // Meta-transaction execution
    }
}
```

#### 4. Input Validation and Sanitization

```solidity
contract InputValidation {
    uint256 public constant MAX_SLIPPAGE = 1000; // 10%
    uint256 public constant MIN_AMOUNT = 1e6; // Minimum swap amount
    uint256 public constant MAX_AMOUNT = 1e30; // Maximum swap amount

    function validateSwapParams(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) internal view {
        require(tokenIn != address(0), "Invalid token in");
        require(tokenOut != address(0), "Invalid token out");
        require(tokenIn != tokenOut, "Same token");
        require(amountIn >= MIN_AMOUNT, "Amount too small");
        require(amountIn <= MAX_AMOUNT, "Amount too large");
        require(deadline > block.timestamp, "Expired deadline");
        
        // Validate slippage protection
        uint256 maxSlippage = (amountIn * MAX_SLIPPAGE) / 10000;
        require(minAmountOut >= amountIn - maxSlippage, "Excessive slippage");
    }

    function validateAddress(address addr) internal pure {
        require(addr != address(0), "Zero address");
        require(addr.code.length > 0, "Not a contract");
    }

    function validateChainId(uint256 chainId) internal view {
        require(chainId != block.chainid, "Same chain");
        require(supportedChains[chainId], "Unsupported chain");
    }
}
```

### Advanced Security Patterns

#### 1. Circuit Breaker Pattern

```solidity
contract CircuitBreaker {
    uint256 public constant CIRCUIT_BREAKER_THRESHOLD = 1000 ether;
    uint256 public constant CIRCUIT_BREAKER_WINDOW = 1 hours;
    
    mapping(uint256 => uint256) public hourlyVolume;
    bool public circuitBreakerTripped;
    uint256 public lastResetTime;

    modifier circuitBreakerCheck(uint256 amount) {
        uint256 currentHour = block.timestamp / 1 hours;
        
        // Reset if new hour
        if (currentHour > lastResetTime) {
            hourlyVolume[currentHour] = 0;
            lastResetTime = currentHour;
            circuitBreakerTripped = false;
        }

        // Check if adding this transaction would trip the breaker
        if (hourlyVolume[currentHour] + amount > CIRCUIT_BREAKER_THRESHOLD) {
            circuitBreakerTripped = true;
            revert("Circuit breaker tripped");
        }

        hourlyVolume[currentHour] += amount;
        _;
    }

    function executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external circuitBreakerCheck(amountIn) {
        // Swap execution logic
    }

    function resetCircuitBreaker() external onlyOwner {
        circuitBreakerTripped = false;
        // Additional security checks before reset
    }
}
```

#### 2. Merkle Proof Verification

```solidity
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract WhitelistVerification {
    bytes32 public merkleRoot;
    mapping(address => bool) public claimed;

    function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
        merkleRoot = _merkleRoot;
    }

    function verifyWhitelist(
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) public view returns (bool) {
        bytes32 node = keccak256(abi.encodePacked(account, amount));
        return MerkleProof.verify(merkleProof, merkleRoot, node);
    }

    function claimWhitelistBenefit(
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external {
        require(!claimed[msg.sender], "Already claimed");
        require(verifyWhitelist(msg.sender, amount, merkleProof), "Invalid proof");
        
        claimed[msg.sender] = true;
        // Grant benefit
    }
}
```

#### 3. Signature Verification for Meta-Transactions

```solidity
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract MetaTransactionSecurity is EIP712 {
    using ECDSA for bytes32;

    bytes32 private constant META_TRANSACTION_TYPEHASH = 
        keccak256("MetaTransaction(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data,uint256 chainId)");

    mapping(address => uint256) public nonces;
    mapping(bytes32 => bool) public executedTransactions;

    constructor() EIP712("IXFIMetaTransaction", "1") {}

    struct MetaTransaction {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        bytes data;
        uint256 chainId;
    }

    function executeMetaTransaction(
        MetaTransaction calldata metaTx,
        bytes calldata signature
    ) external returns (bool success, bytes memory returnData) {
        // Verify chain ID
        require(metaTx.chainId == block.chainid, "Invalid chain");
        
        // Verify nonce
        require(metaTx.nonce == nonces[metaTx.from], "Invalid nonce");
        
        // Create transaction hash
        bytes32 structHash = keccak256(abi.encode(
            META_TRANSACTION_TYPEHASH,
            metaTx.from,
            metaTx.to,
            metaTx.value,
            metaTx.gas,
            metaTx.nonce,
            keccak256(metaTx.data),
            metaTx.chainId
        ));
        
        bytes32 hash = _hashTypedDataV4(structHash);
        
        // Verify signature
        address signer = hash.recover(signature);
        require(signer == metaTx.from, "Invalid signature");
        
        // Prevent replay attacks
        require(!executedTransactions[hash], "Already executed");
        executedTransactions[hash] = true;
        
        // Increment nonce
        nonces[metaTx.from]++;
        
        // Execute transaction
        (success, returnData) = metaTx.to.call{value: metaTx.value, gas: metaTx.gas}(metaTx.data);
        
        require(success, "Transaction failed");
    }
}
```

## Economic Security

### MEV Protection

#### 1. Commit-Reveal Scheme

```solidity
contract MEVProtection {
    struct Commitment {
        bytes32 commitHash;
        uint256 commitTime;
        bool revealed;
    }

    mapping(address => Commitment) public commitments;
    uint256 public constant REVEAL_DELAY = 1 minutes;
    uint256 public constant REVEAL_WINDOW = 5 minutes;

    function commitSwap(bytes32 commitHash) external {
        commitments[msg.sender] = Commitment({
            commitHash: commitHash,
            commitTime: block.timestamp,
            revealed: false
        });
    }

    function revealAndExecuteSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 nonce
    ) external {
        Commitment storage commitment = commitments[msg.sender];
        
        // Check timing constraints
        require(block.timestamp >= commitment.commitTime + REVEAL_DELAY, "Too early");
        require(block.timestamp <= commitment.commitTime + REVEAL_WINDOW, "Too late");
        require(!commitment.revealed, "Already revealed");

        // Verify commitment
        bytes32 hash = keccak256(abi.encodePacked(
            msg.sender, tokenIn, tokenOut, amountIn, minAmountOut, nonce
        ));
        require(hash == commitment.commitHash, "Invalid commitment");

        commitment.revealed = true;
        
        // Execute swap
        _executeSwap(tokenIn, tokenOut, amountIn, minAmountOut);
    }
}
```

#### 2. Batch Auction System

```solidity
contract BatchAuction {
    struct Order {
        address user;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 gasPrice;
    }

    struct Batch {
        Order[] orders;
        uint256 deadline;
        bool executed;
    }

    mapping(uint256 => Batch) public batches;
    uint256 public currentBatchId;
    uint256 public constant BATCH_DURATION = 30 seconds;

    function submitOrder(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external {
        uint256 batchId = block.timestamp / BATCH_DURATION;
        
        batches[batchId].orders.push(Order({
            user: msg.sender,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            minAmountOut: minAmountOut,
            gasPrice: tx.gasprice
        }));

        batches[batchId].deadline = (batchId + 1) * BATCH_DURATION;
    }

    function executeBatch(uint256 batchId) external {
        Batch storage batch = batches[batchId];
        require(block.timestamp >= batch.deadline, "Batch not ready");
        require(!batch.executed, "Already executed");

        batch.executed = true;

        // Sort orders by gas price (highest first) for fair execution
        _sortOrdersByGasPrice(batch.orders);

        // Execute orders in batch
        for (uint i = 0; i < batch.orders.length; i++) {
            _executeOrder(batch.orders[i]);
        }
    }
}
```

### Slippage Protection

#### 1. Dynamic Slippage Calculation

```solidity
contract DynamicSlippage {
    mapping(address => uint256) public tokenLiquidity;
    mapping(address => uint256) public volatilityScores;

    function calculateDynamicSlippage(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) public view returns (uint256 maxSlippage) {
        uint256 liquidityIn = tokenLiquidity[tokenIn];
        uint256 liquidityOut = tokenLiquidity[tokenOut];
        
        // Base slippage based on trade size relative to liquidity
        uint256 tradeImpact = (amountIn * 10000) / liquidityIn;
        
        // Volatility adjustment
        uint256 volatility = (volatilityScores[tokenIn] + volatilityScores[tokenOut]) / 2;
        
        // Calculate dynamic slippage (in basis points)
        maxSlippage = 50 + tradeImpact + volatility; // Base 0.5% + trade impact + volatility
        
        // Cap at maximum 10%
        if (maxSlippage > 1000) {
            maxSlippage = 1000;
        }
    }

    function executeSwapWithDynamicSlippage(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external {
        uint256 maxSlippage = calculateDynamicSlippage(tokenIn, tokenOut, amountIn);
        uint256 minAmountOut = amountIn - (amountIn * maxSlippage / 10000);
        
        _executeSwap(tokenIn, tokenOut, amountIn, minAmountOut);
    }
}
```

#### 2. Time-Weighted Average Price (TWAP) Oracle

```solidity
contract TWAPOracle {
    struct PriceObservation {
        uint256 timestamp;
        uint256 price;
        uint256 cumulativePrice;
    }

    mapping(address => PriceObservation[]) public priceHistory;
    uint256 public constant TWAP_PERIOD = 30 minutes;

    function updatePrice(address token, uint256 newPrice) external onlyOracle {
        PriceObservation[] storage history = priceHistory[token];
        
        uint256 timeElapsed = 0;
        if (history.length > 0) {
            timeElapsed = block.timestamp - history[history.length - 1].timestamp;
        }

        uint256 cumulativePrice = 0;
        if (history.length > 0) {
            cumulativePrice = history[history.length - 1].cumulativePrice + 
                            (history[history.length - 1].price * timeElapsed);
        }

        history.push(PriceObservation({
            timestamp: block.timestamp,
            price: newPrice,
            cumulativePrice: cumulativePrice
        }));

        // Clean old observations
        _cleanOldObservations(token);
    }

    function getTWAP(address token) public view returns (uint256) {
        PriceObservation[] storage history = priceHistory[token];
        require(history.length >= 2, "Insufficient data");

        uint256 targetTime = block.timestamp - TWAP_PERIOD;
        uint256 oldestIndex = _findOldestValidObservation(token, targetTime);
        
        PriceObservation memory oldest = history[oldestIndex];
        PriceObservation memory newest = history[history.length - 1];

        uint256 timeWeightedSum = newest.cumulativePrice - oldest.cumulativePrice;
        uint256 totalTime = newest.timestamp - oldest.timestamp;

        return timeWeightedSum / totalTime;
    }

    function validatePriceDeviation(
        address token,
        uint256 currentPrice,
        uint256 maxDeviationBps
    ) external view returns (bool) {
        uint256 twapPrice = getTWAP(token);
        uint256 deviation = currentPrice > twapPrice 
            ? (currentPrice - twapPrice) * 10000 / twapPrice
            : (twapPrice - currentPrice) * 10000 / twapPrice;
            
        return deviation <= maxDeviationBps;
    }
}
```

## Operational Security

### Monitoring and Alerting

#### 1. Real-time Monitoring System

```javascript
// monitoring/realtime-monitor.js
const { ethers } = require('ethers');
const WebSocket = require('ws');

class IXFIMonitor {
  constructor(config) {
    this.provider = new ethers.providers.WebSocketProvider(config.wsUrl);
    this.contracts = config.contracts;
    this.alertThresholds = config.alertThresholds;
    this.alertHandlers = [];
  }

  async startMonitoring() {
    console.log('Starting IXFI Protocol monitoring...');

    // Monitor contract events
    await this.monitorContractEvents();
    
    // Monitor transaction mempool
    await this.monitorMempool();
    
    // Monitor gas prices
    await this.monitorGasPrices();
    
    // Monitor contract balances
    await this.monitorBalances();
  }

  async monitorContractEvents() {
    // Monitor CrossChainAggregator events
    const aggregator = new ethers.Contract(
      this.contracts.aggregator,
      ['event SwapExecuted(address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint8 routerType)'],
      this.provider
    );

    aggregator.on('SwapExecuted', (user, tokenIn, tokenOut, amountIn, amountOut, routerType, event) => {
      const swapData = {
        user,
        tokenIn,
        tokenOut,
        amountIn: ethers.utils.formatEther(amountIn),
        amountOut: ethers.utils.formatEther(amountOut),
        routerType,
        txHash: event.transactionHash,
        blockNumber: event.blockNumber
      };

      // Check for unusual activity
      if (parseFloat(swapData.amountIn) > this.alertThresholds.largeSwap) {
        this.triggerAlert('LARGE_SWAP', `Large swap detected: ${swapData.amountIn} tokens`, swapData);
      }

      // Check slippage
      const expectedOut = parseFloat(swapData.amountIn) * 0.95; // Assume 5% slippage
      const actualOut = parseFloat(swapData.amountOut);
      if (actualOut < expectedOut * 0.9) { // More than 10% additional slippage
        this.triggerAlert('HIGH_SLIPPAGE', `High slippage detected`, swapData);
      }

      console.log('Swap executed:', swapData);
    });

    // Monitor emergency events
    aggregator.on('Paused', (account, event) => {
      this.triggerAlert('CONTRACT_PAUSED', `Contract paused by ${account}`, {
        account,
        txHash: event.transactionHash
      });
    });
  }

  async monitorMempool() {
    this.provider.on('pending', async (txHash) => {
      try {
        const tx = await this.provider.getTransaction(txHash);
        
        if (tx && tx.to && Object.values(this.contracts).includes(tx.to.toLowerCase())) {
          // Analyze transaction for potential MEV attacks
          await this.analyzePendingTransaction(tx);
        }
      } catch (error) {
        // Ignore errors for pending transactions
      }
    });
  }

  async analyzePendingTransaction(tx) {
    // Check for sandwich attacks
    const gasPrice = tx.gasPrice;
    const value = tx.value;

    if (gasPrice && gasPrice.gt(ethers.utils.parseUnits('100', 'gwei'))) {
      this.triggerAlert('HIGH_GAS_PRICE', `Transaction with high gas price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`, {
        txHash: tx.hash,
        from: tx.from,
        to: tx.to,
        gasPrice: ethers.utils.formatUnits(gasPrice, 'gwei')
      });
    }
  }

  async monitorGasPrices() {
    setInterval(async () => {
      try {
        const gasPrice = await this.provider.getGasPrice();
        const gasPriceGwei = parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei'));

        if (gasPriceGwei > this.alertThresholds.highGasPrice) {
          this.triggerAlert('HIGH_NETWORK_GAS', `Network gas price: ${gasPriceGwei} gwei`, {
            gasPrice: gasPriceGwei
          });
        }
      } catch (error) {
        console.error('Gas price monitoring error:', error);
      }
    }, 60000); // Check every minute
  }

  async monitorBalances() {
    setInterval(async () => {
      for (const [name, address] of Object.entries(this.contracts)) {
        try {
          const balance = await this.provider.getBalance(address);
          const balanceETH = parseFloat(ethers.utils.formatEther(balance));

          if (balanceETH < this.alertThresholds.lowBalance) {
            this.triggerAlert('LOW_CONTRACT_BALANCE', `Low balance for ${name}: ${balanceETH} ETH`, {
              contract: name,
              address,
              balance: balanceETH
            });
          }
        } catch (error) {
          console.error(`Balance monitoring error for ${name}:`, error);
        }
      }
    }, 300000); // Check every 5 minutes
  }

  addAlertHandler(handler) {
    this.alertHandlers.push(handler);
  }

  triggerAlert(type, message, data = {}) {
    const alert = {
      type,
      message,
      data,
      timestamp: new Date().toISOString(),
      severity: this.getAlertSeverity(type)
    };

    console.warn(`🚨 ALERT [${alert.severity}]: ${message}`);

    // Notify all alert handlers
    this.alertHandlers.forEach(handler => {
      try {
        handler(alert);
      } catch (error) {
        console.error('Alert handler error:', error);
      }
    });
  }

  getAlertSeverity(type) {
    const severityMap = {
      'LARGE_SWAP': 'INFO',
      'HIGH_SLIPPAGE': 'WARNING',
      'CONTRACT_PAUSED': 'CRITICAL',
      'HIGH_GAS_PRICE': 'WARNING',
      'HIGH_NETWORK_GAS': 'INFO',
      'LOW_CONTRACT_BALANCE': 'WARNING'
    };

    return severityMap[type] || 'INFO';
  }
}

// Alert handlers
function discordAlertHandler(alert) {
  // Send alert to Discord webhook
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return;

  const payload = {
    embeds: [{
      title: `🚨 IXFI Protocol Alert`,
      description: alert.message,
      color: alert.severity === 'CRITICAL' ? 15158332 : alert.severity === 'WARNING' ? 16776960 : 65280,
      fields: [
        { name: 'Type', value: alert.type, inline: true },
        { name: 'Severity', value: alert.severity, inline: true },
        { name: 'Timestamp', value: alert.timestamp, inline: true }
      ]
    }]
  };

  fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(console.error);
}

function emailAlertHandler(alert) {
  // Send email alert
  console.log('Email alert would be sent:', alert);
}

// Usage
const monitor = new IXFIMonitor({
  wsUrl: process.env.ETHEREUM_WS_URL,
  contracts: {
    aggregator: '0x...',
    metaTxGateway: '0x...',
    gasCreditVault: '0x...'
  },
  alertThresholds: {
    largeSwap: 10000, // ETH
    highGasPrice: 50, // gwei
    lowBalance: 1 // ETH
  }
});

monitor.addAlertHandler(discordAlertHandler);
monitor.addAlertHandler(emailAlertHandler);

monitor.startMonitoring();
```

#### 2. Security Dashboard

```javascript
// monitoring/security-dashboard.js
const express = require('express');
const WebSocket = require('ws');

class SecurityDashboard {
  constructor() {
    this.app = express();
    this.wss = new WebSocket.Server({ port: 8080 });
    this.securityMetrics = {
      totalSwaps: 0,
      totalVolume: 0,
      averageSlippage: 0,
      gasUsage: [],
      alertCount: 0,
      lastAlert: null
    };
  }

  start() {
    this.setupRoutes();
    this.setupWebSocket();
    this.startMetricsCollection();
    
    this.app.listen(3000, () => {
      console.log('Security Dashboard running on http://localhost:3000');
    });
  }

  setupRoutes() {
    this.app.use(express.static('public'));

    this.app.get('/api/metrics', (req, res) => {
      res.json(this.securityMetrics);
    });

    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });
  }

  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      console.log('Client connected to security dashboard');
      
      ws.send(JSON.stringify({
        type: 'metrics',
        data: this.securityMetrics
      }));
    });
  }

  broadcastUpdate(type, data) {
    const message = JSON.stringify({ type, data, timestamp: Date.now() });
    
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  updateMetrics(newData) {
    Object.assign(this.securityMetrics, newData);
    this.broadcastUpdate('metrics', this.securityMetrics);
  }

  recordAlert(alert) {
    this.securityMetrics.alertCount++;
    this.securityMetrics.lastAlert = alert;
    this.broadcastUpdate('alert', alert);
  }
}
```

### Incident Response

#### 1. Emergency Response Procedures

```solidity
// Emergency response contract
contract EmergencyResponse {
    enum EmergencyType { PAUSE, UPGRADE, FUND_RECOVERY }
    
    struct Emergency {
        EmergencyType emergencyType;
        address initiator;
        uint256 timestamp;
        bool executed;
        mapping(address => bool) approvals;
        uint256 approvalCount;
    }

    mapping(bytes32 => Emergency) public emergencies;
    address[] public emergencyCouncil;
    uint256 public constant REQUIRED_APPROVALS = 3;
    uint256 public constant EMERGENCY_DELAY = 6 hours;

    modifier onlyCouncil() {
        require(isCouncilMember(msg.sender), "Not council member");
        _;
    }

    function initiateEmergency(
        EmergencyType emergencyType,
        bytes32 emergencyId
    ) external onlyCouncil {
        Emergency storage emergency = emergencies[emergencyId];
        require(emergency.timestamp == 0, "Emergency already exists");

        emergency.emergencyType = emergencyType;
        emergency.initiator = msg.sender;
        emergency.timestamp = block.timestamp;
        emergency.approvals[msg.sender] = true;
        emergency.approvalCount = 1;

        emit EmergencyInitiated(emergencyId, emergencyType, msg.sender);
    }

    function approveEmergency(bytes32 emergencyId) external onlyCouncil {
        Emergency storage emergency = emergencies[emergencyId];
        require(emergency.timestamp > 0, "Emergency not found");
        require(!emergency.executed, "Already executed");
        require(!emergency.approvals[msg.sender], "Already approved");

        emergency.approvals[msg.sender] = true;
        emergency.approvalCount++;

        emit EmergencyApproved(emergencyId, msg.sender, emergency.approvalCount);

        // Auto-execute if enough approvals
        if (emergency.approvalCount >= REQUIRED_APPROVALS &&
            block.timestamp >= emergency.timestamp + EMERGENCY_DELAY) {
            _executeEmergency(emergencyId);
        }
    }

    function executeEmergency(bytes32 emergencyId) external onlyCouncil {
        Emergency storage emergency = emergencies[emergencyId];
        require(emergency.approvalCount >= REQUIRED_APPROVALS, "Insufficient approvals");
        require(block.timestamp >= emergency.timestamp + EMERGENCY_DELAY, "Emergency delay not met");
        require(!emergency.executed, "Already executed");

        _executeEmergency(emergencyId);
    }

    function _executeEmergency(bytes32 emergencyId) internal {
        Emergency storage emergency = emergencies[emergencyId];
        emergency.executed = true;

        if (emergency.emergencyType == EmergencyType.PAUSE) {
            _pauseAllContracts();
        } else if (emergency.emergencyType == EmergencyType.UPGRADE) {
            _executeUpgrade();
        } else if (emergency.emergencyType == EmergencyType.FUND_RECOVERY) {
            _recoverFunds();
        }

        emit EmergencyExecuted(emergencyId, emergency.emergencyType);
    }
}
```

#### 2. Automated Response System

```javascript
// incident-response/auto-response.js
class AutoResponseSystem {
  constructor(contracts, thresholds) {
    this.contracts = contracts;
    this.thresholds = thresholds;
    this.responseActions = new Map();
    this.setupResponseActions();
  }

  setupResponseActions() {
    // High slippage response
    this.responseActions.set('HIGH_SLIPPAGE', async (alert) => {
      if (alert.data.slippage > this.thresholds.criticalSlippage) {
        await this.pauseTrading('High slippage detected');
      }
    });

    // Large withdrawal response
    this.responseActions.set('LARGE_WITHDRAWAL', async (alert) => {
      if (alert.data.amount > this.thresholds.maxWithdrawal) {
        await this.enableWithdrawalDelay();
      }
    });

    // Unusual gas price response
    this.responseActions.set('GAS_ATTACK', async (alert) => {
      await this.adjustGasLimits();
    });

    // Contract balance low response
    this.responseActions.set('LOW_BALANCE', async (alert) => {
      await this.notifyTreasury(alert.data);
    });
  }

  async handleAlert(alert) {
    const responseAction = this.responseActions.get(alert.type);
    
    if (responseAction) {
      try {
        console.log(`Executing auto-response for ${alert.type}`);
        await responseAction(alert);
        
        this.logResponse(alert, 'SUCCESS');
      } catch (error) {
        console.error(`Auto-response failed for ${alert.type}:`, error);
        this.logResponse(alert, 'FAILED', error.message);
      }
    }
  }

  async pauseTrading(reason) {
    const aggregator = this.contracts.aggregator;
    const tx = await aggregator.pause();
    console.log(`Trading paused: ${reason}. TX: ${tx.hash}`);
  }

  async enableWithdrawalDelay() {
    // Enable time-locked withdrawals
    console.log('Withdrawal delay enabled');
  }

  async adjustGasLimits() {
    // Adjust gas limits to prevent gas-based attacks
    console.log('Gas limits adjusted');
  }

  async notifyTreasury(data) {
    // Notify treasury to top up balances
    console.log('Treasury notified for balance top-up', data);
  }

  logResponse(alert, status, error = null) {
    const log = {
      timestamp: new Date().toISOString(),
      alertType: alert.type,
      status,
      error,
      alertData: alert.data
    };

    console.log('Auto-response log:', log);
    // Save to database or external logging service
  }
}
```

## Integration Security

### API Security

#### 1. API Rate Limiting

```javascript
// api/rate-limiter.js
const rateLimit = require('express-rate-limit');
const Redis = require('redis');

class APIRateLimiter {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  createLimiter(options) {
    return rateLimit({
      windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
      max: options.max || 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP',
      standardHeaders: true,
      legacyHeaders: false,
      
      // Custom store using Redis
      store: {
        async increment(key) {
          const current = await this.redis.incr(key);
          if (current === 1) {
            await this.redis.expire(key, Math.ceil(options.windowMs / 1000));
          }
          return { totalHits: current };
        },
        
        async decrement(key) {
          const current = await this.redis.decr(key);
          return { totalHits: Math.max(0, current) };
        },
        
        async resetKey(key) {
          await this.redis.del(key);
        }
      }
    });
  }

  // Tier-based rate limiting
  createTieredLimiter() {
    return async (req, res, next) => {
      const apiKey = req.headers['x-api-key'];
      const tier = await this.getAPIKeyTier(apiKey);
      
      const limits = {
        free: { windowMs: 15 * 60 * 1000, max: 50 },
        pro: { windowMs: 15 * 60 * 1000, max: 500 },
        enterprise: { windowMs: 15 * 60 * 1000, max: 5000 }
      };

      const limiter = this.createLimiter(limits[tier] || limits.free);
      return limiter(req, res, next);
    };
  }

  async getAPIKeyTier(apiKey) {
    if (!apiKey) return 'free';
    
    const tierData = await this.redis.get(`api_key:${apiKey}`);
    return tierData ? JSON.parse(tierData).tier : 'free';
  }
}
```

#### 2. API Authentication and Authorization

```javascript
// api/auth.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class APIAuthentication {
  constructor(secretKey) {
    this.secretKey = secretKey;
  }

  // JWT-based authentication
  generateToken(payload, expiresIn = '1h') {
    return jwt.sign(payload, this.secretKey, { expiresIn });
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, this.secretKey);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // API Key authentication with HMAC
  generateAPIKey() {
    const keyId = crypto.randomUUID();
    const secret = crypto.randomBytes(32).toString('hex');
    
    return { keyId, secret };
  }

  verifyAPISignature(req) {
    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp'];
    const apiKey = req.headers['x-api-key'];
    
    if (!signature || !timestamp || !apiKey) {
      throw new Error('Missing authentication headers');
    }

    // Check timestamp to prevent replay attacks
    const now = Date.now();
    const requestTime = parseInt(timestamp);
    if (Math.abs(now - requestTime) > 300000) { // 5 minutes
      throw new Error('Request timestamp expired');
    }

    // Reconstruct the signature
    const payload = timestamp + req.method + req.path + JSON.stringify(req.body || {});
    const expectedSignature = crypto
      .createHmac('sha256', this.getAPISecret(apiKey))
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new Error('Invalid signature');
    }

    return true;
  }

  // Middleware for different auth methods
  jwtAuth() {
    return (req, res, next) => {
      try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
          return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = this.verifyToken(token);
        req.user = decoded;
        next();
      } catch (error) {
        res.status(401).json({ error: error.message });
      }
    };
  }

  apiKeyAuth() {
    return (req, res, next) => {
      try {
        this.verifyAPISignature(req);
        next();
      } catch (error) {
        res.status(401).json({ error: error.message });
      }
    };
  }
}
```

### Key Management

#### 1. Secure Key Storage

```javascript
// security/key-management.js
const AWS = require('aws-sdk');
const { Wallet } = require('ethers');

class SecureKeyManager {
  constructor(config) {
    this.kms = new AWS.KMS(config.aws);
    this.secretsManager = new AWS.SecretsManager(config.aws);
    this.encryptionKey = config.encryptionKey;
  }

  // Store private key securely
  async storePrivateKey(keyId, privateKey, metadata = {}) {
    const encryptedKey = await this.encryptWithKMS(privateKey);
    
    const secretValue = {
      encryptedPrivateKey: encryptedKey,
      metadata,
      createdAt: new Date().toISOString()
    };

    await this.secretsManager.createSecret({
      Name: `ixfi/private-keys/${keyId}`,
      SecretString: JSON.stringify(secretValue),
      Description: `IXFI Protocol private key: ${keyId}`
    }).promise();
  }

  // Retrieve and decrypt private key
  async getPrivateKey(keyId) {
    const response = await this.secretsManager.getSecretValue({
      SecretId: `ixfi/private-keys/${keyId}`
    }).promise();

    const secretData = JSON.parse(response.SecretString);
    const privateKey = await this.decryptWithKMS(secretData.encryptedPrivateKey);
    
    return privateKey;
  }

  // Create wallet from stored key
  async createWallet(keyId, provider) {
    const privateKey = await this.getPrivateKey(keyId);
    return new Wallet(privateKey, provider);
  }

  // Encrypt data with KMS
  async encryptWithKMS(data) {
    const response = await this.kms.encrypt({
      KeyId: this.encryptionKey,
      Plaintext: Buffer.from(data)
    }).promise();

    return response.CiphertextBlob.toString('base64');
  }

  // Decrypt data with KMS
  async decryptWithKMS(encryptedData) {
    const response = await this.kms.decrypt({
      CiphertextBlob: Buffer.from(encryptedData, 'base64')
    }).promise();

    return response.Plaintext.toString();
  }

  // Rotate keys periodically
  async rotateKey(keyId) {
    // Generate new key pair
    const newWallet = Wallet.createRandom();
    const newKeyId = `${keyId}-${Date.now()}`;
    
    // Store new key
    await this.storePrivateKey(newKeyId, newWallet.privateKey, {
      previousKeyId: keyId,
      rotatedAt: new Date().toISOString()
    });

    // Mark old key as deprecated
    await this.deprecateKey(keyId);

    return newKeyId;
  }

  async deprecateKey(keyId) {
    await this.secretsManager.updateSecret({
      SecretId: `ixfi/private-keys/${keyId}`,
      Description: `DEPRECATED: ${keyId} - ${new Date().toISOString()}`
    }).promise();
  }
}
```

#### 2. Multi-Signature Wallet Integration

```solidity
// MultiSigWallet for critical operations
contract IXFIMultiSig {
    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 confirmations;
        mapping(address => bool) isConfirmed;
    }

    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public required;
    Transaction[] public transactions;

    modifier onlyOwner() {
        require(isOwner[msg.sender], "Not an owner");
        _;
    }

    modifier txExists(uint256 txId) {
        require(txId < transactions.length, "Transaction does not exist");
        _;
    }

    modifier notExecuted(uint256 txId) {
        require(!transactions[txId].executed, "Transaction already executed");
        _;
    }

    modifier notConfirmed(uint256 txId) {
        require(!transactions[txId].isConfirmed[msg.sender], "Transaction already confirmed");
        _;
    }

    constructor(address[] memory _owners, uint256 _required) {
        require(_owners.length > 0, "Owners required");
        require(_required > 0 && _required <= _owners.length, "Invalid required confirmations");

        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "Invalid owner");
            require(!isOwner[owner], "Owner not unique");

            isOwner[owner] = true;
            owners.push(owner);
        }

        required = _required;
    }

    function submitTransaction(
        address to,
        uint256 value,
        bytes memory data
    ) public onlyOwner returns (uint256 txId) {
        txId = transactions.length;
        
        transactions.push();
        Transaction storage transaction = transactions[txId];
        transaction.to = to;
        transaction.value = value;
        transaction.data = data;
        transaction.executed = false;
        transaction.confirmations = 0;

        emit TransactionSubmitted(txId, to, value, data);
    }

    function confirmTransaction(uint256 txId)
        public
        onlyOwner
        txExists(txId)
        notExecuted(txId)
        notConfirmed(txId)
    {
        Transaction storage transaction = transactions[txId];
        transaction.isConfirmed[msg.sender] = true;
        transaction.confirmations++;

        emit TransactionConfirmed(txId, msg.sender);

        if (transaction.confirmations >= required) {
            executeTransaction(txId);
        }
    }

    function executeTransaction(uint256 txId)
        public
        onlyOwner
        txExists(txId)
        notExecuted(txId)
    {
        Transaction storage transaction = transactions[txId];
        require(transaction.confirmations >= required, "Not enough confirmations");

        transaction.executed = true;

        (bool success, ) = transaction.to.call{value: transaction.value}(transaction.data);
        require(success, "Transaction execution failed");

        emit TransactionExecuted(txId);
    }

    // Emergency functions with time delays
    function emergencyPause(address target) external {
        bytes memory data = abi.encodeWithSignature("pause()");
        submitTransaction(target, 0, data);
    }

    function emergencyUpgrade(address target, address newImplementation) external {
        bytes memory data = abi.encodeWithSignature("upgradeTo(address)", newImplementation);
        submitTransaction(target, 0, data);
    }

    // Events
    event TransactionSubmitted(uint256 indexed txId, address indexed to, uint256 value, bytes data);
    event TransactionConfirmed(uint256 indexed txId, address indexed owner);
    event TransactionExecuted(uint256 indexed txId);
}
```

## Security Auditing

### Automated Security Scanning

```bash
#!/bin/bash
# security/audit-script.sh

echo "🔍 Starting IXFI Protocol Security Audit..."

# 1. Static Analysis with Slither
echo "Running Slither static analysis..."
slither contracts/ --config-file slither.config.json > reports/slither-report.txt

# 2. Mythril analysis
echo "Running Mythril security analysis..."
myth analyze contracts/CrossChainAggregator.sol --execution-timeout 300 > reports/mythril-report.txt

# 3. Solhint linting
echo "Running Solhint code quality checks..."
solhint 'contracts/**/*.sol' > reports/solhint-report.txt

# 4. Gas optimization analysis
echo "Analyzing gas optimization opportunities..."
hardhat test --reporter gas > reports/gas-report.txt

# 5. Dependency vulnerability scan
echo "Scanning dependencies for vulnerabilities..."
npm audit --json > reports/dependency-audit.json

# 6. Custom security checks
echo "Running custom security checks..."
node security/custom-checks.js > reports/custom-security-report.txt

echo "✅ Security audit completed. Check reports/ directory for results."
```

### Manual Security Review Checklist

```markdown
# IXFI Protocol Security Review Checklist

## Smart Contract Security

### Access Control
- [ ] Owner privileges are properly restricted
- [ ] Role-based access control is implemented correctly
- [ ] Multi-signature requirements for critical functions
- [ ] Time delays for sensitive operations

### Input Validation
- [ ] All user inputs are validated
- [ ] Address zero checks are in place
- [ ] Overflow/underflow protection
- [ ] Deadline validation for time-sensitive operations

### State Management
- [ ] State changes follow Checks-Effects-Interactions pattern
- [ ] Reentrancy guards are in place
- [ ] State consistency across functions
- [ ] Proper event emission

### Economic Security
- [ ] Slippage protection mechanisms
- [ ] Fee calculation accuracy
- [ ] Liquidity checks
- [ ] Oracle manipulation resistance

### Cross-Chain Security
- [ ] Cross-chain message validation
- [ ] Source chain verification
- [ ] Replay attack prevention
- [ ] Destination chain safety checks

## Operational Security

### Deployment Security
- [ ] Deployment scripts are secure
- [ ] Constructor parameters are validated
- [ ] Initial configuration is correct
- [ ] Upgrade mechanisms are secure

### Key Management
- [ ] Private keys are stored securely
- [ ] Key rotation procedures are in place
- [ ] Multi-signature wallets for critical operations
- [ ] Hardware security modules (HSM) usage

### Monitoring and Alerting
- [ ] Real-time monitoring is implemented
- [ ] Alert thresholds are configured
- [ ] Incident response procedures are documented
- [ ] Emergency response mechanisms are tested

## Integration Security

### API Security
- [ ] Authentication mechanisms are robust
- [ ] Rate limiting is implemented
- [ ] Input sanitization
- [ ] HTTPS enforcement

### Frontend Security
- [ ] XSS protection
- [ ] CSRF protection
- [ ] Secure wallet connections
- [ ] Transaction validation

### Infrastructure Security
- [ ] Server hardening
- [ ] Network security
- [ ] Database security
- [ ] Backup and recovery procedures
```

## Best Practices Summary

### Development Phase
1. **Secure Coding**: Follow established patterns and use battle-tested libraries
2. **Testing**: Comprehensive unit, integration, and security testing
3. **Code Review**: Multiple developer review of all code changes
4. **Static Analysis**: Regular automated security scanning

### Deployment Phase
1. **Gradual Rollout**: Start with testnets and small mainnet deployments
2. **Monitoring Setup**: Implement comprehensive monitoring before mainnet launch
3. **Emergency Procedures**: Have pause and recovery mechanisms ready
4. **Documentation**: Maintain up-to-date security documentation

### Operations Phase
1. **Continuous Monitoring**: 24/7 monitoring of protocol health
2. **Regular Audits**: Periodic security audits by external firms
3. **Incident Response**: Well-defined procedures for security incidents
4. **Community**: Bug bounty programs and responsible disclosure

## Resources

- [OpenZeppelin Security Guidelines](https://docs.openzeppelin.com/contracts/4.x/security)
- [ConsenSys Smart Contract Best Practices](https://consensys.github.io/smart-contract-best-practices/)
- [OWASP API Security](https://owasp.org/www-project-api-security/)
- [Trail of Bits Security Guide](https://blog.trailofbits.com/)
- [Blockchain Security Guide](https://github.com/slowmist/Knowledge-Base)
- [Frontend Integration](frontend-integration.md)
- [Smart Contract Integration](smart-contract-integration.md)
- [Testing Guide](testing.md)
