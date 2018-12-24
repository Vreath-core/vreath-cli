"use strict";
exports.__esModule = true;
var state_1 = require("./state");
exports.pub = state_1.genesis_pub;
exports.state = state_1.genesis_state;
exports.roots = state_1.genesis_roots;
var block_1 = require("./block");
exports.block = block_1.genesis_block;
var initial_peers_1 = require("./initial_peers");
exports.peers = initial_peers_1.peers;
