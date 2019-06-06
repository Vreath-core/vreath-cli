"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const tx_routes = __importStar(require("../app/routes/tx"));
const block_routes = __importStar(require("../app/routes/block"));
const chain_routes = __importStar(require("../app/routes/chain"));
const unit_routes = __importStar(require("../app/routes/unit"));
const data = __importStar(require("../logic/data"));
const intervals = __importStar(require("../logic/interval"));
const main_1 = require("../commands/main");
const util_1 = require("util");
const stream_1 = require("stream");
const PeerInfo = require('peer-info');
const PeerId = require('peer-id');
const Multiaddr = require('multiaddr');
const PeerBook = require('peer-book');
const libp2p = require('libp2p');
const TCP = require('libp2p-tcp');
const WS = require('libp2p-websockets');
const SPDY = require('libp2p-spdy');
const MPLEX = require('libp2p-mplex');
const SECIO = require('libp2p-secio');
const MulticastDNS = require('libp2p-mdns');
const Bootstrap = require('libp2p-bootstrap');
const DHT = require('libp2p-kad-dht');
const defaultsDeep = require('@nodeutils/defaults-deep');
const pull = require('pull-stream');
const toStream = require('pull-stream-to-stream');
class ReadableStream extends stream_1.Readable {
    constructor(keys, values) {
        super({ objectMode: true });
        this.keys = keys;
        this.values = values;
        this.i = 0;
    }
    _read() {
        if (this.i >= this.keys.length) {
            this.push(null);
        }
        else {
            const obj = { key: this.keys[this.i], value: this.values[this.i] };
            this.push(obj);
            this.i++;
        }
    }
}
exports.ReadableStream = ReadableStream;
class TestDB {
    constructor(keys, values) {
        this.keys = keys;
        this.values = values;
    }
    async get(key) {
        const i = this.keys.indexOf(key);
        return this.values[i];
    }
    async put(key, val) {
        const i = this.keys.indexOf(key);
        if (i === -1) {
            this.keys.push(key);
            this.values.push(val);
        }
        else {
            this.values[i] = val;
        }
    }
    async del(key) {
        const i = this.keys.indexOf(key);
        this.keys.splice(i, 1);
        this.values.splice(i, 1);
    }
    createReadStream() {
        const keys = this.keys;
        const values = this.values;
        const stream = new ReadableStream(keys, values);
        return stream;
    }
    get raw_db() {
        return this.keys.map((key, i) => { return { key: key, value: this.values[i] }; });
    }
}
exports.TestDB = TestDB;
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
const run_node = async (private_key, config, port, bootstrapList, db_set) => {
    const peer_id = await util_1.promisify(PeerId.createFromJSON)(config.peer);
    const peer_info = new PeerInfo(peer_id);
    peer_info.multiaddrs.add(`/ip4/localhost/tcp/${port}`);
    const peer_address_list = bootstrapList.map(peer => `${peer.multiaddrs[0]}/p2p/${peer.identity.id}`);
    await data.peer_list_db.del(Buffer.from(config.peer.id).toString('hex'));
    const node = new main_1.Node({ peerInfo: peer_info }, peer_address_list);
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
    node.start((err) => {
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
            data.peer_list_db.write_obj(Buffer.from(peer_obj.identity.id).toString('hex'), peer_obj);
        });
        node.handle(`/vreath/${data.id}/tx/post`, (protocol, conn) => {
            pull(conn, pull.drain((msg) => {
                tx_routes.post(msg, chain_info_db, root_db, trie_db, tx_db, block_db, state_db, lock_db, output_db);
            }));
        });
        node.handle(`/vreath/${data.id}/block/get`, async (protocol, conn) => {
            pull(conn, pull.drain((msg) => {
                block_routes.get(msg, node, block_db);
            }));
        });
        node.handle(`/vreath/${data.id}/block/post`, (protocol, conn) => {
            pull(conn, pull.drain((msg) => {
                block_routes.post(msg, chain_info_db, root_db, trie_db, block_db, state_db, lock_db, tx_db);
            }));
        });
        node.handle(`/vreath/${data.id}/chain/get`, (protocol, conn) => {
            const stream = toStream(conn);
            chain_routes.get(stream, chain_info_db, block_db, output_db);
        });
        node.handle(`/vreath/${data.id}/chain/post`, (protocol, conn) => {
            pull(conn, pull.drain((msg) => {
                chain_routes.post(msg, block_db, chain_info_db, root_db, trie_db, state_db, lock_db, tx_db);
            }));
        });
        node.handle(`/vreath/${data.id}/unit/post`, async (protocol, conn) => {
            pull(conn, pull.drain((msg) => {
                unit_routes.post(msg, block_db, chain_info_db, root_db, trie_db, state_db, unit_db);
            }));
        });
        node.on('error', (err) => {
            throw new Error(err);
        });
        intervals.get_new_chain(node, peer_list_db, chain_info_db, block_db, root_db, trie_db, state_db, lock_db, tx_db);
        if (config.validator.flag) {
            intervals.staking(private_key, node, chain_info_db, root_db, trie_db, block_db, state_db, lock_db, output_db, tx_db, peer_list_db);
            intervals.buying_unit(private_key, config, node, chain_info_db, root_db, trie_db, block_db, state_db, lock_db, output_db, tx_db, unit_db, peer_list_db);
        }
        if (config.miner.flag) {
            intervals.refreshing(private_key, config, node, chain_info_db, root_db, trie_db, block_db, state_db, lock_db, output_db, tx_db, peer_list_db);
            intervals.making_unit(private_key, config, node, chain_info_db, root_db, trie_db, block_db, state_db, unit_db, peer_list_db);
        }
        intervals.maintenance(node, chain_info_db, block_db, root_db, trie_db, state_db, lock_db, tx_db, peer_list_db);
    });
};
