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
const works = __importStar(require("../logic/work"));
const run_1 = require("../commands/run");
const util_1 = require("util");
const levelup_1 = __importDefault(require("levelup"));
const memdown_1 = __importDefault(require("memdown"));
const path = __importStar(require("path"));
const big_integer_1 = __importDefault(require("big-integer"));
const bunyan_1 = __importDefault(require("bunyan"));
const PeerInfo = require('peer-info');
const PeerId = require('peer-id');
const Multiaddr = require('multiaddr');
const pull = require('pull-stream');
const toStream = require('pull-stream-to-stream');
class leveldb {
    constructor(_db) {
        this.db = _db;
    }
    async get(key) {
        const got = await this.db.get(key);
        if (typeof got === 'string')
            return Buffer.from(key);
        else
            return got;
    }
    async put(key, val) {
        await this.db.put(key, val);
    }
    async del(key) {
        await this.db.del(key);
    }
    createReadStream() {
        return this.db.createReadStream();
    }
    get raw_db() {
        return this.db;
    }
}
exports.leveldb = leveldb;
exports.make_db_obj = () => {
    const levelup_obj = new levelup_1.default(memdown_1.default());
    const leveldb_obj = new leveldb(levelup_obj);
    return new vr.db(leveldb_obj);
};
class DBSet {
    constructor() {
        this.db_set = {};
    }
    call(_key) {
        return this.db_set[_key];
    }
    add_db(_key, _db) {
        this.db_set[_key] = _db;
    }
}
exports.DBSet = DBSet;
const dialog = async (db_set, native_address, unit_address, id) => {
    const chain_info_db = db_set.call('chain_info');
    const root_db = db_set.call('root');
    const trie_db = db_set.call('trie');
    const state_db = db_set.call('state');
    const obj = await works.dialog_data(chain_info_db, root_db, trie_db, state_db, native_address, unit_address, id);
    console.log(JSON.stringify(obj, null, 4));
    await works.sleep(7000);
    return await dialog(db_set, native_address, unit_address, id);
};
const finish_check = async (db_set) => {
    const chain_info_db = db_set.call('chain_info');
    const chain_info = await chain_info_db.read_obj('00');
    if (chain_info == null || !big_integer_1.default(chain_info.last_height, 16).lesser(3))
        return db_set;
    else
        return await finish_check(db_set);
};
exports.run_node = async (private_key, config, ip, port, bootstrapList, db_set, id) => {
    const chain_info_db = db_set.call('chain_info');
    const root_db = db_set.call('root');
    const trie_db = db_set.call('trie');
    const tx_db = db_set.call('tx');
    const block_db = db_set.call('block');
    const state_db = db_set.call('state');
    const lock_db = db_set.call('lock');
    const output_db = db_set.call('output');
    const unit_db = db_set.call('unit');
    const peer_list_db = db_set.call('peer_list');
    const finalize_db = db_set.call('finalize');
    const uniter_db = db_set.call('uniter');
    const peer_id = await util_1.promisify(PeerId.createFromJSON)(config.peer);
    const peer_info = new PeerInfo(peer_id);
    peer_info.multiaddrs.add(`/ip4/${ip}/tcp/${port}`);
    const peer_address_list = bootstrapList.map(peer => `${peer.multiaddrs[0]}`);
    await peer_list_db.del(Buffer.from(config.peer.id).toString('hex'));
    const node = new run_1.Node(peer_info, ['spdy', 'mplex'], peer_address_list);
    const log = bunyan_1.default.createLogger({
        name: 'vreath-cli',
        streams: [
            {
                path: path.join(__dirname, `../log/test${id.toString()}.log`)
            }
        ]
    });
    try {
        node.start((err) => {
            //console.log(err);
            run_1.node_handles(node, private_key, config, chain_info_db, root_db, trie_db, block_db, state_db, lock_db, output_db, tx_db, unit_db, peer_list_db, finalize_db, uniter_db, log);
            run_1.run_intervals(node, private_key, config, chain_info_db, root_db, trie_db, block_db, state_db, lock_db, output_db, tx_db, unit_db, peer_list_db, finalize_db, uniter_db, log);
            const pubKey = vr.crypto.private2public(private_key);
            const native_address = vr.crypto.generate_address(vr.con.constant.native, pubKey);
            const unit_address = vr.crypto.generate_address(vr.con.constant.unit, pubKey);
            dialog(db_set, native_address, unit_address, id);
        });
    }
    catch (e) {
        log.info(e);
    }
};
