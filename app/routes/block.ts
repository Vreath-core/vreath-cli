import * as vr from 'vreath'
import * as data from '../../logic/data'
import * as works from '../../logic/work'
import * as P from 'p-iteration'

export const get = async (message:Buffer)=>{
    const height = message.toString('hex');
    console.log('called');
    if(vr.checker.hex_check(height,8,true)){
        throw new Error('invalid request data');
    }
    const block:vr.Block|null = await data.block_db.read_obj(height);
    if(block==null) throw new Error('invalid height');
    return block;
}

export const post = async (message:Buffer)=>{
    const msg_data:[vr.Block,vr.State[]] = JSON.parse(message.toString('utf-8'));
    const block = msg_data[0];
    const output_state = msg_data[1];
    if(block==null||!vr.block.isBlock(block)||output_state==null||output_state.some(s=>!vr.state.isState(s))) throw new Error('invalid data');
    const info:data.chain_info|null = await data.chain_info_db.read_obj('00');
    if(info==null) throw new Error('chain_info is empty');
    const last_height = info.last_height;
    const root:string|null = await data.root_db.get(last_height,'hex');
    if(root==null) throw new Error('root is empty at the last height');
    const trie = vr.data.trie_ins(data.trie_db,root);
    const verified = await (async ()=>{
        if(block.meta.kind===0) return await vr.block.verify_key_block(block,data.block_db,trie,data.state_db,last_height);
        else if(block.meta.kind===1) return await vr.block.verify_micro_block(block,output_state,data.block_db,trie,data.state_db,data.lock_db,last_height);
        else return false;
    });
    if(!verified){
        throw new Error('invalid block');
    }
    if(block.meta.kind===0) await vr.block.accept_key_block(block,data.block_db,last_height,trie,data.state_db,data.lock_db);
    else if(block.meta.kind===1) await vr.block.accept_micro_block(block,data.block_db,last_height,trie,data.state_db,data.lock_db);
    await data.block_db.write_obj(block.meta.height,block);
    const new_info = await works.new_obj(info,(info)=>{
        info.last_height = block.meta.height;
        info.last_hash = block.hash;
        return info;
    });
    await data.chain_info_db.write_obj("00",new_info);
    const new_root = trie.now_root();
    await data.root_db.put(block.meta.height,new_root,'hex','utf8');
    const txs_hash = block.txs.map(tx=>tx.hash);
    await P.forEach(txs_hash, async (key:string)=>{
        await data.tx_db.del(key);
        await data.output_db.del(key);
    });
    return 1;
}