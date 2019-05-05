import * as vr from 'vreath'
import * as data from '../../logic/data'
import {post as block_post} from './block'
import bigInt from 'big-integer'
import * as P from 'p-iteration'


export const get = async (msg:Buffer):Promise<{[key:string]:vr.Block}>=>{
    const req_last_height = msg.toString('hex');
    if(vr.checker.hex_check(req_last_height)) throw new Error('invalid data');
    const info:data.chain_info|null = await data.chain_info_db.read_obj('00');
    if(info==null) throw new Error("chain_info doesn't exist");
    const last_height = info.last_height;
    if(bigInt(last_height,16).lesser(bigInt(req_last_height,16))) throw new Error('heavier chain');
    let height = bigInt(req_last_height,16);
    let block:vr.Block|null = null;
    while(1){
        block = await data.block_db.read_obj(vr.crypto.bigint2hex(height));
        if((block!=null&&block.meta.kind===0)||height.eq(0)) break;
        height = height.subtract(1);
    }
    if(block==null) throw new Error('fail to search key block');
    let chain:{[key:string]:vr.Block} = {};
    let i = height;
    while(i.lesserOrEquals(bigInt(last_height,16))){
        block = await data.block_db.read_obj(vr.crypto.bigint2hex(i));
        if(block==null) throw new Error("block doesn't exist");
        chain[vr.crypto.bigint2hex(i)] = block;
    }
    return chain;
}

export const post = async (msg:Buffer)=>{
    console.log('posted');
    const new_chain:{[key:string]:[vr.Block,vr.State[]]}= JSON.parse(msg.toString('utf-8'));
    if(Object.values(new_chain).some(info=>!vr.block.isBlock(info[0])||info[1].some(s=>!vr.state.isState(s)))) throw new Error('invalid data');
    const heights:string[] = Object.keys(new_chain).sort((a,b)=>bigInt(a,16).subtract(bigInt(b,16)).toJSNumber());
    const new_diff_sum = heights.reduce((sum,height)=>{
        const block = new_chain[height][0];
        return sum.add(bigInt(block.meta.pos_diff,16));
    },bigInt(0));
    const my_diff_sum = await P.reduce(heights, async (sum,height)=>{
        const block:vr.Block|null = await data.block_db.read_obj(height);
        if(block==null) throw new Error("block doesn't exist");
        return sum.add(bigInt(block.meta.pos_diff,16));
    },bigInt(0));
    if(new_diff_sum.lesserOrEquals(my_diff_sum)) throw new Error("lighter chain");
    await P.forEach(Object.values(new_chain), async (info)=>{
        await block_post(Buffer.from(JSON.stringify(info)))
    });
    return 1;
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