// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice 8-decimal USD price of 1 ETH, e.g. $3032 -> 303200000000
interface IEthUsdPrice {
    function ethUsd8() external view returns (uint256 price8, uint256 updatedAt);
}

/// @title VeyroHoodCampaign
/// @notice Mainnet verification payments, 80/20 split, referral escrow, OG tracking.
contract VeyroHoodCampaign is Ownable2Step, Pausable, ReentrancyGuard {
    uint256 public constant FEE_USD_8 = 25_000000; // $0.25 with 8 decimals
    uint256 public constant WITHDRAW_USD_8 = 2_00000000; // $2.00
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant REFERRAL_BPS = 2_000; // 20%
    uint256 public constant OG_LIMIT = 1_000;

    address payable public treasury;
    IEthUsdPrice public priceSource;

    uint256 public minPaymentBps = 9_000; // accept >= 90% of quoted $0.25
    uint256 public maxPriceAge = 30 minutes;
    uint256 public verifiedCount;

    mapping(address => bool) public hasPaid;
    mapping(address => bool) public isOg;
    mapping(address => uint256) public claimable;
    mapping(address => address) public lockedReferrer;

    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event PriceSourceUpdated(address indexed previousSource, address indexed newSource);
    event PaymentConfigUpdated(uint256 minPaymentBps, uint256 maxPriceAge);
    event VerificationPaid(
        address indexed payer,
        address indexed referrer,
        uint256 amount,
        uint256 treasuryAmount,
        uint256 referralAmount,
        bool og,
        uint256 verifiedCountAfter
    );
    event ReferralCredited(address indexed referrer, address indexed referred, uint256 amount);
    event Withdrawn(address indexed referrer, uint256 amount, uint256 ethUsd8);

    error InvalidAddress();
    error AlreadyPaid();
    error SelfReferral();
    error PaymentTooLow(uint256 sent, uint256 required);
    error StalePrice(uint256 updatedAt, uint256 maxAge);
    error InvalidPrice();
    error BelowWithdrawThreshold(uint256 claimableWei, uint256 requiredWei);
    error NothingToWithdraw();
    error TreasuryTransferFailed();
    error WithdrawTransferFailed();

    constructor(address payable treasury_, address priceSource_, address owner_)
        Ownable(owner_)
    {
        if (treasury_ == address(0) || owner_ == address(0) || priceSource_ == address(0)) {
            revert InvalidAddress();
        }
        treasury = treasury_;
        priceSource = IEthUsdPrice(priceSource_);
    }

    receive() external payable {
        revert("use payToVerify");
    }

    function payToVerify(address referrer) external payable whenNotPaused nonReentrant {
        if (hasPaid[msg.sender]) revert AlreadyPaid();
        if (referrer == msg.sender) revert SelfReferral();

        (uint256 price8, ) = _readFreshPrice();
        uint256 required = _usd8ToWei(FEE_USD_8, price8);
        uint256 minAccepted = (required * minPaymentBps) / BPS_DENOMINATOR;
        if (msg.value < minAccepted) revert PaymentTooLow(msg.value, minAccepted);

        hasPaid[msg.sender] = true;
        verifiedCount += 1;

        bool og = verifiedCount <= OG_LIMIT;
        if (og) {
            isOg[msg.sender] = true;
        }

        address validReferrer = referrer;
        if (validReferrer == address(0) || validReferrer == treasury) {
            validReferrer = address(0);
        }

        if (lockedReferrer[msg.sender] == address(0) && validReferrer != address(0)) {
            lockedReferrer[msg.sender] = validReferrer;
        } else {
            validReferrer = lockedReferrer[msg.sender];
        }

        uint256 referralAmount = 0;
        if (validReferrer != address(0)) {
            referralAmount = (msg.value * REFERRAL_BPS) / BPS_DENOMINATOR;
            claimable[validReferrer] += referralAmount;
            emit ReferralCredited(validReferrer, msg.sender, referralAmount);
        }

        uint256 treasuryAmount = msg.value - referralAmount;
        (bool ok, ) = treasury.call{value: treasuryAmount}("");
        if (!ok) revert TreasuryTransferFailed();

        emit VerificationPaid(
            msg.sender,
            validReferrer,
            msg.value,
            treasuryAmount,
            referralAmount,
            og,
            verifiedCount
        );
    }

    function withdraw() external whenNotPaused nonReentrant {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        (uint256 price8, ) = _readFreshPrice();
        uint256 required = _usd8ToWei(WITHDRAW_USD_8, price8);
        if (amount < required) revert BelowWithdrawThreshold(amount, required);

        claimable[msg.sender] = 0;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert WithdrawTransferFailed();

        emit Withdrawn(msg.sender, amount, price8);
    }

    function quoteFeeWei() external view returns (uint256 required, uint256 minAccepted, uint256 price8) {
        (price8, ) = _readFreshPrice();
        required = _usd8ToWei(FEE_USD_8, price8);
        minAccepted = (required * minPaymentBps) / BPS_DENOMINATOR;
    }

    function quoteWithdrawWei() external view returns (uint256 required, uint256 price8) {
        (price8, ) = _readFreshPrice();
        required = _usd8ToWei(WITHDRAW_USD_8, price8);
    }

    function setTreasury(address payable newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidAddress();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    function setPriceSource(address newSource) external onlyOwner {
        if (newSource == address(0)) revert InvalidAddress();
        emit PriceSourceUpdated(address(priceSource), newSource);
        priceSource = IEthUsdPrice(newSource);
    }

    function setPaymentConfig(uint256 minPaymentBps_, uint256 maxPriceAge_) external onlyOwner {
        require(minPaymentBps_ >= 8_000 && minPaymentBps_ <= 10_000, "bps");
        require(maxPriceAge_ >= 2 minutes && maxPriceAge_ <= 24 hours, "age");
        minPaymentBps = minPaymentBps_;
        maxPriceAge = maxPriceAge_;
        emit PaymentConfigUpdated(minPaymentBps_, maxPriceAge_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _readFreshPrice() internal view returns (uint256 price8, uint256 updatedAt) {
        (price8, updatedAt) = priceSource.ethUsd8();
        if (price8 == 0) revert InvalidPrice();
        if (block.timestamp < updatedAt || block.timestamp - updatedAt > maxPriceAge) {
            revert StalePrice(updatedAt, maxPriceAge);
        }
    }

    function _usd8ToWei(uint256 usd8, uint256 price8) internal pure returns (uint256) {
        return (usd8 * 1e18) / price8;
    }
}
