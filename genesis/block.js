"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vr = __importStar(require("vreath"));
const big_integer_1 = __importDefault(require("big-integer"));
const gen_meta = {
    kind: 0,
    height: "00",
    previoushash: vr.crypto.get_sha256(''),
    timestamp: 1545629491,
    pos_diff: vr.con.constant.def_pos_diff.toString(16),
    trie_root: vr.crypto.get_sha256(''),
    tx_root: vr.crypto.get_sha256(''),
    fee_sum: "00",
    extra: Buffer.from("Vreath bring cryptocurrency to everyone.").toString('hex')
};
const id = vr.con.constant.my_version + vr.con.constant.my_chain_id + vr.con.constant.my_net_id;
const meta_array = vr.block.block_meta2array(gen_meta).concat(id);
const gen_sign_data = '00a1cf887f528f063a0ec9bd72d2fbea67e5e635b9cea5dbe18529256dec674f6cf5b8a33ff4ac438d3b60a051e4910063c9872926a5d17ba35d362e464b2261';
const gen_recover_id = '01';
const gen_v = vr.crypto.bigint2hex(big_integer_1.default(id, 16).multiply(2).add(8).add(big_integer_1.default(28).subtract(big_integer_1.default(gen_recover_id, 16))));
const gen_sign = {
    data: gen_sign_data,
    v: gen_v
};
const all_array = meta_array.concat(gen_sign.v);
const gen_hash = vr.crypto.array2hash(all_array);
exports.genesis_block = {
    hash: gen_hash,
    signature: gen_sign,
    meta: gen_meta,
    txs: []
};
