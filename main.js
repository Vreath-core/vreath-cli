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
const express_1 = __importDefault(require("express"));
const bodyParser = __importStar(require("body-parser"));
const fs = __importStar(require("fs"));
const util_1 = require("util");
const P = __importStar(require("p-iteration"));
const request_1 = __importDefault(require("request"));
const repl = __importStar(require("repl"));
const readline_sync_1 = __importDefault(require("readline-sync"));
const staking = async (private_key) => {
    try {
        const chain = JSON.parse(await util_1.promisify(fs.readFile)('./json/chain.json', 'utf-8'));
        const config = JSON.parse(await util_1.promisify(fs.readFile)('./config/config.json', 'utf-8'));
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
        const new_chain = chain.concat(block);
        await util_1.promisify(fs.writeFile)('./json/chain.json', JSON.stringify(new_chain, null, 4), 'utf-8');
        const new_roots = {
            stateroot: S_Trie.now_root(),
            lockroot: L_Trie.now_root()
        };
        await util_1.promisify(fs.writeFile)('./json/root.json', JSON.stringify(new_roots, null, 4), 'utf-8');
        const txs_hash = block.txs.map(pure => pure.hash);
        const new_pool_keys = Object.keys(pool).filter(key => txs_hash.indexOf(key) === -1);
        const new_pool = new_pool_keys.map(key => pool[key]);
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
    }
};
/*const refreshing = async (private_key:string)=>{
    try{
        const config = JSON.parse(await promisify(fs.readFile)('./config/config.json','utf-8'));
        const validator_pub:string = config.pub_keys[config.user.use];
        const feeprice = Number(readlineSync.question("fee price"));
        const unit_price = Number(readlineSync.question("unit price"));
        const log = readlineSync.question("log");
        const chain:vr.Block[] = JSON.parse(await promisify(fs.readFile)('./json/chain.json','utf-8'));
        const roots:{stateroot:string,lockroot:string} = JSON.parse(await promisify(fs.readFile)('./json/root.json','utf-8'));
        const S_Trie = data.state_trie_ins(roots.stateroot);
        const L_Trie = data.lock_trie_ins(roots.lockroot);
        const tx = await works.make_ref_tx([validator_pub],feeprice,unit_price,log,private_key,validator_pub,chain,S_Trie,L_Trie);

        const peers:{protocol:string,ip:string,port:number}[] = JSON.parse(await promisify(fs.readFile)('./json/peer_list.json','utf-8')||"[]");
        const header = {
            'Content-Type':'application/json'
        };
        peers.forEach(peer=>{
            const url = peer.protocol+'://'+peer.ip+':'+peer.port+'/tx';
            const option = {
                url: url,
                method: 'POST',
                headers: header,
                json: true,
                form:tx
            }
            request(option,(err,res)=>{
            });
        });
    }
    catch(e){
        console.log(e);
    }
}*/
const app = express_1.default();
app.listen(57750);
app.use(bodyParser.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/tx', tx_1.default);
app.use('/block', block_1.default);
const my_private = readline_sync_1.default.question('Your private key:', { hideEchoBack: true });
setInterval(async () => {
    await staking(my_private);
}, 1000);
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
        try {
            const splited = input.split('--').slice(1);
            ;
            const config = JSON.parse(await util_1.promisify(fs.readFile)('./config/config.json', 'utf-8'));
            const user_pub = config.pub_keys[config.user.use];
            const type = splited[0].split('=')[1].trim();
            const tokens = splited[1].split('=')[1].trim().split(',');
            const bases = splited[2].split('=')[1].trim().split(',');
            const feeprice = Number(splited[3].split('=')[1].trim());
            const gas = Number(splited[4].split('=')[1].trim());
            const input_raw = splited[5].split('=')[1].trim().split(',');
            const log = splited[6].split('=')[1].trim();
            const chain = JSON.parse(await util_1.promisify(fs.readFile)('./json/chain.json', 'utf-8'));
            const roots = JSON.parse(await util_1.promisify(fs.readFile)('./json/root.json', 'utf-8'));
            const S_Trie = data.state_trie_ins(roots.stateroot);
            const L_Trie = data.lock_trie_ins(roots.lockroot);
            const tx = await works.make_req_tx([user_pub], type, tokens, bases, feeprice, gas, input_raw, log, my_private, user_pub, chain, S_Trie, L_Trie);
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
            console.log(e);
        }
    }
});
replServer.defineCommand('remit', {
    help: 'Create request tx',
    async action(input) {
        try {
            const splited = input.split('--').slice(1);
            const config = JSON.parse(await util_1.promisify(fs.readFile)('./config/config.json', 'utf-8'));
            const user_pub = config.pub_keys[config.user.use];
            const type = "change";
            const tokens = [vr.con.constant.native];
            const remitter = vr.crypto.genereate_address(vr.con.constant.native, user_pub);
            const receiver = splited[0].split('=')[1].trim().split(',').map(add => {
                if (add === "remitter")
                    return remitter;
                else
                    return add;
            });
            const bases = [remitter].concat(receiver).filter((val, i, array) => array.indexOf(val) === i);
            const feeprice = Number(splited[1].split('=')[1].trim());
            const gas = Number(splited[2].split('=')[1].trim());
            const amount = splited[3].split('=')[1].trim().split(',');
            if (receiver.length != amount.length)
                throw new Error('invalid amount');
            const log = splited[4].split('=')[1].trim();
            const chain = JSON.parse(await util_1.promisify(fs.readFile)('./json/chain.json', 'utf-8'));
            const roots = JSON.parse(await util_1.promisify(fs.readFile)('./json/root.json', 'utf-8'));
            const S_Trie = data.state_trie_ins(roots.stateroot);
            const L_Trie = data.lock_trie_ins(roots.lockroot);
            const tx = await works.make_req_tx([user_pub], type, tokens, bases, feeprice, gas, amount, log, my_private, user_pub, chain, S_Trie, L_Trie);
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
            console.log(e);
        }
    }
});