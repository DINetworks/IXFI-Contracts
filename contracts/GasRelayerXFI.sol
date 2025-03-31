// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract GasRelayerXFI {
    using SafeERC20 for IERC20;
    using Address for address;

    address public owner;
    IERC20 public ixfiToken;
    mapping(address => uint) public gasBalance;

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
    
    function depositGas() public payable {
        require(msg.value > 0, "Amount must be greater than zero");

        gasBalance[msg.sender] += msg.value;

        emit GasDeposited(msg.sender, msg.value);
    }

    // Function to deposit XFI tokens into the gas pool
    function depositGasIXFI(uint amount) external {
        address user = msg.sender;
        ixfiToken.safeTransferFrom(user, address(this), amount);
        gasBalance[user] += amount;
        
        emit GasDeposited(user, amount);
    }

    function withdrawGasIXFI(uint amount) external {
        address user = msg.sender;
        require(gasBalance[user] >= amount, "Insufficient Balance");
        ixfiToken.safeTransfer(user, amount);
        gasBalance[user] -= amount;

        emit GasWithdrawn(user, amount);
    }

    function coverGas(address user, uint amount) external onlyOwner {
        require(gasBalance[user] >= amount, "Insufficient gas balance");
        gasBalance[user] -= amount;
        emit GasFeePaid(user, amount);
    }

    receive() external payable {
        depositGas();
    }
}