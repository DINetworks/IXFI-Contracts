const dotenv = require('dotenv');
const { ContractFactory, Wallet, JsonRpcProvider, keccak256, toUtf8Bytes } = require('ethers');
const artifactsIXFIGateway = require('../artifacts/contracts/IXFIGateway.sol/IXFIGateway.json')
const artifactsGasRelayerXFI = require('../artifacts/contracts/GasRelayerXFI.sol/GasRelayerXFI.json')
const artifactsIXFICaller = require('../artifacts/contracts/IXFICaller.sol/IXFICaller.json')
const artifactsIXFI = require('../artifacts/contracts/IXFI.sol/IXFI.json')

dotenv.config()

const provider = new JsonRpcProvider(process.env.RPC_URL); 
const wallet = new Wallet(process.env.PRIVATE_KEY, provider);

async function main() {
    // Get the contract factory for the contract
    const IXFIGatewayFactory = new ContractFactory(artifactsIXFIGateway.abi, artifactsIXFIGateway.bytecode, wallet);
    const gatewayContract = await IXFIGatewayFactory.deploy(wallet.address);
    await gatewayContract.waitForDeployment();        
    console.log(artifactsIXFIGateway.contractName, gatewayContract.target)

    // IXFICaller Contract
    const IXFICallerFactory = new ContractFactory(artifactsIXFICaller.abi, artifactsIXFICaller.bytecode, wallet);
    const ixficallerContract = await IXFICallerFactory.deploy();
    await ixficallerContract.waitForDeployment();
    console.log(artifactsIXFICaller.contractName, ixficallerContract.target)

    // IXFI Token Contract
    const IXFIFactory = new ContractFactory(artifactsIXFI.abi, artifactsIXFI.bytecode, wallet);
    const ixfiContract = await IXFIFactory.deploy(wallet.address, "0xdaF0CEf4fc5447a5911b73C1b8148a6f838403D9");
    await ixfiContract.waitForDeployment();
    console.log(artifactsIXFI.contractName, ixfiContract.target)


    // GasRelayererFactory
    const GasRelayerXFIFactory = new ContractFactory(artifactsGasRelayerXFI.abi, artifactsGasRelayerXFI.bytecode, wallet);
    const gRelayXFIcontract = await GasRelayerXFIFactory.deploy(ixfiContract.target);
    await gRelayXFIcontract.waitForDeployment();        
    console.log(artifactsGasRelayerXFI.contractName, gRelayXFIcontract.target)

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });