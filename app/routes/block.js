"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const express = __importStar(require("express"));
const vr = __importStar(require("vreath"));
const fs = __importStar(require("fs"));
const util_1 = require("util");
const logic = __importStar(require("../../logic/data"));
const P = __importStar(require("p-iteration"));
const router = express.Router();
exports.default = router.post('/block', async (req, res) => {
    try {
        const block = req.body;
        if (!vr.block.isBlock(block))
            res.send('invalid block');
        const version = block.meta.version || 0;
        const net_id = block.meta.network_id || 0;
        const chain_id = block.meta.chain_id || 0;
        if (version < vr.con.constant.compatible_version || net_id != vr.con.constant.my_net_id || chain_id != vr.con.constant.my_chain_id)
            res.send('unsupported　version');
        else {
            const chain = JSON.parse(await util_1.promisify(fs.readFile)('./json/chain.json', 'utf-8'));
            const roots = JSON.parse(await util_1.promisify(fs.readFile)('./json/root.json', 'utf-8'));
            const pool = JSON.parse(await util_1.promisify(fs.readFile)('./json/pool.json', 'utf-8'));
            const S_Trie = logic.state_trie_ins(roots.stateroot);
            const StateData = await logic.get_block_statedata(block, chain, S_Trie);
            const L_Trie = logic.lock_trie_ins(roots.lockroot);
            const LockData = await logic.get_block_lockdata(block, chain, L_Trie);
            const check = (() => {
                if (block.meta.kind === 'key')
                    return vr.block.verify_key_block(block, chain, roots.stateroot, roots.lockroot, StateData);
                else if (block.meta.kind === 'micro')
                    return vr.block.verify_micro_block(block, chain, roots.stateroot, roots.lockroot, StateData, LockData);
                else
                    return false;
            })();
            if (!check)
                res.status(404).send('invalid block');
            else {
                const accepted = (() => {
                    if (block.meta.kind === 'key')
                        return vr.block.accept_key_block(block, chain, StateData, LockData);
                    else
                        return vr.block.accept_micro_block(block, chain, StateData, LockData);
                })();
                await P.forEach(accepted[0], async (state) => {
                    if (state.kind === 'state')
                        await S_Trie.put(state.owner, state);
                    else
                        await S_Trie.put(state.token, state);
                });
                await P.forEach(accepted[1], async (lock) => {
                    await L_Trie.put(lock.address, lock);
                });
                const new_chain = chain.concat(block);
                await util_1.promisify(fs.writeFile)('./json/chain.json', JSON.stringify(new_chain, null, 4), 'utf-8');
                const new_roots = {
                    stateroot: S_Trie.now_root(),
                    lockroot: L_Trie.now_root()
                };
                await util_1.promisify(fs.writeFile)('./json/root.json', JSON.stringify(new_roots, null, 4), 'utf-8');
                const txs_hash = block.txs.map(pure => pure.hash);
                const new_pool_keys = Object.keys(pool).filter(key => txs_hash.indexOf(key) === -1);
                const new_pool = new_pool_keys.reduce((obj, key) => {
                    obj[key] = pool[key];
                    return obj;
                }, {});
                await util_1.promisify(fs.writeFile)('./json/pool.json', JSON.stringify(new_pool, null, 4), 'utf-8');
                res.status(200).send('success');
            }
        }
    }
    catch (e) {
        console.log(e);
        res.status(404).send('error');
    }
});
//# sourceMappingURL=block.js.map