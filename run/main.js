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
const handshake_1 = require("../app/routes/handshake");
const peers_1 = __importDefault(require("../app/routes/peers"));
const tx_1 = __importDefault(require("../app/routes/tx"));
const block_1 = __importDefault(require("../app/routes/block"));
const unit_1 = __importDefault(require("../app/routes/unit"));
const chain_1 = __importDefault(require("../app/routes/chain"));
const works = __importStar(require("../logic/work"));
const data = __importStar(require("../logic/data"));
const request_tx_1 = __importDefault(require("../app/commands/request-tx"));
const remit_1 = __importDefault(require("../app/commands/remit"));
const express_1 = __importDefault(require("express"));
const bodyParser = __importStar(require("body-parser"));
const fs = __importStar(require("fs"));
const util_1 = require("util");
const P = __importStar(require("p-iteration"));
const crypto_js_1 = __importDefault(require("crypto-js"));
const request_promise_native_1 = __importDefault(require("request-promise-native"));
const repl = __importStar(require("repl"));
const readline_sync_1 = __importDefault(require("readline-sync"));
const math = __importStar(require("mathjs"));
const bunyan_1 = __importDefault(require("bunyan"));
const timers_1 = require("timers");
math.config({
    number: 'BigNumber'
});
const app = express_1.default();
app.listen(57750);
app.use(bodyParser.json({ limit: '2gb' }));
app.use(express_1.default.urlencoded({ limit: '2gb', extended: true }));
app.use('/handshake', handshake_1.handshake_route);
app.use('/peer', peers_1.default);
app.use('/tx', tx_1.default);
app.use('/block', block_1.default);
app.use('/unit', unit_1.default);
app.use('/chain', chain_1.default);
const log = bunyan_1.default.createLogger({
    name: 'vreath-cli',
    streams: [
        {
            path: './log/log.log'
        }
    ]
});
const my_password = readline_sync_1.default.question('Your password:', { hideEchoBack: true, defaultInput: 'password' });
const my_key = vr.crypto.hash(my_password).slice(0, 122);
const get_private = fs.readFileSync('./keys/private/' + my_key + '.txt', 'utf-8');
const my_private = crypto_js_1.default.AES.decrypt(get_private, my_key).toString(crypto_js_1.default.enc.Utf8);
const config = JSON.parse(fs.readFileSync('./config/config.json', 'utf-8'));
const shake_hands = async () => {
    try {
        const my_node_info = handshake_1.make_node_info();
        const peers = JSON.parse(await util_1.promisify(fs.readFile)('./json/peer_list.json', 'utf-8') || "[]");
        const new_peer_list = await P.reduce(peers.slice(0, 8), async (list, peer) => {
            const url1 = 'http://' + peer.ip + ':57750/handshake';
            const option1 = {
                uri: url1,
                body: my_node_info,
                json: true
            };
            const this_info = await request_promise_native_1.default.post(option1);
            if (typeof this_info.version != 'number' || typeof this_info.net_id != 'number' || typeof this_info.chain_id != 'number' || typeof this_info.timestamp != 'number' || this_info.version < vr.con.constant.compatible_version || this_info.net_id != vr.con.constant.my_net_id || this_info.chain_id != vr.con.constant.my_chain_id)
                return list;
            const this_peer = {
                ip: peer.ip,
                timestamp: this_info.timestamp
            };
            const this_index = list.map(p => p.ip).indexOf(peer.ip);
            const refreshed_list = list.map((p, i) => {
                if (i === this_index)
                    return this_peer;
                else
                    return p;
            }).sort((a, b) => b.timestamp - a.timestamp);
            const url2 = 'http://' + peer.ip + ':57750/peer';
            const option2 = {
                url: url2,
                body: peers,
                json: true
            };
            const get_list = await request_promise_native_1.default.post(option2);
            if (!Array.isArray(get_list) || get_list.some(p => typeof p.ip != 'string' || typeof p.timestamp != 'number'))
                return refreshed_list;
            const get_list_ips = get_list.map(p => p.ip);
            return refreshed_list.map(p => {
                const i = get_list_ips.indexOf(p.ip);
                if (i === -1)
                    return p;
                else
                    return get_list[i];
            }).sort((a, b) => b.timestamp - a.timestamp);
        }, peers);
        await util_1.promisify(fs.writeFile)('./json/peer_list.json', JSON.stringify(new_peer_list, null, 4), 'utf-8');
    }
    catch (e) {
        log.info(e);
    }
};
const staking = async (private_key) => {
    try {
        const chain = await works.read_chain(2 * (10 ** 9));
        const validator_pub = config.pub_keys[config.validator.use];
        if (validator_pub == null)
            throw new Error('invalid validator public key');
        const roots = JSON.parse(await util_1.promisify(fs.readFile)('./json/root.json', 'utf-8'));
        const pool = JSON.parse(await util_1.promisify(fs.readFile)('./json/pool.json', 'utf-8'));
        const S_Trie = data.state_trie_ins(roots.stateroot);
        const unit_validator = vr.crypto.genereate_address(vr.con.constant.unit, validator_pub);
        const unit_validator_state = await S_Trie.get(unit_validator);
        if (unit_validator_state == null || unit_validator_state.amount === 0)
            throw new Error('the validator has no units');
        const L_Trie = data.lock_trie_ins(roots.lockroot);
        const block = await works.make_block(chain, [validator_pub], roots.stateroot, roots.lockroot, '', pool, private_key, validator_pub, S_Trie, L_Trie);
        const StateData = await data.get_block_statedata(block, chain, S_Trie);
        const LockData = await data.get_block_lockdata(block, chain, L_Trie);
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
        await works.write_chain(block);
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
                body: chain,
                json: true
            };
            await request_promise_native_1.default.post(option2);
        });
    }
    catch (e) {
        log.info(e);
    }
};
const buying_unit = async (private_key) => {
    try {
        const pub_key = config.pub_keys[config.validator.use];
        const type = "change";
        const tokens = [vr.con.constant.unit, vr.con.constant.native];
        const chain = await works.read_chain(2 * (10 ** 9));
        const roots = JSON.parse(await util_1.promisify(fs.readFile)('./json/root.json', 'utf-8'));
        const S_Trie = data.state_trie_ins(roots.stateroot);
        const L_Trie = data.lock_trie_ins(roots.lockroot);
        const native_validator = vr.crypto.genereate_address(vr.con.constant.native, vr.crypto.merge_pub_keys([pub_key]));
        const unit_validator = vr.crypto.genereate_address(vr.con.constant.unit, vr.crypto.merge_pub_keys([pub_key]));
        const validator_state = await S_Trie.get(native_validator);
        if (validator_state == null)
            throw new Error("You don't have enough amount");
        const validator_amount = validator_state.amount || 0;
        const minimum = config.validator.minimum || validator_amount;
        const unit_store = JSON.parse(await util_1.promisify(fs.readFile)('./json/unit_store.json', 'utf-8'));
        const unit_values = Object.values(unit_store);
        const sorted_units = unit_values.slice().sort((a, b) => a.unit_price - b.unit_price);
        let price_sum = 0;
        const units = await P.reduce(sorted_units, async (res, unit) => {
            if (math.chain(validator_amount).subtract(price_sum).subtract(unit.unit_price).smaller(minimum).done())
                return res;
            const unit_state = await S_Trie.get(unit.address) || vr.state.create_state(0, unit.address, vr.con.constant.unit, 0, { used: "[]" });
            const unit_used = JSON.parse(unit_state.data.used);
            const iden_hash = vr.crypto.hash((vr.crypto.hex2number(unit.request) + unit.height + vr.crypto.hex2number(unit.block_hash)).toString(16));
            if (unit_used.indexOf(iden_hash) != -1)
                return res;
            price_sum = math.chain(price_sum).add(unit.unit_price).done();
            return res.concat(unit);
        }, []);
        if (units.length === 0)
            throw new Error('no units');
        const unit_addresses = [unit_validator].concat(units.map(u => u.address)).filter((val, i, array) => array.indexOf(val) === i);
        const native_addresses = [native_validator].concat(units.map(u => "Vr:" + vr.con.constant.native + ":" + u.address.split(':')[2])).filter((val, i, array) => array.indexOf(val) === i);
        const bases = unit_addresses.concat(native_addresses);
        const feeprice = config.validator.fee_price;
        const gas = config.validator.gas;
        const input_raw = ["buy", JSON.stringify(units)];
        const tx = await works.make_req_tx([pub_key], type, tokens, bases, feeprice, gas, input_raw, "", private_key, pub_key, chain, S_Trie, L_Trie);
        const pool = JSON.parse(await util_1.promisify(fs.readFile)('./json/pool.json', 'utf-8'));
        const StateData = await data.get_tx_statedata(tx, chain, S_Trie);
        const LockData = await data.get_tx_lockdata(tx, chain, L_Trie);
        const new_pool = vr.pool.tx2pool(pool, tx, chain, StateData, LockData);
        if (new_pool[tx.hash] != null) {
            await util_1.promisify(fs.writeFile)('./json/pool.json', JSON.stringify(new_pool, null, 4), 'utf-8');
            const new_unit_store = works.new_obj(unit_store, store => {
                units.forEach(unit => {
                    const iden_hash = vr.crypto.hash((vr.crypto.hex2number(unit.request) + unit.height + vr.crypto.hex2number(unit.block_hash)).toString(16));
                    delete store[iden_hash];
                });
                return store;
            });
            await util_1.promisify(fs.writeFile)('./json/unit_store.json', JSON.stringify(new_unit_store, null, 4), 'utf-8');
            const peers = JSON.parse(await util_1.promisify(fs.readFile)('./json/peer_list.json', 'utf-8') || "[]");
            await P.forEach(peers, async (peer) => {
                const url = 'http://' + peer.ip + ':57550/tx';
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
        log.info(e);
    }
};
const refreshing = async (private_key) => {
    try {
        const miner_pub = config.pub_keys[config.miner.use];
        const feeprice = Number(config.miner.fee_price);
        const unit_price = Number(config.miner.unit_price);
        const log = "";
        const chain = await works.read_chain(2 * (10 ** 9));
        let refreshed = [];
        let search_block;
        let tx_i;
        let search_tx;
        let block_height = -1;
        let tx_index = -1;
        for (search_block of chain.slice().reverse()) {
            for (tx_i in search_block.txs) {
                search_tx = search_block.txs[Number(tx_i)];
                if (search_tx.meta.kind === 'request' && refreshed.indexOf(search_tx.hash) === -1) {
                    block_height = search_block.meta.height;
                    tx_index = Number(tx_i);
                    break;
                }
                else if (search_tx.meta.kind === 'refresh') {
                    refreshed.push(search_tx.meta.req_tx_hash);
                }
            }
        }
        if (block_height === -1 || tx_index === -1)
            throw new Error('any request tx is already refreshed.');
        const roots = JSON.parse(await util_1.promisify(fs.readFile)('./json/root.json', 'utf-8'));
        const S_Trie = data.state_trie_ins(roots.stateroot);
        const L_Trie = data.lock_trie_ins(roots.lockroot);
        const tx = await works.make_ref_tx([miner_pub], feeprice, unit_price, block_height, tx_index, log, private_key, miner_pub, chain, S_Trie, L_Trie);
        const pool = JSON.parse(await util_1.promisify(fs.readFile)('./json/pool.json', 'utf-8'));
        const StateData = await data.get_tx_statedata(tx, chain, S_Trie);
        const LockData = await data.get_tx_lockdata(tx, chain, L_Trie);
        const new_pool = vr.pool.tx2pool(pool, tx, chain, StateData, LockData);
        await util_1.promisify(fs.writeFile)('./json/pool.json', JSON.stringify(new_pool, null, 4), 'utf-8');
        const peers = JSON.parse(await util_1.promisify(fs.readFile)('./json/peer_list.json', 'utf-8') || "[]");
        await P.forEach(peers, async (peer) => {
            const url = 'http://' + peer.ip + ':57550/tx';
            const option = {
                url: url,
                body: tx,
                json: true
            };
            await request_promise_native_1.default.post(option);
        });
    }
    catch (e) {
        log.info(e);
    }
};
const making_unit = async (miner) => {
    try {
        const chain = await works.read_chain(2 * (10 ** 9));
        const unit_price = config.miner.unit_price;
        const roots = JSON.parse(await util_1.promisify(fs.readFile)('./json/root.json', 'utf-8'));
        const S_Trie = data.state_trie_ins(roots.stateroot);
        const unit_state = await S_Trie.get(miner) || vr.state.create_state(0, miner, vr.con.constant.unit, 0, { data: "[]" });
        const used = JSON.parse(unit_state.data.used || "[]");
        const unit_store = JSON.parse(await util_1.promisify(fs.readFile)('./json/unit_store.json', 'utf-8'));
        let search_block;
        let search_tx;
        let unit_iden_hash = '';
        let pre_unit = {
            request: vr.crypto.hash(''),
            height: 0,
            block_hash: vr.crypto.hash(''),
            nonce: 0,
            address: miner,
            output: vr.crypto.hash(''),
            unit_price: 0
        };
        let found = false;
        for (search_block of chain.slice().reverse()) {
            for (search_tx of search_block.txs) {
                if (search_tx.meta.kind === "refresh") {
                    unit_iden_hash = vr.crypto.hash((vr.crypto.hex2number(search_tx.meta.req_tx_hash) + search_tx.meta.height + vr.crypto.hex2number(search_tx.meta.block_hash)).toString(16));
                    if (used.indexOf(unit_iden_hash) != -1)
                        continue;
                    pre_unit = {
                        request: search_tx.meta.req_tx_hash,
                        height: search_tx.meta.height,
                        block_hash: search_tx.meta.block_hash,
                        nonce: 0,
                        address: miner,
                        output: search_tx.meta.output,
                        unit_price: unit_price
                    };
                    found = true;
                    break;
                }
            }
        }
        if (!found)
            throw new Error('no new refresh-tx');
        const nonce = works.get_nonce(pre_unit.request, pre_unit.height, pre_unit.block_hash, miner, pre_unit.output, unit_price);
        if (nonce === -1)
            throw new Error('fail to get valid nonce');
        const unit = works.new_obj(pre_unit, u => {
            u.nonce = nonce;
            return u;
        });
        const new_unit_store = works.new_obj(unit_store, store => {
            store[unit_iden_hash] = unit;
            return store;
        });
        await util_1.promisify(fs.writeFile)('./json/unit_store.json', JSON.stringify(new_unit_store, null, 4), 'utf-8');
        const peers = JSON.parse(await util_1.promisify(fs.readFile)('./json/peer_list.json', 'utf-8') || "[]");
        await P.forEach(peers, async (peer) => {
            const url = 'http://' + peer.ip + ':57550/unit';
            const option = {
                url: url,
                body: unit,
                json: true
            };
            await request_promise_native_1.default.post(option);
        });
    }
    catch (e) {
        log.info(e);
    }
};
(async () => { await shake_hands(); })();
timers_1.setInterval(async () => {
    await shake_hands();
}, 3600000);
if (config.validator.flag) {
    timers_1.setInterval(async () => {
        await staking(my_private);
        await buying_unit(my_private);
    }, 1000);
}
if (config.miner.flag) {
    const my_miner_pub = config.pub_keys[config.miner.use];
    const my_miner = vr.crypto.genereate_address(vr.con.constant.unit, my_miner_pub);
    timers_1.setInterval(async () => {
        await refreshing(my_private);
        await making_unit(my_miner);
    }, 60000 * config.miner.interval);
}
const replServer = repl.start({ prompt: '>', terminal: true });
replServer.defineCommand('request-tx', {
    help: 'Create request tx',
    async action(input) {
        await request_tx_1.default(input, config, my_private);
    }
});
replServer.defineCommand('remit', {
    help: 'Create request tx',
    async action(input) {
        await remit_1.default(input, config, my_private);
    }
});
//# sourceMappingURL=main.js.map