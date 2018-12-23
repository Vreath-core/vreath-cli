import * as express from 'express'
import * as vs from 'vreath'
import * as fs from 'fs'
import {promisify} from 'util'
import * as logic from '../../logic/data'

const router = express.Router();

export default router.post('/tx',async (req,res)=>{
    try{
        const tx:vs.Tx = req.body;
        if(!vs.tx.isTx(tx)) res.send('invalid tx');
        const version = tx.meta.version || 0;
        const net_id = tx.meta.network_id || 0;
        const chain_id = tx.meta.chain_id || 0;
        if(version<vs.con.constant.compatible_version||net_id!=vs.con.constant.my_net_id||chain_id!=vs.con.constant.my_chain_id) res.send('unsupported　version');
        else{
            const pool:vs.Pool = JSON.parse(await promisify(fs.readFile)('./json/pool.json','utf-8'));
            const chain:vs.Block[] = JSON.parse(await promisify(fs.readFile)('./json/chain.json','utf-8'));
            const roots:{stateroot:string,lockroot:string} = JSON.parse(await promisify(fs.readFile)('./json/root.json','utf-8'));
            const S_Trie = logic.state_trie_ins(roots.stateroot);
            const StateData = await logic.get_tx_statedata(tx,chain,S_Trie);
            const L_Trie = logic.lock_trie_ins(roots.lockroot);
            const LockData = await logic.get_tx_lockdata(tx,chain,L_Trie);
            vs.pool.tx2pool(pool,tx,chain,StateData,LockData);
            res.status(200).send('success');
        }
    }
    catch(e){
        console.log(e);
        res.status(404).send('error');
    }
});