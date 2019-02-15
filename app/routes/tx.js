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
const work_1 = require("../../logic/work");
const P = __importStar(require("p-iteration"));
const router = express.Router();
exports.default = router.post('/', async (req, res) => {
    try {
        const tx = req.body;
        if (!vr.tx.isTx(tx)) {
            res.status(500).send('invalid tx');
            return 0;
        }
        const version = tx.meta.version || 0;
        const net_id = tx.meta.network_id || 0;
        const chain_id = tx.meta.chain_id || 0;
        if (version < vr.con.constant.compatible_version || net_id != vr.con.constant.my_net_id || chain_id != vr.con.constant.my_chain_id) {
            res.status(500).send('unsupported　version');
            return 0;
        }
        const pool = JSON.parse(await util_1.promisify(fs.readFile)('./json/pool.json', 'utf-8'));
        const chain = await work_1.read_chain(2 * (10 ** 9));
        const roots = JSON.parse(await util_1.promisify(fs.readFile)('./json/root.json', 'utf-8'));
        const S_Trie = logic.state_trie_ins(roots.stateroot);
        const StateData = await logic.get_tx_statedata(tx, chain, S_Trie);
        const L_Trie = logic.lock_trie_ins(roots.lockroot);
        const LockData = await logic.get_tx_lockdata(tx, chain, L_Trie);
        if (tx.meta.kind === 'refresh') {
            const req_tx = vr.tx.find_req_tx(tx, chain);
            const checked = await (async () => {
                const not_refed = await P.some(req_tx.meta.bases, async (key) => {
                    const lock = await L_Trie.get(key);
                    return lock == null || !(lock.state === "already" && lock.height === tx.meta.height && lock.block_hash === tx.meta.block_hash && lock.index === tx.meta.index && lock.tx_hash === tx.meta.req_tx_hash);
                });
                if (!not_refed)
                    return true;
                const in_pool = Object.values(pool).some(t => {
                    return t.meta.kind === 'refresh' && t.meta.req_tx_hash === tx.meta.req_tx_hash && t.meta.height === tx.meta.height && t.meta.index === tx.meta.index && t.meta.block_hash === tx.meta.block_hash;
                });
                if (in_pool)
                    return true;
                else
                    return false;
            })();
            if (!checked) {
                const valid_output = work_1.compute_output(req_tx, StateData, chain);
                const suc = !valid_output.some(s => !vr.state.verify_state(s));
                const valid_out_hash = vr.crypto.object_hash(valid_output);
                if (suc != tx.meta.success || valid_out_hash != tx.meta.output)
                    throw new Error('invalid output');
            }
        }
        const new_pool = vr.pool.tx2pool(pool, tx, chain, StateData, LockData);
        await util_1.promisify(fs.writeFile)('./json/pool.json', JSON.stringify(new_pool, null, 4), 'utf-8');
        res.status(200).send('success');
        return 1;
    }
    catch (e) {
        console.log(e);
        res.status(500).send('error');
    }
});
//# sourceMappingURL=tx.js.map