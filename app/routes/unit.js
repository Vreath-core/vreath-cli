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
const express = __importStar(require("express"));
const fs = __importStar(require("fs"));
const util_1 = require("util");
const work_1 = require("../../logic/work");
const data_1 = require("../../logic/data");
const router = express.Router();
exports.default = router.post('/unit', async (req, res) => {
    try {
        const unit = req.body;
        const unit_store = JSON.parse(await util_1.promisify(fs.readFile)('./json/unit_store.json', 'utf-8'));
        const roots = JSON.parse(await util_1.promisify(fs.readFile)('./json/root.json', 'utf-8'));
        const S_Trie = data_1.state_trie_ins(roots.stateroot);
        const unit_state = await S_Trie.get(unit.address) || vr.state.create_state(0, unit.address, vr.con.constant.unit, 0, { data: "[]" });
        const used = JSON.parse(unit_state.data.used || "[]");
        const iden_hash = vr.crypto.hash((vr.crypto.hex2number(unit.request) + unit.height + vr.crypto.hex2number(unit.block_hash)).toString(16));
        if (used.indexOf(iden_hash) != -1)
            res.send('already used unit');
        const chain = await work_1.read_chain(2 * (10 ** 9));
        const check = (() => {
            let search_block;
            let search_tx;
            for (search_block of chain.slice().reverse()) {
                for (search_tx of search_block.txs) {
                    if (search_tx.meta.kind === "refresh" && search_tx.meta.req_tx_hash === unit.request && search_tx.meta.height === unit.height && search_tx.meta.block_hash === unit.block_hash && search_tx.meta.output === unit.output && !vr.crypto.verify_address(unit.address) && unit.unit_price >= 0 && vr.tx.mining(unit.request, unit.height, unit.block_hash, unit.address, unit.output, unit.unit_price, unit.nonce))
                        return true;
                }
            }
            return false;
        })();
        if (!check)
            res.send('invalid unit');
        const new_unit_store = work_1.new_obj(unit_store, store => {
            store[iden_hash] = unit;
            return store;
        });
        await util_1.promisify(fs.writeFile)('./json/unit_store.json', JSON.stringify(new_unit_store, null, 4), 'utf-8');
    }
    catch (e) {
        res.status(404).send('error');
    }
});
//# sourceMappingURL=unit.js.map