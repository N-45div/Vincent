// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ReceiverTemplate} from "./ReceiverTemplate.sol";

contract SignalRegistry is ReceiverTemplate {
    enum Signal {
        HOLD,
        BUY,
        SELL
    }

    struct SignalReport {
        bytes32 dataHash;
        uint8 signal;
        uint8 confidence;
        uint256 timestamp;
        string asset;
        uint256 price;
        int256 sentiment;
    }

    SignalReport public latestReport;
    uint256 public reportCount;
    mapping(uint256 => SignalReport) public reports;

    event SignalAttested(
        uint256 indexed reportId,
        bytes32 indexed dataHash,
        uint8 signal,
        uint8 confidence,
        string asset,
        uint256 timestamp
    );

    constructor(address forwarder) ReceiverTemplate(forwarder) {}

    function _processReport(bytes calldata report) internal override {
        SignalReport memory decoded = abi.decode(report, (SignalReport));
        reportCount += 1;
        reports[reportCount] = decoded;
        latestReport = decoded;

        emit SignalAttested(
            reportCount,
            decoded.dataHash,
            decoded.signal,
            decoded.confidence,
            decoded.asset,
            decoded.timestamp
        );
    }

    function getReport(uint256 reportId) external view returns (SignalReport memory) {
        return reports[reportId];
    }

    function isReportAnomalous(SignalReport memory prospective) public view returns (bool) {
        if (reportCount == 0) {
            return false;
        }
        return prospective.confidence > 95 && latestReport.signal != prospective.signal;
    }
}
