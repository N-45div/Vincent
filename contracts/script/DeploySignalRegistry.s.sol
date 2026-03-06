// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import {SignalRegistry} from "../src/SignalRegistry.sol";

contract DeploySignalRegistry is Script {
    function run() external returns (SignalRegistry deployed) {
        address forwarder = vm.envAddress("CRE_FORWARDER");
        vm.startBroadcast();
        deployed = new SignalRegistry(forwarder);
        vm.stopBroadcast();
    }
}
