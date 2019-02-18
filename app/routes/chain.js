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
const work_1 = require("../../logic/work");
const P = __importStar(require("p-iteration"));
const request_promise_native_1 = __importDefault(require("request-promise-native"));
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
        const req_diff_sum = req.body.diff_sum || 0;
        if (typeof req_diff_sum != 'number') {
            res.status(500).send('invalid data');
            return 0;
        }
        const info = JSON.parse((await util_1.promisify(fs.readFile)('./json/chain/net_id_' + vr.con.constant.my_net_id.toString() + '/info.json', 'utf-8')));
        const my_diffs = info.pos_diffs;
        let height = 0;
        let sum = 0;
        let i;
        let index = 0;
        for (i in my_diffs) {
            index = Number(i);
            if (math.larger(sum, req_diff_sum)) {
                height = index;
                break;
            }
        }
        const chain = await work_1.read_chain(2 * (10 ** 9));
        res.json(chain.slice(height));
        return 1;
    }
    catch (e) {
        res.status(500).send('error');
    }
}).post('/', async (req, res) => {
    try {
        const new_chain = req.body;
        const my_chain = await work_1.read_chain(2 * (10 ** 9));
        const same_height = (() => {
            let same_height = 0;
            let index;
            let i;
            for (index in new_chain.slice().reverse()) {
                i = Number(index);
                if (my_chain[new_chain.length - 1 - i] != null && my_chain[new_chain.length - 1 - i].hash === new_chain[new_chain.length - 1 - i].hash) {
                    same_height = new_chain.length - 1 - i;
                }
            }
            return same_height;
        })();
        const add_chain = new_chain.slice(same_height + 1);
        const info = JSON.parse((await util_1.promisify(fs.readFile)('./json/chain/net_id_' + vr.con.constant.my_net_id.toString() + '/info.json', 'utf-8')));
        const my_diff_sum = info.pos_diffs.slice(same_height + 1).reduce((sum, diff) => math.chain(sum).add(diff).done(), 0);
        const new_diff_sum = add_chain.reduce((sum, block) => math.chain(sum).add(block.meta.pos_diff).done(), 0);
        if (math.largerEq(my_diff_sum, new_diff_sum)) {
            res.status(500).send('light chain');
            return 0;
        }
        await P.forEach(add_chain, async (block) => {
            await request_promise_native_1.default.post({
                url: 'http://localhost:57750/block',
                body: block,
                json: true
            });
        });
        res.status(200).send('success');
        return 1;
    }
    catch (e) {
        log.info(e);
        res.status(500).send('error');
    }
});
//# sourceMappingURL=chain.js.map