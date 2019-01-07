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
const gen_sign = '8acf304c2d3f387ce87df9f8919094c0a38b2a00aa09749511d8303929c0e6c871de9e54ad1e236957647ae0a0afd39080029a0bbd828dfbcbe86ab7a27b96d1';
exports.genesis_block = {
    hash: gen_hash,
    validatorSign: [gen_sign],
    meta: gen_meta,
    txs: [],
    raws: []
};
//# sourceMappingURL=block.js.map