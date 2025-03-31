// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract XFIGasRelayer {
    address public owner;
    IERC20 public ixfiToken;
    mapping(address => uint) public gasBalance;
    mapping(address => uint) public nonces;

    event GasDeposited(address indexed user, uint amount);
    event GasWithdrawn(address indexed user, uint amount);
    event GasFeePaid(address indexed user, uint amount);

    constructor(address _xfiToken) {
        owner = msg.sender;
        ixfiToken = IERC20(_xfiToken);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    // Function to deposit XFI tokens into the gas pool
    function depositGas(uint amount) external {
        address user = msg.sender;
        require(ixfiToken.transferFrom(user, address(this), amount), "Transfer failed");
        gasBalance[user] += amount;
        
        emit GasDeposited(user, amount);
    }

    function withdrawGas(uint amount) external {
        address user = msg.sender;
        require(gasBalance[user] >= amount, "Insufficient Balance");
        require(ixfiToken.transfer(user, amount), "Transfer failed");
        gasBalance[user] -= amount;

        emit GasWithdrawn(user, amount);
    }

    function coverGas(address user, uint amount) external onlyOwner {
        require(gasBalance[user] >= amount, "Insufficient gas balance");
        gasBalance[user] -= amount;
        emit GasFeePaid(user, amount);
    }
}