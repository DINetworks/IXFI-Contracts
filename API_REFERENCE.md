# IXFI Contract API Reference

## Table of Contents
1. [IXFI Gateway](#ixfi-gateway)
2. [CrossChainAggregator](#crosschainaggregator)
3. [MulticallLibraryV2](#multicalllibraryv2)
4. [QuoteLibrary](#quotelibrary)
5. [MetaTxGasCreditVault](#metatxgascreditvault)
6. [MetaTxGateway](#metatxgateway)
7. [IXFIExecutable](#ixfiexecutable)
8. [Events Reference](#events-reference)
9. [Error Codes](#error-codes)

## IXFI Gateway

### Core Functions

#### XFI ↔ IXFI Conversion

```solidity
function deposit() public payable onlyCrossfiChain
```
**Description**: Deposit native XFI to mint equivalent IXFI tokens (1:1 ratio)
- **Requirements**: Must be called on CrossFi chain
- **Parameters**: None (amount specified in msg.value)
- **Events**: `Deposited(address indexed user, uint256 amount)`

```solidity
function withdraw(uint256 amount_) public onlyCrossfiChain
```
**Description**: Burn IXFI tokens to withdraw equivalent native XFI
- **Requirements**: Must be called on CrossFi chain, sufficient IXFI balance
- **Parameters**: 
  - `amount_`: Amount of IXFI to burn (and XFI to receive)
- **Events**: `Withdrawn(address indexed user, uint256 amount)`

#### Cross-Chain Operations

```solidity
function callContract(
    string memory destinationChain,
    string memory destinationContractAddress,
    bytes memory payload
) external
```
**Description**: Initiate a cross-chain contract call
- **Parameters**:
  - `destinationChain`: Name of destination chain (e.g., "ethereum", "bsc")
  - `destinationContractAddress`: Target contract address on destination
  - `payload`: Encoded function call data
- **Events**: `ContractCall(...)`

```solidity
function callContractWithToken(
    string memory destinationChain,
    string memory destinationContractAddress,
    bytes memory payload,
    string memory symbol,
    uint256 amount
) external
```
**Description**: Cross-chain contract call with token transfer
- **Requirements**: User must have sufficient IXFI balance
- **Parameters**:
  - `destinationChain`: Destination chain name
  - `destinationContractAddress`: Target contract address
  - `payload`: Function call data
  - `symbol`: Token symbol (must be "IXFI")
  - `amount`: Amount of tokens to send
- **Events**: `ContractCallWithToken(...)`

```solidity
function sendToken(
    string memory destinationChain,
    string memory destinationAddress,
    string memory symbol,
    uint256 amount
) external
```
**Description**: Send tokens to an address on another chain
- **Parameters**:
  - `destinationChain`: Destination chain name
  - `destinationAddress`: Recipient address
  - `symbol`: Token symbol (must be "IXFI")
  - `amount`: Amount to send

#### Relayer Functions

```solidity
function execute(
    bytes32 commandId,
    Command[] memory commands,
    bytes memory signature
) external onlyRelayer notExecuted(commandId)
```
**Description**: Execute cross-chain commands (relayer only)
- **Requirements**: Must be whitelisted relayer
- **Parameters**:
  - `commandId`: Unique command identifier
  - `commands`: Array of commands to execute
  - `signature`: Relayer signature

#### Management Functions

```solidity
function addWhitelistedRelayer(address relayer) public onlyOwner
function removeWhitelistedRelayer(address relayer) public onlyOwner
function addChain(string memory chainName, uint256 chainId) external onlyOwner
function removeChain(string memory chainName) external onlyOwner
```

#### View Functions

```solidity
function isFullyBacked() external view returns (bool)
function getXFIBalance() external view returns (uint256)
function isCommandExecuted(bytes32 commandId) external view returns (bool)
function getAllRelayers() external view returns (address[] memory)
function getRelayerCount() external view returns (uint256)
```

## CrossChainAggregator

### Main Aggregation Functions

#### Quote Functions

```solidity
function getOptimalQuote(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256[] memory routerTypes
) external view returns (uint256 bestAmount, uint256 bestRouter)
```
**Description**: Get the best quote across specified DEX protocols
- **Parameters**:
  - `tokenIn`: Input token address
  - `tokenOut`: Output token address
  - `amountIn`: Amount of input tokens
  - `routerTypes`: Array of router type IDs to check (0-36)
- **Returns**: Best output amount and corresponding router type

```solidity
function getAllQuotes(
    address tokenIn,
    address tokenOut,
    uint256 amountIn
) external view returns (QuoteResult[] memory)
```
**Description**: Get quotes from all 37 supported DEX protocols
- **Returns**: Array of quote results with amounts and router types

#### Swap Execution

```solidity
function executeSwap(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    uint256 routerType,
    bytes calldata swapData
) external payable returns (uint256 amountOut)
```
**Description**: Execute token swap through specified DEX protocol
- **Parameters**:
  - `tokenIn`: Input token address (use address(0) for ETH)
  - `tokenOut`: Output token address
  - `amountIn`: Exact amount of input tokens
  - `minAmountOut`: Minimum acceptable output amount (slippage protection)
  - `routerType`: DEX protocol to use (0-36)
  - `swapData`: Protocol-specific swap data
- **Events**: `SwapExecuted(address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 routerType)`

#### Cross-Chain Swap

```solidity
function crossChainSwap(
    string memory sourceChain,
    string memory destinationChain,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    uint256 routerType
) external payable
```
**Description**: Execute cross-chain token swap
- **Parameters**:
  - `sourceChain`: Source chain name
  - `destinationChain`: Destination chain name
  - `tokenIn`: Input token on source chain
  - `tokenOut`: Desired output token on destination chain
  - `amountIn`: Amount to swap
  - `minAmountOut`: Minimum output with slippage protection
  - `routerType`: DEX protocol to use on destination

#### Batch Operations

```solidity
function multiSwap(
    SwapParams[] memory swaps
) external payable returns (uint256[] memory amountsOut)
```
**Description**: Execute multiple swaps in a single transaction
- **Parameters**:
  - `swaps`: Array of swap parameters
- **Returns**: Array of output amounts for each swap

### View Functions

```solidity
function getSupportedTokens(uint256 chainId) external view returns (address[] memory)
function getRouterAddress(uint256 routerType, uint256 chainId) external view returns (address)
function isRouterSupported(uint256 routerType, uint256 chainId) external view returns (bool)
function getSwapFee(uint256 routerType) external view returns (uint256)
```

## MulticallLibraryV2

### Batch Quote Functions

```solidity
function getMultipleQuotes(
    address tokenIn,
    address tokenOut,
    uint256 amountIn
) external view returns (QuoteResult[] memory quotes)
```
**Description**: Get quotes from all 37 DEX protocols in parallel
- **Returns**: Array of quote results sorted by output amount (best first)

```solidity
function getQuotesForRouters(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256[] memory routerTypes
) external view returns (QuoteResult[] memory quotes)
```
**Description**: Get quotes from specific router types only
- **Parameters**:
  - `routerTypes`: Array of router type IDs to query

### Utility Functions

```solidity
function findBestQuote(
    QuoteResult[] memory quotes
) external pure returns (uint256 bestAmount, uint256 bestRouter)
```
**Description**: Find the best quote from an array of results

```solidity
function filterValidQuotes(
    QuoteResult[] memory quotes,
    uint256 minAmount
) external pure returns (QuoteResult[] memory validQuotes)
```
**Description**: Filter quotes above minimum threshold

## QuoteLibrary

### V2 AMM Quotes

```solidity
function getUniswapV2Quote(
    address factory,
    address tokenIn,
    address tokenOut,
    uint256 amountIn
) external view returns (uint256 amountOut)
```
**Description**: Calculate quote for Uniswap V2 style AMM
- **Parameters**:
  - `factory`: Factory contract address
  - `tokenIn`: Input token address
  - `tokenOut`: Output token address
  - `amountIn`: Input amount

```solidity
function getSushiswapV2Quote(address factory, address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256)
function getPancakeswapV2Quote(address factory, address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256)
function getQuickswapQuote(address factory, address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256)
```

### V3 Concentrated Liquidity Quotes

```solidity
function getUniswapV3Quote(
    address factory,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint24 fee
) external view returns (uint256 amountOut)
```
**Description**: Calculate quote for Uniswap V3 concentrated liquidity
- **Parameters**:
  - `factory`: V3 factory address
  - `fee`: Pool fee tier (500, 3000, 10000)

```solidity
function getSushiswapV3Quote(address factory, address tokenIn, address tokenOut, uint256 amountIn, uint24 fee) external view returns (uint256)
function getPancakeswapV3Quote(address factory, address tokenIn, address tokenOut, uint256 amountIn, uint24 fee) external view returns (uint256)
```

### Specialized Protocol Quotes

```solidity
function getCurveQuote(
    address pool,
    address tokenIn,
    address tokenOut,
    uint256 amountIn
) external view returns (uint256 amountOut)
```
**Description**: Calculate quote for Curve stableswap pools

```solidity
function getBalancerV2Quote(
    address vault,
    bytes32 poolId,
    address tokenIn,
    address tokenOut,
    uint256 amountIn
) external view returns (uint256 amountOut)
```
**Description**: Calculate quote for Balancer V2 weighted pools

```solidity
function getVelodrome Quote(address router, address tokenIn, address tokenOut, uint256 amountIn, bool stable) external view returns (uint256)
function getAerodromeQuote(address router, address tokenIn, address tokenOut, uint256 amountIn, bool stable) external view returns (uint256)
```
**Description**: Calculate quotes for Solidly-based protocols (ve(3,3))

### Router Type Constants

```solidity
// V2 AMM Protocols
uint256 constant UNISWAP_V2 = 0;
uint256 constant SUSHISWAP_V2 = 1;
uint256 constant PANCAKESWAP_V2 = 2;
uint256 constant QUICKSWAP = 3;
uint256 constant TRADERJOE_V1 = 4;

// V3 Concentrated Liquidity
uint256 constant UNISWAP_V3 = 10;
uint256 constant SUSHISWAP_V3 = 11;
uint256 constant PANCAKESWAP_V3 = 12;

// Solidly Forks
uint256 constant VELODROME = 20;
uint256 constant AERODROME = 21;
uint256 constant THENA = 22;

// Stableswap
uint256 constant CURVE = 30;
uint256 constant ELLIPSIS = 31;

// Specialized
uint256 constant BALANCER_V2 = 35;
uint256 constant ONEINCH = 36;
```

### Command Structure

```solidity
struct Command {
    uint256 commandType;
    bytes data;
}
```

**Command Types**:
- `COMMAND_APPROVE_CONTRACT_CALL = 0`
- `COMMAND_APPROVE_CONTRACT_CALL_WITH_MINT = 1`
- `COMMAND_BURN_TOKEN = 2`
- `COMMAND_MINT_TOKEN = 4`

## MetaTxGasCreditVault

### User Functions

```solidity
function deposit(uint256 amount) external nonReentrant
```
**Description**: Deposit IXFI tokens to get gas credits
- **Parameters**: `amount` - IXFI amount to deposit
- **Returns**: Credits added to user balance
- **Events**: `Deposited(user, ixfiAmount, creditsAdded)`

```solidity
function withdraw(uint256 amount) external nonReentrant
```
**Description**: Withdraw IXFI tokens by burning gas credits
- **Parameters**: `amount` - IXFI amount to withdraw
- **Events**: `Withdrawn(user, ixfiAmount, creditsDeducted)`

### Gateway Functions

```solidity
function consumeCredits(address user, uint256 gasUsd) external returns (bool success)
```
**Description**: Consume user's gas credits (authorized gateways only)
- **Parameters**:
  - `user`: User whose credits to consume
  - `gasUsd`: Gas cost in USD cents
- **Returns**: Success boolean
- **Events**: `CreditsUsed(user, gateway, creditsUsed, gasUsd)`

### Oracle Functions

```solidity
function calculateCreditsFromIXFI(uint256 ixfiAmount) public view returns (uint256 usdCredits)
```
**Description**: Calculate USD credits from IXFI amount using current price
- **Parameters**: `ixfiAmount` - Amount of IXFI tokens
- **Returns**: Equivalent USD credits (in cents)

```solidity
function getIXFIPrice() public view returns (uint128 price, uint128 timestamp)
```
**Description**: Get current IXFI price from DIA Oracle
- **Returns**: 
  - `price`: Price with 8 decimals
  - `timestamp`: Price timestamp

```solidity
function hasEnoughCredits(address user, uint256 gasUsd) external view returns (bool hasEnough)
```
**Description**: Check if user has sufficient credits for transaction
- **Parameters**:
  - `user`: User address
  - `gasUsd`: Required gas in USD cents
- **Returns**: Boolean indicating sufficient credits

### Owner Functions

```solidity
function setDIAOracle(address newOracle) external onlyOwner
function setIXFIPriceKey(string memory newKey) external onlyOwner
function setMaxPriceAge(uint256 newMaxAge) external onlyOwner
function setGatewayAuthorization(address gateway, bool authorized) external onlyOwner
```

## MetaTxGateway

### Meta-Transaction Structure

```solidity
struct MetaTransaction {
    address from;      // User who signed the transaction
    address to;        // Target contract to call
    uint256 value;     // ETH value to send (usually 0)
    bytes data;        // Function call data
    uint256 nonce;     // User's current nonce
    uint256 deadline;  // Transaction deadline
}
```

### Core Functions

```solidity
function executeMetaTransaction(
    MetaTransaction calldata metaTx,
    bytes calldata signature
) external nonReentrant returns (bool success)
```
**Description**: Execute a gasless transaction
- **Requirements**: Authorized relayer, valid signature, not expired
- **Parameters**:
  - `metaTx`: Meta-transaction data
  - `signature`: User's EIP-712 signature
- **Returns**: Execution success
- **Events**: `MetaTransactionExecuted(...)`

```solidity
function executeBatchMetaTransactions(
    MetaTransaction[] calldata metaTxs,
    bytes[] calldata signatures
) external nonReentrant returns (bool[] memory results)
```
**Description**: Execute multiple meta-transactions in batch
- **Parameters**:
  - `metaTxs`: Array of meta-transactions
  - `signatures`: Corresponding signatures

### EIP-712 Functions

```solidity
function getDomainSeparator() public view returns (bytes32)
function getMetaTransactionHash(MetaTransaction memory metaTx) public view returns (bytes32)
function getNonce(address user) external view returns (uint256)
```

### Management Functions

```solidity
function setRelayerAuthorization(address relayer, bool authorized) external onlyOwner
```

## IXFIExecutable

### Abstract Contract for dApp Integration

```solidity
abstract contract IXFIExecutable is IExecutable
```

### Core Functions

```solidity
function execute(
    bytes32 commandId,
    string calldata sourceChain,
    string calldata sourceAddress,
    bytes calldata payload
) external override onlyGateway
```
**Description**: Receive cross-chain calls (implemented)
- **Requirements**: Only IXFI gateway can call
- **Parameters**:
  - `commandId`: Unique command ID
  - `sourceChain`: Origin chain name
  - `sourceAddress`: Sender address on source chain
  - `payload`: Call data

```solidity
function executeWithToken(
    bytes32 commandId,
    string calldata sourceChain,
    string calldata sourceAddress,
    bytes calldata payload,
    string calldata symbol,
    uint256 amount
) external override onlyGateway
```
**Description**: Receive cross-chain calls with tokens
- **Note**: IXFI tokens are pre-minted to contract before call

### Abstract Functions (To Implement)

```solidity
function _execute(
    string calldata sourceChain,
    string calldata sourceAddress,
    bytes calldata payload
) internal virtual
```

```solidity
function _executeWithToken(
    string calldata sourceChain,
    string calldata sourceAddress,
    bytes calldata payload,
    string calldata symbol,
    uint256 amount
) internal virtual
```

### Example Implementation

```solidity
contract MyDApp is IXFIExecutable {
    constructor(address gateway_) IXFIExecutable(gateway_) {}
    
    function _execute(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal override {
        // Decode payload
        (string memory message) = abi.decode(payload, (string));
        
        // Process cross-chain message
        processMessage(sourceChain, sourceAddress, message);
    }
    
    function _executeWithToken(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) internal override {
        // IXFI tokens already minted to this contract
        IERC20 ixfi = IERC20(gateway.getTokenAddress("IXFI"));
        
        // Process the tokens and payload
        processPayment(amount, payload);
    }
}
```

## Events Reference

### IXFI Gateway Events

```solidity
event ContractCall(
    address indexed sender,
    string destinationChain,
    string destinationContractAddress,
    bytes32 indexed payloadHash,
    bytes payload
);

event ContractCallWithToken(
    address indexed sender,
    string destinationChain,
    string destinationContractAddress,
    bytes32 indexed payloadHash,
    bytes payload,
    string symbol,
    uint256 amount
);

event TokenSent(
    address indexed sender,
    string destinationChain,
    string destinationAddress,
    string symbol,
    uint256 amount
);

event Deposited(address indexed user, uint256 amount);
event Withdrawn(address indexed user, uint256 amount);

event ContractCallApproved(
    bytes32 indexed commandId,
    string sourceChain,
    string sourceAddress,
    address indexed contractAddress,
    bytes32 indexed payloadHash,
    bytes32 sourceTxHash,
    uint256 sourceEventIndex
);

event Executed(bytes32 indexed commandId);
```

### MetaTxGasCreditVault Events

```solidity
event Deposited(address indexed user, uint256 ixfiAmount, uint256 creditsAdded);
event Withdrawn(address indexed user, uint256 ixfiAmount, uint256 creditsDeducted);
event CreditsUsed(address indexed user, address indexed gateway, uint256 creditsUsed, uint256 gasUsd);
event GatewayAuthorized(address indexed gateway, bool authorized);
event OracleUpdated(address newOracle);
```

### MetaTxGateway Events

```solidity
event MetaTransactionExecuted(
    address indexed user,
    address indexed relayer,
    address indexed target,
    uint256 gasUsed,
    bool success
);
event RelayerAuthorized(address indexed relayer, bool authorized);
```

## Error Codes

### Common Errors

```solidity
error NotGateway();                    // Caller is not authorized gateway
error InvalidAddress();                // Zero or invalid address provided
error NotApprovedByGateway();         // Contract call not approved
error InsufficientCredits();          // Not enough gas credits
error InvalidSignature();             // EIP-712 signature verification failed
error TransactionExpired();           // Meta-transaction past deadline
error InvalidNonce();                 // Nonce mismatch or replay attempt
error UnsupportedToken();            // Token symbol not supported
error InsufficientBalance();         // Insufficient token balance
error InvalidChain();                 // Chain not supported
error CommandAlreadyExecuted();       // Command ID already used
error UnauthorizedRelayer();          // Relayer not whitelisted
error PriceDataStale();              // Oracle price too old
error InvalidPriceData();            // Oracle returned invalid price
```

### Revert Messages

```solidity
"Zero Value"                          // Deposit amount is zero
"Not enough XFI"                      // Contract has insufficient XFI
"Not enough IXFI"                     // User has insufficient IXFI
"Withdraw failed"                     // XFI transfer failed
"Invalid payload hash"                // Payload doesn't match hash
"Contract call failed"                // Target contract execution failed
"Unsupported destination chain"       // Chain not in registry
"Invalid destination address"         // Empty destination address
"Amount must be greater than zero"    // Zero amount specified
"Caller not whitelisted relayers"    // Unauthorized relayer access
"Command already executed"            // Command replay attempt
"Invalid signer"                      // Signature from wrong address
```

## Gas Costs

### Typical Gas Usage

| Function | Gas Cost | Notes |
|----------|----------|-------|
| `deposit()` | ~50,000 | XFI to IXFI conversion |
| `withdraw()` | ~55,000 | IXFI to XFI conversion |
| `callContract()` | ~80,000 | Cross-chain call initiation |
| `callContractWithToken()` | ~100,000 | Cross-chain call with token burn |
| `execute()` | ~150,000 + target cost | Command execution by relayer |
| `executeMetaTransaction()` | ~75,000 + target cost | Meta-transaction execution |
| Meta-tx deposit | ~60,000 | IXFI deposit for credits |
| Meta-tx withdrawal | ~65,000 | Credit withdrawal to IXFI |

### Optimization Tips

1. **Batch Operations**: Use batch functions when possible
2. **Payload Size**: Keep cross-chain payloads minimal
3. **Credit Management**: Deposit larger amounts less frequently
4. **Chain Selection**: Consider gas costs when choosing chains
5. **Contract Design**: Implement efficient `_execute` functions
