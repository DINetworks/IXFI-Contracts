# IXFI Relayer Services

This directory contains two main relayer services for the IXFI ecosystem:

1. **GMP Relayer** - For General Message Passing cross-chain operations
2. **MetaTx Relayer** - For gasless meta-transaction execution

## 🌉 GMP Relayer (IXFIRelayer.js)

A robust relayer service for the IXFI General Message Passing (GMP) protocol, enabling secure cross-chain communication and token transfers.

### Features

- 🌉 **Cross-Chain Message Relay**: Monitors and processes GMP events across multiple chains
- 🔒 **Secure Signature Verification**: Signs and verifies commands using cryptographic signatures
- 📊 **Health Monitoring**: Built-in health checks and metrics endpoints
- 🔄 **Automatic Recovery**: Handles network errors and retries failed transactions
- 💾 **Event Persistence**: Tracks processed events to prevent double-spending
- ⚡ **High Performance**: Efficient event monitoring with configurable polling intervals

### Quick Start

#### 1. Installation

```bash
cd relayer
npm install
```

#### 2. Configuration

```bash
# Copy example config
npm run setup

# Edit config.json with your settings
nano config.json
```

#### 3. Configuration File

Update `config.json` with your chain details:

```json
{
  "chains": {
    "crossfi": {
      "rpc": "https://rpc.crossfi.io",
      "chainId": 4158,
      "ixfiAddress": "0xYourIXFIContractAddress",
      "blockConfirmations": 1
    },
    "ethereum": {
      "rpc": "https://mainnet.infura.io/v3/YOUR_PROJECT_ID",
      "chainId": 1,
      "ixfiAddress": "0xYourIXFIContractAddress",
      "blockConfirmations": 12
    }
  },
  "relayerPrivateKey": "YOUR_RELAYER_PRIVATE_KEY",
  "pollingInterval": 5000,
  "healthCheckPort": 3000
}
```

#### 4. Setup Relayer Account

Make sure your relayer account is whitelisted on all chains:

```bash
# On each chain, run:
npx hardhat run scripts/whitelist-relayer.js --network <network>
```

#### 5. Start the GMP Relayer

```bash
# Start GMP relayer with API
npm run start:gmp
```

## 🚀 MetaTx Relayer (MetaTxRelayer.js)

A specialized relayer service for executing gasless meta-transactions across multiple chains using IXFI gas credits.

### Features

- 💳 **Gas Credit Management**: Uses IXFI tokens for gas payments across all chains
- 📦 **Batch Processing**: Execute multiple transactions in a single batch
- 🔗 **Multi-Chain Support**: Deploy on any EVM chain with CrossFi as credit hub
- ⛽ **Gas Estimation**: Accurate gas cost calculation with real-time price feeds
- 🛡️ **Security**: EIP-712 signature verification for all transactions
- 📊 **Transaction Logging**: Complete audit trail for all processed transactions

### Quick Start

#### 1. Configuration

```bash
# Copy meta-tx config (if not already done)
cp meta-tx-config.example.json meta-tx-config.json

# Edit meta-tx-config.json with your settings
nano meta-tx-config.json
```

#### 2. Configuration File

Update `meta-tx-config.json`:

```json
{
  "relayerPrivateKey": "YOUR_RELAYER_PRIVATE_KEY",
  "healthPort": 3001,
  "apiPort": 3001,
  "chains": {
    "crossfi": {
      "rpc": "https://rpc.crossfi.io",
      "chainId": 4158,
      "gasCreditVault": "0xYourGasCreditVaultAddress"
    },
    "ethereum": {
      "rpc": "https://mainnet.infura.io/v3/YOUR_PROJECT_ID",
      "chainId": 1,
      "metaTxGateway": "0xYourMetaTxGatewayAddress"
    },
    "polygon": {
      "rpc": "https://polygon-rpc.com",
      "chainId": 137,
      "metaTxGateway": "0xYourMetaTxGatewayAddress"
    }
  }
}
```

#### 3. Start the MetaTx Relayer

```bash
# Option 1: Start relayer only (basic health endpoint)
npm run start:meta-tx

# Option 2: Start relayer with full API (recommended)
npm run start:meta-tx-api
```

## 🔧 Available Scripts

```bash
# GMP Relayer
npm run start:gmp          # Start GMP relayer with monitoring API

# MetaTx Relayer
npm run start:meta-tx      # Start MetaTx relayer (basic)
npm run start:meta-tx-api  # Start MetaTx relayer with full API

# Utilities
npm run setup              # Copy example configs
npm test                   # Run tests
npm run lint              # Lint code
```

## 📡 API Endpoints

### GMP Relayer API (Port 3000)

- `GET /health` - Health check and metrics
- `GET /failed-transactions` - Get failed transactions
- `POST /compensate/:commandId` - Manual compensation
- `GET /status` - Relayer status

### MetaTx Relayer API (Port 3001)

- `GET /health` - Health check and metrics
- `POST /execute` - Execute single meta-transaction
- `POST /execute-batch` - Execute batch meta-transactions
- `GET /credits/:userAddress` - Check user's gas credits
- `POST /estimate-batch` - Estimate gas for batch transaction
- `GET /chains` - Get supported chains
- `GET /status` - Relayer status

## 🔍 How They Work

### GMP Relayer Flow

1. **Monitor Events**: Continuously monitors IXFI contracts for:
   - `ContractCall`: Cross-chain contract calls
   - `ContractCallWithToken`: Contract calls with token transfers
   - `TokenSent`: Simple token transfers

2. **Process Events**: For each event:
   - Validates event structure
   - Creates appropriate command
   - Signs the command with relayer private key
   - Executes command on destination chain

3. **Command Types**:
   - `COMMAND_APPROVE_CONTRACT_CALL (0)`: Approve contract execution
   - `COMMAND_APPROVE_CONTRACT_CALL_WITH_MINT (1)`: Approve with token mint
   - `COMMAND_MINT_TOKEN (4)`: Mint tokens on destination

### MetaTx Relayer Flow

1. **Receive Request**: API receives meta-transaction request
2. **Check Credits**: Verify user has enough IXFI gas credits on CrossFi
3. **Execute Batch**: Execute transactions on target chain using relayer's gas
4. **Deduct Credits**: Deduct equivalent gas cost from user's credits
5. **Return Result**: Provide transaction hash and execution results

## 🛡️ Security Features

### GMP Relayer
- **Signature Verification**: All commands are cryptographically signed
- **Replay Protection**: Tracks processed events to prevent duplicates
- **Whitelist Validation**: Only whitelisted relayers can execute commands
- **Gas Limit Protection**: Configurable gas limits prevent runaway transactions

### MetaTx Relayer
- **EIP-712 Signatures**: All meta-transactions use typed data signatures
- **Nonce Management**: Prevents replay attacks with user nonces
- **Deadline Protection**: Transactions have time-based expiration
- **Credit Authorization**: Only authorized relayers can deduct credits
- **Gas Estimation**: Prevents over-spending with accurate gas calculations

## 📊 Monitoring & Health Checks

### GMP Relayer Health Endpoint

```bash
GET http://localhost:3000/health
```

Returns:
```json
{
  "status": "healthy",
  "chains": {
    "crossfi": {
      "status": "connected",
      "blockNumber": 12345,
      "balance": "1.5",
      "ixfiAddress": "0x..."
    }
  },
  "processedEvents": 1337,
  "relayerAddress": "0x..."
}
```

### MetaTx Relayer Health Endpoint

```bash
GET http://localhost:3001/health
```

Returns:
```json
{
  "status": "healthy",
  "service": "MetaTx Relayer",
  "uptime": 3600,
  "metrics": {
    "totalTransactions": 150,
    "successfulTransactions": 147,
    "failedTransactions": 3,
    "successRate": "98.00%",
    "totalGasUsed": 2500000,
    "avgGasPerTx": 17007
  },
  "chains": ["crossfi", "ethereum", "polygon"],
  "relayerAddress": "0x..."
}
```

## 🧪 Testing

### Run Tests

```bash
npm test
```

### Manual Testing

#### Test GMP Relayer

```bash
# Start relayer
npm run start:gmp

# In another terminal, check health
curl http://localhost:3000/health

# Check failed transactions
curl http://localhost:3000/failed-transactions
```

#### Test MetaTx Relayer

```bash
# Start relayer API
npm run start:meta-tx-api

# Check health
curl http://localhost:3001/health

# Check supported chains
curl http://localhost:3001/chains

# Estimate batch transaction
curl -X POST http://localhost:3001/estimate-batch \
  -H "Content-Type: application/json" \
  -d '{
    "targetChain": "polygon",
    "metaTxs": [
      {
        "to": "0x...",
        "value": "0",
        "data": "0x"
      }
    ],
    "from": "0x..."
  }'
```

## 🔧 Configuration Options

### GMP Relayer (`config.json`)

| Parameter | Description | Default |
|-----------|-------------|---------|
| `pollingInterval` | How often to check for new events (ms) | 5000 |
| `healthCheckPort` | Port for health check API | 3000 |
| `blockConfirmations` | Required confirmations per chain | 1 |
| `maxRetries` | Max retries for failed transactions | 3 |
| `retryDelay` | Delay between retries (ms) | 10000 |

### MetaTx Relayer (`meta-tx-config.json`)

| Parameter | Description | Default |
|-----------|-------------|---------|
| `healthPort` | Port for basic health endpoint | 3001 |
| `apiPort` | Port for full API (when using meta-tx-api) | 3001 |
| `maxBatchSize` | Maximum transactions per batch | 10 |
| `gasBuffer` | Extra gas percentage for estimates | 20 |

## 🚨 Troubleshooting

### Common Issues

#### GMP Relayer

**Issue**: "Failed to connect to chain"
- **Solution**: Check RPC URL and network connectivity
- **Verification**: `curl <RPC_URL>` should return response

**Issue**: "Insufficient funds for gas"
- **Solution**: Fund the relayer account with native tokens
- **Check**: `GET /health` endpoint shows balance

**Issue**: "Event already processed"
- **Solution**: This is normal - indicates replay protection is working
- **Action**: No action needed

#### MetaTx Relayer

**Issue**: "Insufficient gas credits"
- **Solution**: User needs to deposit more IXFI tokens to credit vault
- **Check**: Use `GET /credits/:userAddress` endpoint

**Issue**: "Failed to estimate gas"
- **Solution**: Check if target chain RPC is accessible and gateway is deployed
- **Verification**: Use `GET /chains` to verify configuration

**Issue**: "Invalid signature"
- **Solution**: Ensure frontend is using correct EIP-712 domain and types
- **Debug**: Check signature format and user nonce

### Debug Mode

Enable verbose logging:

```bash
# Set environment variable
export DEBUG=ixfi:*

# Or in config file
{
  "debug": true,
  "logLevel": "debug"
}
```

## 📝 Logs

### Log Locations

- **GMP Relayer**: Logs to console and optionally to file
- **MetaTx Relayer**: Logs to console with emoji indicators

### Log Levels

- `🔄` - Initialization
- `✅` - Success operations
- `❌` - Errors
- `⚠️` - Warnings
- `💳` - Credit operations
- `⛽` - Gas calculations
- `📦` - Batch operations

## 🔐 Security Best Practices

1. **Private Key Management**
   - Use environment variables or secure key management
   - Never commit private keys to version control
   - Rotate keys regularly

2. **Network Security**
   - Use HTTPS endpoints for production
   - Implement rate limiting on API endpoints
   - Monitor for unusual activity

3. **Relayer Account**
   - Keep minimal balance in relayer accounts
   - Monitor account balance regularly
   - Set up alerts for low balance

4. **Smart Contract Security**
   - Verify all contract addresses in configuration
   - Use multi-sig for contract upgrades
   - Regular security audits

## 📚 Additional Resources

- [IXFI Technical Documentation](../TECHNICAL_DOCS.md)
- [Cross-Chain Integration Guide](../CROSS_CHAIN_INTEGRATION.md)
- [API Reference](../API_REFERENCE.md)
- [Deployment Guide](../DEPLOYMENT_GUIDE.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.
| `gasLimit` | Maximum gas per transaction | 500000 |
| `gasPrice` | Gas price in gwei | Auto |
| `blockConfirmations` | Confirmations before processing | Chain-specific |
| `healthCheckPort` | Health check server port | 3000 |
| `retryAttempts` | Max retry attempts for failed txs | 3 |

## Monitoring and Alerts

### Health Monitoring
```bash
# Check if relayer is healthy
curl http://localhost:3000/health

# Get metrics for monitoring systems
curl http://localhost:3000/metrics
```

### Log Output
The relayer provides detailed logging:
```
🚀 Starting IXFI Relayer...
✅ Relayer whitelisted on crossfi
👀 Starting to monitor crossfi...
📞 Processing ContractCall from crossfi
⚡ Executing commands on ethereum
✅ Commands executed successfully on ethereum
```

## Production Deployment

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables
```bash
export CONFIG_PATH=/path/to/config.json
export NODE_ENV=production
```

### Systemd Service
```ini
[Unit]
Description=IXFI GMP Relayer
After=network.target

[Service]
Type=simple
User=ixfi
WorkingDirectory=/opt/ixfi-relayer
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## Troubleshooting

### Common Issues

1. **Relayer Not Whitelisted**
   ```bash
   ❌ Relayer NOT whitelisted on ethereum
   ```
   Solution: Add relayer address using `addWhitelistedRelayer()`

2. **Insufficient Balance**
   ```bash
   ❌ Failed to execute commands: insufficient funds
   ```
   Solution: Fund relayer account with native tokens for gas

3. **RPC Connection Issues**
   ```bash
   ❌ Error monitoring ethereum: network error
   ```
   Solution: Check RPC endpoint and network connectivity

### Debug Mode
```bash
DEBUG=ixfi:* npm start
```

## Security Considerations

1. **Private Key Security**: Store relayer private key securely
2. **Network Security**: Use secure RPC endpoints
3. **Monitoring**: Set up alerts for failed transactions
4. **Backup**: Regularly backup processed events file
5. **Updates**: Keep dependencies updated

## Support

For issues and support:
- 📧 Email: support@ixfi.io
- 🐛 Issues: GitHub Issues
- 📖 Docs: [IXFI Documentation](https://docs.ixfi.io)

## License

MIT License - see LICENSE file for details.
