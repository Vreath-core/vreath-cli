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
var gen_sign = '902683e69a80185af0b3d1d001a0894970e9d5351b12b1143bff9e991637eef4609ac1ab4fbba1040febfe29d983afeebf0a14b50e1370eccc1065bc69ec1779';
console.log(gen_sign);
exports.genesis_block = {
    hash: gen_hash,
    validatorSign: [gen_sign],
    meta: gen_meta,
    txs: [],
    raws: []
};
console.log(exports.genesis_block);
