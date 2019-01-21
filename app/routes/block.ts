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

export default router.get('/',async (req,res)=>{
    try{
        const info:{height:number,hash?:string} = req.body;
        const height = info.height;
        if(typeof height != 'number'){
            res.status(500).send('invalid request data');
            return 0;
        }
        const chain:vr.Block[] = await read_chain(2*(10**9));
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
        const info:chain_info = JSON.parse((await promisify(fs.readFile)('./json/chain/net_id_'+vr.con.constant.my_net_id.toString()+'/info.json','utf-8')));
        if(block.meta.height!=info.last_height+1){
            res.status(500).send('invalid height block');
            return 0;
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
        //console.log(e);
        res.status(500).send('error');
    }
});