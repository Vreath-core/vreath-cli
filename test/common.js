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
const handshake_1 = __importDefault(require("../app/routes/handshake"));
const tx_routes = __importStar(require("../app/routes/tx"));
const block_routes = __importStar(require("../app/routes/block"));
const chain_routes = __importStar(require("../app/routes/chain"));
const unit_routes = __importStar(require("../app/routes/unit"));
const data = __importStar(require("../logic/data"));
const works = __importStar(require("../logic/work"));
const intervals = __importStar(require("../logic/interval"));
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
            node.on('peer:connect', (peerInfo) => {
                const ids = new PeerInfo(PeerId.createFromB58String(peerInfo.id._idB58String));
                const id_obj = {
                    id: ids.id._idB58String,
                    privKey: ids.id._privKey,
                    pubKey: ids.id._pubKey
                };
                const multiaddrs = peerInfo.multiaddrs.toArray().map((add) => Multiaddr(add.buffer).toString());
                const peer_obj = {
                    identity: id_obj,
                    multiaddrs: multiaddrs
                };
                //console.log(peer_obj)
                peer_list_db.write_obj(Buffer.from(peer_obj.identity.id).toString('hex'), peer_obj);
            });
            node.handle(`/vreath/${data.id}/handshake`, (protocol, conn) => {
                const stream = toStream(conn);
                let data = [];
                stream.on('data', (msg) => {
                    try {
                        if (msg != null && msg.length > 0) {
                            const str = msg.toString('utf-8');
                            if (str != 'end')
                                data.push(str);
                            else {
                                const res = data.reduce((json, str) => json + str, '');
                                handshake_1.default(res, peer_list_db, log);
                                data = [];
                                stream.end();
                            }
                        }
                    }
                    catch (e) {
                        log.info(e);
                    }
                });
                stream.on('error', (e) => {
                    log.info(e);
                });
            });
            node.handle(`/vreath/${data.id}/tx/post`, (protocol, conn) => {
                pull(conn, pull.drain((msg) => {
                    try {
                        tx_routes.post(msg, chain_info_db, root_db, trie_db, tx_db, block_db, state_db, lock_db, output_db, log);
                    }
                    catch (e) {
                        log.info(e);
                    }
                }));
            });
            node.handle(`/vreath/${data.id}/block/get`, async (protocol, conn) => {
                pull(conn, pull.drain((msg) => {
                    try {
                        block_routes.get(msg, node, block_db, log);
                    }
                    catch (e) {
                        log.info(e);
                    }
                }));
            });
            node.handle(`/vreath/${data.id}/block/post`, (protocol, conn) => {
                pull(conn, pull.drain((msg) => {
                    try {
                        block_routes.post(msg, chain_info_db, root_db, trie_db, block_db, state_db, lock_db, tx_db, log);
                    }
                    catch (e) {
                        log.info(e);
                    }
                }));
            });
            node.handle(`/vreath/${data.id}/chain/get`, (protocol, conn) => {
                try {
                    const stream = toStream(conn);
                    let data = [];
                    stream.on('data', (msg) => {
                        try {
                            if (msg != null && msg.length > 0) {
                                const str = msg.toString('utf-8');
                                if (str != 'end1')
                                    data.push(str);
                                else {
                                    const res = data.reduce((json, str) => json + str, '');
                                    const hashes = JSON.parse(res);
                                    chain_routes.get(hashes, stream, chain_info_db, block_db, output_db, log);
                                    data = [];
                                }
                            }
                        }
                        catch (e) {
                            log.info(e);
                        }
                    });
                    stream.on('error', (e) => {
                        log.info(e);
                    });
                }
                catch (e) {
                    log.info(e);
                }
            });
            node.handle(`/vreath/${data.id}/chain/post`, (protocol, conn) => {
                pull(conn, pull.drain((msg) => {
                    try {
                        chain_routes.post(msg.toString('utf-8'), block_db, chain_info_db, root_db, trie_db, state_db, lock_db, tx_db, log);
                    }
                    catch (e) {
                        log.info(e);
                    }
                }));
            });
            node.handle(`/vreath/${data.id}/unit/post`, async (protocol, conn) => {
                pull(conn, pull.drain((msg) => {
                    try {
                        unit_routes.post(msg, block_db, chain_info_db, root_db, trie_db, state_db, unit_db, log);
                    }
                    catch (e) {
                        log.info(e);
                    }
                }));
            });
            node.on('error', (e) => {
                log.info(e);
            });
            intervals.shake_hands(node, peer_list_db, log);
            intervals.get_new_chain(node, peer_list_db, chain_info_db, block_db, root_db, trie_db, state_db, lock_db, tx_db, log);
            if (config.validator.flag) {
                intervals.staking(private_key, node, chain_info_db, root_db, trie_db, block_db, state_db, lock_db, output_db, tx_db, peer_list_db, log);
                intervals.buying_unit(private_key, config, node, chain_info_db, root_db, trie_db, block_db, state_db, lock_db, output_db, tx_db, unit_db, peer_list_db, log);
            }
            if (config.miner.flag) {
                intervals.refreshing(private_key, config, node, chain_info_db, root_db, trie_db, block_db, state_db, lock_db, output_db, tx_db, peer_list_db, log);
                intervals.making_unit(private_key, config, node, chain_info_db, root_db, trie_db, block_db, state_db, unit_db, peer_list_db, log);
            }
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
