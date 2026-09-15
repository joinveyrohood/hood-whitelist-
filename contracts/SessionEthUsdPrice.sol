// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IEthUsdPrice} from "./VeyroHoodCampaign.sol";

/// @notice Owner-posted ETH/USD session price for Robinhood Chain (no Chainlink feed).
contract SessionEthUsdPrice is Ownable2Step, IEthUsdPrice {
    uint256 public price8;
    uint256 public updatedAt;

    event PricePosted(uint256 price8, uint256 updatedAt);

    constructor(address owner_, uint256 initialPrice8) Ownable(owner_) {
        require(initialPrice8 > 0, "price");
        price8 = initialPrice8;
        updatedAt = block.timestamp;
        emit PricePosted(initialPrice8, updatedAt);
    }

    function postPrice(uint256 newPrice8) external onlyOwner {
        require(newPrice8 > 0, "price");
        price8 = newPrice8;
        updatedAt = block.timestamp;
        emit PricePosted(newPrice8, updatedAt);
    }

    function ethUsd8() external view returns (uint256, uint256) {
        return (price8, updatedAt);
    }
}
