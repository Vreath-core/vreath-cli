import * as express from 'express'
import * as vr from 'vreath'
import * as fs from 'fs'
import {promisify} from 'util'
import {state_trie_ins,lock_trie_ins,get_block_statedata,get_block_lockdata} from '../../logic/data'
import {read_chain, write_chain,chain_info, new_obj} from '../../logic/work'
import * as genesis from '../../genesis/index'
import * as P from 'p-iteration'
import {yets} from '../../run/main'
import * as math from 'mathjs'
math.config({
    number: 'BigNumber'
});

const router = express.Router();

const check_chain = async (block:vr.Block,i:number,same_chain:vr.Block[],add_chain:vr.Block[],stateroot:string,lockroot:string,S_Trie:vr.trie,L_Trie:vr.trie):Promise<boolean>=>{
    const chain = same_chain.concat(add_chain).slice(0,same_chain.length+i);
    const StateData = await get_block_statedata(block,chain,S_Trie);
    const LockData = await get_block_lockdata(block,chain,L_Trie);
    if(block.meta!=null&&block.meta.kind==='key'&&vr.block.verify_key_block(block,chain,stateroot,lockroot,StateData)){
        const data = await vr.block.accept_key_block(block,chain,StateData,LockData);
        await P.forEach(data[0],async state=>{
            if(state.kind==='state') await S_Trie.put(state.owner,state);
            else if(state.kind==='info') await S_Trie.put(state.token,state);
        });
        await P.forEach(data[1], async lock=>{
            await L_Trie.put(lock.address,lock);
        });
    }
    else if(block.meta!=null&&block.meta.kind==='micro'&&vr.block.verify_micro_block(block,chain,stateroot,lockroot,StateData,LockData)){
        const data = await vr.block.accept_micro_block(block,chain,StateData,LockData);
        await P.forEach(data[0],async state=>{
            if(state.kind==='state') await S_Trie.put(state.owner,state);
            else if(state.kind==='info') await S_Trie.put(state.token,state);
        });
        await P.forEach(data[1], async lock=>{
            await L_Trie.put(lock.address,lock);
        });
    }
    else return true;
    if(i>=add_chain.length-1) return false;
    else return await check_chain(add_chain[i+1],i+1,same_chain,add_chain,S_Trie.now_root(),L_Trie.now_root(),S_Trie,L_Trie);
}

export default router.post('/',async (req,res)=>{
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
        const same_chain = my_chain.slice(0,same_height+1);
        const info:chain_info = JSON.parse((await promisify(fs.readFile)('./json/chain/net_id_'+vr.con.constant.my_net_id.toString()+'/info.json','utf-8')));
        const my_diff_sum = info.pos_diffs.slice(same_height+1).reduce((sum,diff)=>math.chain(sum).add(diff).done(),0);
        const new_diff_sum:number = add_chain.reduce((sum,block)=>math.chain(sum).add(block.meta.pos_diff).done(),0);
        if(math.largerEq(my_diff_sum,new_diff_sum)as boolean){
            res.status(500).send('light chain');
            return 0;
        }
        add_chain.forEach(block=>yets.add_block(block));
        return 1;
        /*const new_info = new_obj(
            pre_info,
            info=>{
                info.last_height = same_height;
                info.pos_diffs = info.pos_diffs.slice(0,same_height+1);
                return info;
            }
        );
        await promisify(fs.writeFile)('./json/chain/net_id_'+vr.con.constant.my_net_id.toString()+'/info.json',JSON.stringify(new_info,null, 4),'utf-8');
        const pre_chain = same_chain.slice(0,same_chain.length-1);
        const pre_block = same_chain[same_chain.length-1];
        const S_Trie = state_trie_ins(pre_block.meta.stateroot);
        const L_Trie = lock_trie_ins(pre_block.meta.lockroot);
        const pre_StateData = await get_block_statedata(pre_block,pre_chain,S_Trie);
        const pre_LockData = await get_block_lockdata(pre_block,pre_chain,L_Trie);
        const new_data = (()=>{
            if(pre_block.meta.height===0){
                const reduced_state = genesis.state.map(s=>{
                    if(s.kind!='state'||s.token!=vr.con.constant.unit) return s;
                    return new_obj(
                        s,
                        s=>{
                            s.amount = math.chain(s.amount).multiply(vr.con.constant.unit_rate).done();
                            return s;
                        }
                    )
                });
                return [reduced_state,[]] as [vr.State[],vr.Lock[]];
            }
            else if(pre_block.meta.kind==='key') return vr.block.accept_key_block(pre_block,pre_chain,pre_StateData,pre_LockData);
            else if(pre_block.meta.kind==='micro') return vr.block.accept_micro_block(pre_block,pre_chain,pre_StateData,pre_LockData);
            else return [[],[]] as [vr.State[],vr.Lock[]];
        })();
        await P.forEach(new_data[0],async state=>{
            if(state.kind==='state') await S_Trie.put(state.owner,state);
            else if(state.kind==='info') await S_Trie.put(state.token,state);
        });
        await P.forEach(new_data[1],async lock=>{
            await L_Trie.put(lock.address,lock);
        })
        const invalid = await check_chain(add_chain[0],0,same_chain,add_chain,S_Trie.now_root(),L_Trie.now_root(),S_Trie,L_Trie);
        if(invalid){
            res.status(500).send('invalid chain');
            return 0;
        }
        else{
            const pool:vr.Pool = JSON.parse(await promisify(fs.readFile)('./json/pool.json','utf-8'));
            await P.forEach(add_chain, async block=>{
                await promisify(fs.writeFile)('./json/chain/net_id_'+vr.con.constant.my_net_id.toString()+'/block_'+block.meta.height.toString()+'.json',JSON.stringify(block,null, 4),'utf-8');
                const txs_hash = block.txs.map(pure=>pure.hash);
                const new_pool_keys = Object.keys(pool).filter(key=>txs_hash.indexOf(key)===-1);
                const new_pool = new_pool_keys.reduce((obj:vr.Pool,key)=>{
                    obj[key] = pool[key];
                    return obj;
                },{});
                await promisify(fs.writeFile)('./json/pool.json',JSON.stringify(new_pool,null, 4),'utf-8');
            });
            const info:chain_info = JSON.parse((await promisify(fs.readFile)('./json/chain/net_id_'+vr.con.constant.my_net_id.toString()+'/info.json','utf-8')));
            const new_pos_diffs = same_chain.concat(add_chain).map(block=>block.meta.pos_diff);
            const new_info = new_obj(
                info,
                info=>{
                    info.last_height = add_chain[add_chain.length-1].meta.height;
                    info.pos_diffs = new_pos_diffs;
                    return info;
                }
            );
            await promisify(fs.writeFile)('./json/chain/net_id_'+vr.con.constant.my_net_id.toString()+'/info.json',JSON.stringify(new_info,null, 4),'utf-8');
            res.send('success');
            return 1;
        }*/
    }
    catch(e){
        res.status(500).send('error');
    }
})