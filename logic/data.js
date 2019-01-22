"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const levelup_1 = __importDefault(require("levelup"));
const leveldown_1 = __importDefault(require("leveldown"));
const P = __importStar(require("p-iteration"));
const vr = __importStar(require("vreath"));
const native = vr.con.constant.native;
const unit = vr.con.constant.unit;
const state_db = levelup_1.default(leveldown_1.default('state_trie'));
const lock_db = levelup_1.default(leveldown_1.default('lock_trie'));
class Trie extends vr.trie {
}
exports.state_trie_ins = (root) => {
    try {
        return new vr.trie(state_db, root);
    }
    catch (e) {
        console.log(e);
        return new vr.trie(state_db);
    }
};
exports.lock_trie_ins = (root) => {
    try {
        return new vr.trie(lock_db, root);
    }
    catch (e) {
        console.log(e);
        return new vr.trie(lock_db);
    }
};
const output_keys = (tx) => {
    if (tx.meta.kind === "request")
        return [];
    const states = tx.raw.raw.map(r => JSON.parse(r));
    return states.map(s => s.owner);
};
const pays = (tx, chain) => {
    if (tx.meta.kind === "request") {
        const requester = vr.crypto.genereate_address(native, vr.crypto.merge_pub_keys(tx.meta.pub_key));
        return [requester];
    }
    else if (tx.meta.kind === "refresh") {
        const req_tx = vr.tx.find_req_tx(tx, chain);
        const requester = vr.crypto.genereate_address(native, vr.crypto.merge_pub_keys(req_tx.meta.pub_key));
        const refresher = vr.crypto.genereate_address(native, vr.crypto.merge_pub_keys(tx.meta.pub_key));
        return [requester, refresher];
    }
    else
        return [];
};
exports.get_tx_statedata = async (tx, chain, S_Trie) => {
    try {
        const base = tx.meta.bases;
        const base_states = await P.reduce(base, async (result, key) => {
            const getted = await S_Trie.get(key);
            if (getted == null)
                return result.concat(vr.state.create_state(0, key, key.split(':')[1], 0));
            else
                return result.concat(getted);
        }, []);
        const outputs = output_keys(tx);
        const output_states = await P.reduce(outputs, async (result, key) => {
            const getted = await S_Trie.get(key);
            const token = key.split(':')[1];
            if (getted == null)
                return result.concat(vr.state.create_state(0, key, token, 0));
            else
                return result.concat(getted);
        }, []);
        const payes = pays(tx, chain);
        const pay_states = await P.reduce(payes, async (result, key) => {
            const getted = await S_Trie.get(key);
            if (getted == null)
                return result.concat(vr.state.create_state(0, key, native, 0));
            else
                return result.concat(getted);
        }, []);
        const concated = base_states.concat(output_states).concat(pay_states);
        const hashes = concated.map(state => vr.crypto.object_hash(state));
        return concated.filter((val, i) => hashes.indexOf(vr.crypto.object_hash(val)) === i);
    }
    catch (e) {
        return [];
    }
};
exports.get_tx_lockdata = async (tx, chain, L_Trie) => {
    try {
        const target = (() => {
            if (tx.meta.kind === "request")
                return tx;
            else
                return vr.tx.find_req_tx(tx, chain);
        })();
        const keys = target.meta.bases.filter((val, i, array) => array.indexOf(val) === i);
        const result = await P.reduce(keys, async (array, key) => {
            if (vr.crypto.verify_address(key))
                return array;
            const getted = await L_Trie.get(key);
            if (getted == null) {
                const new_loc = {
                    address: key,
                    state: 'yet',
                    height: 0,
                    block_hash: vr.crypto.hash(''),
                    index: 0,
                    tx_hash: vr.crypto.hash('')
                };
                return array.concat(new_loc);
            }
            else
                return array.concat(getted);
        }, []);
        return result;
    }
    catch (e) {
        console.log(e);
        return [];
    }
};
exports.get_block_statedata = async (block, chain, S_Trie) => {
    try {
        const validatorPub = (() => {
            if (block.meta.kind === 'key')
                return block.meta.validatorPub;
            else
                return vr.block.search_key_block(chain).meta.validatorPub;
        })();
        const native_validator = vr.crypto.genereate_address(native, vr.crypto.merge_pub_keys(validatorPub));
        const native_validator_state = await S_Trie.get(native_validator) || vr.state.create_state(0, native_validator, native);
        const txs = block.txs.map(tx => vr.tx.pure2tx(tx, block));
        const tx_states = await P.reduce(txs, async (result, tx) => result.concat(await exports.get_tx_statedata(tx, chain, S_Trie)), []);
        const all_units = await S_Trie.filter((state) => vr.state.isState(state) && state.kind === "state" && state.token === unit);
        const native_token = await S_Trie.get(native) || vr.state.create_info(0, native);
        const unit_token = await S_Trie.get(unit) || vr.state.create_info(0, unit);
        const concated = tx_states.concat(native_validator_state).concat(all_units).concat(native_token).concat(unit_token);
        const hashes = concated.map(s => vr.crypto.object_hash(s));
        return concated.filter((val, i) => hashes.indexOf(vr.crypto.object_hash(val)) === i);
    }
    catch (e) {
        console.log(e);
        return [];
    }
};
exports.get_block_lockdata = async (block, chain, L_Trie) => {
    try {
        const txs = block.txs.map(tx => vr.tx.pure2tx(tx, block));
        const tx_loc = await P.reduce(txs, async (result, tx) => {
            return result.concat(await exports.get_tx_lockdata(tx, chain, L_Trie));
        }, []);
        const validatorPub = (() => {
            if (block.meta.kind === 'key')
                return block.meta.validatorPub;
            else
                return vr.block.search_key_block(chain).meta.validatorPub;
        })();
        const native_validator = await L_Trie.get(vr.crypto.genereate_address(native, vr.crypto.merge_pub_keys(validatorPub)));
        const unit_validator = await L_Trie.get(vr.crypto.genereate_address(unit, vr.crypto.merge_pub_keys(validatorPub)));
        const concated = tx_loc.concat(native_validator).concat(unit_validator).filter(lock => lock != null);
        const hashes = concated.map(l => vr.crypto.object_hash(l));
        return concated.filter((val, i) => hashes.indexOf(vr.crypto.object_hash(val)) === i);
    }
    catch (e) {
        console.log(e);
        return [];
    }
};
//# sourceMappingURL=data.js.map