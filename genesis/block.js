"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const vr = __importStar(require("vreath"));
const state_1 = require("./state");
const gen_meta = {
    kind: 'key',
    version: vr.con.constant.my_version,
    network_id: vr.con.constant.my_net_id,
    chain_id: vr.con.constant.my_chain_id,
    validator: vr.crypto.genereate_address(vr.con.constant.native, state_1.genesis_pub),
    height: 0,
    previoushash: vr.crypto.hash(''),
    timestamp: 1545629491,
    pos_diff: vr.con.constant.def_pos_diff,
    validatorPub: [state_1.genesis_pub],
    stateroot: state_1.genesis_roots.stateroot,
    lockroot: state_1.genesis_roots.lockroot,
    tx_root: vr.crypto.hash(''),
    fee_sum: 0,
    extra: 'Vreath bring cryptocurrency to everyone.'
};
const gen_hash = vr.crypto.object_hash(gen_meta);
const gen_sign = '8762f2d1162be7a24389ba1c45b46f6ca969da31e5bf4c4a6a2608e311b012d96c3fa4ca4991ac90c193e3f5ac6bc1d36547c6bf1bd15645d182b1e2d175b3b4';
exports.genesis_block = {
    hash: gen_hash,
    validatorSign: [gen_sign],
    meta: gen_meta,
    txs: [],
    raws: []
};
