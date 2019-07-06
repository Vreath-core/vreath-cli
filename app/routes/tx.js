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
//import * as P from 'p-iteration'
exports.post = async (msg, chain_info_db, root_db, trie_db, tx_db, block_db, state_db, lock_db, output_db, log) => {
    try {
        const msg_data = JSON.parse(msg.toString('utf-8'));
        const tx = msg_data[0];
        const output_state = msg_data[1];
        if (tx == null || !vr.tx.isTx(tx) || output_state == null || output_state.some(s => !vr.state.isState(s)))
            throw new Error('invalid type of data');
        const info = await chain_info_db.read_obj("00");
        if (info == null)
            throw new Error("chain_info doesn't exist");
        const last_height = info.last_height;
        const root = await root_db.get(last_height, "hex");
        if (root == null)
            throw new Error("root doesn't exist");
        const trie = vr.data.trie_ins(trie_db, root);
        await vr.pool.tx2pool(tx_db, tx, output_state, block_db, trie, state_db, lock_db, last_height);
        await output_db.write_obj(tx.hash, output_state);
        return 1;
    }
    catch (e) {
        log.info(e);
    }
};
