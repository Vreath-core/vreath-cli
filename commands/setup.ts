import * as vr from 'vreath'
import * as data from '../logic/data'
import * as genesis from '../genesis/index'
import * as fs from 'fs'
import * as path from 'path'
import {promisify} from 'util'
import * as P from 'p-iteration'
import bigInt from 'big-integer'
import readlineSync from 'readline-sync'

export default async ()=>{
    const trie_db = data.make_db_obj(path.join(__dirname,`../db/net_id_${data.id}/trie`));
    const state_db = data.make_db_obj(path.join(__dirname,`../db/net_id_${data.id}/state`));
    const lock_db =  data.make_db_obj(path.join(__dirname,`../db/net_id_${data.id}/lock`));
    const block_db = data.make_db_obj(path.join(__dirname,`../db/net_id_${data.id}/block`));
    const chain_info_db = data.make_db_obj(path.join(__dirname,`../db/net_id_${data.id}/chain_info`));
    const tx_db = data.make_db_obj(path.join(__dirname,`../db/net_id_${data.id}/tx_pool`));
    const output_db = data.make_db_obj(path.join(__dirname,`../db/net_id_${data.id}/output`));
    const root_db = data.make_db_obj(path.join(__dirname,`../db/net_id_${data.id}/root`));
    const unit_db = data.make_db_obj(path.join(__dirname,`../db/net_id_${data.id}/unit_store`));
    const peer_list_db = data.make_db_obj(path.join(__dirname,`../db/net_id_${data.id}/peer_list`));
    const my_password = Buffer.from(readlineSync.question('Your password:',{hideEchoBack: true, defaultInput: 'password'}),'utf-8').toString('hex')
    const my_key = vr.crypto.get_sha256(my_password).slice(0,122);
    await promisify(fs.stat)(path.join(__dirname,'../keys/private/'+my_key+'.txt'));
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
