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
const data = __importStar(require("../logic/data"));
const genesis = __importStar(require("../genesis/index"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const util_1 = require("util");
const P = __importStar(require("p-iteration"));
const readline_sync_1 = __importDefault(require("readline-sync"));
exports.default = async () => {
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
    const my_password = Buffer.from(readline_sync_1.default.question('Your password:', { hideEchoBack: true, defaultInput: 'password' }), 'utf-8').toString('hex');
    const my_key = vr.crypto.get_sha256(my_password).slice(0, 122);
    await util_1.promisify(fs.stat)(path.join(__dirname, '../keys/private/' + my_key + '.txt'));
    await state_db.filter('hex', 'utf8', async (key, val) => {
        await state_db.del(key);
        return false;
    });
    await lock_db.filter('hex', 'utf8', async (key, val) => {
        await lock_db.del(key);
        return false;
    });
    const trie = vr.data.trie_ins(trie_db);
    await vr.data.write_trie(trie, state_db, lock_db, genesis.state[0], genesis.lock[0]);
    const root = trie.now_root();
    await chain_info_db.del('00');
    await block_db.filter('hex', 'utf8', async (key, val) => {
        await block_db.del(key);
        return false;
    });
    const info = {
        net_id: vr.con.constant.my_net_id,
        chain_id: vr.con.constant.my_chain_id,
        version: vr.con.constant.my_version,
        compatible_version: vr.con.constant.compatible_version,
        last_height: "00",
        last_hash: genesis.block.hash,
        syncing: false,
        manual_requesting: {
            flag: false,
            failed_times: 0,
            address: '',
            tx_hash: '',
            nonce: '00'
        }
    };
    await chain_info_db.write_obj("00", info);
    await block_db.write_obj("00", genesis.block);
    await root_db.put("00", root);
    await tx_db.filter('hex', 'utf8', async (key, val) => {
        await tx_db.del(key);
        await output_db.del(key);
        return false;
    });
    await unit_db.filter('hex', 'utf8', async (key, val) => {
        await unit_db.del(key);
        return false;
    });
    const genesis_peers = JSON.parse(Buffer.from(await util_1.promisify(fs.readFile)(path.join(__dirname, '../genesis_peers.json'))).toString());
    if (genesis_peers == null)
        throw new Error("genesis peers doesn't exist");
    await P.forEach(genesis_peers, async (peer) => {
        await peer_list_db.write_obj(Buffer.from(peer.identity.id, 'utf-8').toString('hex'), peer);
    });
    await util_1.promisify(fs.writeFile)('./log/main.log', '', 'utf-8');
};
