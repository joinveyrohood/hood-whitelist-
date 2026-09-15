// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SessionEthUsdPrice} from "../SessionEthUsdPrice.sol";
import {VeyroHoodCampaign} from "../VeyroHoodCampaign.sol";

contract Deploy is Script {
    address payable constant TREASURY =
        payable(0xf6F80827cBAf83798c7763FCd915C0068F2bE60C);

    function run() external {
        require(block.chainid == 4663, "Refusing to deploy: not Robinhood mainnet 4663");

        uint256 pk = vm.envUint("PRIVATE_KEY");
        address owner = vm.envOr("OWNER", vm.addr(pk));
        uint256 initialUsd = vm.envOr("INITIAL_ETH_USD", uint256(3032));
        require(owner != address(0), "bad owner");
        require(initialUsd > 0, "bad price");

        uint256 price8 = initialUsd * 1e8;

        console2.log("chainId", block.chainid);
        console2.log("treasury", TREASURY);
        console2.log("owner", owner);
        console2.log("price8", price8);

        vm.startBroadcast(pk);
        SessionEthUsdPrice price = new SessionEthUsdPrice(owner, price8);
        VeyroHoodCampaign campaign = new VeyroHoodCampaign(TREASURY, address(price), owner);
        vm.stopBroadcast();

        console2.log("PRICE_CONTRACT", address(price));
        console2.log("CAMPAIGN_CONTRACT", address(campaign));
    }
}
