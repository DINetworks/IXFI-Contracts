<div align="center">
    <a href="https://ixfi.network.com">
        <img alt="logo" src="https://github.com/IXFILabs/IXFILabs/blob/main/IXFI-banner.png" style="width: 100%;">
    </a>
</div>

## IXFI Protocol

The Interoperable XFI (IXFI) Protocol introduces a groundbreaking approach to cross-chain interoperability by leveraging XFI as the primary gas token. This enables gasless cross-chain swaps through a meta-transaction relay system while enhancing XFI’s utility across multiple blockchain networks.

By addressing the limitations of CrossFi’s existing bridge, IXFI transforms CrossFi’s ecosystem into a fully interoperable and programmable cross-chain infrastructure. This innovation allows seamless asset transfers, smart contract execution, and data messaging across diverse blockchain ecosystems.

## Tech Stack

    - solidity (v0.8.20)
    - Hardhat (v2.22.19)
    - Openzeppelin Contracts (v5.2.0)

## Development & Test on Local Environment

Clone and install npm modules

```sh
git clone https://github.com/IXFILabs/IXFI-Contracts.git
cd IXFI-Contracts
npm install
```

Create .env file and setup env variables

```
RPC_URL=https://crossfi-testnet.g.alchemy.com/v2/<YOUR_ALCHEMY_API_KEY>
PRIVATE_KEY=<YOUR_WALLET_PRIVATE_KEY>
```

## Features

### Gas Relayer
`GasRelayer.sol, GasRelayerXFI.sol:`
These contracts facilitate gas supply for users' meta transactions on EVM-compatible chains. Users can deposit XFI (IXFI) to cover gas fees and withdraw their deposited XFI at any time.

### Gateway
`IXFIGateway.sol`
This smart contract will support meta-transactions, allowing users to submit transactions without paying for gas. The contract will validate the relayer's signature and execute the transaction.

- executeMetaTransaction: Allows a user to submit a meta-transaction. The relayer signs the transaction and submits it to the contract.

- recoverSigner: Recovers the signer's address from the signature to ensure the transaction was signed by the user.

- nonces: Prevents replay attacks by ensuring each transaction is only executed once.

### IXFI Token
`IXFI.sol`, `IXFICaller.sol`: these contracts facilitate the cross-chain transfer of XFI (IXFI) tokens along with associated data, enabling seamless interoperability between EVM-compatible blockchains. Users can lock XFI (or burn IXFI) on the source chain while transmitting data, and on the destination chain, IXFI is minted, allowing the received data to trigger program execution.

## Depolyed Contracts on CrossFi Testnet
| Contract Name       | Address on CrossFi Testnet                         |
|---------------------|---------------------------------------------------|
| IXFIGateway.sol    | 0x24ace36d6565fc3a27e2bb9f2f0fa164d3f2adf6        |
| GasRelayerXFI.sol  | 0xf337fc4d623b5a2664138947aa6cea8ce783f3f2        |
| IXFI.sol           | 0xFC4C231D2293180a30eCd10Ce9A84bDBF27B3967        |
| IXFICaller.sol     | 0xdaf0cef4fc5447a5911b73c1b8148a6f838403d9        |





