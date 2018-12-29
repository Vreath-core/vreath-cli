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
const data = __importStar(require("./data"));
const P = __importStar(require("p-iteration"));
const math = __importStar(require("mathjs"));
const fs = __importStar(require("fs"));
const util_1 = require("util");
math.config({
    number: 'BigNumber'
});
class Trie extends vr.trie {
}
exports.sleep = (msec) => {
    return new Promise(function (resolve) {
        setTimeout(function () { resolve(); }, msec);
    });
};
const choose_txs = async (pool, L_Trie) => {
    const pool_txs = Object.keys(pool).map(key => pool[key]);
    const requested_bases = (await L_Trie.filter((val) => {
        const getted = val;
        if (getted != null && getted.state === "already")
            return true;
        else
            return false;
    })).map(l => l.address);
    const not_same = pool_txs.reduce((result, tx) => {
        const bases = result.reduce((r, t) => {
            if (t.meta.kind === "request")
                return r.concat(t.meta.bases);
            else
                return r;
        }, requested_bases);
        const requests = result.reduce((r, t) => {
            if (t.meta.kind === "refresh")
                return r.concat(t.meta.req_tx_hash);
            else
                return r;
        }, []);
        if (tx.meta.kind === "request" && !bases.some(b => tx.meta.bases.indexOf(b) != -1))
            return result.concat(tx);
        else if (tx.meta.kind === "refresh" && requests.indexOf(tx.meta.req_tx_hash) === -1)
            return result.concat(tx);
        else
            return result;
    }, []);
    let size_sum = 0;
    const sorted = not_same.slice().sort((a, b) => {
        return math.chain(vr.tx.get_tx_fee(b)).subtract(vr.tx.get_tx_fee(a)).done();
    });
    const choosed = sorted.reduce((txs, tx) => {
        if (math.chain(vr.con.constant.block_size).multiply(0.9).smaller(size_sum).done())
            return txs;
        size_sum = math.chain(size_sum).add(Buffer.from(JSON.stringify(tx)).length).done();
        return txs.concat(tx);
    }, []);
    return choosed;
};
exports.make_block = async (chain, pubs, stateroot, lockroot, extra, pool, private_key, public_key, S_Trie, L_Trie) => {
    try {
        const pre_key_block = vr.block.search_key_block(chain);
        const pre_micro_blocks = vr.block.search_micro_block(chain, pre_key_block);
        if (vr.crypto.merge_pub_keys(pre_key_block.meta.validatorPub) != vr.crypto.merge_pub_keys(pubs) || pre_micro_blocks.length >= vr.con.constant.max_blocks) {
            const key_block = vr.block.create_key_block(chain, pubs, stateroot, lockroot, extra, public_key, private_key);
            const StateData = await data.get_block_statedata(key_block, chain, S_Trie);
            if (!vr.block.verify_key_block(key_block, chain, stateroot, lockroot, StateData))
                throw new Error('fail to create valid block');
            return key_block;
        }
        else {
            const txs = await choose_txs(pool, L_Trie);
            const micro_block = vr.block.create_micro_block(chain, stateroot, lockroot, txs, extra, private_key, public_key);
            const StateData = await data.get_block_statedata(micro_block, chain, S_Trie);
            const LockData = await data.get_block_lockdata(micro_block, chain, L_Trie);
            if (!vr.block.verify_micro_block(micro_block, chain, stateroot, lockroot, StateData, LockData)) {
                const invalid_tx_hashes = await P.reduce(micro_block.txs, async (result, pure) => {
                    const tx = vr.tx.pure2tx(pure, micro_block);
                    const s_data = await data.get_tx_statedata(tx, chain, S_Trie);
                    const l_data = await data.get_tx_lockdata(tx, chain, L_Trie);
                    if (tx.meta.kind === 'request' && !vr.tx.verify_req_tx(tx, false, s_data, l_data))
                        return result.concat(tx.hash);
                    else if (tx.meta.kind === 'refresh' && !vr.tx.verify_ref_tx(tx, chain, true, s_data, l_data))
                        return result.concat(tx.hash);
                    else
                        return result;
                }, []);
                const pool = JSON.parse(await util_1.promisify(fs.readFile)('./json/pool.json', 'utf-8'));
                const new_pool = Object.keys(pool).filter(key => invalid_tx_hashes.indexOf(key) === -1).reduce((res, key) => {
                    res[key] = pool[key];
                    return res;
                }, {});
                await util_1.promisify(fs.writeFile)('./json/pool.json', JSON.stringify(new_pool, null, 4), 'utf-8');
                throw new Error('remove invalid txs');
            }
            return micro_block;
        }
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.make_req_tx = async (pubs, type, tokens, bases, feeprice, gas, input_raw, log, private_key, public_key, chain, S_Trie, L_Trie) => {
    try {
        if (tokens.some(t => t != vr.con.constant.native && t != vr.con.constant.unit))
            throw new Error('unsupported token');
        const tx = vr.tx.create_req_tx(pubs, type, tokens, bases, feeprice, gas, input_raw, log, private_key, public_key);
        const StateData = await data.get_tx_statedata(tx, chain, S_Trie);
        const LockData = await data.get_tx_lockdata(tx, chain, L_Trie);
        if (!vr.tx.verify_req_tx(tx, true, StateData, LockData))
            throw new Error('fail to create valid request tx');
        return tx;
    }
    catch (e) {
        throw new Error(e);
    }
};
const get_nonce = (request, height, block_hash, refresher, output, unit_price) => {
    let nonce = 0;
    while (!vr.tx.mining(request, height, block_hash, refresher, output, unit_price, nonce)) {
        nonce++;
    }
    return nonce;
};
exports.make_ref_tx = async (pubs, feeprice, unit_price, height, index, log, private_key, public_key, chain, S_Trie, L_Trie) => {
    try {
        const target_block = chain[height] || vr.block.empty_block;
        const req_tx_pure = target_block.txs[index] || vr.tx.empty_tx;
        const req_tx = vr.tx.pure2tx(req_tx_pure, target_block);
        const pre_StateData = await P.reduce(req_tx.meta.bases, async (result, key) => {
            const getted = await S_Trie.get(key);
            if (getted == null)
                return result;
            else
                return result.concat(getted);
        }, []);
        const computed = req_tx.meta.tokens.reduce((result, token) => {
            const base_states = pre_StateData.filter(s => s.kind === 'state' && s.token === token);
            if (token === vr.con.constant.native)
                return result.concat(vr.tx.native_contract(base_states, req_tx));
            else if (token === vr.con.constant.unit)
                return result.concat(vr.tx.unit_contract(pre_StateData, req_tx, chain));
            else
                return result;
        }, []);
        const success = !computed.some(s => vr.state.verify_state(s));
        const output = (() => {
            if (success)
                return computed;
            else
                return pre_StateData;
        })();
        const refresher = vr.crypto.genereate_address(vr.con.constant.unit, vr.crypto.merge_pub_keys(pubs));
        const nonce = get_nonce(req_tx.hash, height, target_block.hash, refresher, vr.crypto.object_hash(output), unit_price);
        const tx = vr.tx.create_ref_tx(pubs, feeprice, unit_price, height, target_block.hash, index, req_tx_pure.hash, success, nonce, output.map(s => JSON.stringify(s)), log, chain, private_key, public_key);
        const StateData = await data.get_tx_statedata(tx, chain, S_Trie);
        const LockData = await data.get_tx_lockdata(tx, chain, L_Trie);
        if (!vr.tx.verify_ref_tx(tx, chain, true, StateData, LockData))
            throw new Error('fail to create valid request tx');
        return tx;
    }
    catch (e) {
        throw new Error(e);
    }
};
