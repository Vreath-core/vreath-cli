import assert = require('assert');
import * as vr from 'vreath'
import * as tx_routes from '../app/routes/tx'
import * as block_routes from '../app/routes/block'
import * as chain_routes from '../app/routes/chain'
import * as unit_routes from '../app/routes/unit'
import * as data from '../logic/data'
import * as intervals from '../logic/interval'
import {Node} from '../commands/main'
import {promisify} from 'util'
import {Readable} from 'stream'
import * as fs from 'fs'
import * as path from 'path'
import readlineSync from 'readline-sync'
import CryptoJS from 'crypto-js'
import * as P from 'p-iteration'
const PeerInfo = require('peer-info');
const PeerId = require('peer-id');
const Multiaddr = require('multiaddr');
const PeerBook = require('peer-book')
const libp2p = require('libp2p');
const TCP = require('libp2p-tcp')
const WS = require('libp2p-websockets')
const SPDY = require('libp2p-spdy')
const MPLEX = require('libp2p-mplex')
const SECIO = require('libp2p-secio')
const MulticastDNS = require('libp2p-mdns')
const Bootstrap = require('libp2p-bootstrap')
const DHT = require('libp2p-kad-dht')
const defaultsDeep = require('@nodeutils/defaults-deep')
const pull = require('pull-stream');
const toStream = require('pull-stream-to-stream');


export class ReadableStream extends Readable implements NodeJS.ReadableStream{
    private i:number = 0;
    constructor(private keys:Buffer[],private values:Buffer[]){
        super({objectMode:true});
    }
    _read(){
        if(this.i>=this.keys.length){
            this.push(null);
        }
        else{
            const obj = {key:this.keys[this.i],value:this.values[this.i]};
            this.push(obj);
            this.i ++;
        }
    }
}

export class TestDB implements vr.db_impl {
    constructor(private keys:Buffer[],private values:Buffer[]){}

    public async get(key:Buffer){
        const i = this.keys.indexOf(key);
        return this.values[i];
    }

    public async put(key:Buffer,val:Buffer){
        const i = this.keys.indexOf(key);
        if(i===-1){
            this.keys.push(key);
            this.values.push(val);
        }
        else{
            this.values[i] = val;
        }
    }

    public async del(key:Buffer){
        const i = this.keys.indexOf(key);
        this.keys.splice(i,1);
        this.values.splice(i,1);
    }

    public createReadStream(){
        const keys = this.keys;
        const values = this.values;
        const stream = new ReadableStream(keys,values);
        return stream;
    }

    get raw_db(){
        return this.keys.map((key,i)=>{return {key:key,value:this.values[i]}});
    }
}

class DBSet {
    private db_set:{[key:string]:vr.db} = {}
    constructor(){}
    call(_key:string){
        return this.db_set[_key];
    }
    add_db(_key:string,_db:vr.db){
        this.db_set[_key] = _db;
    }
}


const run_node = async (private_key:string,config:any,port:string,bootstrapList:data.peer_info[],db_set:DBSet)=>{
    const peer_id = await promisify(PeerId.createFromJSON)(config.peer);
    const peer_info = new PeerInfo(peer_id);
    peer_info.multiaddrs.add(`/ip4/localhost/tcp/${port}`);
    const peer_address_list = bootstrapList.map(peer=>`${peer.multiaddrs[0]}/p2p/${peer.identity.id}`);
    await data.peer_list_db.del(Buffer.from(config.peer.id).toString('hex'));
    const node = new Node({ peerInfo: peer_info},peer_address_list);

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

    node.start((err:string)=>{
        node.on('peer:connect', (peerInfo:any) => {
            const ids = new PeerInfo(PeerId.createFromB58String(peerInfo.id._idB58String));
            const id_obj = {
                id:ids.id._idB58String,
                privKey:ids.id._privKey,
                pubKey:ids.id._pubKey
            };
            const multiaddrs = peerInfo.multiaddrs.toArray().map((add:{buffer:Buffer})=>Multiaddr(add.buffer).toString());
            const peer_obj:data.peer_info = {
                identity:id_obj,
                multiaddrs:multiaddrs
            }
            data.peer_list_db.write_obj(Buffer.from(peer_obj.identity.id).toString('hex'),peer_obj);
        });

        node.handle(`/vreath/${data.id}/tx/post`, (protocol:string, conn:any)=>{
            pull(
                conn,
                pull.drain((msg:Buffer)=>{
                    tx_routes.post(msg,chain_info_db,root_db,trie_db,tx_db,block_db,state_db,lock_db,output_db);
                })
            )
        });

        node.handle(`/vreath/${data.id}/block/get`, async (protocol:string, conn:any) => {
            pull(
                conn,
                pull.drain((msg:Buffer)=>{
                    block_routes.get(msg,node,block_db);
                })
            )
        });

        node.handle(`/vreath/${data.id}/block/post`, (protocol:string, conn:string) => {
            pull(
                conn,
                pull.drain((msg:Buffer)=>{
                    block_routes.post(msg,chain_info_db,root_db,trie_db,block_db,state_db,lock_db,tx_db);
                })
            )
        });

        node.handle(`/vreath/${data.id}/chain/get`, (protocol:string, conn:any) => {
            const stream = toStream(conn);
            chain_routes.get(stream,chain_info_db,block_db,output_db);
        });

        node.handle(`/vreath/${data.id}/chain/post`, (protocol:string, conn:string) => {
            pull(
                conn,
                pull.drain((msg:Buffer)=>{
                    chain_routes.post(msg,block_db,chain_info_db,root_db,trie_db,state_db,lock_db,tx_db);
                })
            )
        });

        node.handle(`/vreath/${data.id}/unit/post`, async (protocol:string, conn:any)=>{
            pull(
                conn,
                pull.drain((msg:Buffer)=>{
                    unit_routes.post(msg,block_db,chain_info_db,root_db,trie_db,state_db,unit_db);
                })
            )
        });

        node.on('error',(err:string)=>{
            throw new Error(err);
        })

        intervals.get_new_chain(node,peer_list_db,chain_info_db,block_db,root_db,trie_db,state_db,lock_db,tx_db);
        if(config.validator.flag){
            intervals.staking(private_key,node,chain_info_db,root_db,trie_db,block_db,state_db,lock_db,output_db,tx_db,peer_list_db);
            intervals.buying_unit(private_key,config,node,chain_info_db,root_db,trie_db,block_db,state_db,lock_db,output_db,tx_db,unit_db,peer_list_db);
        }
        if(config.miner.flag){
            intervals.refreshing(private_key,config,node,chain_info_db,root_db,trie_db,block_db,state_db,lock_db,output_db,tx_db,peer_list_db);
            intervals.making_unit(private_key,config,node,chain_info_db,root_db,trie_db,block_db,state_db,unit_db,peer_list_db);
        }
        intervals.maintenance(node,chain_info_db,block_db,root_db,trie_db,state_db,lock_db,tx_db,peer_list_db);
    });
}