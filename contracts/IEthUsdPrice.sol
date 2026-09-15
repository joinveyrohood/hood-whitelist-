// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice 8-decimal USD price of 1 ETH. Example: $3,032.00 -> 303200000000
interface IEthUsdPrice {
    function ethUsd8() external view returns (uint256 price8, uint256 updatedAt);
}
