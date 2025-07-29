# IXFI Gateway API Reference

The IXFI Gateway is the core contract that enables cross-chain communication and token transfers in the IXFI Protocol.

## Contract Interface

```solidity
interface IIXFIGateway {
    // Cross-chain messaging
    function callContract(
        string memory destinationChain,
        string memory contractAddress,
        bytes memory payload
    ) external;
    
    function callContractWithToken(
        string memory destinationChain,
        string memory contractAddress,
        bytes memory payload,
        string memory symbol,
        uint256 amount
    ) external;
    
    // Token operations
    function sendToken(
        string memory destinationChain,
        string memory destinationAddress,
        string memory symbol,
        uint256 amount
    ) external;
    
    // Command execution
    function execute(bytes memory data) external;
    
    // Relayer management
    function isValidRelayer(address relayer) external view returns (bool);
    
    // Chain management
    function isValidChain(string memory chainName) external view returns (bool);
    
    // Status queries
    function isCommandExecuted(bytes32 commandId) external view returns (bool);
}
```

## Core Functions

### callContract

Initiates a cross-chain contract call without token transfer.

```solidity
function callContract(
    string memory destinationChain,
    string memory contractAddress,
    bytes memory payload
) external
```

**Parameters:**
- `destinationChain`: Name of the target blockchain (e.g., "ethereum", "bsc")
- `contractAddress`: Address of the target contract on destination chain
- `payload`: Encoded function call data to execute

**Events Emitted:**
```solidity
event ContractCall(
    address indexed sender,
    string destinationChain,
    string destinationContractAddress,
    bytes32 indexed payloadHash,
    bytes payload
);
```

**Example:**
```solidity
bytes memory payload = abi.encodeWithSignature(
    "updateValue(uint256)",
    42
);

gateway.callContract(
    "ethereum",
    "0x742d35Cc6aB8C0532FdA5c5F8E71c1e4b"F,
    payload
);
```

### callContractWithToken

Initiates a cross-chain contract call with token transfer.

```solidity
function callContractWithToken(
    string memory destinationChain,
    string memory contractAddress,
    bytes memory payload,
    string memory symbol,
    uint256 amount
) external
```

**Parameters:**
- `destinationChain`: Name of the target blockchain
- `contractAddress`: Address of the target contract
- `payload`: Encoded function call data
- `symbol`: Token symbol to transfer (e.g., "IXFI")
- `amount`: Amount of tokens to transfer

**Events Emitted:**
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

**Example:**
```solidity
bytes memory stakePayload = abi.encodeWithSignature(
    "stake(address,uint256)",
    msg.sender,
    ethers.parseEther("100")
);

gateway.callContractWithToken(
    "polygon",
    stakingContractAddress,
    stakePayload,
    "IXFI",
    ethers.parseEther("100")
);
```

### sendToken

Transfers tokens to an address on another chain.

```solidity
function sendToken(
    string memory destinationChain,
    string memory destinationAddress,
    string memory symbol,
    uint256 amount
) external
```

**Parameters:**
- `destinationChain`: Target blockchain name
- `destinationAddress`: Recipient address on destination chain
- `symbol`: Token symbol to transfer
- `amount`: Amount to transfer

**Events Emitted:**
```solidity
event TokenSent(
    address indexed sender,
    string destinationChain,
    string destinationAddress,
    string symbol,
    uint256 amount
);
```

### execute

Executes approved cross-chain commands (relayer-only function).

```solidity
function execute(bytes memory data) external onlyRelayer
```

**Parameters:**
- `data`: Encoded command data including signatures and payload

**Access Control:** Only authorized relayers can call this function.

## View Functions

### isValidRelayer

Checks if an address is an authorized relayer.

```solidity
function isValidRelayer(address relayer) external view returns (bool)
```

**Returns:** `true` if the address is an authorized relayer

### isValidChain

Checks if a chain name is supported.

```solidity
function isValidChain(string memory chainName) external view returns (bool)
```

**Returns:** `true` if the chain is supported

### isCommandExecuted

Checks if a command has already been executed.

```solidity
function isCommandExecuted(bytes32 commandId) external view returns (bool)
```

**Returns:** `true` if the command has been executed

## Events

### ContractCall

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

### ContractCallWithToken

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

### TokenSent

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

### Executed

Emitted when a cross-chain command is executed.

```solidity
event Executed(
    bytes32 indexed commandId,
    string sourceChain,
    string sourceAddress,
    bool success,
    bytes returnData
);
```

## Error Codes

```solidity
error InvalidChain(string chainName);
error InvalidRelayer(address relayer);
error CommandAlreadyExecuted(bytes32 commandId);
error InsufficientBalance(uint256 requested, uint256 available);
error InvalidSignature();
error PayloadExecutionFailed(string reason);
```

## Gas Costs

| Function | Estimated Gas | Factors |
|----------|--------------|---------|
| `callContract` | 80,000 - 150,000 | Payload size, chain congestion |
| `callContractWithToken` | 120,000 - 200,000 | Token transfer, payload complexity |
| `sendToken` | 60,000 - 100,000 | Token type, destination chain |
| `execute` | 100,000 - 300,000 | Payload execution complexity |

## Integration Examples

### Basic Integration

```solidity
contract MyDApp {
    IIXFIGateway public gateway;
    
    constructor(address _gateway) {
        gateway = IIXFIGateway(_gateway);
    }
    
    function crossChainUpdate(
        string memory targetChain,
        address targetContract,
        uint256 newValue
    ) external {
        bytes memory payload = abi.encodeWithSignature(
            "updateValue(uint256)",
            newValue
        );
        
        gateway.callContract(
            targetChain,
            Strings.toHexString(uint160(targetContract), 20),
            payload
        );
    }
}
```

### Token Transfer Integration

```solidity
contract TokenBridge {
    IIXFIGateway public gateway;
    IERC20 public token;
    
    function bridgeTokens(
        string memory destinationChain,
        address recipient,
        uint256 amount
    ) external {
        // Transfer tokens from user
        token.transferFrom(msg.sender, address(this), amount);
        
        // Approve gateway
        token.approve(address(gateway), amount);
        
        // Send tokens cross-chain
        gateway.sendToken(
            destinationChain,
            Strings.toHexString(uint160(recipient), 20),
            "IXFI",
            amount
        );
    }
}
```

### DeFi Integration

```solidity
contract CrossChainYield {
    IIXFIGateway public gateway;
    
    function depositToChain(
        string memory targetChain,
        address yieldContract,
        uint256 amount
    ) external {
        bytes memory depositPayload = abi.encodeWithSignature(
            "deposit(address,uint256)",
            msg.sender,
            amount
        );
        
        gateway.callContractWithToken(
            targetChain,
            Strings.toHexString(uint160(yieldContract), 20),
            depositPayload,
            "IXFI",
            amount
        );
    }
}
```

## Security Considerations

### Input Validation

Always validate inputs before calling gateway functions:

```solidity
modifier validChain(string memory chainName) {
    require(gateway.isValidChain(chainName), "Invalid chain");
    _;
}

modifier validAmount(uint256 amount) {
    require(amount > 0, "Amount must be positive");
    _;
}

function safeCallContract(
    string memory destinationChain,
    address contractAddress,
    bytes memory payload
) external validChain(destinationChain) {
    require(contractAddress != address(0), "Invalid contract address");
    require(payload.length > 0, "Empty payload");
    
    gateway.callContract(
        destinationChain,
        Strings.toHexString(uint160(contractAddress), 20),
        payload
    );
}
```

### Access Control

Implement proper access control for sensitive functions:

```solidity
contract SecureGatewayUser {
    mapping(address => bool) public authorizedUsers;
    
    modifier onlyAuthorized() {
        require(authorizedUsers[msg.sender], "Unauthorized");
        _;
    }
    
    function restrictedCrossChainCall(
        string memory destinationChain,
        address contractAddress,
        bytes memory payload
    ) external onlyAuthorized {
        gateway.callContract(destinationChain, contractAddress, payload);
    }
}
```

### Reentrancy Protection

Use reentrancy guards for functions that transfer tokens:

```solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SecureTokenBridge is ReentrancyGuard {
    function bridgeTokens(
        string memory destinationChain,
        address recipient,
        uint256 amount
    ) external nonReentrant {
        // Bridge logic here
    }
}
```

## Upgradeability

The IXFI Gateway uses a proxy pattern for upgradeability:

```solidity
// Proxy interface
interface IGatewayProxy {
    function implementation() external view returns (address);
    function admin() external view returns (address);
    function upgrade(address newImplementation) external;
}
```

## Monitoring and Analytics

### Event Monitoring

Monitor gateway events for cross-chain activity:

```javascript
const gateway = new ethers.Contract(gatewayAddress, gatewayABI, provider);

// Listen for contract calls
gateway.on("ContractCall", (sender, destinationChain, contractAddress, payloadHash, payload) => {
    console.log(`Cross-chain call from ${sender} to ${destinationChain}`);
});

// Listen for token transfers
gateway.on("TokenSent", (sender, destinationChain, destinationAddress, symbol, amount) => {
    console.log(`${ethers.formatEther(amount)} ${symbol} sent to ${destinationChain}`);
});
```

### Transaction Tracking

Track cross-chain transactions:

```javascript
async function trackCrossChainTx(txHash) {
    const receipt = await provider.getTransactionReceipt(txHash);
    
    const contractCallEvents = receipt.logs.filter(log => 
        log.topics[0] === ethers.id("ContractCall(address,string,string,bytes32,bytes)")
    );
    
    for (const event of contractCallEvents) {
        const decoded = gateway.interface.parseLog(event);
        console.log(`Command ID: ${ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ["bytes32", "uint256"],
                [decoded.args.payloadHash, event.logIndex]
            )
        )}`);
    }
}
```

## Best Practices

### 1. Always Check Chain Support

```solidity
require(gateway.isValidChain(destinationChain), "Unsupported chain");
```

### 2. Validate Contract Addresses

```solidity
require(contractAddress != address(0), "Invalid address");
```

### 3. Handle Token Approvals

```solidity
IERC20(token).approve(address(gateway), amount);
```

### 4. Implement Proper Error Handling

```solidity
try gateway.callContract(chain, contract, payload) {
    emit CrossChainCallSucceeded(chain, contract);
} catch Error(string memory reason) {
    emit CrossChainCallFailed(chain, contract, reason);
}
```

### 5. Use Events for Tracking

```solidity
event CrossChainOperationInitiated(
    address indexed user,
    string indexed destinationChain,
    bytes32 indexed operationId
);
```

## Resources

- [Cross-Chain Architecture](../core-concepts/cross-chain-architecture.md)
- [Message Passing Guide](../cross-chain/message-passing.md)
- [Integration Examples](../examples/basic-swap.md)
- [Security Best Practices](../guides/security.md)
