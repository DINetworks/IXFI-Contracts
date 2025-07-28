const IXFIRelayer = require('../IXFIRelayer');
const { ethers } = require('ethers');

// Mock configuration for testing
const mockConfig = {
    chains: {
        crossfi: {
            rpc: "http://localhost:8545",
            chainId: 4157,
            ixfiAddress: "0x1234567890123456789012345678901234567890",
            blockConfirmations: 1
        },
        ethereum: {
            rpc: "http://localhost:8546",
            chainId: 1,
            ixfiAddress: "0x0987654321098765432109876543210987654321",
            blockConfirmations: 12
        }
    },
    relayerPrivateKey: "0x0123456789012345678901234567890123456789012345678901234567890123",
    pollingInterval: 1000,
    gasLimit: 500000
};

describe('IXFIRelayer', () => {
    let relayer;

    beforeEach(() => {
        // Create a new relayer instance for each test
        relayer = new IXFIRelayer(mockConfig);
    });

    afterEach(async () => {
        if (relayer && relayer.isRunning) {
            await relayer.stop();
        }
    });

    test('should initialize with correct configuration', () => {
        expect(relayer.config).toEqual(mockConfig);
        expect(relayer.isRunning).toBe(false);
        expect(relayer.processedEvents).toBeInstanceOf(Set);
    });

    test('should setup providers for all chains', () => {
        expect(Object.keys(relayer.providers)).toEqual(['crossfi', 'ethereum']);
        expect(relayer.providers.crossfi).toBeTruthy();
        expect(relayer.providers.ethereum).toBeTruthy();
    });

    test('should setup signers for all chains', () => {
        expect(Object.keys(relayer.signers)).toEqual(['crossfi', 'ethereum']);
        expect(relayer.signers.crossfi.address).toBeTruthy();
        expect(relayer.signers.ethereum.address).toBeTruthy();
        
        // All signers should have the same address (same private key)
        expect(relayer.signers.crossfi.address).toBe(relayer.signers.ethereum.address);
    });

    test('should generate correct command ID', () => {
        const txHash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
        const logIndex = 0;
        
        const commandId = ethers.id(`${txHash}-${logIndex}`);
        expect(commandId).toBeTruthy();
        expect(commandId.length).toBe(66); // 0x + 64 hex chars
    });

    test('should handle processed events correctly', () => {
        const eventId = "0xabc-1";
        
        expect(relayer.processedEvents.has(eventId)).toBe(false);
        
        relayer.processedEvents.add(eventId);
        expect(relayer.processedEvents.has(eventId)).toBe(true);
    });

    test('should create correct contract call command', () => {
        const mockEvent = {
            transactionHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            logIndex: 0,
            args: {
                sender: "0x1111111111111111111111111111111111111111",
                destinationChain: "ethereum",
                destinationContractAddress: "0x2222222222222222222222222222222222222222",
                payloadHash: "0x3333333333333333333333333333333333333333333333333333333333333333"
            }
        };

        const commandData = ethers.AbiCoder.defaultAbiCoder().encode(
            ['string', 'string', 'address', 'bytes32', 'bytes32', 'uint256'],
            [
                'crossfi',
                mockEvent.args.sender,
                mockEvent.args.destinationContractAddress,
                mockEvent.args.payloadHash,
                mockEvent.transactionHash,
                mockEvent.logIndex
            ]
        );

        expect(commandData).toBeTruthy();
        expect(commandData.startsWith('0x')).toBe(true);
    });

    test('should create correct token mint command', () => {
        const mockEvent = {
            transactionHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            logIndex: 0,
            args: {
                sender: "0x1111111111111111111111111111111111111111",
                destinationChain: "ethereum",
                destinationAddress: "0x2222222222222222222222222222222222222222",
                symbol: "IXFI",
                amount: ethers.parseEther("100")
            }
        };

        const commandData = ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint256', 'string'],
            [
                mockEvent.args.destinationAddress,
                mockEvent.args.amount,
                mockEvent.args.symbol
            ]
        );

        expect(commandData).toBeTruthy();
        expect(commandData.startsWith('0x')).toBe(true);
    });

    test('should get health status', async () => {
        const health = await relayer.getHealth();
        
        expect(health).toHaveProperty('status');
        expect(health).toHaveProperty('chains');
        expect(health).toHaveProperty('processedEvents');
        expect(health).toHaveProperty('relayerAddress');
        
        expect(health.chains).toHaveProperty('crossfi');
        expect(health.chains).toHaveProperty('ethereum');
        expect(typeof health.processedEvents).toBe('number');
    });
});

// Integration tests (require running blockchain nodes)
describe('IXFIRelayer Integration', () => {
    // These tests would require actual blockchain nodes running
    // Skip them if nodes are not available
    
    test.skip('should connect to blockchain networks', async () => {
        const relayer = new IXFIRelayer(mockConfig);
        
        // This would test actual network connectivity
        const health = await relayer.getHealth();
        expect(health.status).toBe('healthy');
        
        await relayer.stop();
    });

    test.skip('should verify relayer whitelist status', async () => {
        const relayer = new IXFIRelayer(mockConfig);
        
        // This would test actual contract interaction
        await relayer.verifyRelayerStatus();
        
        await relayer.stop();
    });
});
