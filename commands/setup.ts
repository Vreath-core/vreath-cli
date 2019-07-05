import * as vr from 'vreath'
import * as data from '../logic/data'
import * as genesis from '../genesis/index'
import * as fs from 'fs'
import * as path from 'path'
import {promisify} from 'util'
import * as P from 'p-iteration'
import bigInt from 'big-integer'

export default async (my_password:string,state_db:vr.db,lock_db:vr.db,trie_db:vr.db,chain_info_db:vr.db,block_db:vr.db,root_db:vr.db,tx_db:vr.db,output_db:vr.db,unit_db:vr.db,peer_list_db:vr.db)=>{
    const my_key = vr.crypto.get_sha256(my_password).slice(0,122);
    await promisify(fs.stat)('./keys/private/'+my_key+'.txt');
    await state_db.filter('hex','utf8',async (key:string,val:vr.Tx)=>{
        await state_db.del(key);
        return false;
    });
    await lock_db.filter('hex','utf8',async (key:string,val:vr.Tx)=>{
        await lock_db.del(key);
        return false;
    });
    const trie = vr.data.trie_ins(trie_db);
    await vr.data.write_trie(trie,state_db,lock_db,genesis.state[0],genesis.lock[0]);
    const root = trie.now_root();
    await chain_info_db.del('00');
    await block_db.filter('hex','utf8',async (key:string,val:vr.Tx)=>{
        await block_db.del(key);
        return false;
    });

    const info:data.chain_info = {
        net_id:vr.con.constant.my_net_id,
        chain_id:vr.con.constant.my_chain_id,
        version:vr.con.constant.my_version,
        compatible_version:vr.con.constant.compatible_version,
        last_height:"00",
        last_hash:genesis.block.hash
    }
    await chain_info_db.write_obj("00",info);
    await block_db.write_obj("00",genesis.block);
    await root_db.put("00",root);
    await tx_db.filter('hex','utf8',async (key:string,val:vr.Tx)=>{
        await tx_db.del(key);
        await output_db.del(key);
        return false;
    });
    await unit_db.filter('hex','utf8',async (key:string,val:vr.Tx)=>{
        await unit_db.del(key);
        return false;
    });
    const genesis_peers:data.peer_info[]|null = JSON.parse(Buffer.from(await promisify(fs.readFile)(path.join(__dirname,'../genesis_peers.json'))).toString());
    if(genesis_peers==null) throw new Error("genesis peers doesn't exist");
    await P.forEach(genesis_peers, async (peer:data.peer_info)=>{
        await peer_list_db.write_obj(Buffer.from(peer.identity.id,'utf-8').toString('hex'),peer);
    });
    await promisify(fs.writeFile)('./log/main.log','','utf-8');
}
