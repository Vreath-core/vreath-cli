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
const express = __importStar(require("express"));
const work_1 = require("../../logic/work");
const data_1 = require("../../logic/data");
const bunyan_1 = __importDefault(require("bunyan"));
const log = bunyan_1.default.createLogger({
    name: 'vreath-cli',
    streams: [
        {
            path: './log/log.log'
        }
    ]
});
const router = express.Router();
exports.default = router.post('/', async (req, res) => {
    try {
        const unit = req.body;
        const unit_store = await data_1.get_unit_store();
        const roots = await data_1.read_root();
        const S_Trie = data_1.state_trie_ins(roots.stateroot);
        const unit_state = await data_1.read_state(S_Trie, unit.address, vr.state.create_state(0, unit.address, vr.con.constant.unit, 0, { data: "[]" }));
        const used = JSON.parse(unit_state.data.used || "[]");
        const iden_hash = vr.crypto.hash(unit.request + unit.height.toString(16) + unit.block_hash);
        if (used.indexOf(iden_hash) != -1) {
            res.status(500).send('already used unit');
            return 0;
        }
        const chain = await data_1.read_chain(2 * (10 ** 9));
        const check = (() => {
            let search_block;
            let search_tx;
            for (search_block of chain.slice().reverse()) {
                for (search_tx of search_block.txs) {
                    if (search_tx.meta.kind === "refresh" && search_tx.meta.req_tx_hash === unit.request && search_tx.meta.height === unit.height && search_tx.meta.block_hash === unit.block_hash && search_tx.meta.output === unit.output && vr.crypto.verify_address(unit.address) && unit.unit_price >= 0 && vr.tx.mining(unit.request, unit.height, unit.block_hash, unit.address, unit.output, unit.unit_price, unit.nonce))
                        return true;
                }
            }
            return false;
        })();
        if (!check) {
            res.status(500).send('invalid unit');
            return 0;
        }
        const new_unit_store = work_1.new_obj(unit_store, store => {
            const key = vr.crypto.hash(unit.request + unit.height.toString(16) + unit.block_hash + unit.address);
            store[key] = unit;
            return store;
        });
        let w_unit;
        for (w_unit of Object.values(new_unit_store)) {
            await data_1.write_unit(w_unit);
        }
        res.status(200).send('success');
        return 1;
    }
    catch (e) {
        log.info(e);
        res.status(404).send('error');
    }
});
//# sourceMappingURL=unit.js.map