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
const data = __importStar(require("./data"));
const works = __importStar(require("./work"));
const tx_routes = __importStar(require("../app/routes/tx"));
const P = __importStar(require("p-iteration"));
const bunyan_1 = __importDefault(require("bunyan"));
const path = __importStar(require("path"));
const util_1 = require("util");
const big_integer_1 = __importDefault(require("big-integer"));
const PeerId = require('peer-id');
const PeerInfo = require('peer-info');
const log = bunyan_1.default.createLogger({
    name: 'vreath-cli',
    streams: [
        {
            path: path.join(__dirname, '../log/log.log')
        }
    ]
});
const pull = require('pull-stream');
exports.get_new_chain = async (node) => {
    try {
        const peers = await data.peer_list_db.filter();
        const peer = peers[0];
        if (peer == null)
            throw new Error('no peer');
        const peer_id = await util_1.promisify(PeerId.createFromJSON)(peer.identity);
        const peer_info = new PeerInfo(peer_id);
        peer.multiaddrs.forEach(add => peer_info.multiaddrs.add(add));
        const info = await data.chain_info_db.read_obj("00");
        if (info == null)
            throw new Error("chain_info doesn't exist");
        node.dialProtocol(peer_info, `/vreath/${data.id}/chain/get`, (err, conn) => {
            if (err) {
                throw err;
            }
            pull(pull.values([info.last_height]), conn);
        });
    }
    catch (e) {
        log.info(e);
    }
    await works.sleep(30000);
    setImmediate(() => exports.get_new_chain.apply(null, [node]));
    return 0;
};
exports.staking = async (private_key, node) => {
    try {
        const info = await data.chain_info_db.read_obj("00");
        if (info == null)
            throw new Error("chain_info doesn't exist");
        const last_height = info.last_height;
        const root = await data.root_db.get(last_height);
        if (root == null)
            throw new Error("root doesn't exist");
        const trie = vr.data.trie_ins(data.trie_db, root);
        const made = await works.make_block(private_key, data.block_db, info.last_height, trie, data.state_db, data.lock_db, "", data.tx_db, data.output_db);
        const block = made[0];
        const output_state = made[1];
        if (block.meta.kind === 0)
            await vr.block.accept_key_block(block, data.block_db, last_height, trie, data.state_db, data.lock_db);
        else if (block.meta.kind === 1)
            await vr.block.accept_micro_block(block, output_state, data.block_db, trie, data.state_db, data.lock_db);
        await data.block_db.write_obj(block.meta.height, block);
        const new_info = await works.new_obj(info, (info) => {
            info.last_height = block.meta.height;
            info.last_hash = block.hash;
            return info;
        });
        await data.chain_info_db.write_obj("00", new_info);
        const new_root = trie.now_root();
        await data.root_db.put(block.meta.height, new_root, 'hex', 'utf8');
        const txs_hash = block.txs.map(tx => tx.hash);
        await P.forEach(txs_hash, async (key) => {
            await data.tx_db.del(key);
            await data.output_db.del(key);
        });
        await data.peer_list_db.filter('hex', 'utf8', async (key, peer) => {
            const peer_id = await util_1.promisify(PeerId.createFromJSON)(peer.identity);
            const peer_info = new PeerInfo(peer_id);
            peer.multiaddrs.forEach(add => peer_info.multiaddrs.add(add));
            node.dialProtocol(peer_info, `/vreath/${data.id}/block/post`, (err, conn) => {
                if (err) {
                    throw err;
                }
                pull(pull.values([JSON.stringify(made)]), conn);
            });
            return false;
        });
    }
    catch (e) {
        log.info(e);
    }
    await works.sleep(1000);
    setImmediate(() => exports.staking.apply(null, [private_key, node]));
    return 0;
};
exports.buying_unit = async (private_key, config, node) => {
    try {
        const pub_key = vr.crypto.private2public(private_key);
        const native_validator = vr.crypto.generate_address(vr.con.constant.native, pub_key);
        const unit_validator = vr.crypto.generate_address(vr.con.constant.unit, pub_key);
        const info = await data.chain_info_db.read_obj("00");
        if (info == null)
            throw new Error("chain_info doesn't exist");
        const root = await data.root_db.get(info.last_height);
        if (root == null)
            throw new Error("root doesn't exist");
        const trie = vr.data.trie_ins(data.trie_db, root);
        const validator_native_state = await vr.data.read_from_trie(trie, data.state_db, native_validator, 0, vr.state.create_state("00", vr.con.constant.native, native_validator, "00"));
        const validator_amount = validator_native_state.amount || "00";
        const minimum = config.validator.minimum;
        if (big_integer_1.default(validator_amount, 16).lesser(big_integer_1.default(minimum, 16)))
            throw new Error("You don't have enough amount");
        await data.tx_db.filter('hex', 'utf8', async (key, tx) => {
            if (tx.meta.kind === 0 && tx.meta.request.bases[0] === unit_validator)
                throw new Error("already bought units");
            return false;
        });
        let units = [];
        let unit_addresses = [unit_validator];
        let price_sum = big_integer_1.default(0);
        await data.unit_db.filter('hex', 'utf8', async (key, unit) => {
            const maxed = big_integer_1.default(validator_amount, 16).subtract(price_sum).subtract(big_integer_1.default(unit[4], 16)).lesser(big_integer_1.default(minimum, 16));
            if (maxed && big_integer_1.default(unit[4], 16).lesser(big_integer_1.default(units[0][4], 16)))
                return false;
            const unit_info = await vr.unit.get_info_from_unit(unit, data.block_db);
            const unit_address = unit_info[1];
            const unit_state = await vr.data.read_from_trie(trie, data.state_db, unit_address, 0, vr.state.create_state("00", vr.con.constant.unit, unit_address, "00"));
            if (unit_state.data.length != 0) {
                await data.unit_db.del(unit_address);
            }
            if (maxed) {
                units[0] = unit;
                unit_addresses[0] = unit_address;
            }
            else {
                units.push(unit);
                unit_addresses.push(unit_address);
            }
            units.sort((a, b) => big_integer_1.default(a[4], 16).subtract(big_integer_1.default(b[4], 16)).toJSNumber());
            price_sum = price_sum.add(big_integer_1.default(unit[4], 16));
            return false;
        });
        if (units.length === 0)
            throw new Error('no units');
        const unit_hashes = units.map(u => vr.crypto.array2hash([u[0], vr.crypto.bigint2hex(big_integer_1.default(u[1])), u[2], u[3], u[4]]));
        units = units.filter((u, i) => unit_hashes.indexOf(unit_hashes[i]) === i);
        unit_addresses = unit_addresses.filter((val, i, array) => array.indexOf(val) === i);
        const native_addresses = [native_validator].concat(units.map(u => ("0000000000000000" + vr.con.constant.native).slice(-16) + ("0000000000000000000000000000000000000000000000000000000000000000" + u[3]).slice(-64))).filter((val, i, array) => array.indexOf(val) === i);
        const bases = unit_addresses.concat(native_addresses);
        const feeprice = config.validator.fee_price;
        const gas = config.validator.gas;
        const input_raw = units.reduce((res, unit) => {
            let index = (unit[1]).toString(16);
            if (index.length % 2 != 0)
                index = "0" + index;
            return res.concat(unit[0]).concat(index).concat(unit[2]).concat(unit[3]).concat(unit[4]);
        }, ["00"]);
        const tx = await works.make_req_tx(0, bases, feeprice, gas, input_raw, "", private_key, trie, data.state_db, data.lock_db);
        await tx_routes.post(Buffer.from(JSON.stringify([tx, []])));
        await data.tx_db.write_obj(tx.hash, tx);
        await P.forEach(units, async (unit, i) => {
            await data.unit_db.del(unit_addresses[i + 1]);
        });
        await data.peer_list_db.filter('hex', 'utf8', async (key, peer) => {
            const peer_id = await util_1.promisify(PeerId.createFromJSON)(peer.identity);
            const peer_info = new PeerInfo(peer_id);
            peer.multiaddrs.forEach(add => peer_info.multiaddrs.add(add));
            node.dialProtocol(peer_info, `/vreath/${data.id}/tx/post`, (err, conn) => {
                if (err) {
                    throw err;
                }
                pull(pull.values([JSON.stringify([tx, []])]), conn);
            });
            return false;
        });
    }
    catch (e) {
        log.info(e);
    }
    await works.sleep(2000);
    setImmediate(() => exports.buying_unit.apply(null, [private_key, config, node]));
    return 0;
};
exports.refreshing = async (private_key, config, node) => {
    try {
        const info = await data.chain_info_db.read_obj("00");
        if (info == null)
            throw new Error("chain_info doesn't exist");
        const last_height = info.last_height;
        let height = big_integer_1.default(last_height, 16);
        let index = -1;
        let block;
        let refreshed = [];
        let target_tx = null;
        while (height.notEquals(0)) {
            if (target_tx != null)
                break;
            block = await data.block_db.read_obj(vr.crypto.bigint2hex(height));
            if (block == null)
                continue;
            await P.forEach(block.txs, async (tx, i) => {
                const pooled = await data.tx_db.filter('hex', 'utf8', async (key, t) => {
                    return t.meta.kind === 1 && tx.meta.refresh.height === t.meta.refresh.height && tx.meta.refresh.index === t.meta.refresh.index && tx.meta.refresh.output === t.meta.refresh.output;
                });
                if (tx.meta.kind === 0 && refreshed.indexOf(tx.hash) === -1 && pooled.length === 0) {
                    target_tx = tx;
                    index = i;
                }
                else if (tx.meta.kind === 1) {
                    const req_tx = await vr.tx.find_req_tx(tx, data.block_db);
                    refreshed.push(req_tx.hash);
                }
            });
            if (index != -1)
                break;
            height = height.subtract(1);
        }
        if (target_tx == null || index === -1)
            throw new Error('no request tx is refreshed yet.');
        await data.tx_db.filter('hex', 'utf8', async (key, tx) => {
            if (tx.meta.kind === 1 && tx.meta.refresh.height === vr.crypto.bigint2hex(height) && tx.meta.refresh.index === index)
                throw new Error('refresh tx exists in the pool');
            return false;
        });
        const gas_share = config.miner.gas_share;
        const unit_price = config.miner.unit_price;
        const root = await data.root_db.get(last_height);
        if (root == null)
            throw new Error("root doesn't exist");
        const trie = vr.data.trie_ins(data.trie_db, root);
        const made = await works.make_ref_tx(vr.crypto.bigint2hex(height), index, gas_share, unit_price, private_key, data.block_db, trie, data.state_db, data.lock_db, last_height);
        await data.tx_db.write_obj(made[0].hash, made[0]);
        await data.output_db.write_obj(made[0].hash, made[1]);
        await data.peer_list_db.filter('hex', 'utf8', async (key, peer) => {
            const peer_id = await util_1.promisify(PeerId.createFromJSON)(peer.identity);
            const peer_info = new PeerInfo(peer_id);
            peer.multiaddrs.forEach(add => peer_info.multiaddrs.add(add));
            node.dialProtocol(peer_info, `/vreath/${data.id}/tx/post`, (err, conn) => {
                if (err) {
                    throw err;
                }
                pull(pull.values([JSON.stringify(made)]), conn);
            });
            return false;
        });
    }
    catch (e) {
        log.info(e);
    }
    await works.sleep(2000);
    setImmediate(() => exports.refreshing.apply(null, [private_key, config, node]));
    return 0;
};
exports.making_unit = async (private_key, config, node) => {
    try {
        const public_key = vr.crypto.private2public(private_key);
        const my_unit_address = vr.crypto.generate_address(vr.con.constant.unit, public_key);
        const info = await data.chain_info_db.read_obj("00");
        if (info == null)
            throw new Error("chain_info doesn't exist");
        const last_height = info.last_height;
        const root = await data.root_db.get(last_height);
        if (root == null)
            throw new Error("root doesn't exist");
        const trie = vr.data.trie_ins(data.trie_db, root);
        let height = big_integer_1.default(last_height, 16);
        let block;
        let unit_info = null;
        while (height.notEquals(0)) {
            if (unit_info != null)
                break;
            block = await data.block_db.read_obj(vr.crypto.bigint2hex(height));
            if (block == null)
                continue;
            await P.forEach(block.txs, async (ref_tx, i) => {
                if (ref_tx.meta.kind === 1) {
                    const req_height = ref_tx.meta.refresh.height || "00";
                    const req_block = await data.block_db.read_obj(req_height);
                    if (req_block == null)
                        return 0;
                    const req_tx = req_block.txs[ref_tx.meta.refresh.index];
                    if (req_tx == null)
                        return 0;
                    const output_hash = vr.crypto.array2hash(ref_tx.meta.refresh.output);
                    const iden = vr.crypto.array2hash([req_tx.hash, req_height, req_block.hash, my_unit_address, output_hash]);
                    const unit_address = ("0000000000000000" + vr.con.constant.unit).slice(-16) + ("0000000000000000000000000000000000000000000000000000000000000000" + iden).slice(-64);
                    const made_unit = await data.unit_db.read_obj(unit_address);
                    if (made_unit != null)
                        return 0;
                    const unit_state = await vr.data.read_from_trie(trie, data.state_db, unit_address, 0, vr.state.create_state("00", vr.con.constant.unit, unit_address));
                    if (unit_state.data.length === 0 && block != null) {
                        unit_info = [req_tx.hash, req_height, req_block.hash, output_hash, vr.crypto.bigint2hex(big_integer_1.default(block.meta.height, 16)), i, unit_address];
                    }
                    return 1;
                }
            });
            if (unit_info != null)
                break;
            height = height.subtract(1);
        }
        if (unit_info == null)
            throw new Error('no new refresh-tx');
        const unit_price = config.miner.unit_price;
        const nonce = await works.get_nonce(unit_info[0], unit_info[1], unit_info[2], my_unit_address, unit_info[3], unit_price);
        if (big_integer_1.default(nonce, 16).eq(0))
            throw new Error('fail to get valid nonce');
        const unit = [unit_info[4], unit_info[5], nonce, my_unit_address, unit_price];
        await data.unit_db.write_obj(unit_info[6], unit);
        await data.peer_list_db.filter('hex', 'utf8', async (key, peer) => {
            const peer_id = await util_1.promisify(PeerId.createFromJSON)(peer.identity);
            const peer_info = new PeerInfo(peer_id);
            peer.multiaddrs.forEach(add => peer_info.multiaddrs.add(add));
            node.dialProtocol(peer_info, `/vreath/${data.id}/unit/post`, (err, conn) => {
                if (err) {
                    throw err;
                }
                pull(pull.values([unit]), conn);
            });
            return false;
        });
    }
    catch (e) {
        log.info(e);
    }
    await works.sleep(2000);
    setImmediate(() => exports.making_unit.apply(null, [private_key, config, node]));
    return 0;
};
