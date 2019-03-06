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
const share_data_1 = __importDefault(require("../share/share_data"));
const block_1 = require("../genesis/block");
const work_1 = require("./work");
const math = __importStar(require("mathjs"));
const awaitify_stream_1 = __importDefault(require("awaitify-stream"));
math.config({
    number: 'BigNumber'
});
const native = vr.con.constant.native;
const unit = vr.con.constant.unit;
const state_trie_db = levelup_1.default(leveldown_1.default(`./db/net_id_${vr.con.constant.my_net_id}/state_trie`));
const lock_trie_db = levelup_1.default(leveldown_1.default(`./db/net_id_${vr.con.constant.my_net_id}/lock_trie`));
const state_db = levelup_1.default(leveldown_1.default(`./db/net_id_${vr.con.constant.my_net_id}/state`));
const lock_db = levelup_1.default(leveldown_1.default(`./db/net_id_${vr.con.constant.my_net_id}/lock`));
const block_db = levelup_1.default(leveldown_1.default(`./db/net_id_${vr.con.constant.my_net_id}/block`));
const tx_db = levelup_1.default(leveldown_1.default(`./db/net_id_${vr.con.constant.my_net_id}/tx_pool`));
const root_db = levelup_1.default(leveldown_1.default(`./db/net_id_${vr.con.constant.my_net_id}/root`));
const unit_db = levelup_1.default(leveldown_1.default(`./db/net_id_${vr.con.constant.my_net_id}/unit_store`));
const peer_list_db = levelup_1.default(leveldown_1.default(`./db/net_id_${vr.con.constant.my_net_id}/peer_list`));
class Trie extends vr.trie {
}
exports.state_trie_ins = (root) => {
    try {
        return new vr.trie(state_trie_db, root);
    }
    catch (e) {
        console.log(e);
        return new vr.trie(state_trie_db);
    }
};
exports.lock_trie_ins = (root) => {
    try {
        return new vr.trie(lock_trie_db, root);
    }
    catch (e) {
        console.log(e);
        return new vr.trie(lock_trie_db);
    }
};
const read_obj_from_db = async (db, key) => JSON.parse((await db.get(key)).toString('utf-8'));
const write_obj_to_db = async (db, key, obj) => await db.put(key, Buffer.from(JSON.stringify(obj), 'utf-8'));
const del_obj_from_db = async (db, key) => await db.del(key);
const output_keys = (tx) => {
    if (tx.meta.kind === "request")
        return [];
    const states = tx.raw.raw.map(r => JSON.parse(r));
    return states.map(s => s.owner);
};
const pays = (tx, chain) => {
    if (tx.meta.kind === "request") {
        const requester = vr.crypto.generate_address(native, vr.crypto.merge_pub_keys(tx.meta.pub_key));
        return [requester];
    }
    else if (tx.meta.kind === "refresh") {
        const req_tx = vr.tx.find_req_tx(tx, chain);
        const requester = vr.crypto.generate_address(native, vr.crypto.merge_pub_keys(req_tx.meta.pub_key));
        const refresher = vr.crypto.generate_address(native, vr.crypto.merge_pub_keys(tx.meta.pub_key));
        return [requester, refresher];
    }
    else
        return [];
};
exports.read_state = async (S_Trie, key, empty) => {
    try {
        const hash = await S_Trie.get(key);
        if (hash == null)
            return empty;
        const state = await read_obj_from_db(state_db, hash || '');
        if (state == null)
            return empty;
        else
            return state;
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.write_state = async (state) => {
    try {
        const hash = vr.crypto.object_hash(state);
        await write_obj_to_db(state_db, hash, state);
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.put_state_to_trie = async (S_Trie, hash, kind, key) => {
    try {
        if (kind === 'state')
            await S_Trie.put(key, hash);
        else if (kind === 'info')
            await S_Trie.put(key, hash);
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.read_lock = async (L_Trie, key, empty) => {
    try {
        const hash = await L_Trie.get(key);
        if (hash == null)
            return empty;
        const lock = await read_obj_from_db(lock_db, hash || '');
        if (hash == null)
            return empty;
        else
            return lock;
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.write_lock = async (lock) => {
    try {
        const hash = vr.crypto.object_hash(lock);
        await write_obj_to_db(lock_db, hash, lock);
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.put_lock_to_trie = async (L_Trie, hash, key) => {
    try {
        await L_Trie.put(key, hash);
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.get_tx_statedata = async (tx, chain, S_Trie) => {
    try {
        const base = tx.meta.bases;
        const base_states = await P.reduce(base, async (result, key) => {
            const state = await exports.read_state(S_Trie, key, vr.state.create_state(0, key, key.split(':')[1], 0));
            return result.concat(state);
        }, []);
        const outputs = output_keys(tx);
        const output_states = await P.reduce(outputs, async (result, key) => {
            const hash = await S_Trie.get(key);
            const getted = await read_obj_from_db(state_db, hash || '');
            const token = key.split(':')[1];
            if (hash == null || getted == null)
                return result.concat(vr.state.create_state(0, key, token, 0));
            else
                return result.concat(getted);
        }, []);
        const payes = pays(tx, chain);
        const pay_states = await P.reduce(payes, async (result, key) => {
            const state = await exports.read_state(S_Trie, key, vr.state.create_state(0, key, native, 0));
            return result.concat(state);
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
            if (!vr.crypto.verify_address(key))
                return array;
            const new_loc = {
                address: key,
                state: 'yet',
                height: 0,
                block_hash: vr.crypto.hash(''),
                index: 0,
                tx_hash: vr.crypto.hash('')
            };
            const lock = await exports.read_lock(L_Trie, key, new_loc);
            return array.concat(lock);
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
        const native_validator = vr.crypto.generate_address(native, vr.crypto.merge_pub_keys(validatorPub));
        const native_validator_state = await exports.read_state(S_Trie, native_validator, vr.state.create_state(0, native_validator, native));
        const txs = block.txs.map(tx => vr.tx.pure2tx(tx, block));
        const tx_states = await P.reduce(txs, async (result, tx) => result.concat(await exports.get_tx_statedata(tx, chain, S_Trie)), []);
        let all_units = [];
        await S_Trie.filter(async (hash) => {
            const state = await read_obj_from_db(state_db, hash);
            if (state != null && vr.state.isState(state) && state.kind === "state" && state.token === unit) {
                all_units.push(state);
                return true;
            }
            else
                return false;
        });
        const native_token = await exports.read_state(S_Trie, native, vr.state.create_info(0, native));
        const unit_token = await exports.read_state(S_Trie, unit, vr.state.create_info(0, unit));
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
        const native_address = vr.crypto.generate_address(native, vr.crypto.merge_pub_keys(validatorPub));
        const unit_address = vr.crypto.generate_address(unit, vr.crypto.merge_pub_keys(validatorPub));
        const native_validator = await exports.read_lock(L_Trie, native_address, {
            address: native_address,
            state: 'yet',
            height: 0,
            block_hash: vr.crypto.hash(''),
            index: 0,
            tx_hash: vr.crypto.hash('')
        });
        const unit_validator = await exports.read_lock(L_Trie, unit_address, {
            address: unit_address,
            state: 'yet',
            height: 0,
            block_hash: vr.crypto.hash(''),
            index: 0,
            tx_hash: vr.crypto.hash('')
        });
        const concated = tx_loc.concat(native_validator).concat(unit_validator).filter(lock => lock != null);
        const hashes = concated.map(l => vr.crypto.object_hash(l));
        return concated.filter((val, i) => hashes.indexOf(vr.crypto.object_hash(val)) === i);
    }
    catch (e) {
        console.log(e);
        return [];
    }
};
exports.get_native_balance = async (address, S_Trie) => {
    try {
        const state = await exports.read_state(S_Trie, address, vr.state.create_state(0, address));
        return state.amount;
    }
    catch (e) {
        console.log(e);
        return 0;
    }
};
exports.read_chain_info = async () => {
    try {
        const info = await read_obj_from_db(block_db, 'info');
        if (info)
            return info;
        return {
            net_id: vr.con.constant.my_net_id,
            chain_id: vr.con.constant.my_chain_id,
            version: vr.con.constant.my_version,
            compatible_version: vr.con.constant.compatible_version,
            last_height: -1,
            last_hash: '',
            pos_diffs: []
        };
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.write_chain_info = async (info) => {
    try {
        await write_obj_to_db(block_db, 'info', info);
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.read_chain = async (max_size) => {
    try {
        const pre_chain = share_data_1.default.chain;
        const info = await read_obj_from_db(block_db, 'info');
        if (pre_chain.length - 1 >= info.last_height && pre_chain[pre_chain.length - 1] != null && pre_chain[pre_chain.length - 1].hash === info.last_hash) {
            return pre_chain;
        }
        let chain = [];
        let block;
        let size_sum = 0;
        let i;
        for (i = info.last_height; i >= 0; i--) {
            block = await read_obj_from_db(block_db, i.toString());
            size_sum = math.chain(size_sum).add(Buffer.from(JSON.stringify(block)).length).done();
            if (pre_chain[info.last_height - i] != null && pre_chain[info.last_height - i].hash === block.hash) {
                const reversed = chain.reverse();
                chain = pre_chain.concat(reversed);
                break;
            }
            if (size_sum > max_size) {
                chain.reverse();
                break;
            }
            else
                chain.push(block);
            if (i === 0) {
                chain.reverse();
                break;
            }
        }
        return chain;
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.write_chain = async (block) => {
    try {
        const info = await read_obj_from_db(block_db, 'info');
        const height = block.meta.height;
        const new_info = work_1.new_obj(info, i => {
            i.last_height = height;
            i.last_hash = block.hash;
            i.pos_diffs.push(block.meta.pos_diff);
            return i;
        });
        await write_obj_to_db(block_db, height.toString(), block);
        await write_obj_to_db(block_db, 'info', new_info);
        share_data_1.default.chain.push(block);
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.back_chain = async (height) => {
    try {
        if (share_data_1.default.chain.length - 1 === height)
            return 0;
        const info = await read_obj_from_db(block_db, 'info');
        let i;
        for (i = height + 1; i <= info.last_height; i++) {
            try {
                await del_obj_from_db(block_db, i.toString());
            }
            catch (e) {
                continue;
            }
        }
        const backed_chain = share_data_1.default.chain.slice(0, height + 1);
        const new_info = work_1.new_obj(info, info => {
            const last_block = backed_chain[backed_chain.length - 1] || block_1.genesis_block;
            info.last_height = height;
            info.last_hash = last_block.hash;
            info.pos_diffs = info.pos_diffs.slice(0, height + 1);
            return info;
        });
        await write_obj_to_db(block_db, 'info', new_info);
        const post_block = share_data_1.default.chain[height + 1];
        const new_roots = {
            stateroot: post_block.meta.stateroot,
            lockroot: post_block.meta.lockroot
        };
        await write_obj_to_db(root_db, 'root', new_roots);
        share_data_1.default.chain = backed_chain;
        return 1;
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.reset_chain = async () => {
    try {
        const info = await exports.read_chain_info().catch(e => {
            return {
                net_id: vr.con.constant.my_net_id,
                chain_id: vr.con.constant.my_chain_id,
                version: vr.con.constant.my_version,
                compatible_version: vr.con.constant.compatible_version,
                last_height: -1,
                last_hash: '',
                pos_diffs: []
            };
        });
        let i;
        for (i = 0; i <= info.last_height; i++) {
            await del_obj_from_db(block_db, i.toString());
        }
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.read_pool = async (max_size) => {
    try {
        const mem_pool = share_data_1.default.pool;
        let txnames = [];
        let reader = awaitify_stream_1.default.createReader(tx_db.createKeyStream());
        let name = '';
        while (null !== (name = await reader.readAsync())) {
            txnames.push(name.toString());
        }
        let size = 0;
        let tx;
        let pool = {};
        for (name of txnames) {
            if (mem_pool[name] != null) {
                pool[name] = mem_pool[name];
                continue;
            }
            tx = await read_obj_from_db(tx_db, name);
            if (size + Buffer.from(JSON.stringify(tx)).length > max_size)
                break;
            pool[tx.hash] = tx;
        }
        return pool;
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.write_pool = async (pool) => {
    try {
        let txnames = [];
        let reader = awaitify_stream_1.default.createReader(tx_db.createKeyStream());
        let name = '';
        while (null !== (name = await reader.readAsync())) {
            txnames.push(name.toString());
        }
        const tx_names = Object.keys(pool);
        const for_save = tx_names.filter(name => txnames.indexOf(name) === -1);
        const for_del = txnames.filter(name => tx_names.indexOf(name) === -1);
        let tx;
        for (name of txnames) {
            if (for_del.indexOf(name) != -1) {
                delete share_data_1.default.pool[name];
                await del_obj_from_db(tx_db, name);
            }
        }
        for (name of tx_names) {
            if (for_save.indexOf(name) != -1) {
                tx = pool[name];
                share_data_1.default.pool[name] = tx;
                await write_obj_to_db(tx_db, name, tx);
            }
        }
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.empty_pool = async () => {
    try {
        let txnames = [];
        let reader = awaitify_stream_1.default.createReader(tx_db.createKeyStream());
        let name = '';
        while (null !== (name = await reader.readAsync())) {
            txnames.push(name.toString());
        }
        for (name of txnames) {
            await del_obj_from_db(tx_db, name);
        }
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.read_root = async () => {
    try {
        const roots = await read_obj_from_db(root_db, 'root');
        return roots;
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.write_root = async (roots) => {
    try {
        await write_obj_to_db(root_db, 'root', roots);
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.read_unit = async (key) => {
    try {
        return await read_obj_from_db(unit_db, key);
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.write_unit = async (unit) => {
    try {
        const iden_hash = vr.crypto.hash(unit.request + unit.height.toString(16) + unit.block_hash + unit.address);
        await write_obj_to_db(unit_db, iden_hash, unit);
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.del_unit = async (unit) => {
    try {
        const iden_hash = vr.crypto.hash(unit.request + unit.height.toString(16) + unit.block_hash + unit.address);
        await del_obj_from_db(unit_db, iden_hash);
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.get_unit_store = async () => {
    try {
        let store = {};
        let reader = awaitify_stream_1.default.createReader(unit_db.createReadStream());
        let data;
        while (null !== (data = await reader.readAsync())) {
            store[data.key.toString()] = JSON.parse(data.value.toString());
        }
        return store;
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.read_peer = async (ip) => {
    try {
        return await read_obj_from_db(peer_list_db, ip);
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.write_peer = async (peer) => {
    try {
        await write_obj_to_db(peer_list_db, peer.ip, peer);
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.del_peer = async (ip) => {
    try {
        await del_obj_from_db(peer_list_db, ip);
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.get_peer_list = async () => {
    try {
        let list = [];
        let reader = awaitify_stream_1.default.createReader(peer_list_db.createReadStream());
        let data;
        while (null !== (data = await reader.readAsync())) {
            list.push(JSON.parse(data.value.toString()));
        }
        return list;
    }
    catch (e) {
        throw new Error(e);
    }
};
//# sourceMappingURL=data.js.map