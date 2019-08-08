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
        if(vr.crypto.verify(finalize_hash,sign.data,pub_key)) throw new Error('invalid sign');
        await finalize_db.write_obj(data.height,data);
    }
    catch(e){
        log.info(e);
    }
}