# Frontend Integration Guide

This comprehensive guide covers integrating IXFI Protocol into frontend applications, including React, Vue, and vanilla JavaScript implementations.

## Overview

IXFI Protocol offers multiple frontend integration approaches:

1. **JavaScript SDK**: Easy-to-use high-level APIs
2. **React Hooks**: Pre-built hooks for React applications
3. **Direct Contract Interaction**: Low-level ethers.js integration
4. **REST API**: Server-side integration options

## Installation & Setup

### NPM Package Installation

```bash
# Core SDK
npm install @ixfi/sdk ethers

# React hooks (for React apps)
npm install @ixfi/react-hooks

# Vue composables (for Vue apps)
npm install @ixfi/vue-composables

# Additional utilities
npm install @ixfi/utils @ixfi/types
```

### CDN Integration

For vanilla JavaScript or quick prototyping:

```html
<!-- Core IXFI SDK -->
<script src="https://cdn.ixfi.com/sdk/latest/ixfi-sdk.min.js"></script>

<!-- Ethers.js (required dependency) -->
<script src="https://cdn.ethers.io/lib/ethers-5.7.2.umd.min.js"></script>

<script>
// IXFI SDK is now available globally
const { IXFIGateway, CrossChainAggregator } = IXFI;
</script>
```

## JavaScript SDK Integration

### Basic Setup

```javascript
import { IXFIGateway, CrossChainAggregator, MetaTxGateway } from '@ixfi/sdk';
import { ethers } from 'ethers';

// Initialize provider (MetaMask, WalletConnect, etc.)
const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();

// Initialize IXFI components
const config = {
  provider,
  signer,
  chainId: 1, // Ethereum mainnet
  relayerEndpoint: 'https://relayer.ixfi.com',
  gasOracleEndpoint: 'https://gas.ixfi.com'
};

const gateway = new IXFIGateway(config);
const aggregator = new CrossChainAggregator(config);
const metaTxGateway = new MetaTxGateway(config);
```

### Wallet Connection

```javascript
class WalletManager {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.account = null;
    this.chainId = null;
  }

  async connectWallet(walletType = 'metamask') {
    try {
      switch (walletType) {
        case 'metamask':
          await this.connectMetaMask();
          break;
        case 'walletconnect':
          await this.connectWalletConnect();
          break;
        case 'coinbase':
          await this.connectCoinbaseWallet();
          break;
        default:
          throw new Error('Unsupported wallet type');
      }

      await this.setupEventListeners();
      return {
        account: this.account,
        chainId: this.chainId,
        provider: this.provider
      };
    } catch (error) {
      console.error('Wallet connection failed:', error);
      throw error;
    }
  }

  async connectMetaMask() {
    if (!window.ethereum) {
      throw new Error('MetaMask not installed');
    }

    // Request account access
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    
    this.provider = new ethers.providers.Web3Provider(window.ethereum);
    this.signer = this.provider.getSigner();
    this.account = await this.signer.getAddress();
    
    const network = await this.provider.getNetwork();
    this.chainId = network.chainId;
  }

  async connectWalletConnect() {
    const WalletConnectProvider = (await import('@walletconnect/ethereum-provider')).default;
    
    const walletConnectProvider = await WalletConnectProvider.init({
      projectId: 'your-walletconnect-project-id',
      chains: [1, 137, 56, 43114, 42161, 10], // Supported chains
      showQrModal: true
    });

    await walletConnectProvider.enable();
    
    this.provider = new ethers.providers.Web3Provider(walletConnectProvider);
    this.signer = this.provider.getSigner();
    this.account = await this.signer.getAddress();
    
    const network = await this.provider.getNetwork();
    this.chainId = network.chainId;
  }

  async connectCoinbaseWallet() {
    const CoinbaseWalletSDK = (await import('@coinbase/wallet-sdk')).default;
    
    const coinbaseWallet = new CoinbaseWalletSDK({
      appName: 'IXFI DApp',
      appLogoUrl: 'https://ixfi.com/logo.png',
      darkMode: false
    });

    const ethereum = coinbaseWallet.makeWeb3Provider('https://mainnet.infura.io/v3/your-infura-key', 1);
    
    await ethereum.request({ method: 'eth_requestAccounts' });
    
    this.provider = new ethers.providers.Web3Provider(ethereum);
    this.signer = this.provider.getSigner();
    this.account = await this.signer.getAddress();
    
    const network = await this.provider.getNetwork();
    this.chainId = network.chainId;
  }

  async setupEventListeners() {
    if (window.ethereum) {
      // Account changed
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          this.disconnect();
        } else {
          this.account = accounts[0];
          this.onAccountChanged(accounts[0]);
        }
      });

      // Chain changed
      window.ethereum.on('chainChanged', (chainId) => {
        this.chainId = parseInt(chainId, 16);
        this.onChainChanged(this.chainId);
        // Reload page for chain changes
        window.location.reload();
      });

      // Disconnect
      window.ethereum.on('disconnect', () => {
        this.disconnect();
      });
    }
  }

  disconnect() {
    this.provider = null;
    this.signer = null;
    this.account = null;
    this.chainId = null;
    this.onDisconnect();
  }

  // Event handlers (override in implementation)
  onAccountChanged(account) {
    console.log('Account changed:', account);
  }

  onChainChanged(chainId) {
    console.log('Chain changed:', chainId);
  }

  onDisconnect() {
    console.log('Wallet disconnected');
  }
}
```

### Token Swapping Interface

```javascript
class SwapInterface {
  constructor(aggregator, walletManager) {
    this.aggregator = aggregator;
    this.walletManager = walletManager;
    this.quotes = [];
    this.selectedQuote = null;
  }

  async getSwapQuotes(tokenIn, tokenOut, amountIn) {
    try {
      // Show loading state
      this.onLoadingStart('Getting quotes...');

      // Get quotes from all DEXes
      const quotes = await this.aggregator.getAllQuotes(tokenIn, tokenOut, amountIn);
      
      // Filter and sort quotes
      this.quotes = quotes
        .filter(quote => quote.success && quote.amountOut > 0)
        .sort((a, b) => parseFloat(b.amountOut) - parseFloat(a.amountOut))
        .map(quote => ({
          ...quote,
          dexName: this.getDEXName(quote.routerType),
          amountOutFormatted: ethers.utils.formatUnits(quote.amountOut, 18),
          priceImpactFormatted: `${(quote.priceImpact / 100).toFixed(2)}%`,
          gasEstimateETH: ethers.utils.formatEther(quote.gasEstimate || 0)
        }));

      this.selectedQuote = this.quotes[0]; // Default to best quote
      this.onQuotesUpdated(this.quotes);
      
      return this.quotes;
    } catch (error) {
      this.onError('Failed to get quotes', error);
      throw error;
    } finally {
      this.onLoadingEnd();
    }
  }

  async executeSwap(slippageTolerance = 0.5) {
    if (!this.selectedQuote) {
      throw new Error('No quote selected');
    }

    try {
      this.onLoadingStart('Executing swap...');

      const { tokenIn, tokenOut, amountIn } = this.selectedQuote;
      
      // Calculate minimum amount out with slippage
      const minAmountOut = ethers.BigNumber.from(this.selectedQuote.amountOut)
        .mul(Math.floor((100 - slippageTolerance) * 100))
        .div(10000);

      // Check and approve token if needed
      await this.ensureTokenApproval(tokenIn, amountIn);

      // Execute swap
      const tx = await this.aggregator.executeSwap({
        tokenIn,
        tokenOut,
        amountIn,
        minAmountOut,
        routerType: this.selectedQuote.routerType,
        to: this.walletManager.account
      });

      this.onTransactionSubmitted(tx.hash);

      // Wait for confirmation
      const receipt = await tx.wait();
      this.onTransactionConfirmed(receipt);

      return receipt;
    } catch (error) {
      this.onError('Swap failed', error);
      throw error;
    } finally {
      this.onLoadingEnd();
    }
  }

  async ensureTokenApproval(tokenAddress, amount) {
    if (tokenAddress === ethers.constants.AddressZero) {
      return; // No approval needed for ETH
    }

    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) returns (bool)'],
      this.walletManager.signer
    );

    const currentAllowance = await tokenContract.allowance(
      this.walletManager.account,
      this.aggregator.address
    );

    if (currentAllowance.lt(amount)) {
      const approveTx = await tokenContract.approve(this.aggregator.address, amount);
      await approveTx.wait();
      this.onApprovalConfirmed(tokenAddress, amount);
    }
  }

  getDEXName(routerType) {
    const dexNames = {
      0: 'Uniswap V2',
      1: 'SushiSwap V2',
      2: 'PancakeSwap V2',
      3: 'QuickSwap',
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

  // Event handlers (override in implementation)
  onLoadingStart(message) {
    console.log('Loading:', message);
  }

  onLoadingEnd() {
    console.log('Loading complete');
  }

  onQuotesUpdated(quotes) {
    console.log('Quotes updated:', quotes.length);
  }

  onTransactionSubmitted(hash) {
    console.log('Transaction submitted:', hash);
  }

  onTransactionConfirmed(receipt) {
    console.log('Transaction confirmed:', receipt.transactionHash);
  }

  onApprovalConfirmed(token, amount) {
    console.log('Approval confirmed:', token, amount);
  }

  onError(message, error) {
    console.error(message, error);
  }
}
```

## React Integration

### React Hooks

```jsx
// hooks/useIXFI.js
import { useState, useEffect, useContext, createContext } from 'react';
import { IXFIGateway, CrossChainAggregator } from '@ixfi/sdk';

// Context for IXFI SDK
const IXFIContext = createContext();

export const IXFIProvider = ({ children, config }) => {
  const [gateway, setGateway] = useState(null);
  const [aggregator, setAggregator] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeSDK = async () => {
      try {
        const gatewayInstance = new IXFIGateway(config);
        const aggregatorInstance = new CrossChainAggregator(config);
        
        setGateway(gatewayInstance);
        setAggregator(aggregatorInstance);
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize IXFI SDK:', error);
      }
    };

    initializeSDK();
  }, [config]);

  return (
    <IXFIContext.Provider value={{ gateway, aggregator, isInitialized }}>
      {children}
    </IXFIContext.Provider>
  );
};

export const useIXFI = () => {
  const context = useContext(IXFIContext);
  if (!context) {
    throw new Error('useIXFI must be used within IXFIProvider');
  }
  return context;
};

// hooks/useSwap.js
import { useState, useCallback } from 'react';
import { useIXFI } from './useIXFI';

export const useSwap = () => {
  const { aggregator } = useIXFI();
  const [quotes, setQuotes] = useState([]);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getQuotes = useCallback(async (tokenIn, tokenOut, amountIn) => {
    if (!aggregator) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const quotesResult = await aggregator.getAllQuotes(tokenIn, tokenOut, amountIn);
      const formattedQuotes = quotesResult
        .filter(q => q.success)
        .sort((a, b) => parseFloat(b.amountOut) - parseFloat(a.amountOut));
      
      setQuotes(formattedQuotes);
      setSelectedQuote(formattedQuotes[0]);
      
      return formattedQuotes;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [aggregator]);

  const executeSwap = useCallback(async (swapParams) => {
    if (!aggregator || !selectedQuote) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await aggregator.executeSwap(swapParams);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [aggregator, selectedQuote]);

  return {
    quotes,
    selectedQuote,
    setSelectedQuote,
    getQuotes,
    executeSwap,
    loading,
    error
  };
};

// hooks/useCrossChain.js
import { useState, useCallback } from 'react';
import { useIXFI } from './useIXFI';

export const useCrossChain = () => {
  const { gateway } = useIXFI();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const transferTokens = useCallback(async (params) => {
    if (!gateway) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await gateway.transferTokens(params);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  const crossChainCall = useCallback(async (params) => {
    if (!gateway) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await gateway.callContract(params);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  return {
    transferTokens,
    crossChainCall,
    loading,
    error
  };
};
```

### React Components

```jsx
// components/SwapInterface.jsx
import React, { useState } from 'react';
import { useSwap } from '../hooks/useSwap';
import { useWallet } from '../hooks/useWallet';
import { ethers } from 'ethers';

const SwapInterface = () => {
  const { account, signer } = useWallet();
  const { quotes, selectedQuote, setSelectedQuote, getQuotes, executeSwap, loading, error } = useSwap();
  
  const [tokenIn, setTokenIn] = useState('');
  const [tokenOut, setTokenOut] = useState('');
  const [amountIn, setAmountIn] = useState('');
  const [slippage, setSlippage] = useState(0.5);

  const handleGetQuotes = async () => {
    if (!tokenIn || !tokenOut || !amountIn) return;
    
    try {
      const amount = ethers.utils.parseUnits(amountIn, 18);
      await getQuotes(tokenIn, tokenOut, amount);
    } catch (err) {
      console.error('Failed to get quotes:', err);
    }
  };

  const handleSwap = async () => {
    if (!selectedQuote || !signer) return;
    
    try {
      const minAmountOut = ethers.BigNumber.from(selectedQuote.amountOut)
        .mul(Math.floor((100 - slippage) * 100))
        .div(10000);

      await executeSwap({
        tokenIn,
        tokenOut,
        amountIn: ethers.utils.parseUnits(amountIn, 18),
        minAmountOut,
        routerType: selectedQuote.routerType,
        to: account
      });
    } catch (err) {
      console.error('Swap failed:', err);
    }
  };

  return (
    <div className="swap-interface">
      <h2>Token Swap</h2>
      
      <div className="swap-form">
        <div className="input-group">
          <label>From Token</label>
          <input
            type="text"
            placeholder="Token address"
            value={tokenIn}
            onChange={(e) => setTokenIn(e.target.value)}
          />
        </div>
        
        <div className="input-group">
          <label>To Token</label>
          <input
            type="text"
            placeholder="Token address"
            value={tokenOut}
            onChange={(e) => setTokenOut(e.target.value)}
          />
        </div>
        
        <div className="input-group">
          <label>Amount</label>
          <input
            type="number"
            placeholder="0.0"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
          />
        </div>
        
        <div className="input-group">
          <label>Slippage Tolerance (%)</label>
          <input
            type="number"
            step="0.1"
            value={slippage}
            onChange={(e) => setSlippage(parseFloat(e.target.value))}
          />
        </div>
        
        <button 
          onClick={handleGetQuotes}
          disabled={loading || !tokenIn || !tokenOut || !amountIn}
        >
          {loading ? 'Getting Quotes...' : 'Get Quotes'}
        </button>
      </div>

      {error && (
        <div className="error">
          Error: {error}
        </div>
      )}

      {quotes.length > 0 && (
        <div className="quotes-section">
          <h3>Available Quotes</h3>
          <div className="quotes-list">
            {quotes.map((quote, index) => (
              <div 
                key={index}
                className={`quote-item ${selectedQuote === quote ? 'selected' : ''}`}
                onClick={() => setSelectedQuote(quote)}
              >
                <div className="dex-name">{getDEXName(quote.routerType)}</div>
                <div className="amount-out">
                  {ethers.utils.formatUnits(quote.amountOut, 18)} tokens
                </div>
                <div className="price-impact">
                  Impact: {(quote.priceImpact / 100).toFixed(2)}%
                </div>
              </div>
            ))}
          </div>
          
          {selectedQuote && (
            <button 
              onClick={handleSwap}
              disabled={loading}
              className="swap-button"
            >
              {loading ? 'Swapping...' : 'Execute Swap'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SwapInterface;

// components/CrossChainTransfer.jsx
import React, { useState } from 'react';
import { useCrossChain } from '../hooks/useCrossChain';
import { ethers } from 'ethers';

const CrossChainTransfer = () => {
  const { transferTokens, loading, error } = useCrossChain();
  
  const [fromChain, setFromChain] = useState('ethereum');
  const [toChain, setToChain] = useState('polygon');
  const [token, setToken] = useState('');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');

  const supportedChains = [
    { id: 'ethereum', name: 'Ethereum' },
    { id: 'polygon', name: 'Polygon' },
    { id: 'bsc', name: 'BSC' },
    { id: 'avalanche', name: 'Avalanche' },
    { id: 'arbitrum', name: 'Arbitrum' },
    { id: 'optimism', name: 'Optimism' }
  ];

  const handleTransfer = async () => {
    if (!token || !amount || !recipient) return;
    
    try {
      await transferTokens({
        fromChain,
        toChain,
        token,
        amount: ethers.utils.parseUnits(amount, 18),
        recipient
      });
    } catch (err) {
      console.error('Transfer failed:', err);
    }
  };

  return (
    <div className="cross-chain-transfer">
      <h2>Cross-Chain Transfer</h2>
      
      <div className="transfer-form">
        <div className="chain-selection">
          <div className="input-group">
            <label>From Chain</label>
            <select value={fromChain} onChange={(e) => setFromChain(e.target.value)}>
              {supportedChains.map(chain => (
                <option key={chain.id} value={chain.id}>{chain.name}</option>
              ))}
            </select>
          </div>
          
          <div className="input-group">
            <label>To Chain</label>
            <select value={toChain} onChange={(e) => setToChain(e.target.value)}>
              {supportedChains.map(chain => (
                <option key={chain.id} value={chain.id}>{chain.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="input-group">
          <label>Token Address</label>
          <input
            type="text"
            placeholder="0x..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>
        
        <div className="input-group">
          <label>Amount</label>
          <input
            type="number"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        
        <div className="input-group">
          <label>Recipient Address</label>
          <input
            type="text"
            placeholder="0x..."
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
        </div>
        
        <button 
          onClick={handleTransfer}
          disabled={loading || !token || !amount || !recipient}
        >
          {loading ? 'Transferring...' : 'Transfer Tokens'}
        </button>
      </div>

      {error && (
        <div className="error">
          Error: {error}
        </div>
      )}
    </div>
  );
};

export default CrossChainTransfer;
```

## Vue.js Integration

### Vue Composables

```javascript
// composables/useIXFI.js
import { ref, reactive, computed } from 'vue';
import { IXFIGateway, CrossChainAggregator } from '@ixfi/sdk';

const state = reactive({
  gateway: null,
  aggregator: null,
  isInitialized: false,
  config: null
});

export const useIXFI = () => {
  const initialize = async (config) => {
    try {
      state.config = config;
      state.gateway = new IXFIGateway(config);
      state.aggregator = new CrossChainAggregator(config);
      state.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize IXFI SDK:', error);
      throw error;
    }
  };

  const isInitialized = computed(() => state.isInitialized);
  const gateway = computed(() => state.gateway);
  const aggregator = computed(() => state.aggregator);

  return {
    initialize,
    isInitialized,
    gateway,
    aggregator
  };
};

// composables/useSwap.js
import { ref, computed } from 'vue';
import { useIXFI } from './useIXFI';

export const useSwap = () => {
  const { aggregator } = useIXFI();
  
  const quotes = ref([]);
  const selectedQuote = ref(null);
  const loading = ref(false);
  const error = ref(null);

  const getQuotes = async (tokenIn, tokenOut, amountIn) => {
    if (!aggregator.value) return;
    
    loading.value = true;
    error.value = null;
    
    try {
      const result = await aggregator.value.getAllQuotes(tokenIn, tokenOut, amountIn);
      quotes.value = result.filter(q => q.success);
      selectedQuote.value = quotes.value[0];
      return quotes.value;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const executeSwap = async (swapParams) => {
    if (!aggregator.value || !selectedQuote.value) return;
    
    loading.value = true;
    error.value = null;
    
    try {
      const result = await aggregator.value.executeSwap(swapParams);
      return result;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const bestQuote = computed(() => quotes.value[0]);
  const hasQuotes = computed(() => quotes.value.length > 0);

  return {
    quotes,
    selectedQuote,
    loading,
    error,
    bestQuote,
    hasQuotes,
    getQuotes,
    executeSwap
  };
};
```

### Vue Components

```vue
<!-- components/SwapInterface.vue -->
<template>
  <div class="swap-interface">
    <h2>Token Swap</h2>
    
    <form @submit.prevent="handleGetQuotes" class="swap-form">
      <div class="input-group">
        <label>From Token</label>
        <input 
          v-model="formData.tokenIn" 
          type="text" 
          placeholder="Token address"
          required
        />
      </div>
      
      <div class="input-group">
        <label>To Token</label>
        <input 
          v-model="formData.tokenOut" 
          type="text" 
          placeholder="Token address"
          required
        />
      </div>
      
      <div class="input-group">
        <label>Amount</label>
        <input 
          v-model="formData.amountIn" 
          type="number" 
          placeholder="0.0"
          step="any"
          required
        />
      </div>
      
      <button 
        type="submit" 
        :disabled="loading || !isFormValid"
        class="get-quotes-btn"
      >
        {{ loading ? 'Getting Quotes...' : 'Get Quotes' }}
      </button>
    </form>

    <div v-if="error" class="error">
      Error: {{ error }}
    </div>

    <div v-if="hasQuotes" class="quotes-section">
      <h3>Available Quotes</h3>
      
      <div class="quotes-list">
        <div 
          v-for="(quote, index) in quotes" 
          :key="index"
          :class="['quote-item', { selected: selectedQuote === quote }]"
          @click="selectedQuote = quote"
        >
          <div class="dex-name">{{ getDEXName(quote.routerType) }}</div>
          <div class="amount-out">{{ formatAmount(quote.amountOut) }} tokens</div>
          <div class="price-impact">Impact: {{ formatPercent(quote.priceImpact) }}</div>
        </div>
      </div>
      
      <button 
        v-if="selectedQuote"
        @click="handleSwap"
        :disabled="loading"
        class="swap-btn"
      >
        {{ loading ? 'Swapping...' : 'Execute Swap' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed } from 'vue';
import { useSwap } from '../composables/useSwap';
import { ethers } from 'ethers';

const { quotes, selectedQuote, loading, error, hasQuotes, getQuotes, executeSwap } = useSwap();

const formData = reactive({
  tokenIn: '',
  tokenOut: '',
  amountIn: '',
  slippage: 0.5
});

const isFormValid = computed(() => 
  formData.tokenIn && formData.tokenOut && formData.amountIn
);

const handleGetQuotes = async () => {
  try {
    const amount = ethers.utils.parseUnits(formData.amountIn, 18);
    await getQuotes(formData.tokenIn, formData.tokenOut, amount);
  } catch (err) {
    console.error('Failed to get quotes:', err);
  }
};

const handleSwap = async () => {
  if (!selectedQuote.value) return;
  
  try {
    const minAmountOut = ethers.BigNumber.from(selectedQuote.value.amountOut)
      .mul(Math.floor((100 - formData.slippage) * 100))
      .div(10000);

    await executeSwap({
      tokenIn: formData.tokenIn,
      tokenOut: formData.tokenOut,
      amountIn: ethers.utils.parseUnits(formData.amountIn, 18),
      minAmountOut,
      routerType: selectedQuote.value.routerType
    });
  } catch (err) {
    console.error('Swap failed:', err);
  }
};

const getDEXName = (routerType) => {
  const dexNames = {
    0: 'Uniswap V2',
    1: 'SushiSwap V2',
    10: 'Uniswap V3',
    30: 'Curve'
  };
  return dexNames[routerType] || `Router ${routerType}`;
};

const formatAmount = (amount) => {
  return ethers.utils.formatUnits(amount, 18);
};

const formatPercent = (value) => {
  return `${(value / 100).toFixed(2)}%`;
};
</script>

<style scoped>
.swap-interface {
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
}

.swap-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 20px;
}

.input-group {
  display: flex;
  flex-direction: column;
}

.input-group label {
  margin-bottom: 5px;
  font-weight: bold;
}

.input-group input {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
}

.quotes-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.quote-item {
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.2s;
}

.quote-item:hover {
  border-color: #007bff;
}

.quote-item.selected {
  border-color: #007bff;
  background-color: #f8f9fa;
}

.error {
  color: red;
  padding: 10px;
  margin: 10px 0;
  border: 1px solid red;
  border-radius: 5px;
  background-color: #ffeaea;
}

button {
  padding: 12px 20px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
}

button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

button:hover:not(:disabled) {
  background-color: #0056b3;
}
</style>
```

## Error Handling & Best Practices

### Comprehensive Error Handling

```javascript
class IXFIErrorHandler {
  constructor() {
    this.errorTypes = {
      WALLET_NOT_CONNECTED: 'WalletNotConnected',
      INSUFFICIENT_BALANCE: 'InsufficientBalance',
      SLIPPAGE_EXCEEDED: 'SlippageExceeded',
      TRANSACTION_FAILED: 'TransactionFailed',
      NETWORK_ERROR: 'NetworkError',
      QUOTE_EXPIRED: 'QuoteExpired'
    };
  }

  handleError(error, context = '') {
    console.error(`[IXFI] Error in ${context}:`, error);

    // Parse error message and code
    const errorInfo = this.parseError(error);
    
    // Show user-friendly message
    this.showUserMessage(errorInfo);
    
    // Log for analytics
    this.logError(errorInfo, context);
    
    return errorInfo;
  }

  parseError(error) {
    // Check for common error patterns
    if (error.code === 4001) {
      return {
        type: 'USER_REJECTED',
        message: 'Transaction was rejected by user',
        userMessage: 'You rejected the transaction'
      };
    }

    if (error.message.includes('insufficient funds')) {
      return {
        type: this.errorTypes.INSUFFICIENT_BALANCE,
        message: error.message,
        userMessage: 'Insufficient balance for this transaction'
      };
    }

    if (error.message.includes('slippage')) {
      return {
        type: this.errorTypes.SLIPPAGE_EXCEEDED,
        message: error.message,
        userMessage: 'Price moved too much. Try increasing slippage tolerance.'
      };
    }

    // Default error
    return {
      type: 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      userMessage: 'Something went wrong. Please try again.'
    };
  }

  showUserMessage(errorInfo) {
    // Use your preferred notification system
    console.warn('User Message:', errorInfo.userMessage);
    
    // Example: show in UI toast/notification
    if (window.showNotification) {
      window.showNotification(errorInfo.userMessage, 'error');
    }
  }

  logError(errorInfo, context) {
    // Log to your analytics service
    console.log('Logging error:', errorInfo, context);
  }
}

const errorHandler = new IXFIErrorHandler();

// Usage in async functions
const safeExecute = async (operation, context = '') => {
  try {
    return await operation();
  } catch (error) {
    return errorHandler.handleError(error, context);
  }
};
```

### Performance Optimization

```javascript
class IXFIPerformanceOptimizer {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
  }

  // Cache quotes to avoid repeated requests
  async getCachedQuotes(tokenIn, tokenOut, amountIn) {
    const cacheKey = `${tokenIn}-${tokenOut}-${amountIn}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    // Fetch fresh quotes
    const quotes = await aggregator.getAllQuotes(tokenIn, tokenOut, amountIn);
    
    // Cache the result
    this.cache.set(cacheKey, {
      data: quotes,
      timestamp: Date.now()
    });

    return quotes;
  }

  // Debounce quote requests
  debounceQuoteRequest = this.debounce(async (tokenIn, tokenOut, amountIn) => {
    return await this.getCachedQuotes(tokenIn, tokenOut, amountIn);
  }, 500);

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Batch multiple operations
  async batchOperations(operations) {
    return await Promise.allSettled(operations);
  }

  // Clean up cache periodically
  startCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > this.cacheTimeout) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Clean every minute
  }
}
```

## Testing

### Unit Testing with Jest

```javascript
// tests/ixfi-integration.test.js
import { IXFIGateway, CrossChainAggregator } from '@ixfi/sdk';
import { ethers } from 'ethers';

describe('IXFI Integration', () => {
  let gateway;
  let aggregator;
  let mockProvider;
  let mockSigner;

  beforeEach(() => {
    mockProvider = {
      getNetwork: jest.fn().mockResolvedValue({ chainId: 1 }),
      getBlockNumber: jest.fn().mockResolvedValue(12345)
    };

    mockSigner = {
      getAddress: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
      provider: mockProvider
    };

    const config = {
      provider: mockProvider,
      signer: mockSigner,
      chainId: 1
    };

    gateway = new IXFIGateway(config);
    aggregator = new CrossChainAggregator(config);
  });

  test('should initialize gateway correctly', () => {
    expect(gateway).toBeDefined();
    expect(gateway.provider).toBe(mockProvider);
  });

  test('should get quotes from aggregator', async () => {
    // Mock the getAllQuotes method
    aggregator.getAllQuotes = jest.fn().mockResolvedValue([
      {
        routerType: 0,
        amountOut: ethers.BigNumber.from('1000000000000000000'),
        success: true
      }
    ]);

    const quotes = await aggregator.getAllQuotes(
      '0xA0b86a33E6441e1a02c4e4670dd96EA0f25A632', // USDC
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
      ethers.utils.parseUnits('1000', 6)
    );

    expect(quotes).toHaveLength(1);
    expect(quotes[0].success).toBe(true);
  });
});
```

## Deployment

### Production Deployment

```javascript
// config/production.js
export const productionConfig = {
  networks: {
    ethereum: {
      rpcUrl: 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
      chainId: 1,
      contracts: {
        gateway: '0x...',
        aggregator: '0x...',
        metaTxGateway: '0x...'
      }
    },
    polygon: {
      rpcUrl: 'https://polygon-rpc.com',
      chainId: 137,
      contracts: {
        gateway: '0x...',
        aggregator: '0x...',
        metaTxGateway: '0x...'
      }
    }
  },
  relayer: {
    endpoint: 'https://relayer.ixfi.com',
    timeout: 30000
  },
  features: {
    gaslessTransactions: true,
    crossChainSwaps: true,
    multiRouting: true
  }
};

// Build configuration
export const buildConfig = {
  optimization: {
    minimize: true,
    moduleIds: 'deterministic'
  },
  externals: {
    'ethers': 'ethers'
  }
};
```

## Security Considerations

1. **Input Validation**: Always validate user inputs
2. **Token Approvals**: Check and handle token approvals securely
3. **Slippage Protection**: Implement appropriate slippage tolerances
4. **Error Handling**: Never expose sensitive error details to users
5. **Rate Limiting**: Implement rate limiting for API calls
6. **HTTPS Only**: Always use HTTPS in production
7. **Wallet Security**: Guide users on wallet security best practices

## Resources

- [React Example App](https://github.com/ixfi/react-example)
- [Vue Example App](https://github.com/ixfi/vue-example) 
- [JavaScript SDK Documentation](https://docs.ixfi.com/sdk)
- [API Reference](../api-reference/)
- [Smart Contract Integration](smart-contract-integration.md)
- [Security Best Practices](security.md)
