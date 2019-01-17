import * as express from 'express'
import * as vr from 'vreath'
import * as fs from 'fs'
import {promisify} from 'util'
import * as logic from '../../logic/data'
import {read_chain, write_chain} from '../../logic/work'
import * as P from 'p-iteration'

const router = express.Router();

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
        const chain:vr.Block[] = await read_chain(2*(10**9));
        if(block.meta.height<chain.length-1){
            res.status(500).send('old block');
            return 0;
        }
        if(block.meta.height>chain.length-1){
            res.status(200).send('order chain');
            return 0;
        }
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
        return 1;
    }
    catch(e){
        console.log(e);
        res.status(500).send('error');
    }
});