require('dotenv').config();
require("@nomicfoundation/hardhat-ethers");
require("hardhat-contract-sizer");

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          },
          viaIR: false,
          evmVersion: "london"
        }
      }
    ]
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },
  networks: {
    crossfi: {
      chainId: 4158,
      url: "https://rpc.mainnet.ms", 
      accounts: [process.env.PRIVATE_KEY], 
    },
  },
  // Add paths if needed
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};