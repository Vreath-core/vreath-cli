import * as vr from 'vreath'
import * as data from '../../logic/data'
import * as works from '../../logic/work'
import {post as block_post} from './block'
import bigInt from 'big-integer'
import * as P from 'p-iteration'
import * as bunyan from 'bunyan'
import * as fs from 'fs'
const pull = require('pull-stream');

export const get = async (hashes:{[key:string]:string},stream:any,chain_info_db:vr.db,block_db:vr.db,output_db:vr.db,log:bunyan):Promise<void>=>{
    try{
        const info:data.chain_info|null = await chain_info_db.read_obj('00');
        if(info==null) throw new Error("chain_info doesn't exist");
        const last_height = info.last_height;
        let i = bigInt(0);
        let height:string;
        let block:vr.Block|null;
        let fork_height:string = last_height;
        while(i.lesserOrEquals(bigInt(last_height,16))){
            height = vr.crypto.bigint2hex(i);
            block = await block_db.read_obj(height);
            if(block==null||block.hash!=hashes[block.meta.height]){
                fork_height = height;
                break;
            }
            i = i.add(1);
        }
        let chain:vr.Block[] = [];
        let next_blocks:vr.Block[] = [];
        i = bigInt(fork_height,16);
        while(i.lesserOrEquals(bigInt(last_height,16))){
            height = vr.crypto.bigint2hex(i);
            block = await block_db.read_obj(height);
            i = i.add(1);
            if(block!=null) next_blocks.push(block);
            else break;
        }
        chain = chain.concat(next_blocks);
        next_blocks = [];
        const states = await P.reduce(chain, async (result:{[key:string]:vr.State[]},block)=>{
            if(block.meta.height==="00") return result;
            return await P.reduce(block.txs,async (res,tx)=>{
                if(tx.meta.kind!=0){
                    res[tx.hash] = [];
                    return res;
                }
                else{
                    const outputs:vr.State[]|null = await output_db.read_obj(tx.hash);
                    if(outputs==null) return res;
                    res[tx.hash] = outputs;
                    return res;
                }
            },result);
        },{});
        stream.write(JSON.stringify([chain,states]));
        stream.write('end2');
    }
    catch(e){
        log.info(e);
    }
}

export const post = async (msg:string,block_db:vr.db,chain_info_db:vr.db,root_db:vr.db,trie_db:vr.db,state_db:vr.db,lock_db:vr.db,tx_db:vr.db,log:bunyan)=>{
    try{
        const parsed:[vr.Block[],{[key:string]:vr.State[]}] = JSON.parse(msg);
        const new_chain = parsed[0];
        const output_states = parsed[1];
        if(new_chain.some(block=>!vr.block.isBlock(block))||Object.values(output_states).some(states=>states.some(s=>!vr.state.isState(s)))) throw new Error('invalid data');
        const heights:string[] = new_chain.map(block=>block.meta.height).sort((a,b)=>bigInt(a,16).subtract(bigInt(b,16)).toJSNumber());
        const new_diff_sum = new_chain.reduce((sum,block)=>{
            return sum.add(bigInt(block.meta.pos_diff,16));
        },bigInt(0));
        const my_diff_sum = await P.reduce(heights, async (sum,height)=>{
            const block:vr.Block|null = await block_db.read_obj(height);
            if(block==null) return sum;
            return sum.add(bigInt(block.meta.pos_diff,16));
        },bigInt(0));
        if(new_diff_sum.lesserOrEquals(my_diff_sum)) throw new Error("lighter chain");
        let info:data.chain_info|null = await chain_info_db.read_obj('00');
        if(info==null) throw new Error('chain_info is empty');
        const fork_block = new_chain[0];
        const backed_last_height = vr.crypto.bigint2hex(bigInt(fork_block.meta.height,16).subtract(1));
        const backed_last_block:vr.Block|null = await block_db.read_obj(backed_last_height);
        if(backed_last_block!=null){
            info.last_hash = backed_last_block.hash;
            info.last_height = backed_last_height;
        }
        await chain_info_db.write_obj("00",info);
        let block:vr.Block;
        const minimum_height = bigInt(backed_last_height,16);
        for(block of new_chain){
            if(block.meta.height==='00'||bigInt(block.meta.height,16).lesser(minimum_height)) continue;
            const outputs = await P.reduce(block.txs,async (res:vr.State[],tx)=>{
                if(tx.meta.kind!=1) return res;
                const given = output_states[tx.hash];
                if(given!=null&&given.length>0) return res.concat(given);
                else{
                    const req_height = tx.meta.refresh.height;
                    const root = await root_db.get(req_height);
                    if(root==null) throw new Error("root doesn't exist");
                    const trie = vr.data.trie_ins(trie_db,root);
                    const req_tx = await vr.tx.find_req_tx(tx,block_db);
                    const computed = await works.compute_output(req_tx,trie,state_db,block_db);
                    const output = computed[1];
                    return res.concat(output);
                }
            },[]);
            await block_post(Buffer.from(JSON.stringify([block,outputs])),chain_info_db,root_db,trie_db,block_db,state_db,lock_db,tx_db,log);
        }
        return 1;
    }
    catch(e){
        log.info(e);
    }
}
