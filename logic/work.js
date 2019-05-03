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
const data = __importStar(require("./data"));
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
    let choosed = [];
    await pool_db.filter('hex', 'utf8', async (key, tx) => {
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
        const unit_buying_tokens_hash = vr.crypto.array2hash([("0000000000000000" + vr.con.constant.unit).slice(-16), ("0000000000000000" + vr.con.constant.native).slice(-12)]);
        if (tx.meta.kind === 1 || ((unit_mode && tokens_hash === unit_buying_tokens_hash) || (!unit_mode && tokens_hash != unit_buying_tokens_hash)))
            choosed.push(tx);
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
        const meta = tx.meta;
        const sign = tx.signature.map(s => s.data + s.v);
        const array = vr.tx.tx_meta2array(meta).splice(2, 1).concat(tx.hash).concat(sign);
        tx_size = array.reduce((sum, item) => {
            return sum.add(Math.ceil(Buffer.from(item, 'hex').length));
        }, big_integer_1.default(0));
        size_sum = big_integer_1.default(size_sum).add(tx_size);
        return txs.concat(tx);
    }, []);
    return size_checked;
};
exports.make_block = async (private_key, block_db, last_height, trie, state_db, lock_db, extra, pool_db, output_db) => {
    const my_pub = vr.crypto.private2public(private_key);
    const native_address = vr.crypto.generate_address(vr.con.constant.native, my_pub);
    const pre_key_block = await vr.block.search_key_block(block_db, last_height);
    const pre_micro_blocks = await vr.block.search_micro_block(block_db, pre_key_block, last_height);
    const key_validator = vr.block.get_info_from_block(pre_key_block)[4];
    if (native_address != key_validator || pre_micro_blocks.length >= vr.con.constant.max_blocks) {
        //console.log('key');
        const key_block = await vr.block.create_key_block(private_key, block_db, last_height, trie, state_db, extra);
        if (!await vr.block.verify_key_block(key_block, block_db, trie, state_db, last_height))
            throw new Error('fail to create valid key block');
        return [key_block, []];
    }
    else {
        const unit_mode = big_integer_1.default(last_height, 16).add(1).mod(3).eq(0);
        const unit_address = vr.crypto.generate_address(vr.con.constant.unit, my_pub);
        const unit_state = await vr.data.read_from_trie(trie, data.state_db, unit_address, 0, vr.state.create_state("00", vr.con.constant.unit, unit_address));
        //if(unit_state!=null) console.log(bigInt(unit_state.amount,16).toString());
        const txs = await choose_txs(unit_mode, trie, pool_db, lock_db, block_db, unit_address);
        let micro_block = await vr.block.create_micro_block(private_key, block_db, last_height, trie, txs, extra);
        const txs_hash = txs.map(tx => tx.hash);
        micro_block.txs.forEach(tx => {
            tx.additional.hash = micro_block.hash;
            tx.additional.height = micro_block.meta.height;
            tx.additional.index = txs_hash.indexOf(tx.hash);
        });
        const output_states = await P.reduce(txs_hash, async (res, key, i) => {
            if (txs[i] === null || txs[i].meta.kind === 0)
                return res;
            const get = await data.output_db.read_obj(key);
            if (get == null) {
                await data.tx_db.del(key);
                throw new Error('output state is not found');
            }
            return res.concat(get);
        }, []);
        if (!await vr.block.verify_micro_block(micro_block, output_states, block_db, trie, state_db, lock_db, last_height)) {
            const invalid_tx_hashes = await P.reduce(micro_block.txs, async (result, tx) => {
                if (tx.meta.kind === 0 && !vr.tx.verify_req_tx(tx, trie, state_db, lock_db, [5])) {
                    return result.concat(tx.hash);
                }
                else if (tx.meta.kind === 1) {
                    const output_for_tx = await data.output_db.read_obj(tx.hash);
                    if (output_for_tx == null) {
                        result.push(tx.hash);
                    }
                    if (output_for_tx != null && !await vr.tx.verify_ref_tx(tx, output_for_tx, block_db, trie, state_db, lock_db, last_height)) {
                        //console.log('invalid');
                        result.push(tx.hash);
                    }
                    return result;
                }
                else
                    return result;
            }, []);
            await P.forEach(invalid_tx_hashes, async (key) => {
                await pool_db.del(key);
                await output_db.del(key);
            });
            if (invalid_tx_hashes.length > 0)
                throw new Error('remove invalid txs');
            else
                throw new Error('fail to create valid micro block');
        }
        //console.log('micro');
        return [micro_block, output_states];
    }
};
exports.make_req_tx = async (tyep, bases, feeprice, gas, input, log, private_key, trie, state_db, lock_db) => {
    const tokens = bases.map(key => vr.crypto.slice_token_part(key)).filter((val, i, array) => array.indexOf(val) === i);
    if (tokens.some(t => big_integer_1.default(t, 16).notEquals(big_integer_1.default(vr.con.constant.native)) && big_integer_1.default(t, 16).notEquals(big_integer_1.default(vr.con.constant.unit))))
        throw new Error('unsupported token');
    const tx = vr.tx.create_req_tx(tyep, bases, feeprice, gas, input, log, private_key);
    if (!await vr.tx.verify_req_tx(tx, trie, state_db, lock_db))
        throw new Error('fail to create valid request tx');
    return tx;
};
exports.compute_output = async (req_tx, trie, state_db, block_db) => {
    const tokens = req_tx.meta.request.bases.map(key => vr.crypto.slice_token_part(key)).filter((val, i, array) => array.indexOf(val) === i);
    const main_token = tokens[0];
    const bases = req_tx.meta.request.bases.filter((val, i, array) => array.indexOf(val) === i);
    const base_states = await P.map(bases, async (key) => {
        return await vr.data.read_from_trie(trie, state_db, key, 0, vr.state.create_state("00", vr.crypto.slice_token_part(key), key));
    });
    const input_data = req_tx.meta.request.input;
    const output = await (async () => {
        if (big_integer_1.default(main_token, 16).eq(big_integer_1.default(vr.con.constant.native, 16)))
            return vr.contracts.native_prove(bases, base_states, input_data);
        else if (big_integer_1.default(main_token, 16).eq(big_integer_1.default(vr.con.constant.unit, 16)))
            return await vr.contracts.unit_prove(bases, base_states, input_data, block_db, req_tx.additional.height);
        else
            return [];
    })();
    const success = !output.some(s => !vr.state.verify_state(s)) ? 1 : 0;
    const return_state = success === 1 ? output : [];
    return [success, return_state];
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
        hash = await vr.tx.mining(request, height, block_hash, vr.crypto.bigint2hex(nonce), refresher, output, unit_price);
        if (!flag || big_integer_1.default(hash, 16).lesserOrEquals(big_integer_1.default(vr.con.constant.pow_target, 16)))
            break;
    }
    return vr.crypto.bigint2hex(nonce);
};
exports.make_ref_tx = async (height, index, gas_share, unit_price, private_key, block_db, trie, state_db, lock_db, last_height) => {
    const req_block = await block_db.read_obj(height);
    if (req_block == null || !vr.block.isBlock(req_block))
        throw new Error('invalid height');
    const req_tx = req_block.txs[index];
    if (req_tx == null || !vr.tx.isTx(req_tx))
        throw new Error('invalid index');
    const computed = await exports.compute_output(req_tx, trie, state_db, block_db);
    const success = computed[0];
    const output = computed[1];
    const output_hashes = output.map(s => vr.crypto.array2hash([s.nonce, s.token, s.owner, s.amount].concat(s.data)));
    const output_hash = vr.crypto.array2hash(output_hashes);
    const my_public = vr.crypto.private2public(private_key);
    const my_address = vr.crypto.generate_address(vr.con.constant.unit, my_public);
    const nonce = await exports.get_nonce(req_tx.hash, height, req_block.hash, my_address, output_hash, unit_price);
    if (nonce === "00")
        throw new Error('fail to get valid nonce');
    const ref_tx = vr.tx.create_ref_tx(height, index, success, output_hashes, [], nonce, gas_share, unit_price, private_key);
    if (!vr.tx.verify_ref_tx(ref_tx, output, block_db, trie, state_db, lock_db, last_height))
        throw new Error('fail to create valid refresh tx');
    return [ref_tx, output];
};
