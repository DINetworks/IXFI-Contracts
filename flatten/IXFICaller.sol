// Sources flattened with hardhat v2.22.19 https://hardhat.org

// SPDX-License-Identifier: MIT

// File contracts/IXFICaller.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.0;

contract IXFICaller {

    struct CallData {
        address target;
        bytes4 selector;
        bytes params;
    }

    error CallDataInvalid();

    function multicall(bytes calldata callData) external {
        CallData[] memory data = abi.decode(callData, (CallData[]));
        uint256 call_count = data.length;
        for (uint256 i = 0; i < call_count; ) {
            (bool success, ) = data[i].target.call(abi.encodeWithSelector(data[i].selector, data[i].params));
            if (!success) {
                revert CallDataInvalid();
            }

            unchecked {
                ++i;
            }
        }

    }
}
