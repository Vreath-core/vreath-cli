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
const P = __importStar(require("p-iteration"));
const big_integer_1 = __importDefault(require("big-integer"));
const lodash_1 = require("lodash");
exports.sleep = (msec) => {
    return new Promise(function (resolve) {
        setTimeout(function () { resolve(); }, msec);
    });
};
exports.copy = (data) => {
    return lodash_1.cloneDeep(data);
};
exports.new_obj = (obj, fn) => {
    return fn(exports.copy(obj));
};
//my_address is the validator's unit address
const choose_txs = async (unit_mode, trie, pool_db, lock_db, block_db, my_address) => {
    let requested_bases = [];
    let requested_tx_hashes = [];
    const choosed = await pool_db.filter('hex', 'utf8', async (key, tx) => {
        if (tx.meta.kind === 0) {
            const requested_check = await P.some(tx.meta.request.bases, async (base) => {
                if (requested_bases.indexOf(base) != -1)
                    return true;
                const lock = await vr.data.read_from_trie(trie, lock_db, base, 1, vr.lock.create_lock(base));
                return lock.state === 1;
            });
            if (!requested_check) {
                requested_bases = requested_bases.concat(tx.meta.request.bases);
            }
            else
                return false;
        }
        else if (tx.meta.kind === 1) {
            const block = await block_db.read_obj(tx.meta.refresh.height);
            if (block == null)
                return false;
            const req_tx = block.txs[tx.meta.refresh.index];
            if (req_tx == null)
                return false;
            const hash = req_tx.hash;
            if (requested_tx_hashes.indexOf(hash) === -1) {
                requested_tx_hashes.push(hash);
            }
            else
                return false;
        }
        else
            return false;
        const tokens = tx.meta.request.bases.map(key => vr.crypto.slice_token_part(key)).filter((val, i, array) => array.indexOf(val) === i);
        const tokens_hash = vr.crypto.array2hash(tokens);
        const unit_buying_tokens_hash = vr.crypto.array2hash([vr.con.constant.unit, vr.con.constant.native]);
        if (tx.meta.kind === 0 && ((unit_mode && tokens_hash != unit_buying_tokens_hash) || (!unit_mode && tokens_hash === unit_buying_tokens_hash)))
            return true;
        else
            return false;
    });
    const sorted = choosed.slice().sort((a, b) => {
        const a_address = vr.tx.get_info_from_tx(a)[4];
        const b_address = vr.tx.get_info_from_tx(b)[4];
        if (unit_mode && a_address != my_address && b_address === my_address)
            return -1;
        else if (unit_mode && a_address === my_address && b_address != my_address)
            return 1;
        else if (big_integer_1.default(vr.tx.get_tx_fee(a), 16).lesser(big_integer_1.default(vr.tx.get_tx_fee(b), 16)))
            return 1;
        else
            return 0;
    });
    let tx_size;
    let size_sum = big_integer_1.default(0);
    const size_checked = sorted.reduce((txs, tx) => {
        if (big_integer_1.default(vr.con.constant.block_size).multiply(9).divide(10).lesser(size_sum))
            return txs;
        tx_size = big_integer_1.default(vr.tx.get_tx_fee(tx), 16).divide(tx.meta.request.feeprice);
        size_sum = big_integer_1.default(size_sum).add(tx_size);
        return txs.concat(tx);
    }, []);
    return size_checked;
};
exports.make_block = async (private_key, block_db, last_height, trie, state_db, lock_db, extra, pool_db, output_states) => {
    const my_pub = vr.crypto.private2public(private_key);
    const native_address = vr.crypto.generate_address(vr.con.constant.native, my_pub);
    const pre_key_block = await vr.block.search_key_block(block_db, last_height);
    const pre_micro_blocks = await vr.block.search_micro_block(block_db, pre_key_block, last_height);
    const key_validator = vr.block.get_info_from_block(pre_key_block)[4];
    if (native_address != key_validator || pre_micro_blocks.length >= vr.con.constant.max_blocks) {
        const key_block = await vr.block.create_key_block(private_key, block_db, last_height, trie, state_db, extra);
        if (!await vr.block.verify_key_block(key_block, block_db, trie, state_db, last_height))
            throw new Error('fail to create valid key block');
        return key_block;
    }
    else {
        const unit_mode = big_integer_1.default(last_height, 16).mod(3).eq(0);
        const unit_address = vr.crypto.generate_address(vr.con.constant.unit, my_pub);
        const txs = await choose_txs(unit_mode, trie, pool_db, lock_db, block_db, unit_address);
        let micro_block = await vr.block.create_micro_block(private_key, block_db, last_height, trie, txs, extra);
        const txs_hash = txs.map(tx => tx.hash);
        micro_block.txs.forEach(tx => {
            tx.additional.hash = micro_block.hash;
            tx.additional.height = micro_block.meta.height;
            tx.additional.index = txs_hash.indexOf(tx.hash);
        });
        if (!await vr.block.verify_micro_block(micro_block, output_states, block_db, trie, state_db, lock_db, last_height)) {
            const output_states_owners = output_states.map(s => s.owner);
            const invalid_tx_hashes = await P.reduce(micro_block.txs, async (result, tx) => {
                if (tx.meta.kind === 0 && !vr.tx.verify_req_tx(tx, trie, state_db, lock_db, [5])) {
                    return result.concat(tx.hash);
                }
                else if (tx.meta.kind === 1) {
                    const req_tx = await vr.tx.find_req_tx(tx, block_db);
                    const req_tx_address = vr.tx.get_info_from_tx(req_tx)[4];
                    const ref_tx_address = vr.tx.get_info_from_tx(tx)[4];
                    const req_base = [req_tx_address, ref_tx_address].concat(req_tx.meta.request.bases).filter((val, i, array) => array.indexOf(val) === i);
                    const output_for_tx = req_base.map(key => {
                        const i = output_states_owners.indexOf(key);
                        if (i === -1)
                            return vr.state.create_state("0", vr.crypto.slice_token_part(key), key, "0", []);
                        else
                            return output_states[i];
                    });
                    if (!await vr.tx.verify_ref_tx(tx, output_for_tx, block_db, trie, state_db, lock_db, last_height)) {
                        result.push(tx.hash);
                    }
                    return result;
                }
                else
                    return result;
            }, []);
            await P.forEach(invalid_tx_hashes, async (key) => {
                await pool_db.del(key);
            });
            if (invalid_tx_hashes.length > 0)
                throw new Error('remove invalid txs');
            else
                throw new Error('fail to create valid micro block');
        }
        return micro_block;
    }
};
exports.make_req_tx = async (tyep, bases, feeprice, gas, input, log, private_key, trie, state_db, lock_db) => {
    const tokens = bases.map(key => vr.crypto.slice_token_part(key)).filter((val, i, array) => array.indexOf(val) === i);
    if (tokens.some(t => t != vr.con.constant.native && t != vr.con.constant.unit))
        throw new Error('unsupported token');
    const tx = vr.tx.create_req_tx(tyep, bases, feeprice, gas, input, log, private_key);
    if (!await vr.tx.verify_req_tx(tx, trie, state_db, lock_db))
        throw new Error('fail to create valid request tx');
    return tx;
};
exports.compute_output = async (req_tx, trie, state_db, block_db, last_height) => {
    const tokens = req_tx.meta.request.bases.map(key => vr.crypto.slice_token_part(key)).filter((val, i, array) => array.indexOf(val) === i);
    const main_token = tokens[0];
    const public_keys = vr.tx.get_info_from_tx(req_tx)[3];
    const address = vr.crypto.generate_address(main_token, vr.crypto.merge_pub_keys(public_keys));
    const bases = [address].concat(req_tx.meta.request.bases).filter((val, i, array) => array.indexOf(val) === i);
    const base_states = await P.map(bases, async (key) => {
        return await vr.data.read_from_trie(trie, state_db, key, 0, vr.state.create_state("0", vr.crypto.slice_token_part(key), key));
    });
    const input_data = req_tx.meta.request.input;
    const output = await (async () => {
        if (main_token === vr.con.constant.native)
            return vr.contracts.native_prove(bases, base_states, input_data);
        else if (main_token === vr.con.constant.unit)
            return await vr.contracts.unit_prove(bases, base_states, input_data, block_db, last_height);
        else
            return [];
    })();
    const success = !output.some(s => vr.state.verify_state(s));
    if (success)
        return output;
    else
        return [];
};
exports.get_nonce = async (request, height, block_hash, refresher, output, unit_price) => {
    let nonce = big_integer_1.default(0);
    let flag = true;
    let hash = "";
    setTimeout(() => {
        nonce = big_integer_1.default(0);
        flag = false;
    }, 10000);
    while (1) {
        nonce = nonce.add(1);
        hash = await vr.tx.mining(request, height, block_hash, nonce.toString(16), refresher, output, unit_price);
        if (!flag || big_integer_1.default(hash, 16).lesserOrEquals(big_integer_1.default(vr.con.constant.pow_target, 16)))
            break;
    }
    return nonce.toString(16);
};
exports.make_ref_tx = async (height, index, gas_share, unit_price, private_key, block_db, trie, state_db, lock_db, last_height) => {
    const req_block = await block_db.read_obj(height);
    if (req_block == null || !vr.block.isBlock(req_block))
        throw new Error('invalid height');
    const req_tx = req_block.txs[index];
    if (req_tx == null || !vr.tx.isTx(req_tx))
        throw new Error('invalid index');
    const output = await exports.compute_output(req_tx, trie, state_db, block_db, last_height);
    const output_hashes = output.map(s => vr.crypto.array2hash([s.nonce, s.token, s.owner, s.amount].concat(s.data)));
    const output_hash = vr.crypto.array2hash(output_hashes);
    const success = output.length > 0 ? 1 : 0;
    const my_public = vr.crypto.private2public(private_key);
    const my_address = vr.crypto.generate_address(vr.con.constant.unit, my_public);
    const nonce = await exports.get_nonce(req_tx.hash, height, req_block.hash, my_address, output_hash, unit_price);
    if (nonce === "0")
        throw new Error('fail to get valid nonce');
    const ref_tx = vr.tx.create_ref_tx(height, index, success, output_hashes, [], nonce, gas_share, unit_price, private_key);
    if (!vr.tx.verify_ref_tx(ref_tx, output, block_db, trie, state_db, lock_db, last_height))
        throw new Error('fail to create valid refresh tx');
    return ref_tx;
};
//# sourceMappingURL=work.js.map