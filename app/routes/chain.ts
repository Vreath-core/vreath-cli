import * as vr from 'vreath'
import * as data from '../../logic/data'
import * as works from '../../logic/work'
import {post as block_post} from './block'
import bigInt from 'big-integer'
import * as P from 'p-iteration'
import * as path from 'path'
import bunyan from 'bunyan'

const log = bunyan.createLogger({
    name:'vreath-cli',
    streams:[
        {
            path:path.join(__dirname,'../../log/log.log')
        }
    ]
});


export const get = async (stream:any):Promise<void>=>{
    try{
        const info:data.chain_info|null = await data.chain_info_db.read_obj('00');
        if(info==null) throw new Error("chain_info doesn't exist");
        const last_height = info.last_height;
        let i = bigInt(0);
        let block:vr.Block|null;
        let chain:vr.Block[] = [];
        while(i.lesserOrEquals(bigInt(last_height,16))){
            block = await data.block_db.read_obj(vr.crypto.bigint2hex(i));
            if(block==null) break;
            chain.push(block);
            i = i.add(1);
        }
        const states = await P.reduce(chain, async (result:{[key:string]:vr.State[]},block)=>{
            if(block.meta.height==="00") return result;
            return  await P.reduce(block.txs,async (res,tx)=>{
                if(tx.meta.kind!=0){
                    res[tx.hash] = [];
                    return res;
                }
                else{
                    const outputs:vr.State[]|null = await data.output_db.read_obj(tx.hash);
                    if(outputs==null) return res;
                    res[tx.hash] = outputs;
                    return res;
                }
            },result);
        },{});
        stream.write(JSON.stringify([chain,states]));
        stream.end();
    }
    catch(e){
        log.info(e);
    }
}

export const post = async (msg:Buffer)=>{
    try{
        const parsed:[vr.Block[],{[key:string]:vr.State[]}] = JSON.parse(msg.toString('utf-8'));
        const new_chain = parsed[0];
        const output_states = parsed[1];
        if(new_chain.some(block=>!vr.block.isBlock(block))||Object.values(output_states).some(states=>states.some(s=>!vr.state.isState(s)))) throw new Error('invalid data');
        const heights:string[] = new_chain.map(block=>block.meta.height).sort((a,b)=>bigInt(a,16).subtract(bigInt(b,16)).toJSNumber());
        const new_diff_sum = new_chain.reduce((sum,block)=>{
            return sum.add(bigInt(block.meta.pos_diff,16));
        },bigInt(0));
        const my_diff_sum = await P.reduce(heights, async (sum,height)=>{
            const block:vr.Block|null = await data.block_db.read_obj(height);
            if(block==null) return sum;
            return sum.add(bigInt(block.meta.pos_diff,16));
        },bigInt(0));
        if(new_diff_sum.lesserOrEquals(my_diff_sum)) throw new Error("lighter chain");
        const info:data.chain_info|null = await data.chain_info_db.read_obj('00');
        if(info==null) throw new Error('chain_info is empty');
        const last_key_block = await vr.block.search_key_block(data.block_db,info.last_height);
        let block:vr.Block;
        for(block of new_chain){
            if(bigInt(block.meta.height,16).lesser(bigInt(last_key_block.meta.height,16))) break;
            const outputs = await P.reduce(block.txs,async (res:vr.State[],tx)=>{
                if(tx.meta.kind!=1) return res;
                const given = output_states[tx.hash];
                if(given!=null&&given.length>0) return res.concat(given);
                else{
                    const req_height = tx.meta.refresh.height;
                    const root = await data.root_db.get(req_height);
                    if(root==null) throw new Error("root doesn't exist");
                    const trie = vr.data.trie_ins(data.trie_db,root);
                    const req_tx = await vr.tx.find_req_tx(tx,data.block_db);
                    const computed = await works.compute_output(req_tx,trie,data.state_db,data.block_db);
                    const output = computed[1];
                    return res.concat(output);
                }
            },[]);
            await block_post(Buffer.from(JSON.stringify([block,outputs])));
        }
        return 1;
    }
    catch(e){
        log.info(e);
    }
}
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