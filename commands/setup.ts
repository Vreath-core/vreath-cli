import * as vr from 'vreath'
import * as data from '../logic/data'
import * as genesis from '../genesis/index'
import * as fs from 'fs'
import {promisify} from 'util'
import * as P from 'p-iteration'
import {new_obj} from '../logic/work';
import bigInt from 'big-integer'

export default async (my_password:string)=>{
    const my_key = vr.crypto.get_sha256(my_password).slice(0,122);
    await promisify(fs.stat)('./keys/private/'+my_key+'.txt');
    const trie = vr.data.trie_ins(data.trie_db);
    await vr.data.write_trie(trie,data.state_db,data.lock_db,genesis.state[0],genesis.lock[0]);
    const root = trie.now_root();

    const info:data.chain_info = {
        net_id:vr.con.constant.my_net_id,
        chain_id:vr.con.constant.my_chain_id,
        version:vr.con.constant.my_version,
        compatible_version:vr.con.constant.compatible_version,
        last_height:"0",
        last_hash:genesis.block.hash,
        pos_diffs:[]
    }
    const now_info:data.chain_info = (await data.chain_info_db.read_obj("00")) || info;
    const last_height = now_info.last_height;
    let i = bigInt(0);
    for(i;i.lesserOrEquals(bigInt(last_height,16));i=i.add(1)){
        await data.block_db.del(i.toString(16));
    }
    await data.chain_info_db.write_obj("00",info);
    await data.block_db.write_obj("00",genesis.block);
    await data.root_db.put("00",root,"hex","hex");
    await data.tx_db.filter('hex','utf8',async (key:string,val:vr.Tx)=>{
        await data.tx_db.del(key);
        return false;
    });
    await promisify(fs.writeFile)('./log/log.log','','utf-8');
}
