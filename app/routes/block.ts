import * as express from 'express'
import * as vr from 'vreath'
import * as data from '../../logic/data'
import * as P from 'p-iteration'
import bunyan from 'bunyan'
import * as math from 'mathjs'
math.config({
    number: 'BigNumber'
});

const log = bunyan.createLogger({
    name:'vreath-cli',
    streams:[
        {
            path:'./log/log.log'
        }
    ]
});

const router = express.Router();

export default router.get('/',async (req,res)=>{
    try{
        const info:{height:number,hash?:string} = req.body;
        const height = info.height;
        if(typeof height != 'number'){
            res.status(500).send('invalid request data');
            return 0;
        }
        const chain:vr.Block[] = await data.read_chain(2*(10**9));
        const block = chain[height];
        const hash = info.hash || block.hash;
        if(hash!=block.hash){
            res.status(500).send('invalid hash');
            return 0;
        }
        res.json(block);
        return 1;
    }
    catch(e){
        res.status(500).send('error');
    }
}).post('/',async (req,res)=>{
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
        const info:data.chain_info = await data.read_chain_info();
        if(block.meta.height!=info.last_height+1){
            res.status(500).send('invalid height block');
            return 0;
        }
        const chain:vr.Block[] = await data.read_chain(2*(10**9));
        const roots:{stateroot:string,lockroot:string} = await data.read_root();
        const pool:vr.Pool = await data.read_pool(10**9)
        const S_Trie = data.state_trie_ins(roots.stateroot);
        const StateData = await data.get_block_statedata(block,chain,S_Trie);
        const L_Trie = data.lock_trie_ins(roots.lockroot);
        const LockData = await data.get_block_lockdata(block,chain,L_Trie);
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
            await data.write_state(state);
            const hash = vr.crypto.object_hash(state);
            if(state.kind==='state') await data.put_state_to_trie(S_Trie,hash,state.kind,state.owner);
            else if(state.kind==='info') await data.put_state_to_trie(S_Trie,hash,state.kind,state.token);
        });

        await P.forEach(accepted[1], async (lock:vr.Lock)=>{
            await data.write_lock(lock);
            const hash = vr.crypto.object_hash(lock);
            await data.put_lock_to_trie(L_Trie,hash,lock.address);
        });

        await data.write_chain(block);

        const new_roots = {
            stateroot:S_Trie.now_root(),
            lockroot:L_Trie.now_root()
        }
        await data.write_root(new_roots);

        const txs_hash = block.txs.map(pure=>pure.hash);
        const new_pool_keys = Object.keys(pool).filter(key=>txs_hash.indexOf(key)===-1);
        const new_pool = new_pool_keys.reduce((obj:vr.Pool,key)=>{
            obj[key] = pool[key];
            return obj;
        },{});
        await data.write_pool(new_pool);

        res.status(200).send('success');
        return 1;
    }
    catch(e){
        log.info(e);
        res.status(500).send('error');
    }
});