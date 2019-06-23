"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const vr = __importStar(require("vreath"));
const genesis = __importStar(require("../genesis/index"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const util_1 = require("util");
const P = __importStar(require("p-iteration"));
exports.default = async (my_password, state_db, lock_db, trie_db, chain_info_db, block_db, root_db, tx_db, output_db, unit_db, peer_list_db) => {
    const my_key = vr.crypto.get_sha256(my_password).slice(0, 122);
    await util_1.promisify(fs.stat)('./keys/private/' + my_key + '.txt');
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
        last_hash: genesis.block.hash
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
    await util_1.promisify(fs.writeFile)('./log/log.log', '', 'utf-8');
};
