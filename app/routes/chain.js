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
const data_1 = require("../../logic/data");
const work_1 = require("../../logic/work");
const P = __importStar(require("p-iteration"));
const router = express.Router();
exports.default = router.post('/chain', async (req, res) => {
    try {
        const new_chain = req.body;
        const my_chain = await work_1.read_chain(2 * (10 ** 9));
        const same_height = (() => {
            let same_height = 0;
            let index;
            let i;
            for (index in new_chain.slice().reverse()) {
                i = Number(index);
                if (my_chain[i] != null && my_chain[new_chain.length - 1 - i].hash === new_chain[new_chain.length - 1 - i].hash) {
                    same_height = new_chain.length - 1 - i;
                }
            }
            return same_height;
        })();
        const add_chain = new_chain.slice(same_height + 1);
        const same_chain = my_chain.slice(0, same_height);
        const pre_info = JSON.parse((await util_1.promisify(fs.readFile)('./json/chain/net_id_' + vr.con.constant.my_net_id.toString() + '/info.json', 'utf-8')));
        const new_info = work_1.new_obj(pre_info, info => {
            info.last_height = same_height;
            info.pos_diffs = info.pos_diffs.slice(0, same_height);
            return info;
        });
        await util_1.promisify(fs.writeFile)('./json/chain/net_id_' + vr.con.constant.my_net_id.toString() + '/info.json', JSON.stringify(new_info, null, 4), 'utf-8');
        const invalid = P.some(add_chain, async (block, i) => {
            const this_chain = same_chain.concat(add_chain).slice(0, same_chain.length - 1 + i);
            const pre_block = this_chain[same_chain.length + -1 + i];
            const S_Trie = data_1.state_trie_ins(pre_block.meta.stateroot);
            const L_Trie = data_1.lock_trie_ins(pre_block.meta.lockroot);
            const StateData = await data_1.get_block_statedata(block, this_chain, S_Trie);
            const LockData = await data_1.get_block_lockdata(block, this_chain, L_Trie);
            await P.forEach(StateData, async (s) => {
                if (s.kind === 'state')
                    await S_Trie.put(s.owner, s);
                else
                    await S_Trie.put(s.token, s);
            });
            await P.forEach(LockData, async (l) => {
                await L_Trie.put(l.address, l);
            });
            const stateroot = S_Trie.now_root();
            const lockroot = L_Trie.now_root();
            if (block.meta != null && block.meta.kind === 'key' && vr.block.verify_key_block(block, this_chain, stateroot, lockroot, StateData)) {
                await work_1.write_chain(block);
                return false;
            }
            else if (block.meta != null && block.meta.kind === 'micro' && vr.block.verify_micro_block(block, this_chain, stateroot, lockroot, StateData, LockData)) {
                await work_1.write_chain(block);
                return false;
            }
            else
                return true;
        });
        if (invalid) {
            res.status(500).send('invalid chain');
            return 0;
        }
        else {
            res.send('success');
            return 1;
        }
    }
    catch (e) {
        console.log(e);
        res.status(500).send('error');
    }
});
//# sourceMappingURL=chain.js.map