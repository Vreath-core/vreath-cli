import * as vr from 'vreath'
import * as data from '../../logic/data'
import * as bunyan from 'bunyan'
//import * as P from 'p-iteration'


export const post = async (msg:Buffer,chain_info_db:vr.db,root_db:vr.db,trie_db:vr.db,tx_db:vr.db,block_db:vr.db,state_db:vr.db,lock_db:vr.db,output_db:vr.db,log:bunyan)=>{
    try{
        const msg_data:[vr.Tx,vr.State[]] = JSON.parse(msg.toString('utf-8'));
        const tx = msg_data[0];
        const output_state = msg_data[1];
        if(tx==null||!vr.tx.isTx(tx)||output_state==null||output_state.some(s=>!vr.state.isState(s))) throw new Error('invalid type of data');
        const info:data.chain_info|null = await chain_info_db.read_obj("00");
        if(info==null) throw new Error("chain_info doesn't exist");
        const last_height = info.last_height;
        const root = await root_db.get(last_height,"hex");
        if(root==null) throw new Error("root doesn't exist");
        const trie = vr.data.trie_ins(trie_db,root);
        await vr.pool.tx2pool(tx_db,tx,output_state,block_db,trie,state_db,lock_db,last_height);
        await output_db.write_obj(tx.hash,output_state);
        return 1;
    }
    catch(e){
        log.info(e);
    }
}
