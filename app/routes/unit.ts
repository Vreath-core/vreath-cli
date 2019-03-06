import * as vr from 'vreath'
import * as express from 'express'
import {new_obj} from '../../logic/work'
import {state_trie_ins,read_chain,read_root,get_unit_store,write_unit, read_state} from '../../logic/data'
import bunyan from 'bunyan'

const log = bunyan.createLogger({
    name:'vreath-cli',
    streams:[
        {
            path:'./log/log.log'
        }
    ]
});

const router = express.Router();

export default router.post('/',async (req,res)=>{
    try{
        const unit:vr.Unit = req.body;
        const unit_store = await get_unit_store();
        const roots:{stateroot:string,lockroot:string} = await read_root();
        const S_Trie = state_trie_ins(roots.stateroot);
        const unit_state = await read_state(S_Trie,unit.address,vr.state.create_state(0,unit.address,vr.con.constant.unit,0,{data:"[]"}));
        const used:string[] = JSON.parse(unit_state.data.used||"[]");
        const iden_hash = vr.crypto.hash(unit.request+unit.height.toString(16)+unit.block_hash);
        if(used.indexOf(iden_hash)!=-1){
            res.status(500).send('already used unit');
            return 0;
        }
        const chain:vr.Block[] = await read_chain(2*(10**9));
        const check = (()=>{
            let search_block:vr.Block;
            let search_tx:vr.TxPure;
            for(search_block of chain.slice().reverse()){
                for(search_tx of search_block.txs){
                    if(search_tx.meta.kind==="refresh"&&search_tx.meta.req_tx_hash===unit.request&&search_tx.meta.height===unit.height&&search_tx.meta.block_hash===unit.block_hash&&search_tx.meta.output===unit.output&&vr.crypto.verify_address(unit.address)&&unit.unit_price>=0&&vr.tx.mining(unit.request,unit.height,unit.block_hash,unit.address,unit.output,unit.unit_price,unit.nonce)) return true;
                }
            }
            return false;
        })();
        if(!check){
            res.status(500).send('invalid unit');
            return 0;
        }
        const new_unit_store = new_obj(
            unit_store,
            store=>{
                const key = vr.crypto.hash(unit.request+unit.height.toString(16)+unit.block_hash+unit.address);
                store[key] = unit;
                return store;
            }
        );
        let w_unit:vr.Unit;
        for(w_unit of Object.values(new_unit_store)){
            await write_unit(w_unit);
        }
        res.status(200).send('success');
        return 1;
    }
    catch(e){
        log.info(e);
        res.status(404).send('error');
    }
});