import * as express from 'express'
import * as vr from 'vreath'
import * as fs from 'fs'
import {promisify} from 'util'
import * as logic from '../../logic/data'
import {read_chain, write_chain, chain_info, new_obj} from '../../logic/work'
import * as P from 'p-iteration'
import {peer} from '../../app/routes/handshake'
import rp from 'request-promise-native'
import * as math from 'mathjs'
math.config({
    number: 'BigNumber'
});

const router = express.Router();

/*const check_chain = async (block:vr.Block,i:number,same_chain:vr.Block[],add_chain:vr.Block[],stateroot:string,lockroot:string,S_Trie:vr.trie,L_Trie:vr.trie):Promise<boolean>=>{
    const chain = same_chain.concat(add_chain).slice(0,same_chain.length+i);
    const StateData = await logic.get_block_statedata(block,chain,S_Trie);
    const LockData = await logic.get_block_lockdata(block,chain,L_Trie);
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
}*/

export default router.post('/',async (req,res)=>{
    try{
        const block:vr.Block = req.body;
        if(!vr.block.isBlock(block)){
            res.status(500).send('invalid block');
            return 0;
        }
        const version = block.meta.version || 0;
        const net_id = block.meta.network_id || 0;
        const chain_id = block.meta.chain_id || 0;
        if(version<vr.con.constant.compatible_version||net_id!=vr.con.constant.my_net_id||chain_id!=vr.con.constant.my_chain_id){
            res.status(500).send('unsupported　version');
            return 0;
        }
        const info:chain_info = JSON.parse((await promisify(fs.readFile)('./json/chain/net_id_'+vr.con.constant.my_net_id.toString()+'/info.json','utf-8')));
        if(block.meta.height<info.last_height+1){
            res.status(500).send('old block');
            return 0;
        }
        if(block.meta.height>info.last_height+1){
            const remote_add = req.connection.remoteAddress || '';
            const splitted = remote_add.split(':');
            const ip = splitted[splitted.length - 1];
            const url = 'http://'+ip+':57750/chain';
            const option = {
                url:url,
                body:block,
                json:true
            }
            const new_chain:vr.Block[] = await rp.post(option);
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
            const my_diff_sum = info.pos_diffs.slice(same_height+1).reduce((sum,diff)=>math.chain(sum).add(diff).done(),0);
            const new_diff_sum:number = add_chain.reduce((sum,block)=>math.chain(sum).add(block.meta.pos_diff).done(),0);
            if(math.largerEq(my_diff_sum,new_diff_sum)as boolean){
                res.status(500).send('light chain');
                return 0;
            }
            await P.forEach(add_chain, async block=>{
                const new_req = new_obj(
                    req,
                    req=>{
                        req.body = block;
                        return req;
                    }
                );
                await arguments.callee(new_req,res);
            });
        }
        const chain:vr.Block[] = await read_chain(2*(10**9));
        const roots:{stateroot:string,lockroot:string} = JSON.parse(await promisify(fs.readFile)('./json/root.json','utf-8'));
        const pool:vr.Pool = JSON.parse(await promisify(fs.readFile)('./json/pool.json','utf-8'));
        const S_Trie = logic.state_trie_ins(roots.stateroot);
        const StateData = await logic.get_block_statedata(block,chain,S_Trie);
        const L_Trie = logic.lock_trie_ins(roots.lockroot);
        const LockData = await logic.get_block_lockdata(block,chain,L_Trie);
        const check = (()=>{
            if(block.meta.kind==='key') return vr.block.verify_key_block(block,chain,roots.stateroot,roots.lockroot,StateData);
            else if(block.meta.kind==='micro') return vr.block.verify_micro_block(block,chain,roots.stateroot,roots.lockroot,StateData,LockData);
            else return false;
        })();
        if(!check){
            res.status(500).send('invalid block');
            return 0;
        }
        const accepted = (()=>{
            if(block.meta.kind==='key') return vr.block.accept_key_block(block,chain,StateData,LockData);
            else return vr.block.accept_micro_block(block,chain,StateData,LockData);
        })();
        await P.forEach(accepted[0], async (state:vr.State)=>{
            if(state.kind==='state') await S_Trie.put(state.owner,state);
            else await S_Trie.put(state.token,state);
        });

        await P.forEach(accepted[1], async (lock:vr.Lock)=>{
            await L_Trie.put(lock.address,lock);
        });

        await write_chain(block);

        const new_roots = {
            stateroot:S_Trie.now_root(),
            lockroot:L_Trie.now_root()
        }
        await promisify(fs.writeFile)('./json/root.json',JSON.stringify(new_roots,null, 4),'utf-8');

        const txs_hash = block.txs.map(pure=>pure.hash);
        const new_pool_keys = Object.keys(pool).filter(key=>txs_hash.indexOf(key)===-1);
        const new_pool = new_pool_keys.reduce((obj:vr.Pool,key)=>{
            obj[key] = pool[key];
            return obj;
        },{});
        await promisify(fs.writeFile)('./json/pool.json',JSON.stringify(new_pool,null, 4),'utf-8');

        res.status(200).send('success');

        const peers:peer[] = JSON.parse(await promisify(fs.readFile)('./json/peer_list.json','utf-8')||"[]");
        await P.forEach(peers,async peer=>{
            const url1 = 'http://'+peer.ip+':57750/block';
            const option1 = {
                url:url1,
                body:block,
                json:true
            }
            const order = await rp.post(option1);
            if(order!='order chain') return 1;
            const url2 = 'http://'+peer.ip+':57750/chain';
            const option2 = {
                url:url2,
                body:chain.concat(block),
                json:true
            }
            await rp.post(option2);
        });
        return 1;
    }
    catch(e){
        console.log(e);
        res.status(500).send('error');
    }
});