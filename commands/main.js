#! /usr/bin/env node
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
const setup_1 = __importDefault(require("./setup"));
const generate_keys_1 = __importDefault(require("./generate-keys"));
const set_peer_id_1 = __importDefault(require("./set-peer-id"));
const config_1 = require("./config");
const tx_routes = __importStar(require("../app/routes/tx"));
const block_routes = __importStar(require("../app/routes/block"));
const chain_routes = __importStar(require("../app/routes/chain"));
const unit_routes = __importStar(require("../app/routes/unit"));
const request_tx_1 = __importDefault(require("../app/repl/request-tx"));
const get_block_1 = __importDefault(require("../app/repl/get_block"));
const get_chain_info_1 = __importDefault(require("../app/repl/get_chain_info"));
const output_chain_1 = __importDefault(require("../app/repl/output_chain"));
const balance_1 = __importDefault(require("../app/repl/balance"));
const data = __importStar(require("../logic/data"));
const intervals = __importStar(require("../logic/interval"));
const node_1_1 = require("../test/node_1");
const node_2_1 = require("../test/node_2");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const bunyan_1 = __importDefault(require("bunyan"));
const yargs_1 = __importDefault(require("yargs"));
const repl = __importStar(require("repl"));
const readline_sync_1 = __importDefault(require("readline-sync"));
const crypto_js_1 = __importDefault(require("crypto-js"));
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
const search_ip = require('ip');
class Node extends libp2p {
    constructor(_options, _bootstrapList) {
        const defaults = {
            // The libp2p modules for this libp2p bundle
            modules: {
                transport: [
                    TCP // It can take instances too!
                ],
                streamMuxer: [
                    MPLEX
                ],
                connEncryption: [
                    SECIO
                ],
                /** Encryption for private networks. Needs additional private key to work **/
                // connProtector: new Protector(/*protector specific opts*/),
                /** Enable custom content routers, such as delegated routing **/
                // contentRouting: [
                //   new DelegatedContentRouter(peerInfo.id)
                // ],
                /** Enable custom peer routers, such as delegated routing **/
                // peerRouting: [
                //   new DelegatedPeerRouter()
                // ],
                peerDiscovery: [
                    Bootstrap
                ] // DHT enables PeerRouting, ContentRouting and DHT itself components
            },
            // libp2p config options (typically found on a config.json)
            config: {
                peerDiscovery: {
                    /* */ /*autoDial: true,             // Auto connect to discovered peers (limited by ConnectionManager minPeers)
                    mdns: {                     // mdns options
                      interval: 1000,           // ms
                      enabled: true
                    },
                    webrtcStar: {               // webrtc-star options
                      interval: 1000,           // ms
                      enabled: false
                    },*/
                    bootstrap: {
                        interval: 2000,
                        enabled: true,
                        list: _bootstrapList
                    }
                    // .. other discovery module options.
                },
            }
        };
        // overload any defaults of your bundle using https://github.com/nodeutils/defaults-deep
        super(defaultsDeep(_options, defaults));
    }
}
exports.Node = Node;
const log = bunyan_1.default.createLogger({
    name: 'vreath-cli',
    streams: [
        {
            path: path.join(__dirname, '../log/log.log')
        }
    ]
});
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/config.json'), 'utf-8'));
yargs_1.default
    .usage('Usage: $0 <command> [options]')
    .command('setup', 'setup data', {}, async () => {
    try {
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
        const my_password = readline_sync_1.default.question('Your password:', { hideEchoBack: true, defaultInput: 'password' });
        await setup_1.default((Buffer.from(my_password, 'utf-8').toString('hex')), state_db, lock_db, trie_db, chain_info_db, block_db, root_db, tx_db, output_db, unit_db, peer_list_db);
        process.exit(1);
    }
    catch (e) {
        console.log(e);
        process.exit(1);
    }
})
    .command('run', 'run node', {}, async () => {
    try {
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
        await peer_list_db.del(Buffer.from(config.peer.id).toString('hex'));
        const node = new Node({ peerInfo: peer_info }, peer_address_list);
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
                peer_list_db.write_obj(Buffer.from(peer_obj.identity.id).toString('hex'), peer_obj);
            });
            node.handle(`/vreath/${data.id}/tx/post`, (protocol, conn) => {
                pull(conn, pull.drain((msg) => {
                    try {
                        tx_routes.post(msg, chain_info_db, root_db, trie_db, tx_db, block_db, state_db, lock_db, output_db);
                    }
                    catch (e) {
                        log.info(e);
                    }
                }));
            });
            node.handle(`/vreath/${data.id}/block/get`, async (protocol, conn) => {
                pull(conn, pull.drain((msg) => {
                    try {
                        block_routes.get(msg, node, block_db);
                    }
                    catch (e) {
                        log.info(e);
                    }
                }));
            });
            node.handle(`/vreath/${data.id}/block/post`, (protocol, conn) => {
                pull(conn, pull.drain((msg) => {
                    try {
                        block_routes.post(msg, chain_info_db, root_db, trie_db, block_db, state_db, lock_db, tx_db);
                    }
                    catch (e) {
                        log.info(e);
                    }
                }));
            });
            node.handle(`/vreath/${data.id}/chain/get`, (protocol, conn) => {
                const stream = toStream(conn);
                try {
                    chain_routes.get(stream, chain_info_db, block_db, output_db);
                }
                catch (e) {
                    log.info(e);
                }
            });
            node.handle(`/vreath/${data.id}/chain/post`, (protocol, conn) => {
                pull(conn, pull.drain((msg) => {
                    try {
                        chain_routes.post(msg, block_db, chain_info_db, root_db, trie_db, state_db, lock_db, tx_db);
                    }
                    catch (e) {
                        log.info(e);
                    }
                }));
            });
            node.handle(`/vreath/${data.id}/unit/post`, async (protocol, conn) => {
                pull(conn, pull.drain((msg) => {
                    try {
                        unit_routes.post(msg, block_db, chain_info_db, root_db, trie_db, state_db, unit_db);
                    }
                    catch (e) {
                        log.info(e);
                    }
                }));
            });
            node.on('error', (err) => {
                log.info(err);
            });
            intervals.get_new_chain(node, peer_list_db, chain_info_db, block_db, root_db, trie_db, state_db, lock_db, tx_db, log.info);
            if (config.validator.flag) {
                intervals.staking(private_key, node, chain_info_db, root_db, trie_db, block_db, state_db, lock_db, output_db, tx_db, peer_list_db, log.info);
                intervals.buying_unit(private_key, config, node, chain_info_db, root_db, trie_db, block_db, state_db, lock_db, output_db, tx_db, unit_db, peer_list_db, log.info);
            }
            if (config.miner.flag) {
                intervals.refreshing(private_key, config, node, chain_info_db, root_db, trie_db, block_db, state_db, lock_db, output_db, tx_db, peer_list_db, log.info);
                intervals.making_unit(private_key, config, node, chain_info_db, root_db, trie_db, block_db, state_db, unit_db, peer_list_db, log.info);
            }
            intervals.maintenance(node, chain_info_db, block_db, root_db, trie_db, state_db, lock_db, tx_db, peer_list_db, log.info);
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
                            pull(pull.values([JSON.stringify([tx, []])]), conn);
                        });
                        return false;
                    });
                }
            });
            /*replServer.defineCommand('remit',{
                help: 'Create request tx',
                async action(input){
                    await remit(input,config,my_private);
                }
            });*/
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
                    const info = await get_chain_info_1.default(chain_info_db);
                    console.log(JSON.stringify(info, null, 4));
                }
            });
            replServer.defineCommand('output-chain', {
                help: 'output chain as zip of json files',
                async action() {
                    await output_chain_1.default(chain_info_db, block_db);
                }
            });
        });
    }
    catch (e) {
        log.info(e);
    }
})
    .command('demo <id>', 'demonstration', {
    'id': {
        describe: 'node id(1:validator,2:miner)',
        type: 'number'
    }
}, async (argv) => {
    try {
        const id = argv.id;
        if (id == null)
            throw new Error('enter node id');
        const nodes = [node_1_1.run_node1, node_2_1.run_node2];
        await nodes[id - 1]();
    }
    catch (e) {
        console.log(e);
    }
})
    .command('generate-keys', 'generate new key', {}, async () => {
    try {
        await generate_keys_1.default();
        process.exit(1);
    }
    catch (e) {
        console.log(e);
        process.exit(1);
    }
})
    .command('get-native-balance', 'get native balance', {}, async () => {
    try {
        const trie_db = data.make_db_obj(path.join(__dirname, `../db/net_id_${data.id}/trie`));
        const state_db = data.make_db_obj(path.join(__dirname, `../db/net_id_${data.id}/state`));
        const chain_info_db = data.make_db_obj(path.join(__dirname, `../db/net_id_${data.id}/chain_info`));
        const root_db = data.make_db_obj(path.join(__dirname, `../db/net_id_${data.id}/root`));
        const my_password = readline_sync_1.default.question('Your password:', { hideEchoBack: true, defaultInput: 'password' });
        const my_key = vr.crypto.get_sha256(Buffer.from(my_password, 'utf-8').toString('hex')).slice(0, 122);
        const get_private = fs.readFileSync('./keys/private/' + my_key + '.txt', 'utf-8');
        const private_key = crypto_js_1.default.AES.decrypt(get_private, my_key).toString(crypto_js_1.default.enc.Utf8);
        console.log(await balance_1.default(private_key, chain_info_db, root_db, trie_db, state_db));
        process.exit(1);
    }
    catch (e) {
        console.log(e);
        process.exit(1);
    }
})
    .command('set-peer-id', 'set my peer id', {}, async () => {
    try {
        await set_peer_id_1.default();
    }
    catch (e) {
        console.log(e);
        process.exit(1);
    }
})
    .command('decrypt-genesis-peers', 'decrypt genesis peers', {}, async () => {
    try {
        const my_setup_pass = readline_sync_1.default.question('Key for Testnet:', { hideEchoBack: true, defaultInput: 'password' });
        const my_key = vr.crypto.get_sha256(Buffer.from(my_setup_pass, 'utf-8').toString('hex')).slice(0, 122);
        const genesis_crypted_peers = await util_1.promisify(fs.readFile)(path.join(__dirname, '../crypted_genesis_peer.txt'), 'utf-8');
        const genesis_peers = crypto_js_1.default.AES.decrypt(genesis_crypted_peers, my_key).toString(crypto_js_1.default.enc.Utf8);
        await util_1.promisify(fs.writeFile)(path.join(__dirname, '../genesis_peers.json'), genesis_peers);
        process.exit(1);
    }
    catch (e) {
        console.log(e);
        process.exit(1);
    }
})
    .command('config [miner_mode] [miner_interval] [miner_gas_share] [miner_unit_price] [validator_mode] [validator_min] [validator_fee] [validator_gas]', 'set config', {
    'miner_mode': {
        describe: 'flag for mining',
        type: 'boolean'
    },
    'miner_interval': {
        describe: 'mining interval',
        type: 'number'
    },
    'miner_gas_share': {
        describe: 'gas-share of refresh-tx',
        type: 'number'
    },
    'miner_unit_price': {
        describe: 'unit price',
        type: 'string'
    },
    'validator_mode': {
        describe: 'flag for validate',
        type: 'boolean'
    },
    'validator_min': {
        describe: 'minimum balance to buy units',
        type: 'string'
    },
    'validator_fee': {
        describe: 'fee for unit-buying-tx',
        type: 'string'
    },
    'validator_gas': {
        describe: 'gas for unit-buying-tx',
        type: 'string'
    }
}, async (argv) => {
    try {
        await config_1.set_config(config, argv);
        process.exit(1);
    }
    catch (e) {
        console.log(e);
        process.exit(1);
    }
})
    .fail((msg, err) => {
    if (err)
        console.log(err);
    else
        console.log(msg);
    process.exit(1);
}).help().recommendCommands().argv;
