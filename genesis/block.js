"use strict";
exports.__esModule = true;
var vr = require("vreath");
var state_1 = require("./state");
var gen_meta = {
    kind: 'key',
    version: vr.con.constant.my_version,
    network_id: vr.con.constant.my_net_id,
    chain_id: vr.con.constant.my_chain_id,
    validator: vr.crypto.genereate_address(vr.con.constant.native, state_1.genesis_pub),
    height: 0,
    previoushash: vr.crypto.hash(''),
    timestamp: 1545629491469,
    pos_diff: vr.con.constant.def_pos_diff,
    validatorPub: [state_1.genesis_pub],
    stateroot: state_1.genesis_roots.stateroot,
    lockroot: state_1.genesis_roots.lockroot,
    tx_root: vr.crypto.hash(''),
    fee_sum: 0,
    extra: 'Vreath bring cryptocurrency to everyone.'
};
var gen_hash = vr.crypto.object_hash(gen_meta);
var gen_sign = '19681d280c80af2af0744f4ab19dfc38018c70db0022c88c382ec02c1ae846c426b0d22823ea2af616361044ff2a666d6851917a92ed4cf54d79db3c221c302f';
exports.genesis_block = {
    hash: gen_hash,
    validatorSign: [gen_sign],
    meta: gen_meta,
    txs: [],
    raws: []
};
