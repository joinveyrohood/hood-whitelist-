// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract BadTreasury {
    fallback() external payable {
        revert("treasury closed");
    }

    receive() external payable {
        revert("treasury closed");
    }
}
