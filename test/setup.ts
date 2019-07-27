import * as vr from 'vreath'
import {promisify} from 'util'
import bigInt from 'big-integer'
import * as fs from 'fs'
import * as path from 'path'
import {peer_info, chain_info} from '../logic/data'
import {DBSet, make_db_obj} from './common'
const PeerId = require('peer-id');
const PeerInfo = require('peer-info');
const Multiaddr = require('multiaddr');
const search_ip = require('ip');

export type setup_data = {
    privKey:string,
    pubKey:string,
    state:vr.State[],
    token:vr.Token[],
    lock:vr.Lock[],
    block:vr.Block,
    chain_info:chain_info
    peer:peer_info
}

export const test_setup = async ():Promise<setup_data>=>{
    const privKey = vr.crypto.genereate_key();
    const pubKey = vr.crypto.private2public(privKey);
    const unit_address = vr.crypto.generate_address(vr.con.constant.unit,pubKey);
    const one_amount = "e8d4a51000"
    const genesis_state:vr.State[] = [vr.state.create_state("00",vr.con.constant.unit,unit_address,one_amount,["01","00"])];
    const genesis_token:vr.Token[] = [vr.state.create_token("00",vr.con.constant.native),vr.state.create_token("00",vr.con.constant.unit,one_amount)];
    const genesis_lock:vr.Lock[] = [vr.lock.create_lock(unit_address,0,"00",vr.crypto.get_sha256(''),0,vr.crypto.get_sha256(''),)];
    const gen_meta:vr.BlockMeta = {
        kind:0,
        height:"00",
        previoushash:vr.crypto.get_sha256(''),
        timestamp:1545629491,
        pos_diff:vr.con.constant.one_hex,
        trie_root:vr.crypto.get_sha256(''),
        tx_root:vr.crypto.get_sha256(''),
        fee_sum:"00",
        extra:""
    }
    const test_id = "1126"
    const id = vr.con.constant.my_version+test_id+test_id;
    const meta_array = vr.block.block_meta2array(gen_meta).concat(id);
    const gen_sign_data = vr.crypto.sign(vr.crypto.array2hash(meta_array),privKey);
    const v = vr.crypto.bigint2hex(bigInt(id, 16).multiply(2).add(8).add(bigInt(28).subtract(bigInt(gen_sign_data[0], 16))));
    const gen_sign:vr.Sign = {
        data:gen_sign_data[1],
        v:v
    }
    const all_array = meta_array.concat(gen_sign.v);
    const gen_hash = vr.crypto.array2hash(all_array);
    const genesis_block:vr.Block = {
        hash:gen_hash,
        signature:gen_sign,
        meta:gen_meta,
        txs:[]
    }
    const genesis_chain_info:chain_info = {
        version:vr.con.constant.my_version,
        chain_id:test_id,
        net_id:test_id,
        compatible_version:vr.con.constant.compatible_version,
        last_height:"00",
        last_hash:gen_hash
    }
    const gen_peer:peer_info = await set_peer_id('8000');
    const data:setup_data = {
        privKey:privKey,
        pubKey:pubKey,
        state:genesis_state,
        token:genesis_token,
        lock:genesis_lock,
        block:genesis_block,
        chain_info:genesis_chain_info,
        peer:gen_peer
    }
    return data;
}


export const set_peer_id = async (port:string)=>{
    const peer_id = await promisify(PeerId.create)();
    const id_obj = peer_id.toJSON();
    const peer_info = new PeerInfo(peer_id);
    peer_info.multiaddrs.add(`/ip4/127.0.0.1/tcp/${port}/p2p/${id_obj.id}`);
    const multiaddrs = peer_info.multiaddrs.toArray().map((add:{buffer:Buffer})=>Multiaddr(add.buffer).toString());
    const peer_obj:peer_info = {
        identity:id_obj,
        multiaddrs:multiaddrs
    }
    return peer_obj;
}

export const add_setup_data = async (db_set:DBSet,setup:setup_data,id:number)=>{
    try{
        db_set.add_db('chain_info',make_db_obj());
        db_set.add_db('root',make_db_obj());
        db_set.add_db('trie',make_db_obj());
        db_set.add_db('tx',make_db_obj());
        db_set.add_db('block',make_db_obj());
        db_set.add_db('state',make_db_obj());
        db_set.add_db('lock',make_db_obj());
        db_set.add_db('output',make_db_obj());
        db_set.add_db('unit',make_db_obj());
        db_set.add_db('peer_list',make_db_obj());
        db_set.add_db('log',make_db_obj());
        const chain_info_db = db_set.call('chain_info');
        const root_db = db_set.call('root');
        const trie_db = db_set.call('trie');
        const block_db = db_set.call('block');
        const state_db = db_set.call('state');
        const lock_db = db_set.call('lock');
        const peer_list_db = db_set.call('peer_list');

        chain_info_db.write_obj("00",setup.chain_info);
        const trie = vr.data.trie_ins(trie_db);
        await vr.data.write_trie(trie,state_db,lock_db,setup.state[0],setup.lock[0]);
        const root = trie.now_root();
        root_db.put("00",root);
        block_db.write_obj("00",setup.block);
        peer_list_db.write_obj(Buffer.from(setup.peer.identity.id).toString('hex'),setup.peer);
        await promisify(fs.writeFile)(path.join(__dirname,'../log/test'+id.toString()+'.log'),'','utf-8');
        return db_set;
    }
    catch(e){
        return db_set;
    }
}