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
const express = __importStar(require("express"));
const vr = __importStar(require("vreath"));
const fs = __importStar(require("fs"));
const util_1 = require("util");
const logic = __importStar(require("../../logic/data"));
const work_1 = require("../../logic/work");
const P = __importStar(require("p-iteration"));
const main_1 = require("../../run/main");
const request_promise_native_1 = __importDefault(require("request-promise-native"));
const router = express.Router();
exports.default = router.post('/', async (req, res) => {
    try {
        const get_block = req.body;
        if (!vr.block.isBlock(get_block)) {
            res.status(500).send('invalid block');
            return 0;
        }
        main_1.yets.add_block(get_block);
        const block = main_1.yets.blocks[0];
        const version = block.meta.version || 0;
        const net_id = block.meta.network_id || 0;
        const chain_id = block.meta.chain_id || 0;
        if (version < vr.con.constant.compatible_version || net_id != vr.con.constant.my_net_id || chain_id != vr.con.constant.my_chain_id) {
            res.status(500).send('unsupported　version');
            return 0;
        }
        const chain = await work_1.read_chain(2 * (10 ** 9));
        if (block.meta.height < chain.length - 1) {
            res.status(500).send('old block');
            return 0;
        }
        if (block.meta.height > chain.length - 1) {
            res.status(200).send('order chain');
            return 0;
        }
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
        if (!check) {
            res.status(500).send('invalid block');
            return 0;
        }
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
        await work_1.write_chain(block);
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
        const peers = JSON.parse(await util_1.promisify(fs.readFile)('./json/peer_list.json', 'utf-8') || "[]");
        await P.forEach(peers, async (peer) => {
            const url1 = 'http://' + peer.ip + ':57750/block';
            const option1 = {
                url: url1,
                body: block,
                json: true
            };
            const order = await request_promise_native_1.default.post(option1);
            if (order != 'order chain')
                return 1;
            const url2 = 'http://' + peer.ip + ':57750/chain';
            const option2 = {
                url: url2,
                body: chain.concat(block),
                json: true
            };
            await request_promise_native_1.default.post(option2);
        });
        main_1.yets.delete();
        return 1;
    }
    catch (e) {
        console.log(e);
        res.status(500).send('error');
    }
});
//# sourceMappingURL=block.js.map