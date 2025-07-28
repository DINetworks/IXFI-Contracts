# IXFI GMP Relayer

A robust relayer service for the IXFI General Message Passing (GMP) protocol, enabling secure cross-chain communication and token transfers.

## Features

- 🌉 **Cross-Chain Message Relay**: Monitors and processes GMP events across multiple chains
- 🔒 **Secure Signature Verification**: Signs and verifies commands using cryptographic signatures
- 📊 **Health Monitoring**: Built-in health checks and metrics endpoints
- 🔄 **Automatic Recovery**: Handles network errors and retries failed transactions
- 💾 **Event Persistence**: Tracks processed events to prevent double-spending
- ⚡ **High Performance**: Efficient event monitoring with configurable polling intervals

## Quick Start

### 1. Installation

```bash
cd relayer
npm install
```

### 2. Configuration

```bash
# Copy example config
npm run setup

# Edit config.json with your settings
nano config.json
```

### 3. Configuration File

Update `config.json` with your chain details:

```json
{
  "chains": {
    "crossfi": {
      "rpc": "https://rpc.crossfi.io",
      "chainId": 4157,
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

### 4. Setup Relayer Account

Make sure your relayer account is whitelisted on all chains:

```bash
# On each chain, run:
npx hardhat run scripts/whitelist-relayer.js --network <network>
```

### 5. Start the Relayer

```bash
# Production
npm start

# Development with auto-restart
npm run dev
```

## How It Works

### Event Processing Flow

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

### Security Features

- **Signature Verification**: All commands are cryptographically signed
- **Replay Protection**: Tracks processed events to prevent duplicates
- **Whitelist Validation**: Only whitelisted relayers can execute commands
- **Gas Limit Protection**: Configurable gas limits prevent runaway transactions

## API Endpoints

### Health Check
```bash
GET http://localhost:3000/health
```

Returns relayer status and chain connectivity:
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

### Metrics (Prometheus Format)
```bash
GET http://localhost:3000/metrics
```

## Configuration Options

| Parameter | Description | Default |
|-----------|-------------|---------|
| `pollingInterval` | How often to check for new events (ms) | 5000 |
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
