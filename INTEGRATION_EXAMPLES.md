# IXFI Integration Examples

## Table of Contents
1. [Frontend Integration](#frontend-integration)
2. [DEX Aggregation Examples](#dex-aggregation-examples)
3. [Cross-Chain Swap Examples](#cross-chain-swap-examples)
4. [Smart Contract Integration](#smart-contract-integration)
5. [Relayer API Usage](#relayer-api-usage)
6. [SDK Examples](#sdk-examples)
7. [Common Use Cases](#common-use-cases)
8. [Error Handling](#error-handling)

## Frontend Integration

### Basic Web3 Setup

```javascript
import { ethers } from 'ethers';
import { IXFIProvider } from '@ixfi/sdk'; // Hypothetical SDK

// Initialize providers
const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();

// IXFI contract instances
const ixfiAddresses = {
  4157: '0x...', // CrossFi
  1: '0x...',    // Ethereum
  56: '0x...',   // BSC
  137: '0x...'   // Polygon
};

const ixfiABI = [
  // Contract ABI here
];

// Initialize IXFI instance
const chainId = await provider.getNetwork().then(n => n.chainId);
const ixfi = new ethers.Contract(ixfiAddresses[chainId], ixfiABI, signer);
```

### Cross-Chain Token Transfer

```javascript
async function sendCrossChainTokens() {
  try {
    const destinationChain = 'ethereum';
    const destinationAddress = '0x742d35Cc6634C0532925a3b8D4048b05fb2fE98c';
    const amount = ethers.utils.parseEther('10'); // 10 IXFI
    
    // Check user balance
    const balance = await ixfi.balanceOf(await signer.getAddress());
    if (balance.lt(amount)) {
      throw new Error('Insufficient IXFI balance');
    }
    
    // Send tokens
    const tx = await ixfi.sendToken(
      destinationChain,
      destinationAddress,
      'IXFI',
      amount
    );
    
    console.log('Transaction sent:', tx.hash);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log('Transaction confirmed:', receipt.transactionHash);
    
    return receipt;
  } catch (error) {
    console.error('Cross-chain transfer failed:', error);
    throw error;
  }
}
```

### Cross-Chain Contract Call

```javascript
async function callCrossChainContract() {
  try {
    const destinationChain = 'bsc';
    const contractAddress = '0x...';
    
    // Encode function call
    const iface = new ethers.utils.Interface([
      'function updateValue(uint256 value, string memory message)'
    ]);
    const payload = iface.encodeFunctionData('updateValue', [
      123,
      'Hello from CrossFi!'
    ]);
    
    // Execute cross-chain call
    const tx = await ixfi.callContract(
      destinationChain,
      contractAddress,
      payload
    );
    
    console.log('Cross-chain call initiated:', tx.hash);
    
    // Monitor for execution on destination chain
    // This requires relayer monitoring or event listening
    return tx;
  } catch (error) {
    console.error('Cross-chain call failed:', error);
    throw error;
  }
}
```

## DEX Aggregation Examples

### Basic Token Swap with Optimal Routing

```javascript
// Initialize DEX Aggregator
const aggregatorABI = [
  // CrossChainAggregator ABI
];

const aggregatorAddresses = {
  1: '0x...', // Ethereum
  56: '0x...', // BSC
  137: '0x...', // Polygon
  43114: '0x...', // Avalanche
  42161: '0x...', // Arbitrum
  10: '0x...', // Optimism
  8453: '0x...' // Base
};

const aggregator = new ethers.Contract(
  aggregatorAddresses[chainId],
  aggregatorABI,
  signer
);

async function performOptimalSwap() {
  try {
    const tokenIn = '0xA0b86a33E6441e1a02c4e4670dd96EA0f25A632'; // USDC
    const tokenOut = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH
    const amountIn = ethers.utils.parseUnits('1000', 6); // 1000 USDC
    
    // Get all available router types (0-36)
    const allRouterTypes = Array.from({length: 37}, (_, i) => i);
    
    // Get optimal quote
    const [bestAmount, bestRouter] = await aggregator.getOptimalQuote(
      tokenIn,
      tokenOut,
      amountIn,
      allRouterTypes
    );
    
    console.log(`Best quote: ${ethers.utils.formatEther(bestAmount)} WETH`);
    console.log(`Best DEX: Router ${bestRouter}`);
    
    // Calculate minimum output with 0.5% slippage
    const minAmountOut = bestAmount.mul(995).div(1000);
    
    // Approve token spend
    const tokenContract = new ethers.Contract(tokenIn, erc20ABI, signer);
    const approveTx = await tokenContract.approve(aggregator.address, amountIn);
    await approveTx.wait();
    
    // Execute swap
    const swapTx = await aggregator.executeSwap(
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut,
      bestRouter,
      '0x' // Empty swap data for basic swap
    );
    
    console.log('Swap executed:', swapTx.hash);
    return swapTx;
  } catch (error) {
    console.error('Swap failed:', error);
    throw error;
  }
}
```

### Compare Quotes Across All DEXes

```javascript
async function compareAllDEXQuotes() {
  try {
    const tokenIn = '0xA0b86a33E6441e1a02c4e4670dd96EA0f25A632'; // USDC
    const tokenOut = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH
    const amountIn = ethers.utils.parseUnits('1000', 6);
    
    // Get quotes from all 37 DEX protocols
    const allQuotes = await aggregator.getAllQuotes(
      tokenIn,
      tokenOut,
      amountIn
    );
    
    // Process and display results
    const sortedQuotes = allQuotes
      .filter(quote => quote.amountOut.gt(0)) // Filter failed quotes
      .sort((a, b) => b.amountOut.sub(a.amountOut)) // Sort by amount desc
      .map(quote => ({
        router: quote.routerType,
        dexName: getDEXName(quote.routerType),
        amountOut: ethers.utils.formatEther(quote.amountOut),
        price: parseFloat(ethers.utils.formatEther(quote.amountOut)) / 1000 // WETH per USDC
      }));
    
    console.table(sortedQuotes);
    
    return sortedQuotes;
  } catch (error) {
    console.error('Quote comparison failed:', error);
  }
}

function getDEXName(routerType) {
  const dexNames = {
    0: 'Uniswap V2',
    1: 'SushiSwap V2',
    2: 'PancakeSwap V2',
    3: 'QuickSwap',
    4: 'TraderJoe V1',
    10: 'Uniswap V3',
    11: 'SushiSwap V3',
    12: 'PancakeSwap V3',
    20: 'Velodrome',
    21: 'Aerodrome',
    30: 'Curve',
    35: 'Balancer V2',
    36: '1inch'
  };
  return dexNames[routerType] || `Router ${routerType}`;
}
```

## Cross-Chain Swap Examples

### Basic Cross-Chain Token Swap

```javascript
async function crossChainSwap() {
  try {
    const sourceChain = 'ethereum';
    const destinationChain = 'bsc';
    const tokenIn = '0xA0b86a33E6441e1a02c4e4670dd96EA0f25A632'; // USDC on Ethereum
    const tokenOut = '0x2170Ed0880ac9A755fd29B2688956BD959F933F8'; // WETH on BSC
    const amountIn = ethers.utils.parseUnits('1000', 6); // 1000 USDC
    const minAmountOut = ethers.utils.parseEther('0.28'); // Minimum WETH expected
    const routerType = 2; // PancakeSwap V2 on BSC
    
    // Execute cross-chain swap
    const crossChainTx = await aggregator.crossChainSwap(
      sourceChain,
      destinationChain,
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut,
      routerType
    );
    
    console.log('Cross-chain swap initiated:', crossChainTx.hash);
    return crossChainTx;
  } catch (error) {
    console.error('Cross-chain swap failed:', error);
  }
}
```

### Gasless Transaction (Meta-Transaction)

```javascript
import { TypedDataUtils } from 'ethers-eip712';

async function executeGaslessTransaction() {
  try {
    const relayerUrl = 'http://localhost:3001';
    const userAddress = await signer.getAddress();
    
    // Check gas credits
    const creditsResponse = await fetch(`${relayerUrl}/api/credits/${userAddress}`);
    const { balance } = await creditsResponse.json();
    
    if (balance < 50) { // 50 cents minimum
      throw new Error('Insufficient gas credits');
    }
    
    // Prepare meta-transaction
    const targetContract = '0x...';
    const functionCall = '0x...'; // Encoded function call
    const nonce = await getNonce(userAddress);
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    
    const metaTx = {
      from: userAddress,
      to: targetContract,
      value: '0',
      data: functionCall,
      nonce: nonce,
      deadline: deadline
    };
    
    // Sign EIP-712 meta-transaction
    const domain = {
      name: 'MetaTxGateway',
      version: '1',
      chainId: chainId,
      verifyingContract: gatewayAddress
    };
    
    const types = {
      MetaTransaction: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'data', type: 'bytes' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]
    };
    
    const signature = await signer._signTypedData(domain, types, metaTx);
    
    // Submit to relayer
    const response = await fetch(`${relayerUrl}/api/meta-tx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metaTx: metaTx,
        signature: signature,
        targetChain: 'ethereum'
      })
    });
    
    const result = await response.json();
    console.log('Gasless transaction executed:', result.txHash);
    
    return result;
  } catch (error) {
    console.error('Gasless transaction failed:', error);
    throw error;
  }
}

async function getNonce(userAddress) {
  const gateway = new ethers.Contract(gatewayAddress, gatewayABI, provider);
  return await gateway.getNonce(userAddress);
}
```

### React Component Example

```jsx
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

function IXFIWallet() {
  const [balance, setBalance] = useState('0');
  const [credits, setCredits] = useState('0');
  const [loading, setLoading] = useState(false);
  
  // Initialize on component mount
  useEffect(() => {
    initializeWallet();
  }, []);
  
  async function initializeWallet() {
    try {
      if (window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        
        // Get IXFI balance
        const ixfiBalance = await ixfi.balanceOf(address);
        setBalance(ethers.utils.formatEther(ixfiBalance));
        
        // Get gas credits
        const creditsResponse = await fetch(`${relayerUrl}/api/credits/${address}`);
        const { balance: creditBalance } = await creditsResponse.json();
        setCredits(creditBalance);
      }
    } catch (error) {
      console.error('Wallet initialization failed:', error);
    }
  }
  
  async function depositXFI() {
    setLoading(true);
    try {
      const amount = ethers.utils.parseEther('1'); // 1 XFI
      const tx = await ixfi.deposit({ value: amount });
      await tx.wait();
      
      await initializeWallet(); // Refresh balances
      alert('XFI deposited successfully!');
    } catch (error) {
      alert('Deposit failed: ' + error.message);
    }
    setLoading(false);
  }
  
  async function depositCredits() {
    setLoading(true);
    try {
      const amount = ethers.utils.parseEther('10'); // 10 IXFI
      const vault = new ethers.Contract(vaultAddress, vaultABI, signer);
      const tx = await vault.deposit(amount);
      await tx.wait();
      
      await initializeWallet(); // Refresh balances
      alert('Gas credits added!');
    } catch (error) {
      alert('Credit deposit failed: ' + error.message);
    }
    setLoading(false);
  }
  
  return (
    <div className="ixfi-wallet">
      <h2>IXFI Wallet</h2>
      
      <div className="balances">
        <div>IXFI Balance: {balance} IXFI</div>
        <div>Gas Credits: ${(credits / 100).toFixed(2)} USD</div>
      </div>
      
      <div className="actions">
        <button onClick={depositXFI} disabled={loading}>
          Deposit XFI → IXFI
        </button>
        <button onClick={depositCredits} disabled={loading}>
          Add Gas Credits
        </button>
      </div>
      
      <CrossChainTransfer />
      <GaslessTransaction />
    </div>
  );
}

function CrossChainTransfer() {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [targetChain, setTargetChain] = useState('ethereum');
  
  async function sendTokens() {
    try {
      const tx = await ixfi.sendToken(
        targetChain,
        recipient,
        'IXFI',
        ethers.utils.parseEther(amount)
      );
      alert(`Cross-chain transfer initiated: ${tx.hash}`);
    } catch (error) {
      alert('Transfer failed: ' + error.message);
    }
  }
  
  return (
    <div className="cross-chain-transfer">
      <h3>Cross-Chain Transfer</h3>
      <select 
        value={targetChain} 
        onChange={(e) => setTargetChain(e.target.value)}
      >
        <option value="ethereum">Ethereum</option>
        <option value="bsc">BSC</option>
        <option value="polygon">Polygon</option>
      </select>
      <input 
        placeholder="Recipient address"
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
      />
      <input 
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button onClick={sendTokens}>Send</button>
    </div>
  );
}
```

## Smart Contract Integration

### Receiving Cross-Chain Calls

```solidity
pragma solidity ^0.8.20;

import "./IXFIExecutable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CrossChainDApp is IXFIExecutable {
    struct Message {
        string content;
        address sender;
        string sourceChain;
        uint256 timestamp;
    }
    
    Message[] public messages;
    mapping(address => uint256) public userBalances;
    
    event MessageReceived(
        string indexed sourceChain,
        address indexed sender,
        string content
    );
    
    event TokensReceived(
        string indexed sourceChain,
        address indexed sender,
        uint256 amount
    );
    
    constructor(address gateway_) IXFIExecutable(gateway_) {}
    
    function _execute(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal override {
        // Decode the payload
        (string memory messageContent) = abi.decode(payload, (string));
        
        // Store the message
        messages.push(Message({
            content: messageContent,
            sender: _stringToAddress(sourceAddress),
            sourceChain: sourceChain,
            timestamp: block.timestamp
        }));
        
        emit MessageReceived(sourceChain, _stringToAddress(sourceAddress), messageContent);
    }
    
    function _executeWithToken(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) internal override {
        require(
            keccak256(bytes(symbol)) == keccak256(bytes("IXFI")),
            "Unsupported token"
        );
        
        address sender = _stringToAddress(sourceAddress);
        
        // Update user balance
        userBalances[sender] += amount;
        
        // Process the payload if needed
        if (payload.length > 0) {
            _execute(sourceChain, sourceAddress, payload);
        }
        
        emit TokensReceived(sourceChain, sender, amount);
    }
    
    function withdrawTokens(uint256 amount) external {
        require(userBalances[msg.sender] >= amount, "Insufficient balance");
        
        userBalances[msg.sender] -= amount;
        
        // Transfer IXFI tokens
        IERC20 ixfi = IERC20(gateway.tokenAddresses("IXFI"));
        require(ixfi.transfer(msg.sender, amount), "Transfer failed");
    }
    
    function _stringToAddress(string memory str) internal pure returns (address) {
        bytes memory strBytes = bytes(str);
        require(strBytes.length == 42, "Invalid address format");
        
        bytes memory addrBytes = new bytes(20);
        for (uint i = 0; i < 20; i++) {
            addrBytes[i] = bytes1(
                _hexCharToByte(strBytes[2 + i * 2]) * 16 +
                _hexCharToByte(strBytes[3 + i * 2])
            );
        }
        return address(uint160(bytes20(addrBytes)));
    }
    
    function _hexCharToByte(bytes1 char) internal pure returns (uint8) {
        uint8 byteValue = uint8(char);
        if (byteValue >= uint8(bytes1('0')) && byteValue <= uint8(bytes1('9'))) {
            return byteValue - uint8(bytes1('0'));
        } else if (byteValue >= uint8(bytes1('a')) && byteValue <= uint8(bytes1('f'))) {
            return 10 + byteValue - uint8(bytes1('a'));
        } else if (byteValue >= uint8(bytes1('A')) && byteValue <= uint8(bytes1('F'))) {
            return 10 + byteValue - uint8(bytes1('A'));
        }
        revert("Invalid hex character");
    }
}
```

### Initiating Cross-Chain Calls

```solidity
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IIXFIGateway {
    function callContract(
        string memory destinationChain,
        string memory destinationContractAddress,
        bytes memory payload
    ) external;
    
    function callContractWithToken(
        string memory destinationChain,
        string memory destinationContractAddress,
        bytes memory payload,
        string memory symbol,
        uint256 amount
    ) external;
}

contract CrossChainSender {
    IIXFIGateway public immutable ixfiGateway;
    IERC20 public immutable ixfiToken;
    
    constructor(address gateway_, address ixfiToken_) {
        ixfiGateway = IIXFIGateway(gateway_);
        ixfiToken = IERC20(ixfiToken_);
    }
    
    function sendMessage(
        string memory destinationChain,
        address destinationContract,
        string memory message
    ) external {
        bytes memory payload = abi.encode(message);
        
        ixfiGateway.callContract(
            destinationChain,
            _addressToString(destinationContract),
            payload
        );
    }
    
    function sendMessageWithTokens(
        string memory destinationChain,
        address destinationContract,
        string memory message,
        uint256 tokenAmount
    ) external {
        // Transfer tokens from user
        require(
            ixfiToken.transferFrom(msg.sender, address(this), tokenAmount),
            "Token transfer failed"
        );
        
        // Approve gateway to spend tokens
        require(
            ixfiToken.approve(address(ixfiGateway), tokenAmount),
            "Approval failed"
        );
        
        bytes memory payload = abi.encode(message);
        
        ixfiGateway.callContractWithToken(
            destinationChain,
            _addressToString(destinationContract),
            payload,
            "IXFI",
            tokenAmount
        );
    }
    
    function _addressToString(address addr) internal pure returns (string memory) {
        bytes memory data = abi.encodePacked(addr);
        bytes memory alphabet = "0123456789abcdef";
        
        bytes memory str = new bytes(2 + data.length * 2);
        str[0] = "0";
        str[1] = "x";
        for (uint i = 0; i < data.length; i++) {
            str[2+i*2] = alphabet[uint(uint8(data[i] >> 4))];
            str[3+i*2] = alphabet[uint(uint8(data[i] & 0x0f))];
        }
        return string(str);
    }
}
```

## Relayer API Usage

### Health Check

```javascript
async function checkRelayerHealth() {
  try {
    const response = await fetch('http://localhost:3001/health');
    const health = await response.json();
    
    console.log('Relayer Status:', health.status);
    console.log('Connected Chains:', health.chains);
    console.log('Processed Events:', health.processedEvents);
    
    return health.status === 'healthy';
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}
```

### Submit Meta-Transaction

```javascript
async function submitMetaTransaction(metaTx, signature, targetChain) {
  try {
    const response = await fetch('http://localhost:3001/api/meta-tx', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        metaTx: metaTx,
        signature: signature,
        targetChain: targetChain
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Transaction submission failed');
    }
    
    const result = await response.json();
    console.log('Transaction submitted:', result.txHash);
    
    return result;
  } catch (error) {
    console.error('Meta-transaction submission failed:', error);
    throw error;
  }
}
```

### Check Gas Credits

```javascript
async function getGasCredits(userAddress) {
  try {
    const response = await fetch(`http://localhost:3001/api/credits/${userAddress}`);
    const data = await response.json();
    
    return {
      balance: data.balance, // Credits in cents
      balanceUsd: data.balanceUsd // Formatted USD string
    };
  } catch (error) {
    console.error('Credit check failed:', error);
    throw error;
  }
}
```

### Estimate Gas Cost

```javascript
async function estimateGasCost(targetChain, gasLimit) {
  try {
    const response = await fetch('http://localhost:3001/api/estimate-gas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetChain: targetChain,
        gasLimit: gasLimit
      })
    });
    
    const estimate = await response.json();
    
    return {
      gasPrice: estimate.gasPrice,
      estimatedCost: estimate.estimatedCost, // In USD cents
      nativeTokenPrice: estimate.nativeTokenPrice
    };
  } catch (error) {
    console.error('Gas estimation failed:', error);
    throw error;
  }
}
```

## SDK Examples

### Hypothetical IXFI SDK

```javascript
// @ixfi/sdk - Hypothetical SDK implementation
class IXFIProvider {
  constructor(config) {
    this.config = config;
    this.providers = {};
    this.contracts = {};
    this.relayerUrl = config.relayerUrl;
    
    // Initialize providers for each chain
    for (const [chain, rpc] of Object.entries(config.rpcs)) {
      this.providers[chain] = new ethers.providers.JsonRpcProvider(rpc);
    }
  }
  
  async connect(privateKey) {
    this.signer = new ethers.Wallet(privateKey);
    
    // Connect signer to each provider
    for (const [chain, provider] of Object.entries(this.providers)) {
      this.providers[chain] = provider.connect(this.signer);
    }
  }
  
  async deposit(amount, chain = 'crossfi') {
    const ixfi = await this.getContract(chain);
    const tx = await ixfi.deposit({
      value: ethers.utils.parseEther(amount)
    });
    return await tx.wait();
  }
  
  async withdraw(amount, chain = 'crossfi') {
    const ixfi = await this.getContract(chain);
    const tx = await ixfi.withdraw(ethers.utils.parseEther(amount));
    return await tx.wait();
  }
  
  async sendCrossChain(destinationChain, recipient, amount) {
    const ixfi = await this.getContract('crossfi'); // Always send from CrossFi
    const tx = await ixfi.sendToken(
      destinationChain,
      recipient,
      'IXFI',
      ethers.utils.parseEther(amount)
    );
    return await tx.wait();
  }
  
  async callCrossChain(destinationChain, contractAddress, payload, tokenAmount = null) {
    const ixfi = await this.getContract(); // Current chain
    
    if (tokenAmount) {
      const tx = await ixfi.callContractWithToken(
        destinationChain,
        contractAddress,
        payload,
        'IXFI',
        ethers.utils.parseEther(tokenAmount)
      );
      return await tx.wait();
    } else {
      const tx = await ixfi.callContract(
        destinationChain,
        contractAddress,
        payload
      );
      return await tx.wait();
    }
  }
  
  async executeGasless(targetChain, to, data, value = '0') {
    const userAddress = await this.signer.getAddress();
    const nonce = await this.getNonce(userAddress, targetChain);
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    
    const metaTx = {
      from: userAddress,
      to: to,
      value: value,
      data: data,
      nonce: nonce,
      deadline: deadline
    };
    
    const signature = await this.signMetaTransaction(metaTx, targetChain);
    
    return await this.submitMetaTransaction(metaTx, signature, targetChain);
  }
  
  async getContract(chain) {
    if (!this.contracts[chain]) {
      const address = this.config.contracts[chain];
      const provider = this.providers[chain];
      this.contracts[chain] = new ethers.Contract(address, IXFI_ABI, provider);
    }
    return this.contracts[chain];
  }
  
  async signMetaTransaction(metaTx, targetChain) {
    const domain = {
      name: 'MetaTxGateway',
      version: '1',
      chainId: this.config.chainIds[targetChain],
      verifyingContract: this.config.gateways[targetChain]
    };
    
    const types = {
      MetaTransaction: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'data', type: 'bytes' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]
    };
    
    return await this.signer._signTypedData(domain, types, metaTx);
  }
  
  async submitMetaTransaction(metaTx, signature, targetChain) {
    const response = await fetch(`${this.relayerUrl}/api/meta-tx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metaTx: metaTx,
        signature: signature,
        targetChain: targetChain
      })
    });
    
    return await response.json();
  }
}

// Usage example
const ixfi = new IXFIProvider({
  rpcs: {
    crossfi: 'https://rpc.testnet.ms',
    ethereum: 'https://mainnet.infura.io/v3/KEY',
    bsc: 'https://bsc-dataseed1.binance.org'
  },
  contracts: {
    crossfi: '0x...',
    ethereum: '0x...',
    bsc: '0x...'
  },
  gateways: {
    ethereum: '0x...',
    bsc: '0x...'
  },
  chainIds: {
    crossfi: 4157,
    ethereum: 1,
    bsc: 56
  },
  relayerUrl: 'http://localhost:3001'
});

await ixfi.connect(privateKey);
await ixfi.deposit('10'); // Deposit 10 XFI
await ixfi.sendCrossChain('ethereum', '0x...', '5'); // Send 5 IXFI to Ethereum
```

## Common Use Cases

### 1. Cross-Chain DeFi

```javascript
// Cross-chain lending protocol
async function crossChainLend() {
  const lendingPayload = ethers.utils.defaultAbiCoder.encode(
    ['uint256', 'address'],
    [ethers.utils.parseEther('100'), userAddress] // Lend 100 IXFI
  );
  
  await ixfi.callContractWithToken(
    'ethereum',
    lendingProtocolAddress,
    lendingPayload,
    'IXFI',
    ethers.utils.parseEther('100')
  );
}
```

### 2. Cross-Chain Gaming

```javascript
// Transfer game assets between chains
async function transferGameAsset() {
  const gamePayload = ethers.utils.defaultAbiCoder.encode(
    ['uint256', 'uint256'],
    [tokenId, playerId]
  );
  
  await ixfi.callContract(
    'polygon',
    gameContractAddress,
    gamePayload
  );
}
```

### 3. Cross-Chain Governance

```javascript
// Vote on proposal from any chain
async function crossChainVote() {
  const votePayload = ethers.utils.defaultAbiCoder.encode(
    ['uint256', 'bool'],
    [proposalId, true] // Vote yes
  );
  
  await ixfi.callContractWithToken(
    'ethereum',
    governanceContract,
    votePayload,
    'IXFI',
    votingPower
  );
}
```

## Error Handling

### Common Error Patterns

```javascript
class IXFIError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'IXFIError';
    this.code = code;
    this.details = details;
  }
}

async function handleIXFITransaction(transactionFn) {
  try {
    return await transactionFn();
  } catch (error) {
    // Handle specific errors
    if (error.message.includes('insufficient funds')) {
      throw new IXFIError(
        'Insufficient balance for transaction',
        'INSUFFICIENT_BALANCE',
        { required: error.required, available: error.available }
      );
    }
    
    if (error.message.includes('Unsupported destination chain')) {
      throw new IXFIError(
        'Chain not supported',
        'UNSUPPORTED_CHAIN',
        { chain: error.chain }
      );
    }
    
    if (error.message.includes('Transaction expired')) {
      throw new IXFIError(
        'Meta-transaction expired',
        'TRANSACTION_EXPIRED',
        { deadline: error.deadline, currentTime: Date.now() }
      );
    }
    
    // Generic error
    throw new IXFIError(
      'Transaction failed',
      'TRANSACTION_FAILED',
      { originalError: error.message }
    );
  }
}

// Usage with error handling
async function safeTransfer() {
  try {
    const result = await handleIXFITransaction(async () => {
      return await ixfi.sendCrossChain('ethereum', recipient, amount);
    });
    
    console.log('Transfer successful:', result.transactionHash);
  } catch (error) {
    if (error instanceof IXFIError) {
      console.error(`IXFI Error [${error.code}]:`, error.message);
      console.error('Details:', error.details);
      
      // Handle specific error codes
      switch (error.code) {
        case 'INSUFFICIENT_BALANCE':
          alert('Please deposit more IXFI tokens before transferring');
          break;
        case 'UNSUPPORTED_CHAIN':
          alert('Selected chain is not supported');
          break;
        case 'TRANSACTION_EXPIRED':
          alert('Transaction took too long, please try again');
          break;
        default:
          alert('Transaction failed: ' + error.message);
      }
    } else {
      console.error('Unexpected error:', error);
      alert('An unexpected error occurred');
    }
  }
}
```

### Retry Logic

```javascript
async function withRetry(fn, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      console.log(`Attempt ${i + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
}

// Usage
const result = await withRetry(async () => {
  return await ixfi.sendCrossChain('ethereum', recipient, amount);
});
```

This integration guide provides comprehensive examples for developers to integrate IXFI into their applications, covering frontend integration, smart contract development, API usage, and error handling patterns.
