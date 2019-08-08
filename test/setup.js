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
const util_1 = require("util");
const big_integer_1 = __importDefault(require("big-integer"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const common_1 = require("./common");
const PeerId = require('peer-id');
const PeerInfo = require('peer-info');
const Multiaddr = require('multiaddr');
const search_ip = require('ip');
exports.test_setup = async () => {
    const privKey = vr.crypto.genereate_key();
    const pubKey = vr.crypto.private2public(privKey);
    const unit_address = vr.crypto.generate_address(vr.con.constant.unit, pubKey);
    const one_amount = "e8d4a51000";
    const genesis_state = [vr.state.create_state("00", vr.con.constant.unit, unit_address, one_amount, ["01", "00"])];
    const genesis_token = [vr.state.create_token("00", vr.con.constant.native), vr.state.create_token("00", vr.con.constant.unit, one_amount)];
    const genesis_lock = [vr.lock.create_lock(unit_address, 0, "00", vr.crypto.get_sha256(''), 0, vr.crypto.get_sha256(''))];
    const gen_meta = {
        kind: 0,
        height: "00",
        previoushash: vr.crypto.get_sha256(''),
        timestamp: 1545629491,
        pos_diff: vr.con.constant.one_hex,
        trie_root: vr.crypto.get_sha256(''),
        tx_root: vr.crypto.get_sha256(''),
        fee_sum: "00",
        extra: ""
    };
    const test_id = "1126";
    const id = vr.con.constant.my_version + test_id + test_id;
    const meta_array = vr.block.block_meta2array(gen_meta).concat(id);
    const gen_sign_data = vr.crypto.sign(vr.crypto.array2hash(meta_array), privKey);
    const v = vr.crypto.bigint2hex(big_integer_1.default(id, 16).multiply(2).add(8).add(big_integer_1.default(28).subtract(big_integer_1.default(gen_sign_data[0], 16))));
    const gen_sign = {
        data: gen_sign_data[1],
        v: v
    };
    const all_array = meta_array.concat(gen_sign.v);
    const gen_hash = vr.crypto.array2hash(all_array);
    const genesis_block = {
        hash: gen_hash,
        signature: gen_sign,
        meta: gen_meta,
        txs: []
    };
    const genesis_chain_info = {
        version: vr.con.constant.my_version,
        chain_id: test_id,
        net_id: test_id,
        compatible_version: vr.con.constant.compatible_version,
        last_height: "00",
        last_hash: gen_hash
    };
    const gen_peer = await exports.set_peer_id('8000');
    const gen_finalize = vr.finalize.sign("00", gen_hash, privKey);
    const gen_uniter = [unit_address];
    const data = {
        privKey: privKey,
        pubKey: pubKey,
        state: genesis_state,
        token: genesis_token,
        lock: genesis_lock,
        block: genesis_block,
        chain_info: genesis_chain_info,
        peer: gen_peer,
        finalize: [gen_finalize],
        uniter: gen_uniter,
    };
    return data;
};
exports.set_peer_id = async (port) => {
    const peer_id = await util_1.promisify(PeerId.create)();
    const id_obj = peer_id.toJSON();
    const peer_info = new PeerInfo(peer_id);
    peer_info.multiaddrs.add(`/ip4/127.0.0.1/tcp/${port}/p2p/${id_obj.id}`);
    const multiaddrs = peer_info.multiaddrs.toArray().map((add) => Multiaddr(add.buffer).toString());
    const peer_obj = {
        identity: id_obj,
        multiaddrs: multiaddrs
    };
    return peer_obj;
};
exports.add_setup_data = async (db_set, setup, id) => {
    try {
        db_set.add_db('chain_info', common_1.make_db_obj());
        db_set.add_db('root', common_1.make_db_obj());
        db_set.add_db('trie', common_1.make_db_obj());
        db_set.add_db('tx', common_1.make_db_obj());
        db_set.add_db('block', common_1.make_db_obj());
        db_set.add_db('state', common_1.make_db_obj());
        db_set.add_db('lock', common_1.make_db_obj());
        db_set.add_db('output', common_1.make_db_obj());
        db_set.add_db('unit', common_1.make_db_obj());
        db_set.add_db('peer_list', common_1.make_db_obj());
        db_set.add_db('finalize', common_1.make_db_obj());
        db_set.add_db('uniter', common_1.make_db_obj());
        db_set.add_db('log', common_1.make_db_obj());
        const chain_info_db = db_set.call('chain_info');
        const root_db = db_set.call('root');
        const trie_db = db_set.call('trie');
        const block_db = db_set.call('block');
        const state_db = db_set.call('state');
        const lock_db = db_set.call('lock');
        const peer_list_db = db_set.call('peer_list');
        const finalize_db = db_set.call('finalize');
        const uniter_db = db_set.call('uniter');
        chain_info_db.write_obj("00", setup.chain_info);
        const trie = vr.data.trie_ins(trie_db);
        await vr.data.write_trie(trie, state_db, lock_db, setup.state[0], setup.lock[0]);
        const root = trie.now_root();
        await root_db.put("00", root);
        await block_db.write_obj("00", setup.block);
        await peer_list_db.write_obj(Buffer.from(setup.peer.identity.id).toString('hex'), setup.peer);
        await finalize_db.write_obj("00", setup.finalize);
        await uniter_db.write_obj("00", setup.uniter);
        await util_1.promisify(fs.writeFile)(path.join(__dirname, '../log/test' + id.toString() + '.log'), '', 'utf-8');
        return db_set;
    }
    catch (e) {
        return db_set;
    }
};
