// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IEthUsdPrice} from "./IEthUsdPrice.sol";

/// @title SessionEthUsdPrice
/// @notice Admin-posted ETH/USD session price for Robinhood Chain mainnet.
/// @dev Robinhood Chain has no Chainlink ETH/USD feed for this campaign.
///      Ownership should be a multisig. A stale price freezes pay/withdraw.
contract SessionEthUsdPrice is Ownable2Step, IEthUsdPrice {
    uint256 public price8;
    uint256 public updatedAt;

    event PricePosted(uint256 price8, uint256 updatedAt, address indexed poster);

    error InvalidPrice();
    error InvalidOwner();

    constructor(address owner_, uint256 initialPrice8) Ownable(owner_) {
        if (owner_ == address(0)) revert InvalidOwner();
        if (initialPrice8 == 0) revert InvalidPrice();
        price8 = initialPrice8;
        updatedAt = block.timestamp;
        emit PricePosted(initialPrice8, updatedAt, msg.sender);
    }

    function postPrice(uint256 newPrice8) external onlyOwner {
        if (newPrice8 == 0) revert InvalidPrice();
        price8 = newPrice8;
        updatedAt = block.timestamp;
        emit PricePosted(newPrice8, updatedAt, msg.sender);
    }

    function ethUsd8() external view returns (uint256, uint256) {
        return (price8, updatedAt);
    }
}
