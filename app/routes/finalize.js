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
const pull = require('pull-stream');
exports.post = async (msg, block_db, uniter_db, root_db, trie_db, state_db, finalize_db, log) => {
    try {
        const data = JSON.parse(msg.toString('utf-8'));
        if (!vr.finalize.isFinalize(data))
            throw new Error('invalid data');
        const block = await block_db.read_obj(data.height);
        if (block == null || block.meta.kind != 0 || block.hash != data.hash)
            throw new Error('invalid block height');
        const sign = data.sign;
        const finalize_hash = vr.finalize.hash(data.height, data.hash);
        const recover_id = vr.tx.get_recover_id_from_sign(sign);
        const pub_key = vr.crypto.recover(finalize_hash, sign.data, recover_id);
        const address = vr.crypto.generate_address(vr.con.constant.unit, pub_key);
        const uniters = await uniter_db.read_obj(data.height);
        if (uniters == null)
            throw new Error('no uniter at the height');
        const root = await root_db.get(data.height, 'hex');
        if (root == null)
            throw new Error('root is empty at the last height');
        const trie = vr.data.trie_ins(trie_db, root);
        const finalize_validators = await vr.finalize.choose(uniters, data.height, trie, state_db);
        if (finalize_validators.indexOf(address) === -1)
            throw new Error('invalid address');
        if (vr.crypto.verify(finalize_hash, sign.data, pub_key))
            throw new Error('invalid sign');
        await finalize_db.write_obj(data.height, data);
    }
    catch (e) {
        log.info(e);
    }
};
