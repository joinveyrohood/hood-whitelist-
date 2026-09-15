// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICampaignWithdraw {
    function withdraw() external;
}

contract ReenteringWithdrawer {
    ICampaignWithdraw public campaign;
    bool public attack;
    uint256 public receiveCount;

    function setCampaign(address campaign_) external {
        campaign = ICampaignWithdraw(campaign_);
    }

    function enableAttack(bool value) external {
        attack = value;
    }

    function attackWithdraw() external {
        campaign.withdraw();
    }

    receive() external payable {
        receiveCount += 1;
        if (attack && receiveCount == 1) {
            campaign.withdraw();
        }
    }
}
