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
const finalize_routes = __importStar(require("../app/routes/finalize"));
const request_tx_1 = __importDefault(require("../app/repl/request-tx"));
const get_block_1 = __importDefault(require("../app/repl/get_block"));
const get_chain_info_1 = __importDefault(require("../app/repl/get_chain_info"));
const output_chain_1 = __importDefault(require("../app/repl/output_chain"));
const balance_1 = __importDefault(require("../app/repl/balance"));
const data = __importStar(require("../logic/data"));
const intervals = __importStar(require("../logic/interval"));
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const repl = __importStar(require("repl"));
const readline_sync_1 = __importDefault(require("readline-sync"));
const crypto_js_1 = __importDefault(require("crypto-js"));
const P = __importStar(require("p-iteration"));
const PeerInfo = require('peer-info');
const PeerId = require('peer-id');
const Multiaddr = require('multiaddr');
const libp2p = require('libp2p');
const TCP = require('libp2p-tcp');
const WS = require('libp2p-websockets');
const SPDY = require('libp2p-spdy');
const MPLEX = require('libp2p-mplex');
const SECIO = require('libp2p-secio');
const MulticastDNS = require('libp2p-mdns');
const Bootstrap = require('libp2p-bootstrap');
const pull = require('pull-stream');
const toStream = require('pull-stream-to-stream');
const search_ip = require('ip');
const mapMuxers = (list) => {
    return list.map((pref) => {
        if (typeof pref !== 'string') {
            return pref;
        }
        switch (pref.trim().toLowerCase()) {
            case 'spdy': return SPDY;
            case 'mplex': return MPLEX;
            default:
                throw new Error(pref + ' muxer not available');
        }
    });
};
const getMuxers = (muxers) => {
    const muxerPrefs = process.env.LIBP2P_MUXER;
    if (muxerPrefs && !muxers) {
        return mapMuxers(muxerPrefs.split(','));
    }
    else if (muxers) {
        return mapMuxers(muxers);
    }
    else {
        return [MPLEX, SPDY];
    }
};
class Node extends libp2p {
    constructor(_peerinfo, _muxer, _bootstrapList) {
        const option = {
            modules: {
                transport: [
                    TCP,
                    WS
                ],
                streamMuxer: getMuxers(_muxer),
                connEncryption: [SECIO],
                peerDiscovery: [
                    MulticastDNS,
                    Bootstrap
                ]
            },
            config: {
                peerDiscovery: {
                    mdns: {
                        interval: 10000,
                        enabled: false
                    },
                    bootstrap: {
                        interval: 10000,
                        enabled: false,
                        list: _bootstrapList
                    }
                },
                dht: {
                    kBucketSize: 20
                }
            },
            peerInfo: _peerinfo
        };
        super(option);
    }
}
exports.Node = Node;
exports.run = async (config, log) => {
    const trie_db = data.make_db_obj(path.join(__dirname, `../db/net_id_${data.id}/trie`));
    const state_db = data.make_db_obj(path.join(__dirname, `../db/net_id_${data.id}/state`));
    const lock_db = data.make_db_obj(path.join(__dirname, `../db/net_id_${data.id}/lock`));
    const block_db = data.make_db_obj(path.join(__dirname, `../db/net_id_${data.id}/block`));
    const chain_info_db = data.make_db_obj(path.join(__dirname, `../db/net_id_${data.id}/chain_info`));
    const tx_db = data.make_db_obj(path.join(__dirname, `../db/net_id_${data.id}/tx_pool`));
    const output_db = data.make_db_obj(path.join(__dirname, `../db/net_id_${data.id}/output`));
    const root_db = data.make_db_obj(path.join(__dirname, `../db/net_id_${data.id}/root`));
    const unit_db = data.make_db_obj(path.join(__dirname, `../db/net_id_${data.id}/unit_store`));
    const peer_list_db = data.make_db_obj(path.join(__dirname, `../db/net_id_${data.id}/peer_list`));
    const uniter_db = data.make_db_obj(path.join(__dirname, `../db/net_id_${data.id}/uniter`));
    const finalize_db = data.make_db_obj(path.join(__dirname, `../db/net_id_${data.id}/finalize`));
    const my_password = readline_sync_1.default.question('Your password:', { hideEchoBack: true, defaultInput: 'password' });
    const my_key = vr.crypto.get_sha256(Buffer.from(my_password, 'utf-8').toString('hex')).slice(0, 122);
    const get_private = fs.readFileSync('./keys/private/' + my_key + '.txt', 'utf-8');
    const private_key = crypto_js_1.default.AES.decrypt(get_private, my_key).toString(crypto_js_1.default.enc.Utf8);
    const peer_id = await util_1.promisify(PeerId.createFromJSON)(config.peer);
    const peer_info = new PeerInfo(peer_id);
    const ip = search_ip.address();
    peer_info.multiaddrs.add(`/ip4/${ip}/tcp/5577`);
    const bootstrapList = JSON.parse(Buffer.from(await util_1.promisify(fs.readFile)(path.join(__dirname, '../genesis_peers.json'), 'utf-8')).toString());
    const peer_address_list = bootstrapList.map(peer => `${peer.multiaddrs[0]}/p2p/${peer.identity.id}`);
    await P.forEach(bootstrapList, async (peer) => {
        await peer_list_db.write_obj(Buffer.from(config.peer.id).toString('hex'), peer);
    });
    await peer_list_db.del(Buffer.from(config.peer.id).toString('hex'));
    const node = new Node(peer_info, ['spdy', 'mplex'], peer_address_list);
    node.start((err) => {
        exports.node_handles(node, private_key, config, chain_info_db, root_db, trie_db, block_db, state_db, lock_db, output_db, tx_db, unit_db, peer_list_db, finalize_db, uniter_db, log);
        exports.run_intervals(node, private_key, config, chain_info_db, root_db, trie_db, block_db, state_db, lock_db, output_db, tx_db, unit_db, peer_list_db, finalize_db, uniter_db, log);
        exports.accept_repl(node, private_key, chain_info_db, root_db, trie_db, block_db, state_db, lock_db, tx_db, peer_list_db, log);
    });
};
exports.node_handles = (node, private_key, config, chain_info_db, root_db, trie_db, block_db, state_db, lock_db, output_db, tx_db, unit_db, peer_list_db, finalize_db, uniter_db, log) => {
    node.on('peer:connect', (peerInfo) => {
        try {
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
            peer_list_db.write_obj(Buffer.from(peer_obj.identity.id).toString('hex'), peer_obj);
        }
        catch (e) {
            log.info(e);
        }
    });
    node.on('peer:disconnect', (peerInfo) => {
        try {
            const ids = new PeerInfo(PeerId.createFromB58String(peerInfo.id._idB58String));
            const id = ids.id._idB58String;
            peer_list_db.del(Buffer.from(id).toString('hex'));
        }
        catch (e) {
            log.info(e);
        }
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
                        handshake_1.default(res, peer_list_db, config.peer.id, node, log);
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
        let data = [];
        pull(conn, pull.drain((msg) => {
            try {
                if (msg != null && msg.length > 0) {
                    const str = msg.toString('utf-8');
                    if (str != 'end')
                        data.push(str);
                    else {
                        const res = data.reduce((json, str) => json + str, '');
                        tx_routes.post(Buffer.from(res, 'utf-8'), chain_info_db, root_db, trie_db, tx_db, block_db, state_db, lock_db, output_db, log);
                        data = [];
                    }
                }
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
        let data = [];
        pull(conn, pull.drain((msg) => {
            try {
                if (msg != null && msg.length > 0) {
                    const str = msg.toString('utf-8');
                    if (str != 'end')
                        data.push(str);
                    else {
                        const res = data.reduce((json, str) => json + str, '');
                        block_routes.post(Buffer.from(res, 'utf-8'), chain_info_db, root_db, trie_db, block_db, state_db, lock_db, tx_db, peer_list_db, finalize_db, uniter_db, private_key, node, log);
                        data = [];
                    }
                }
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
                    stream.end();
                }
            });
            stream.on('error', (e) => {
                log.info(e);
                stream.end();
            });
        }
        catch (e) {
            log.info(e);
        }
    });
    /*node.handle(`/vreath/${data.id}/chain/post`, (protocol:string, conn:string) => {
        pull(
            conn,
            pull.drain((msg:Buffer)=>{
                try{
                    chain_routes.post(msg.toString('utf-8'),block_db,finalize_db,uniter_db,chain_info_db,root_db,trie_db,state_db,lock_db,tx_db,peer_list_db,private_key,node,log);
                }
                catch(e){
                    log.info(e);
                }
            })
        )
    });*/
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
    node.handle(`/vreath/${data.id}/finalize/post`, (protocol, conn) => {
        let data = [];
        pull(conn, pull.drain((msg) => {
            try {
                if (msg != null && msg.length > 0) {
                    const str = msg.toString('utf-8');
                    if (str != 'end')
                        data.push(str);
                    else {
                        const res = data.reduce((json, str) => json + str, '');
                        finalize_routes.post(Buffer.from(res, 'utf-8'), block_db, uniter_db, root_db, trie_db, state_db, finalize_db, log);
                        data = [];
                    }
                }
            }
            catch (e) {
                log.info(e);
            }
        }));
    });
    node.on('error', (err) => {
        log.info(err);
    });
};
exports.run_intervals = (node, private_key, config, chain_info_db, root_db, trie_db, block_db, state_db, lock_db, output_db, tx_db, unit_db, peer_list_db, finalize_db, uniter_db, log) => {
    intervals.shake_hands(node, peer_list_db, log);
    intervals.get_new_chain(private_key, node, peer_list_db, chain_info_db, block_db, finalize_db, uniter_db, root_db, trie_db, state_db, lock_db, tx_db, log);
    if (config.validator.flag) {
        intervals.staking(private_key, node, chain_info_db, root_db, trie_db, block_db, state_db, lock_db, output_db, tx_db, peer_list_db, finalize_db, uniter_db, log);
        intervals.buying_unit(private_key, config, node, chain_info_db, root_db, trie_db, block_db, state_db, lock_db, output_db, tx_db, unit_db, peer_list_db, log);
    }
    if (config.miner.flag) {
        intervals.refreshing(private_key, config, node, chain_info_db, root_db, trie_db, block_db, state_db, lock_db, output_db, tx_db, peer_list_db, log);
        intervals.making_unit(private_key, config, node, chain_info_db, root_db, trie_db, block_db, state_db, unit_db, peer_list_db, log);
    }
};
exports.accept_repl = (node, private_key, chain_info_db, root_db, trie_db, block_db, state_db, lock_db, tx_db, peer_list_db, log) => {
    const replServer = repl.start({ prompt: '>', terminal: true });
    replServer.defineCommand('request-tx', {
        help: 'Create request tx',
        async action(input) {
            const tx = await request_tx_1.default(input, private_key, chain_info_db, root_db, trie_db, state_db, lock_db, tx_db);
            await peer_list_db.filter('hex', 'utf8', async (key, peer) => {
                const peer_id = await util_1.promisify(PeerId.createFromJSON)(peer.identity);
                const peer_info = new PeerInfo(peer_id);
                peer.multiaddrs.forEach(add => peer_info.multiaddrs.add(add));
                node.dialProtocol(peer_info, `/vreath/${data.id}/tx/post`, (err, conn) => {
                    if (err) {
                        log.info(err);
                    }
                    pull(pull.values([JSON.stringify([tx, []]), 'end']), conn);
                });
                return false;
            });
        }
    });
    replServer.defineCommand('balance', {
        help: 'Show your VRT balance',
        async action() {
            const balance = await balance_1.default(private_key, chain_info_db, root_db, trie_db, state_db);
            console.log(balance);
        }
    });
    replServer.defineCommand('get-block', {
        help: 'Show the block specified by height',
        async action(input) {
            const block = await get_block_1.default(input, block_db);
            console.log(JSON.stringify(block, null, 4));
        }
    });
    replServer.defineCommand('get-chain-info', {
        help: 'Show the chain info',
        async action() {
            const pub_key = vr.crypto.private2public(private_key);
            const native_address = vr.crypto.generate_address(vr.con.constant.native, pub_key);
            const unit_address = vr.crypto.generate_address(vr.con.constant.unit, pub_key);
            const info = await get_chain_info_1.default(chain_info_db, root_db, trie_db, state_db, native_address, unit_address);
            console.log(JSON.stringify(info, null, 4));
        }
    });
    replServer.defineCommand('output-chain', {
        help: 'output chain as zip of json files',
        async action() {
            await output_chain_1.default(chain_info_db, block_db);
        }
    });
};
