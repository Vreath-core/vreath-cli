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
const works = __importStar(require("../../logic/work"));
const block_1 = require("./block");
const big_integer_1 = __importDefault(require("big-integer"));
const P = __importStar(require("p-iteration"));
const pull = require('pull-stream');
exports.get = async (hashes, stream, chain_info_db, block_db, output_db, log) => {
    try {
        const info = await chain_info_db.read_obj('00');
        if (info == null)
            throw new Error("chain_info doesn't exist");
        const last_height = info.last_height;
        let i = big_integer_1.default(0);
        let height;
        let block;
        let fork_height = last_height;
        while (i.lesserOrEquals(big_integer_1.default(last_height, 16))) {
            height = vr.crypto.bigint2hex(i);
            block = await block_db.read_obj(height);
            if (block == null || block.hash != hashes[block.meta.height]) {
                fork_height = height;
                break;
            }
            i = i.add(1);
        }
        let chain = [];
        let next_blocks = [];
        i = big_integer_1.default(fork_height, 16);
        while (i.lesserOrEquals(big_integer_1.default(last_height, 16))) {
            height = vr.crypto.bigint2hex(i);
            block = await block_db.read_obj(height);
            i = i.add(1);
            if (block != null)
                next_blocks.push(block);
            else
                break;
        }
        chain = chain.concat(next_blocks);
        next_blocks = [];
        const states = await P.reduce(chain, async (result, block) => {
            if (block.meta.height === "00")
                return result;
            return await P.reduce(block.txs, async (res, tx) => {
                if (tx.meta.kind != 0) {
                    res[tx.hash] = [];
                    return res;
                }
                else {
                    const outputs = await output_db.read_obj(tx.hash);
                    if (outputs == null)
                        return res;
                    res[tx.hash] = outputs;
                    return res;
                }
            }, result);
        }, {});
        stream.write(JSON.stringify([chain, states]));
        stream.write('end2');
    }
    catch (e) {
        log.info(e);
    }
};
exports.post = async (msg, block_db, finalize_db, uniter_db, chain_info_db, root_db, trie_db, state_db, lock_db, tx_db, peer_list_db, private_key, node, log) => {
    try {
        const parsed = JSON.parse(msg);
        const new_chain = parsed[0];
        const output_states = parsed[1];
        if (new_chain.some(block => !vr.block.isBlock(block)) || Object.values(output_states).some(states => states.some(s => !vr.state.isState(s))))
            throw new Error('invalid data');
        const heights = new_chain.map(block => block.meta.height).sort((a, b) => big_integer_1.default(a, 16).subtract(big_integer_1.default(b, 16)).toJSNumber());
        const new_diff_sum = new_chain.reduce((sum, block) => {
            return sum.add(big_integer_1.default(block.meta.pos_diff, 16));
        }, big_integer_1.default(0));
        const my_diff_sum = await P.reduce(heights, async (sum, height) => {
            const block = await block_db.read_obj(height);
            if (block == null)
                return sum;
            return sum.add(big_integer_1.default(block.meta.pos_diff, 16));
        }, big_integer_1.default(0));
        if (new_diff_sum.lesserOrEquals(my_diff_sum))
            throw new Error("lighter chain");
        let info = await chain_info_db.read_obj('00');
        if (info == null)
            throw new Error('chain_info is empty');
        const key_blocks = new_chain.filter(block => block.meta.kind === 0);
        const finality_check = await P.some(key_blocks, async (block) => {
            const key_height = block.meta.height;
            const my_key_block = await block_db.read_obj(key_height);
            const finalizes = await finalize_db.read_obj(key_height);
            const uniters = await uniter_db.read_obj(key_height);
            const root = await root_db.read_obj(key_height);
            if (my_key_block == null || finalizes == null || uniters == null || root == null || block.hash === my_key_block.hash)
                return false;
            const trie = vr.data.trie_ins(trie_db, root);
            if (vr.finalize.verify(block, finalizes, uniters, trie, state_db))
                return true;
            else
                return false;
        });
        if (finality_check)
            throw new Error('finalized');
        const fork_block = new_chain[0];
        const backed_last_height = vr.crypto.bigint2hex(big_integer_1.default(fork_block.meta.height, 16).subtract(1));
        const backed_last_block = await block_db.read_obj(backed_last_height);
        if (backed_last_block != null) {
            info.last_hash = backed_last_block.hash;
            info.last_height = backed_last_height;
        }
        await chain_info_db.write_obj("00", info);
        let block;
        const minimum_height = big_integer_1.default(backed_last_height, 16);
        for (block of new_chain) {
            if (block.meta.height === '00' || big_integer_1.default(block.meta.height, 16).lesser(minimum_height))
                continue;
            const outputs = await P.reduce(block.txs, async (res, tx) => {
                if (tx.meta.kind != 1)
                    return res;
                const given = output_states[tx.hash];
                if (given != null && given.length > 0)
                    return res.concat(given);
                else {
                    const req_height = tx.meta.refresh.height;
                    const root = await root_db.get(req_height);
                    if (root == null)
                        throw new Error("root doesn't exist");
                    const trie = vr.data.trie_ins(trie_db, root);
                    const req_tx = await vr.tx.find_req_tx(tx, block_db);
                    const computed = await works.compute_output(req_tx, trie, state_db, block_db);
                    const output = computed[1];
                    return res.concat(output);
                }
            }, []);
            await block_1.post(Buffer.from(JSON.stringify([block, outputs])), chain_info_db, root_db, trie_db, block_db, state_db, lock_db, tx_db, peer_list_db, finalize_db, uniter_db, private_key, node, log);
        }
        return 1;
    }
    catch (e) {
        log.info(e);
    }
};
