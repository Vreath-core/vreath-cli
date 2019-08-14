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
const pull = require('pull-stream');
exports.post = async (msg, block_db, uniter_db, root_db, trie_db, state_db, finalize_db, log) => {
    try {
        const data = JSON.parse(msg.toString('utf-8'));
        if (!vr.finalize.isFinalize(data))
            throw new Error('invalid data');
        const block = await block_db.read_obj(data.height);
        if (block == null || block.meta.kind != 0 || block.hash != data.hash)
            throw new Error('invalid block height');
        const pre_height = vr.crypto.bigint2hex(big_integer_1.default(data.height, 16).subtract(1));
        const pre_key_block = await vr.block.search_key_block(block_db, pre_height);
        const pre_key_height = pre_key_block.meta.height;
        const pre_finalizes = await finalize_db.read_obj(pre_key_height);
        const pre_uniters = await uniter_db.read_obj(pre_key_height);
        const pre_root = await root_db.get(pre_key_height);
        const pre_trie = pre_root != null ? vr.data.trie_ins(trie_db, pre_root) : null;
        if (pre_finalizes == null || pre_uniters == null || pre_root == null || pre_trie == null || !vr.finalize.verify(pre_key_block, pre_finalizes, pre_uniters, pre_trie, state_db)) {
            throw new Error('previous key block is not finalized yet');
        }
        const sign = data.sign;
        const finalize_hash = vr.finalize.hash(data.height, data.hash);
        const recover_id = vr.tx.get_recover_id_from_sign(sign);
        const pub_key = vr.crypto.recover(finalize_hash, sign.data, recover_id);
        const address = vr.crypto.generate_address(vr.con.constant.unit, pub_key);
        const uniters = await uniter_db.read_obj(data.height);
        if (uniters == null)
            throw new Error('no uniter at the height');
        const root = await root_db.get(data.height, 'hex');
        if (root == null)
            throw new Error('root is empty at the last height');
        const trie = vr.data.trie_ins(trie_db, root);
        const finalize_validators = await vr.finalize.choose(uniters, data.height, trie, state_db);
        if (finalize_validators.indexOf(address) === -1)
            throw new Error('invalid address');
        if (!vr.crypto.verify(finalize_hash, sign.data, pub_key))
            throw new Error('invalid sign');
        const saved_finalize = await finalize_db.read_obj(data.height);
        const new_finalized = saved_finalize != null && saved_finalize.length >= 1 ? saved_finalize.concat(data) : [data];
        await finalize_db.write_obj(data.height, new_finalized);
    }
    catch (e) {
        log.info(e);
    }
};
