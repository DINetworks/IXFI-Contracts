const dotenv = require('dotenv');
const { ContractFactory, Wallet, JsonRpcProvider, keccak256, toUtf8Bytes } = require('ethers');
const artifacts = require('../artifacts/contracts/IXFIGateway.sol/IXFIGateway.json')

dotenv.config()

const provider = new JsonRpcProvider(process.env.RPC_URL); 
const wallet = new Wallet(process.env.PRIVATE_KEY, provider);

async function main() {
    // Get the contract factory for the contract
    const IXFIGatewayFactory = new ContractFactory(artifacts.abi, artifacts.bytecode, wallet);

    // Deploy the contract
    const contract = await IXFIGatewayFactory.deploy(wallet.address);
    console.log('deployer', wallet.address)

    await contract.waitForDeployment();        
    console.log(artifacts.contractName, contract.target)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });