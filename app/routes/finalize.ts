import * as vr from 'vreath'
import * as data from '../../logic/data'
import * as works from '../../logic/work'
import {post as block_post} from './block'
import bigInt from 'big-integer'
import * as P from 'p-iteration'
import * as bunyan from 'bunyan'
import * as fs from 'fs'
const pull = require('pull-stream');

export const post = async (msg:Buffer,block_db:vr.db,uniter_db:vr.db,root_db:vr.db,trie_db:vr.db,state_db:vr.db,finalize_db:vr.db,log:bunyan)=>{
    try{
        const data:vr.Finalize = JSON.parse(msg.toString('utf-8'));
        if(!vr.finalize.isFinalize(data)) throw new Error('invalid data');
        const block:vr.Block|null = await block_db.read_obj(data.height);
        if(block==null||block.meta.kind!=0||block.hash!=data.hash) throw new Error('invalid block height');
        const pre_height = vr.crypto.bigint2hex(bigInt(data.height,16).subtract(1));
        const pre_key_block = await vr.block.search_key_block(block_db,pre_height);
        const pre_key_height = pre_key_block.meta.height;
        const pre_finalizes:vr.Finalize[]|null = await finalize_db.read_obj(pre_key_height);
        const pre_uniters:string[] | null = await uniter_db.read_obj(pre_key_height);
        const pre_root:string|null = await root_db.read_obj(pre_key_height);
        const pre_trie = pre_root!=null ? vr.data.trie_ins(trie_db,pre_root) : null;
        if(pre_finalizes==null||pre_uniters==null||pre_root==null||pre_trie==null||!vr.finalize.verify(pre_key_block,pre_finalizes,pre_uniters,pre_trie,state_db)){
            throw new Error('previous key block is not finalized yet');
        }
        const sign:vr.Sign = data.sign;
        const finalize_hash = vr.finalize.hash(data.height,data.hash);
        const recover_id = vr.tx.get_recover_id_from_sign(sign);
        const pub_key = vr.crypto.recover(finalize_hash,sign.data,recover_id);
        const address = vr.crypto.generate_address(vr.con.constant.unit,pub_key);
        const uniters:string[]|null = await uniter_db.read_obj(data.height);
        if(uniters==null) throw new Error('no uniter at the height');
        const root:string|null = await root_db.get(data.height,'hex');
        if(root==null) throw new Error('root is empty at the last height');
        const trie = vr.data.trie_ins(trie_db,root);
        const finalize_validators = await vr.finalize.choose(uniters,data.height,trie,state_db);
        if(finalize_validators.indexOf(address)===-1) throw new Error('invalid address');
        if(!vr.crypto.verify(finalize_hash,sign.data,pub_key)) throw new Error('invalid sign');
        await finalize_db.write_obj(data.height,data);
    }
    catch(e){
        log.info(e);
    }
}