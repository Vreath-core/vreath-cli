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
const block_routes = __importStar(require("../app/routes/block"));
const P = __importStar(require("p-iteration"));
const bunyan_1 = __importDefault(require("bunyan"));
const path = __importStar(require("path"));
const big_integer_1 = __importDefault(require("big-integer"));
const log = bunyan_1.default.createLogger({
    name: 'vreath-cli',
    streams: [
        {
            path: path.join(__dirname, '../log/log.log')
        }
    ]
});
const pull = require('pull-stream');
exports.get_new_chain = async (PeerBook, node) => {
    const peers = PeerBook.getAll();
    const peer = peers[0];
    if (peer == null)
        throw new Error('no peer');
    const info = await data.chain_info_db.read_obj("00");
    if (info == null)
        throw new Error("chain_info doesn't exist");
    node.dialProtocol(peer, `/vreath/${data.id}/chain/get`, (err, conn) => {
        if (err) {
            throw err;
        }
        pull(pull.values([info.last_height]), conn);
    });
    await works.sleep(30000);
    setImmediate(exports.get_new_chain);
    return 0;
};
exports.staking = async (private_key, PeerBook, node) => {
    try {
        const info = await data.chain_info_db.read_obj("00");
        if (info == null)
            throw new Error("chain_info doesn't exist");
        const root = await data.root_db.get(info.last_height);
        console.log(info.last_height);
        if (root == null)
            throw new Error("root doesn't exist");
        const trie = vr.data.trie_ins(data.trie_db, root);
        const made = await works.make_block(private_key, data.block_db, info.last_height, trie, data.state_db, data.lock_db, "", data.tx_db);
        await block_routes.post(Buffer.from(JSON.stringify(made)));
        const peers = PeerBook.getAll();
        await P.forEach(peers, async (peer) => {
            node.dialProtocol(peer, `/vreath/${data.id}/block/post`, (err, conn) => {
                if (err) {
                    throw err;
                }
                pull(pull.values([JSON.stringify(made)]), conn);
            });
        });
    }
    catch (e) {
        log.info(e);
        console.log(e);
    }
    await works.sleep(1000);
    setImmediate(() => exports.staking.apply(null, [private_key, PeerBook, node]));
    return 0;
};
exports.buying_unit = async (private_key, config, PeerBook, node) => {
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
        let units = [];
        let price_sum = big_integer_1.default(0);
        await data.unit_db.filter('hex', 'utf8', async (key, unit) => {
            const maxed = big_integer_1.default(validator_amount, 16).subtract(price_sum).subtract(big_integer_1.default(unit[4], 16)).lesser(big_integer_1.default(minimum, 16));
            if (maxed && big_integer_1.default(unit[4], 16).lesser(big_integer_1.default(units[0][4], 16)))
                return false;
            if (maxed) {
                units[0] = unit;
            }
            else {
                units.push(unit);
            }
            units.sort((a, b) => big_integer_1.default(a[4], 16).subtract(big_integer_1.default(b[4], 16)).toJSNumber());
            price_sum = price_sum.add(big_integer_1.default(unit[4], 16));
            return false;
        });
        if (units.length === 0)
            throw new Error('no units');
        const unit_addresses = await P.reduce(units, async (res, unit) => {
            const unit_info = await vr.unit.get_info_from_unit(unit, data.block_db);
            const unit_addresses = unit_info[1];
            const unit_state = await vr.data.read_from_trie(trie, data.state_db, unit_addresses, 0, vr.state.create_state("0", vr.con.constant.unit, unit_addresses, "0"));
            if (!big_integer_1.default(unit_info[2], 16).lesserOrEquals(vr.con.constant.pow_target) || unit_state.data.length != 0)
                return res;
            if (res.indexOf(unit_addresses) != -1)
                return res;
            return res.concat(unit_addresses);
        }, [unit_validator]);
        const native_addresses = [native_validator].concat(units.map(u => vr.crypto.generate_address(vr.con.constant.unit, vr.crypto.slice_hash_part(u[3]))).filter((val, i, array) => array.indexOf(val) === i));
        const bases = unit_addresses.concat(native_addresses);
        const feeprice = config.validator.fee_price;
        const gas = config.validator.gas;
        const input_raw = units.reduce((res, unit) => {
            let index = (unit[1]).toString(16);
            if (index.length % 2 != 0)
                index = "0" + index;
            return res.concat(unit[0]).concat(index).concat(unit[2]).concat(unit[3]).concat(unit[4]);
        }, ["0"]);
        const tx = await works.make_req_tx(0, bases, feeprice, gas, input_raw, "", private_key, trie, data.state_db, data.lock_db);
        await data.tx_db.write_obj(tx.hash, tx);
        await P.forEach(units, async (unit, i) => {
            await data.unit_db.del(unit_addresses[i + 1]);
        });
        const peers = PeerBook.getAll();
        await P.forEach(peers, async (peer) => {
            node.dialProtocol(peer, `/vreath/${data.id}/tx/post`, (err, conn) => {
                if (err) {
                    throw err;
                }
                pull(pull.values([JSON.stringify([tx, []])]), conn);
            });
        });
    }
    catch (e) {
        log.info(e);
        console.log(e);
    }
    await works.sleep(2000);
    setImmediate(() => exports.buying_unit.apply(null, [private_key, config, PeerBook, node]));
    return 0;
};
exports.refreshing = async (private_key, config, PeerBook, node) => {
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
        while (1) {
            if (target_tx != null || height.eq(0))
                break;
            block = await data.block_db.read_obj(vr.crypto.bigint2hex(height));
            if (block == null)
                continue;
            await P.forEach(block.txs, async (tx, i) => {
                const pooled = await data.tx_db.filter('hex', 'utf8', async (key, t) => {
                    return t.meta.kind === 1 && tx.meta.refresh.height === t.meta.refresh.height && tx.meta.refresh.index === t.meta.refresh.index && tx.meta.refresh.output === t.meta.refresh.output;
                });
                if (tx.meta.kind === 0 && refreshed.indexOf(tx.hash) === -1 && pooled.length != 0) {
                    target_tx = tx;
                    index = i;
                }
                else if (tx.meta.kind === 1) {
                    const req_tx = await vr.tx.find_req_tx(tx, data.block_db);
                    refreshed.push(req_tx.hash);
                }
            });
            height = height.subtract(1);
        }
        if (target_tx == null || index === -1)
            throw new Error('no request tx is refreshed yet.');
        const gas_share = config.miner.gas_share;
        const unit_price = config.miner.unit_price;
        const root = await data.root_db.get(last_height);
        if (root == null)
            throw new Error("root doesn't exist");
        const trie = vr.data.trie_ins(data.trie_db, root);
        const made = await works.make_ref_tx(vr.crypto.bigint2hex(height), index, gas_share, unit_price, private_key, data.block_db, trie, data.state_db, data.lock_db, last_height);
        await data.tx_db.write_obj(made[0].hash, made[0]);
        const peers = PeerBook.getAll();
        await P.forEach(peers, async (peer) => {
            node.dialProtocol(peer, `/vreath/${data.id}/tx/post`, (err, conn) => {
                if (err) {
                    throw err;
                }
                pull(pull.values([JSON.stringify(made)]), conn);
            });
        });
    }
    catch (e) {
        log.info(e);
        console.log(e);
    }
    await works.sleep(2000);
    setImmediate(() => exports.refreshing.apply(null, [private_key, config, PeerBook, node]));
    return 0;
};
exports.making_unit = async (private_key, config, PeerBook, node) => {
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
        while (1) {
            if (unit_info != null && height.eq(0))
                break;
            block = await data.block_db.read_obj(vr.crypto.bigint2hex(height));
            if (block == null)
                continue;
            await P.forEach(block.txs, async (ref_tx, i) => {
                if (ref_tx.meta.kind === 1) {
                    /*const ref_block:T.Block|null = await block_db.read_obj(unit[0]);
                    if(ref_block==null) throw new Error("ref_block doesn't exist");
                    const ref_tx:T.Tx|null = ref_block.txs[unit[1]];
                    if(ref_tx==null) throw new Error("ref_tx doesn't exist");*/
                    const req_height = ref_tx.meta.refresh.height || "00";
                    const req_block = await data.block_db.read_obj(req_height);
                    if (req_block == null)
                        throw new Error("req_block doesn't exist");
                    const req_tx = req_block.txs[ref_tx.meta.refresh.index];
                    if (req_tx == null)
                        throw new Error("req_tx doesn't exist");
                    const output_hash = vr.crypto.array2hash(ref_tx.meta.refresh.output);
                    const iden = vr.crypto.array2hash([req_tx.hash, req_height, req_block.hash, my_unit_address, output_hash]);
                    const unit_address = vr.crypto.generate_address(vr.con.constant.unit, iden);
                    const unit_state = await vr.data.read_from_trie(trie, data.state_db, unit_address, 0, vr.state.create_state("00", vr.con.constant.unit, unit_address));
                    if (unit_state.data.length === 0) {
                        unit_info = [req_tx.hash, req_height, req_block.hash, output_hash, vr.crypto.bigint2hex(height), i, unit_address];
                    }
                }
            });
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
        const peers = PeerBook.getAll();
        await P.forEach(peers, async (peer) => {
            node.dialProtocol(peer, `/vreath/${data.id}/tx/post`, (err, conn) => {
                if (err) {
                    throw err;
                }
                pull(pull.values([unit]), conn);
            });
        });
    }
    catch (e) {
        log.info(e);
        console.log(e);
    }
    await works.sleep(2000);
    setImmediate(() => exports.making_unit.apply(null, [private_key, config, PeerBook, node]));
    return 0;
};