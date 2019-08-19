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
const data = __importStar(require("../../logic/data"));
const works = __importStar(require("../../logic/work"));
const P = __importStar(require("p-iteration"));
const finalize_1 = require("./finalize");
const util_1 = require("util");
const big_integer_1 = __importDefault(require("big-integer"));
const PeerId = require('peer-id');
const PeerInfo = require('peer-info');
const pull = require('pull-stream');
exports.get = async (msg, stream, block_db, log) => {
    try {
        const height = msg.toString('hex');
        if (vr.checker.hex_check(height, 8, true)) {
            throw new Error('invalid request data');
        }
        const block = await block_db.read_obj(height);
        if (block == null)
            throw new Error('invalid height');
        stream.write(JSON.stringify([block]));
        stream.write('end');
    }
    catch (e) {
        log.info(e);
    }
};
exports.post = async (message, chain_info_db, root_db, trie_db, block_db, state_db, lock_db, tx_db, peer_list_db, finalize_db, uniter_db, private_key, node, log) => {
    try {
        const msg_data = JSON.parse(message.toString('utf-8'));
        const block = msg_data[0];
        const output_state = msg_data[1];
        const finalize = msg_data[2];
        if (block == null || !vr.block.isBlock(block) || output_state == null || output_state.some(s => !vr.state.isState(s)) || (finalize != null && !vr.finalize.isFinalize(finalize)))
            throw new Error('invalid data');
        const info = await chain_info_db.read_obj('00');
        if (info == null)
            throw new Error('chain_info is empty');
        const last_height = info.last_height;
        const root = await root_db.get(last_height, 'hex');
        if (root == null)
            throw new Error('root is empty at the last height');
        const trie = vr.data.trie_ins(trie_db, root);
        let verified = await (async () => {
            if (block.meta.kind === 0)
                return await vr.block.verify_key_block(block, block_db, trie, state_db, lock_db, last_height);
            else if (block.meta.kind === 1)
                return await vr.block.verify_micro_block(block, output_state, block_db, trie, state_db, lock_db, last_height);
            else
                return false;
        })();
        if (!verified) {
            throw new Error('invalid block');
        }
        if (block.meta.kind === 0)
            await vr.block.accept_key_block(block, block_db, last_height, trie, state_db, lock_db);
        else if (block.meta.kind === 1)
            await vr.block.accept_micro_block(block, output_state, block_db, trie, state_db, lock_db);
        await block_db.write_obj(block.meta.height, block);
        const new_info = await works.new_obj(info, (info) => {
            info.last_height = block.meta.height;
            info.last_hash = block.hash;
            return info;
        });
        await chain_info_db.write_obj("00", new_info);
        const new_root = trie.now_root();
        await root_db.put(block.meta.height, new_root, 'hex', 'utf8');
        const txs_hash = block.txs.map(tx => tx.hash);
        await P.forEach(txs_hash, async (key) => {
            await tx_db.del(key);
        });
        const pre_uniters = await uniter_db.read_obj(last_height) || [];
        const new_uniters = vr.finalize.rocate(pre_uniters);
        await uniter_db.write_obj(block.meta.height, new_uniters);
        if (finalize != null)
            await finalize_1.post(Buffer.from(JSON.stringify(finalize), 'utf8'), block_db, uniter_db, root_db, trie_db, state_db, finalize_db, log);
        if (block.meta.kind === 0) {
            const finalize = await works.make_finalize(private_key, block, chain_info_db, root_db, trie_db, uniter_db, state_db, log);
            if (finalize == null)
                throw new Error('fail to make valid finalize');
            const now_finalize = await finalize_db.read_obj(block.meta.height) || [];
            await finalize_db.write_obj(block.meta.height, now_finalize.concat(finalize));
            const peers = await peer_list_db.filter('hex', 'utf8');
            await P.forEach(peers, async (peer) => {
                const peer_id = await util_1.promisify(PeerId.createFromJSON)(peer.identity);
                const peer_info = new PeerInfo(peer_id);
                peer.multiaddrs.forEach(add => peer_info.multiaddrs.add(add));
                node.dialProtocol(peer_info, `/vreath/${data.id}/finalize/post`, (err, conn) => {
                    if (err) {
                        log.info(err);
                    }
                    pull(pull.values([JSON.stringify(finalize), 'end']), conn);
                });
                return false;
            });
        }
        else if (info.manual_requesting) {
            let request_info = new_info;
            const exist = block.txs.some(tx => tx.meta.kind === 0 && tx.hash === request_info.manual_requesting.tx_hash);
            const times = new_info.manual_requesting.failed_times + 1;
            request_info.manual_requesting.failed_times = times;
            if (exist || times > 10) {
                request_info.manual_requesting.flag = false;
                request_info.manual_requesting.failed_times = 0;
                request_info.manual_requesting.address = '';
                request_info.manual_requesting.tx_hash = '';
                if (!exist)
                    console.log('fail to send request-tx');
            }
            else {
                const address = request_info.manual_requesting.address;
                const new_state = await vr.data.read_from_trie(trie, state_db, address, 0, vr.state.create_state("00", vr.crypto.slice_token_part(address), address, "00", []));
                if (big_integer_1.default(request_info.manual_requesting.nonce, 16).notEquals(big_integer_1.default(new_state.nonce, 16))) {
                    const new_nonce = new_state.nonce;
                    const req_tx = await tx_db.read_obj(request_info.manual_requesting.tx_hash);
                    if (req_tx != null) {
                        const new_req_tx = await works.make_req_tx(0, new_nonce, req_tx.meta.request.bases, req_tx.meta.request.feeprice, req_tx.meta.request.gas, req_tx.meta.request.input, req_tx.meta.request.log, private_key, false, trie, state_db, lock_db);
                        request_info.manual_requesting.failed_times = 0;
                        request_info.manual_requesting.tx_hash = new_req_tx.hash;
                        await peer_list_db.filter('hex', 'utf8', async (key, peer) => {
                            const peer_id = await util_1.promisify(PeerId.createFromJSON)(peer.identity);
                            const peer_info = new PeerInfo(peer_id);
                            peer.multiaddrs.forEach(add => peer_info.multiaddrs.add(add));
                            node.dialProtocol(peer_info, `/vreath/${data.id}/tx/post`, (err, conn) => {
                                if (err) {
                                    log.info(err);
                                }
                                pull(pull.values([JSON.stringify([new_req_tx, []]), 'end']), conn);
                            });
                            return false;
                        });
                    }
                }
            }
            await chain_info_db.write_obj("00", request_info);
        }
        return 1;
    }
    catch (e) {
        log.info(e);
    }
};
