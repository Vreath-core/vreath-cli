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
const tx_1 = __importDefault(require("./app/routes/tx"));
const block_1 = __importDefault(require("./app/routes/block"));
const works = __importStar(require("./logic/work"));
const data = __importStar(require("./logic/data"));
const setup_1 = __importDefault(require("./app/commands/setup"));
const request_tx_1 = __importDefault(require("./app/commands/request-tx"));
const remit_1 = __importDefault(require("./app/commands/remit"));
const express_1 = __importDefault(require("express"));
const bodyParser = __importStar(require("body-parser"));
const fs = __importStar(require("fs"));
const util_1 = require("util");
const P = __importStar(require("p-iteration"));
const request_1 = __importDefault(require("request"));
const repl = __importStar(require("repl"));
const readline_sync_1 = __importDefault(require("readline-sync"));
const math = __importStar(require("mathjs"));
const bunyan_1 = __importDefault(require("bunyan"));
math.config({
    number: 'BigNumber'
});
const app = express_1.default();
app.listen(57750);
app.use(bodyParser.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/tx', tx_1.default);
app.use('/block', block_1.default);
/*app.get('/get_ip',(req,res)=>{
    const remote_add = req.connection.remoteAddress || "";
    const splited_add = remote_add.split(':');
    res.send()
})*/
const log = bunyan_1.default.createLogger({
    name: 'vreath-cli',
    streams: [
        {
            path: './log/log.log'
        }
    ]
});
const my_private = readline_sync_1.default.question('Your private key:', { hideEchoBack: true });
const config = JSON.parse(fs.readFileSync('./config/config.json', 'utf-8'));
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
        const header = {
            'Content-Type': 'application/json'
        };
        peers.forEach(peer => {
            const url = peer.protocol + '://' + peer.ip + ':' + peer.port + '/block';
            const option = {
                url: url,
                method: 'POST',
                headers: header,
                json: true,
                form: block
            };
            request_1.default(option, (err, res) => {
            });
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
        let units = [];
        let search_block;
        let search_tx;
        let search_unit;
        let price_sum = 0;
        for (search_block of chain) {
            for (search_tx of search_block.txs) {
                if (search_tx.meta.kind === "refresh") {
                    if (math.chain(validator_amount).subtract(price_sum).smaller(minimum).done()) {
                        break;
                    }
                    search_unit = {
                        request: search_tx.meta.req_tx_hash,
                        height: search_tx.meta.height,
                        block_hash: search_tx.meta.block_hash,
                        nonce: search_tx.meta.nonce,
                        address: vr.crypto.genereate_address(vr.con.constant.unit, vr.crypto.merge_pub_keys(search_tx.meta.pub_key)),
                        output: search_tx.meta.output,
                        unit_price: search_tx.meta.unit_price
                    };
                    units.push(search_unit);
                    price_sum = math.chain(price_sum).add(search_tx.meta.unit_price).done();
                }
            }
        }
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
            const peers = JSON.parse(await util_1.promisify(fs.readFile)('./json/peer_list.json', 'utf-8') || "[]");
            const header = {
                'Content-Type': 'application/json'
            };
            peers.forEach(peer => {
                const url = peer.protocol + '://' + peer.ip + ':' + peer.port + '/tx';
                const option = {
                    url: url,
                    method: 'POST',
                    headers: header,
                    json: true,
                    form: tx
                };
                request_1.default(option, (err, res) => {
                });
            });
        }
    }
    catch (e) {
        log.info(e);
    }
};
const refreshing = async (private_key) => {
    try {
        const validator_pub = config.pub_keys[config.miner.use];
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
        const tx = await works.make_ref_tx([validator_pub], feeprice, unit_price, block_height, tx_index, log, private_key, validator_pub, chain, S_Trie, L_Trie);
        const pool = JSON.parse(await util_1.promisify(fs.readFile)('./json/pool.json', 'utf-8'));
        const StateData = await data.get_tx_statedata(tx, chain, S_Trie);
        const LockData = await data.get_tx_lockdata(tx, chain, L_Trie);
        const new_pool = vr.pool.tx2pool(pool, tx, chain, StateData, LockData);
        await util_1.promisify(fs.writeFile)('./json/pool.json', JSON.stringify(new_pool, null, 4), 'utf-8');
        const peers = JSON.parse(await util_1.promisify(fs.readFile)('./json/peer_list.json', 'utf-8') || "[]");
        const header = {
            'Content-Type': 'application/json'
        };
        peers.forEach(peer => {
            const url = peer.protocol + '://' + peer.ip + ':' + peer.port + '/tx';
            const option = {
                url: url,
                method: 'POST',
                headers: header,
                json: true,
                form: tx
            };
            request_1.default(option, (err, res) => {
            });
        });
    }
    catch (e) {
        log.info(e);
    }
};
if (config.validator.flag) {
    setInterval(async () => {
        await staking(my_private);
        await buying_unit(my_private);
    }, 1000);
}
if (config.miner.flag) {
    setInterval(async () => {
        await refreshing(my_private);
    }, 60000 * config.miner.interval);
}
const replServer = repl.start({ prompt: '>', terminal: true });
replServer.defineCommand('setup', {
    help: 'Setup genesis data',
    async action() {
        await setup_1.default();
        console.log('finish set up');
    }
});
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