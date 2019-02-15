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
const works = __importStar(require("../../logic/work"));
const data = __importStar(require("../../logic/data"));
const fs = __importStar(require("fs"));
const util_1 = require("util");
const request_promise_native_1 = __importDefault(require("request-promise-native"));
const P = __importStar(require("p-iteration"));
exports.default = async (input, config, my_private) => {
    try {
        const splited = input.split('--').slice(1);
        ;
        const user_pub = config.pub_keys[config.user.use];
        const type = splited[0].split('=')[1].trim();
        const tokens = splited[1].split('=')[1].trim().split(',');
        const bases = splited[2].split('=')[1].trim().split(',');
        const feeprice = Number(splited[3].split('=')[1].trim());
        const gas = Number(splited[4].split('=')[1].trim());
        const input_raw = splited[5].split('=')[1].trim().split(',');
        const log = splited[6].split('=')[1].trim();
        const chain = await works.read_chain(2 * (10 ** 9));
        const roots = JSON.parse(await util_1.promisify(fs.readFile)('./json/root.json', 'utf-8'));
        const S_Trie = data.state_trie_ins(roots.stateroot);
        const L_Trie = data.lock_trie_ins(roots.lockroot);
        const tx = await works.make_req_tx([user_pub], type, tokens, bases, feeprice, gas, input_raw, log, my_private, user_pub, chain, S_Trie, L_Trie);
        const pool = await works.read_pool(10 ** 9);
        const StateData = await data.get_tx_statedata(tx, chain, S_Trie);
        const LockData = await data.get_tx_lockdata(tx, chain, L_Trie);
        const new_pool = vr.pool.tx2pool(pool, tx, chain, StateData, LockData);
        await works.write_pool(new_pool);
        if (new_pool[tx.hash] != null) {
            const peers = JSON.parse(await util_1.promisify(fs.readFile)('./json/peer_list.json', 'utf-8') || "[]");
            await P.forEach(peers, async (peer) => {
                const url = 'http://' + peer.ip + ':57750/tx';
                const option = {
                    url: url,
                    body: tx,
                    json: true
                };
                await request_promise_native_1.default.post(option);
            });
        }
    }
    catch (e) {
        console.log(e);
    }
};
//# sourceMappingURL=request-tx.js.map