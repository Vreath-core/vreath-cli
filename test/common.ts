import * as vr from 'vreath'
import handshake from '../app/routes/handshake'
import * as tx_routes from '../app/routes/tx'
import * as block_routes from '../app/routes/block'
import * as chain_routes from '../app/routes/chain'
import * as unit_routes from '../app/routes/unit'
import * as finalize_routes from '../app/routes/finalize'
import * as data from '../logic/data'
import * as works from '../logic/work'
import * as intervals from '../logic/interval'
import {Node,node_handles,run_intervals} from '../commands/run'
import {promisify} from 'util'
import levelup, { LevelUp } from 'levelup';
import memdown from 'memdown'
import * as path from 'path'
import bigInt from 'big-integer'
import BigNumber from "bignumber.js"
import bunyan from 'bunyan'
import { config } from '../commands/config';
const PeerInfo = require('peer-info');
const PeerId = require('peer-id');
const Multiaddr = require('multiaddr');
const pull = require('pull-stream');
const toStream = require('pull-stream-to-stream');


export class leveldb {
    private db:LevelUp<memdown<Buffer,Buffer>>;
    constructor(_db:LevelUp<memdown<Buffer,Buffer>>){
        this.db = _db;
    }

    public async get(key:Buffer):Promise<Buffer>{
        const got:Buffer|string = await this.db.get(key);
        if(typeof got ==='string') return Buffer.from(key);
        else return got;
    }

    public async put(key:Buffer,val:Buffer):Promise<void>{
        await this.db.put(key,val);
    }

    public async del(key:Buffer):Promise<void>{
        await this.db.del(key);
    }

    public createReadStream():NodeJS.ReadableStream{
        return this.db.createReadStream();
    }

    get raw_db(){
        return this.db;
    }
}

export const make_db_obj = ()=>{
    const levelup_obj = new levelup(memdown<Buffer,Buffer>());
    const leveldb_obj:vr.db_impl = new leveldb(levelup_obj);
    return new vr.db(leveldb_obj)
}



export class DBSet {
    private db_set:{[key:string]:vr.db} = {}
    constructor(){}
    call(_key:string){
        return this.db_set[_key];
    }
    add_db(_key:string,_db:vr.db){
        this.db_set[_key] = _db;
    }
}


const dialog = async (db_set:DBSet,native_address:string,unit_address:string,id:number):Promise<void>=>{
    const chain_info_db = db_set.call('chain_info');
    const root_db = db_set.call('root');
    const trie_db = db_set.call('trie');
    const state_db = db_set.call('state')
    const obj = await works.dialog_data(chain_info_db,root_db,trie_db,state_db,native_address,unit_address,id);
    console.log(JSON.stringify(obj,null,4));
    await works.sleep(7000);
    return await dialog(db_set,native_address,unit_address,id);
}

const finish_check = async (db_set:DBSet):Promise<DBSet>=>{
    const chain_info_db = db_set.call('chain_info');
    const chain_info:data.chain_info|null = await chain_info_db.read_obj('00');
    if(chain_info==null || !bigInt(chain_info.last_height,16).lesser(3)) return db_set;
    else return await finish_check(db_set);
}


export const run_node = async (private_key:string,config:config,ip:string,port:string,bootstrapList:data.peer_info[],db_set:DBSet,id:number):Promise<void>=>{
    const chain_info_db = db_set.call('chain_info');
    const root_db = db_set.call('root');
    const trie_db = db_set.call('trie');
    const tx_db = db_set.call('tx');
    const block_db = db_set.call('block');
    const state_db = db_set.call('state');
    const lock_db = db_set.call('lock');
    const output_db = db_set.call('output');
    const unit_db = db_set.call('unit');
    const peer_list_db = db_set.call('peer_list');
    const finalize_db = db_set.call('finalize');
    const uniter_db = db_set.call('uniter');
    const peer_id = await promisify(PeerId.createFromJSON)(config.peer);
    const peer_info = new PeerInfo(peer_id);
    peer_info.multiaddrs.add(`/ip4/${ip}/tcp/${port}`);
    const peer_address_list = bootstrapList.map(peer=>`${peer.multiaddrs[0]}`);
    await peer_list_db.del(Buffer.from(config.peer.id).toString('hex'));

    const node = new Node(peer_info,['spdy','mplex'],peer_address_list);

    const log = bunyan.createLogger({
        name:'vreath-cli',
        streams:[
            {
                path:path.join(__dirname,`../log/test${id.toString()}.log`)
            }
        ]
    });

    try{
        node.start((err:string)=>{
            //console.log(err);
            node_handles(node,private_key,config,chain_info_db,root_db,trie_db,block_db,state_db,lock_db,output_db,tx_db,unit_db,peer_list_db,finalize_db,uniter_db,log);
            run_intervals(node,private_key,config,chain_info_db,root_db,trie_db,block_db,state_db,lock_db,output_db,tx_db,unit_db,peer_list_db,finalize_db,uniter_db,log);
            const pubKey = vr.crypto.private2public(private_key);
            const native_address = vr.crypto.generate_address(vr.con.constant.native,pubKey);
            const unit_address = vr.crypto.generate_address(vr.con.constant.unit,pubKey);

            dialog(db_set,native_address,unit_address,id);
        });
    }
    catch(e){
        log.info(e);
    }
}
