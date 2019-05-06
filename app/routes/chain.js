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
const data = __importStar(require("../../logic/data"));
const works = __importStar(require("../../logic/work"));
const block_1 = require("./block");
const big_integer_1 = __importDefault(require("big-integer"));
const P = __importStar(require("p-iteration"));
const path = __importStar(require("path"));
const bunyan_1 = __importDefault(require("bunyan"));
const log = bunyan_1.default.createLogger({
    name: 'vreath-cli',
    streams: [
        {
            path: path.join(__dirname, '../../log/log.log')
        }
    ]
});
exports.get = async (msg, stream) => {
    try {
        const req_last_height = msg.toString();
        if (vr.checker.hex_check(req_last_height))
            throw new Error('invalid data');
        const info = await data.chain_info_db.read_obj('00');
        if (info == null)
            throw new Error("chain_info doesn't exist");
        const last_height = info.last_height;
        if (big_integer_1.default(last_height, 16).lesser(big_integer_1.default(req_last_height, 16)))
            throw new Error('heavier chain');
        let height = big_integer_1.default(req_last_height, 16);
        let block = null;
        while (1) {
            block = await data.block_db.read_obj(vr.crypto.bigint2hex(height));
            if ((block != null && block.meta.kind === 0) || height.eq(0))
                break;
            height = height.subtract(1);
        }
        if (block == null)
            throw new Error('fail to search key block');
        let chain = [];
        let i = height;
        while (i.lesserOrEquals(big_integer_1.default(last_height, 16))) {
            block = await data.block_db.read_obj(vr.crypto.bigint2hex(i));
            if (block == null)
                throw new Error("block doesn't exist");
            chain.push(block);
            i = i.add(1);
        }
        const states = await P.reduce(chain, async (result, block) => {
            if (block.meta.height === "00")
                return result;
            return await P.reduce(block.txs, async (res, tx) => {
                if (tx.meta.kind != 0) {
                    res[tx.hash] = [];
                    return res;
                }
                else {
                    const outputs = await data.output_db.read_obj(tx.hash);
                    if (outputs == null)
                        return res;
                    res[tx.hash] = outputs;
                    return res;
                }
            }, result);
        }, {});
        stream.write(JSON.stringify([chain, states]));
        stream.end();
    }
    catch (e) {
        log.info(e);
    }
};
exports.post = async (msg) => {
    try {
        const parsed = JSON.parse(msg.toString('utf-8'));
        const new_chain = parsed[0];
        const output_states = parsed[1];
        if (new_chain.some(block => !vr.block.isBlock(block)) || Object.values(output_states).some(states => states.some(s => !vr.state.isState(s))))
            throw new Error('invalid data');
        const heights = new_chain.map(block => block.meta.height).sort((a, b) => big_integer_1.default(a, 16).subtract(big_integer_1.default(b, 16)).toJSNumber());
        const new_diff_sum = new_chain.reduce((sum, block) => {
            return sum.add(big_integer_1.default(block.meta.pos_diff, 16));
        }, big_integer_1.default(0));
        const my_diff_sum = await P.reduce(heights, async (sum, height) => {
            const block = await data.block_db.read_obj(height);
            if (block == null)
                return sum;
            return sum.add(big_integer_1.default(block.meta.pos_diff, 16));
        }, big_integer_1.default(0));
        if (new_diff_sum.lesserOrEquals(my_diff_sum))
            throw new Error("lighter chain");
        let block;
        for (block of new_chain) {
            const outputs = await P.reduce(block.txs, async (res, tx) => {
                if (tx.meta.kind != 1)
                    return res;
                const given = output_states[tx.hash];
                if (given != null && given.length > 0)
                    return res.concat(given);
                else {
                    //console.log(JSON.stringify(await data.block_db.read_obj(tx.meta.refresh.height),null,4));
                    const info = await data.chain_info_db.read_obj("00");
                    if (info == null)
                        throw new Error("chain_info doesn't exist");
                    const last_height = info.last_height;
                    const root = await data.root_db.get(last_height);
                    if (root == null)
                        throw new Error("root doesn't exist");
                    const trie = vr.data.trie_ins(data.trie_db, root);
                    const req_tx = await vr.tx.find_req_tx(tx, data.block_db);
                    const computed = await works.compute_output(req_tx, trie, data.state_db, data.block_db);
                    const output = computed[1];
                    return res.concat(output);
                }
            }, []);
            await block_1.post(Buffer.from(JSON.stringify([block, outputs])));
        }
        return 1;
    }
    catch (e) {
        log.info(e);
    }
};
/*
export default router.get('/',async (req,res)=>{
    try{
        const req_diff_sum:number = req.body.diff_sum || 0;
        if(typeof req_diff_sum != 'number'){
            res.status(500).send('invalid data');
            return 0;
        }
        const info:chain_info = await read_chain_info();
        const my_diffs = info.pos_diffs;
        let height:number = 0;
        let sum:number = 0;
        let i:string;
        let index:number = 0;
        for(i in my_diffs){
            index = Number(i);
            sum = math.chain(sum).add(my_diffs[index]).done();
            if(math.larger(sum,req_diff_sum) as boolean){
                height = index;
                break;
            }
        }
        const chain:vr.Block[] = await read_chain(2*(10**9));
        let block:vr.Block;
        let key_height:number = 0;
        for(block of chain.slice(0,height+1).reverse()){
            if(block.meta.kind==='key'){
                key_height = block.meta.height;
                break;
            }
        }
        const sliced = chain.slice(key_height);
        res.json(sliced);
        return 1;
    }
    catch(e){
        res.status(500).send('error');
    }
}).post('/', async (req,res)=>{
    try{
        const new_chain:vr.Block[] = req.body;
        const my_chain:vr.Block[] = await read_chain(2*(10**9));
        const same_height = (()=>{
            let same_height:number = 0;
            let index:string;
            let i:number;
            for(index in new_chain.slice().reverse()){
                i = Number(index);
                if(my_chain[new_chain.length-1-i]!=null&&my_chain[new_chain.length-1-i].hash===new_chain[new_chain.length-1-i].hash){
                    same_height = new_chain.length-1-i;
                }
            }
            return same_height;
        })();
        const add_chain = new_chain.slice(same_height+1);
        const info:chain_info = await read_chain_info();
        const my_diff_sum = info.pos_diffs.slice(same_height+1).reduce((sum,diff)=>math.chain(sum).add(diff).done(),0);
        const new_diff_sum:number = add_chain.reduce((sum,block)=>math.chain(sum).add(block.meta.pos_diff).done(),0);
        if(math.largerEq(my_diff_sum,new_diff_sum)as boolean){
            res.status(500).send('light chain');
            return 0;
        }
        await P.forEach(add_chain, async block=>{
            await rp.post({
                url:'http://localhost:57750/block',
                body:block,
                json:true
            });
        });
        res.status(200).send('success');
        return 1;
    }
    catch(e){
        log.info(e);
        res.status(500).send('error');
    }
});*/ 
