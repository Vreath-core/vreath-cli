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
const bunyan_1 = __importDefault(require("bunyan"));
const math = __importStar(require("mathjs"));
math.config({
    number: 'BigNumber'
});
const log = bunyan_1.default.createLogger({
    name: 'vreath-cli',
    streams: [
        {
            path: './log/log.log'
        }
    ]
});
const router = express.Router();
exports.default = router.get('/', async (req, res) => {
    try {
        const info = req.body;
        const height = info.height;
        if (typeof height != 'number') {
            res.status(500).send('invalid request data');
            return 0;
        }
        const chain = await work_1.read_chain(2 * (10 ** 9));
        const block = chain[height];
        const hash = info.hash || block.hash;
        if (hash != block.hash) {
            res.status(500).send('invalid hash');
            return 0;
        }
        res.json(block);
        return 1;
    }
    catch (e) {
        res.status(500).send('error');
    }
}).post('/', async (req, res) => {
    try {
        const block = req.body;
        if (!vr.block.isBlock(block)) {
            res.status(500).send('invalid block');
            return 0;
        }
        const version = block.meta.version || 0;
        const net_id = block.meta.network_id || 0;
        const chain_id = block.meta.chain_id || 0;
        if (version < vr.con.constant.compatible_version || net_id != vr.con.constant.my_net_id || chain_id != vr.con.constant.my_chain_id) {
            res.status(500).send('unsupported　version');
            return 0;
        }
        const info = JSON.parse((await util_1.promisify(fs.readFile)('./json/chain/net_id_' + vr.con.constant.my_net_id.toString() + '/info.json', 'utf-8')));
        if (block.meta.height != info.last_height + 1) {
            res.status(500).send('invalid height block');
            return 0;
        }
        const chain = await work_1.read_chain(2 * (10 ** 9));
        if (block.meta.kind === 'micro' && vr.block.search_key_block(chain).meta.validator != block.meta.validator) {
            res.status(500).send('invalid validator');
            return 0;
        }
        const roots = JSON.parse(await util_1.promisify(fs.readFile)('./json/root.json', 'utf-8'));
        const pool = await work_1.read_pool(10 ** 9);
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
        await work_1.write_pool(new_pool);
        res.status(200).send('success');
        return 1;
    }
    catch (e) {
        log.info(e);
        res.status(500).send('error');
    }
});
//# sourceMappingURL=block.js.map