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
const request_promise_native_1 = __importDefault(require("request-promise-native"));
const P = __importStar(require("p-iteration"));
exports.default = async (input, config, my_private) => {
    try {
        const splited = input.split('--').slice(1);
        const user_pub = config.pub_keys[config.user.use];
        const type = "change";
        const tokens = [vr.con.constant.native];
        const remitter = vr.crypto.generate_address(vr.con.constant.native, user_pub);
        const receiver_input = splited[0].split('=')[1].trim().split(',');
        const receiver = receiver_input.map(add => {
            if (add === "remitter")
                return remitter;
            else
                return add;
        });
        const include_remitter = receiver_input.indexOf("remitter") != -1;
        const bases = [remitter].concat(receiver).filter((val, i, array) => array.indexOf(val) === i);
        const feeprice = Number(splited[1].split('=')[1].trim());
        const gas = Number(splited[2].split('=')[1].trim());
        const amount = (() => {
            const splitted = (splited[3] || "").split('=')[1].trim().split(',');
            if (include_remitter)
                return splitted;
            return ["0"].concat(splitted);
        })();
        if (bases.length != amount.length)
            throw new Error('invalid amount');
        const input_raw = ["remit", JSON.stringify(amount.map(a => Number(a)))];
        const log = splited[4].split('=')[1].trim();
        const chain = await data.read_chain(2 * (10 ** 9));
        const roots = await data.read_root();
        const S_Trie = data.state_trie_ins(roots.stateroot);
        const L_Trie = data.lock_trie_ins(roots.lockroot);
        const tx = await works.make_req_tx([user_pub], type, tokens, bases, feeprice, gas, input_raw, log, my_private, user_pub, chain, S_Trie, L_Trie);
        const pool = await data.read_pool(10 ** 9);
        const StateData = await data.get_tx_statedata(tx, chain, S_Trie);
        const LockData = await data.get_tx_lockdata(tx, chain, L_Trie);
        const new_pool = vr.pool.tx2pool(pool, tx, chain, StateData, LockData);
        await data.write_pool(new_pool);
        if (new_pool[tx.hash] != null) {
            const peers = await data.get_peer_list();
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
//# sourceMappingURL=remit.js.map