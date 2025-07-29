# Configuration

Learn how to configure IXFI Protocol for different environments and use cases.

## Environment Configuration

### Network Configurations

IXFI supports multiple networks with different configurations:

```javascript
const networkConfigs = {
  mainnet: {
    ethereum: {
      chainId: 1,
      rpcUrl: 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
      ixfiGateway: '0x...',
      aggregator: '0x...'
    },
    bsc: {
      chainId: 56,
      rpcUrl: 'https://bsc-dataseed1.binance.org/',
      ixfiGateway: '0x...',
      aggregator: '0x...'
    },
    // ... other networks
  },
  testnet: {
    sepolia: {
      chainId: 11155111,
      rpcUrl: 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID',
      ixfiGateway: '0x...',
      aggregator: '0x...'
    },
    // ... other testnets
  }
};
```

### SDK Configuration

#### Basic Configuration

```javascript
import { IXFIProvider } from '@ixfi/sdk';

const ixfi = new IXFIProvider({
  network: 'mainnet', // or 'testnet'
  provider: window.ethereum,
  signer: signer,
  
  // Optional configurations
  defaultSlippage: 50, // 0.5%
  defaultDeadline: 1800, // 30 minutes
  gasPrice: 'fast', // 'slow', 'standard', 'fast'
  
  // Relayer configuration
  relayerUrl: 'https://relayer.ixfi.com',
  enableGasless: true,
  
  // DEX preferences
  preferredDEXes: ['uniswap-v3', 'sushiswap-v2'],
  excludedDEXes: ['deprecated-dex'],
  
  // Logging
  debug: false,
  logLevel: 'info' // 'error', 'warn', 'info', 'debug'
});
```

#### Advanced Configuration

```javascript
const ixfi = new IXFIProvider({
  network: 'mainnet',
  provider: provider,
  signer: signer,
  
  // Custom network configurations
  customNetworks: {
    myCustomChain: {
      chainId: 12345,
      rpcUrl: 'https://my-custom-rpc.com',
      ixfiGateway: '0x...',
      aggregator: '0x...',
      supportedTokens: ['0x...', '0x...']
    }
  },
  
  // DEX routing preferences
  routing: {
    maxHops: 3,
    minLiquidity: ethers.utils.parseEther('1000'),
    maxPriceImpact: 300, // 3%
    
    // Router-specific settings
    uniswapV3: {
      fees: [500, 3000, 10000], // Preferred fee tiers
      maxTickBias: 1000
    },
    
    curve: {
      maxSlippage: 100, // 1% for stablecoins
      preferStablePools: true
    }
  },
  
  // Cross-chain settings
  crossChain: {
    confirmationBlocks: {
      ethereum: 12,
      bsc: 15,
      polygon: 20
    },
    
    bridgeFees: {
      ethereum: ethers.utils.parseEther('0.01'),
      bsc: ethers.utils.parseEther('0.005')
    },
    
    timeout: 600 // 10 minutes
  },
  
  // Gas optimization
  gas: {
    priorityFee: 'auto', // or specific value in gwei
    maxFeePerGas: 'auto',
    gasLimitMultiplier: 1.2,
    
    // Gas estimation override
    estimateGas: async (transaction) => {
      // Custom gas estimation logic
      return ethers.utils.parseUnits('100000', 'wei');
    }
  }
});
```

## Contract Configuration

### Smart Contract Settings

When deploying or interacting with IXFI contracts:

```solidity
// Deployment configuration
contract IXFIConfig {
    struct NetworkConfig {
        uint256 chainId;
        address gateway;
        address aggregator;
        address[] supportedTokens;
        uint256 minGasPrice;
        uint256 maxGasPrice;
    }
    
    mapping(uint256 => NetworkConfig) public networkConfigs;
    
    constructor() {
        // Ethereum mainnet
        networkConfigs[1] = NetworkConfig({
            chainId: 1,
            gateway: 0x...,
            aggregator: 0x...,
            supportedTokens: [0x..., 0x...],
            minGasPrice: 1 gwei,
            maxGasPrice: 100 gwei
        });
        
        // BSC mainnet
        networkConfigs[56] = NetworkConfig({
            chainId: 56,
            gateway: 0x...,
            aggregator: 0x...,
            supportedTokens: [0x..., 0x...],
            minGasPrice: 5 gwei,
            maxGasPrice: 20 gwei
        });
    }
}
```

### Router Configuration

Configure supported DEX routers:

```javascript
const routerConfigs = {
  // Uniswap V2
  0: {
    name: 'Uniswap V2',
    factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    fee: 30, // 0.3%
    networks: [1, 137, 42161, 10] // Ethereum, Polygon, Arbitrum, Optimism
  },
  
  // Uniswap V3
  10: {
    name: 'Uniswap V3',
    factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
    router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    fees: [100, 500, 3000, 10000],
    networks: [1, 137, 42161, 10, 8453]
  },
  
  // Custom DEX
  37: {
    name: 'Custom DEX',
    router: '0x...',
    networks: [1],
    custom: true,
    quoteFunction: 'getAmountsOut',
    swapFunction: 'swapExactTokensForTokens'
  }
};
```

## Environment Variables

### Required Variables

```bash
# Network RPC URLs
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
BSC_RPC_URL=https://bsc-dataseed1.binance.org/
POLYGON_RPC_URL=https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID

# Private Keys (for deployment)
DEPLOYER_PRIVATE_KEY=0x...
RELAYER_PRIVATE_KEY=0x...

# Contract Addresses
IXFI_GATEWAY_ETHEREUM=0x...
IXFI_GATEWAY_BSC=0x...
CROSSCHAIN_AGGREGATOR_ETHEREUM=0x...
CROSSCHAIN_AGGREGATOR_BSC=0x...

# API Keys
ETHERSCAN_API_KEY=ABC123...
BSCSCAN_API_KEY=DEF456...
COINGECKO_API_KEY=GHI789...

# Relayer Configuration
RELAYER_URL=https://relayer.ixfi.com
RELAYER_API_KEY=secret_key
```

### Optional Variables

```bash
# Gas Configuration
DEFAULT_GAS_PRICE=20
MAX_GAS_PRICE=100
GAS_LIMIT_MULTIPLIER=1.2

# Slippage and Timing
DEFAULT_SLIPPAGE=50
DEFAULT_DEADLINE=1800
CROSS_CHAIN_TIMEOUT=600

# Logging
LOG_LEVEL=info
DEBUG_MODE=false
SENTRY_DSN=https://...

# DEX Preferences
PREFERRED_DEXES=uniswap-v3,sushiswap-v2
EXCLUDED_DEXES=deprecated-dex
MAX_PRICE_IMPACT=300

# Security
ENABLE_WHITELIST=true
SECURITY_DELAY=3600
EMERGENCY_PAUSE=false
```

## Frontend Configuration

### React Configuration

```javascript
// config/ixfi.js
export const ixfiConfig = {
  networks: {
    1: {
      name: 'Ethereum',
      currency: 'ETH',
      explorerUrl: 'https://etherscan.io',
      rpcUrl: process.env.REACT_APP_ETHEREUM_RPC
    },
    56: {
      name: 'BSC',
      currency: 'BNB',
      explorerUrl: 'https://bscscan.com',
      rpcUrl: process.env.REACT_APP_BSC_RPC
    }
  },
  
  tokens: {
    1: { // Ethereum
      USDC: '0xA0b86a33E6441e1a02c4e4670dd96EA0f25A632',
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      IXFI: '0x...'
    },
    56: { // BSC
      USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      IXFI: '0x...'
    }
  },
  
  settings: {
    defaultSlippage: 0.5,
    defaultDeadline: 20,
    refreshInterval: 10000,
    maxRetries: 3
  }
};

// Provider setup
import { IXFIProvider } from '@ixfi/sdk';
import { ixfiConfig } from './config/ixfi';

export const ixfiProvider = new IXFIProvider({
  ...ixfiConfig,
  provider: window.ethereum
});
```

### Vue.js Configuration

```javascript
// plugins/ixfi.js
import { IXFIProvider } from '@ixfi/sdk';

export default {
  install(app, options) {
    const ixfi = new IXFIProvider(options);
    
    app.config.globalProperties.$ixfi = ixfi;
    app.provide('ixfi', ixfi);
  }
};

// main.js
import { createApp } from 'vue';
import IXFIPlugin from './plugins/ixfi';

const app = createApp(App);

app.use(IXFIPlugin, {
  network: 'mainnet',
  provider: window.ethereum,
  debug: process.env.NODE_ENV === 'development'
});
```

## Testing Configuration

### Test Environment

```javascript
// test/config.js
export const testConfig = {
  networks: {
    hardhat: {
      chainId: 31337,
      forking: {
        url: process.env.ETHEREUM_RPC_URL,
        blockNumber: 18000000
      }
    }
  },
  
  accounts: {
    deployer: '0x...',
    user1: '0x...',
    user2: '0x...',
    relayer: '0x...'
  },
  
  tokens: {
    usdc: '0xA0b86a33E6441e1a02c4e4670dd96EA0f25A632',
    weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  },
  
  amounts: {
    small: ethers.utils.parseEther('1'),
    medium: ethers.utils.parseEther('100'),
    large: ethers.utils.parseEther('10000')
  }
};
```

### Hardhat Configuration

```javascript
// hardhat.config.js
require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-waffle');

module.exports = {
  networks: {
    hardhat: {
      forking: {
        url: process.env.ETHEREUM_RPC_URL,
        enabled: process.env.FORKING === 'true'
      },
      accounts: {
        count: 20,
        accountsBalance: '10000000000000000000000'
      }
    },
    
    localhost: {
      url: 'http://127.0.0.1:8545',
      timeout: 60000
    }
  },
  
  solidity: {
    compilers: [
      {
        version: '0.8.20',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          },
          viaIR: true
        }
      }
    ]
  },
  
  mocha: {
    timeout: 60000
  }
};
```

## Production Configuration

### Security Settings

```javascript
const productionConfig = {
  security: {
    enableWhitelist: true,
    requireSignatures: true,
    maxTransactionValue: ethers.utils.parseEther('1000'),
    
    // Rate limiting
    rateLimits: {
      swapPerMinute: 10,
      swapPerHour: 100,
      swapPerDay: 1000
    },
    
    // Emergency controls
    emergencyPause: false,
    securityDelay: 3600, // 1 hour
    
    // Monitoring
    alerts: {
      largeTransactions: ethers.utils.parseEther('10000'),
      suspiciousActivity: true,
      failureThreshold: 5
    }
  },
  
  // Performance optimization
  performance: {
    caching: {
      enabled: true,
      ttl: 60, // seconds
      maxSize: 1000
    },
    
    batching: {
      enabled: true,
      maxBatchSize: 10,
      batchTimeout: 1000 // ms
    }
  }
};
```

### Monitoring Configuration

```javascript
const monitoringConfig = {
  logging: {
    level: 'info',
    format: 'json',
    destinations: ['console', 'file', 'sentry']
  },
  
  metrics: {
    enabled: true,
    endpoint: '/metrics',
    interval: 30000 // 30 seconds
  },
  
  health: {
    endpoint: '/health',
    checks: [
      'database',
      'blockchain-connection',
      'relayer-status'
    ]
  },
  
  alerts: {
    slack: {
      webhook: process.env.SLACK_WEBHOOK,
      channel: '#ixfi-alerts'
    },
    
    email: {
      smtp: process.env.SMTP_URL,
      recipients: ['admin@ixfi.com']
    }
  }
};
```

## Next Steps

With your configuration complete:

1. **[Deploy Contracts](../guides/deployment.md)** - Deploy to your target networks
2. **[Test Integration](../guides/testing.md)** - Validate your setup
3. **[Monitor Performance](../guides/monitoring.md)** - Set up monitoring
4. **[Optimize Settings](../guides/optimization.md)** - Fine-tune for production

For troubleshooting configuration issues, see the [Troubleshooting Guide](../resources/troubleshooting.md).
