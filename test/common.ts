import assert = require('assert');
import * as vr from 'vreath'
import handshake from '../app/routes/handshake'
import * as tx_routes from '../app/routes/tx'
import * as block_routes from '../app/routes/block'
import * as chain_routes from '../app/routes/chain'
import * as unit_routes from '../app/routes/unit'
import * as data from '../logic/data'
import * as works from '../logic/work'
import * as intervals from '../logic/interval'
import {Node} from '../commands/main'
import {promisify} from 'util'
import {Readable} from 'stream'
import levelup, { LevelUp } from 'levelup';
import memdown from 'memdown'
import * as fs from 'fs'
import * as path from 'path'
import readlineSync from 'readline-sync'
import CryptoJS from 'crypto-js'
import * as P from 'p-iteration'
import bigInt from 'big-integer'
import BigNumber from "bignumber.js"
import bunyan from 'bunyan'
import { config } from '../commands/config';
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
    const info:data.chain_info|null = await chain_info_db.read_obj('00');
    if(info==null) throw new Error("chain_info doesn't exist");
    const last_height = info.last_height;
    const root_db = db_set.call('root');
    const root = await root_db.get(last_height);
    if(root==null) throw new Error("root doesn't exist");
    const trie_db = db_set.call('trie');
    const trie = vr.data.trie_ins(trie_db,root);
    const state_db = db_set.call('state')
    const native_state = await vr.data.read_from_trie(trie,state_db,native_address,0,vr.state.create_state("00",vr.con.constant.native,native_address,"00"));
    const unit_state = await vr.data.read_from_trie(trie,state_db,unit_address,0,vr.state.create_state("00",vr.con.constant.unit,unit_address,"00"));
    const hex2tenstr = (amount:string,compute:(big:BigNumber)=>BigNumber)=>{
        const big_int = bigInt(amount,16);
        const big_num = new BigNumber(big_int.toString(16),16);
        return compute(big_num).toString();
    }
    const amount_divide = (big:BigNumber)=>big.dividedBy(10**12);
    const native_amount = hex2tenstr(native_state.amount,amount_divide);
    const unit_amount = hex2tenstr(unit_state.amount,amount_divide);
    const height = hex2tenstr(info.last_height,(big:BigNumber)=>big);
    const obj = {
        id:id,
        address:native_address,
        native_balance:native_amount,
        unit_balance:unit_amount,
        last_height:height,
        last_hash:info.last_hash
    }
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
                //console.log(peer_obj)
                peer_list_db.write_obj(Buffer.from(peer_obj.identity.id).toString('hex'),peer_obj);
            });

            node.handle(`/vreath/${data.id}/handshake`, (protocol:string, conn:any)=>{
                const stream = toStream(conn);
                let data:string[] = [];
                stream.on('data',(msg:Buffer)=>{
                    try{
                        if(msg!=null&&msg.length>0){
                            const str = msg.toString('utf-8');
                            if(str!='end') data.push(str);
                            else {
                                const res = data.reduce((json:string,str)=>json+str,'');
                                handshake(res,peer_list_db,log);
                                data = [];
                                stream.end();
                            }
                        }
                    }
                    catch(e){
                        log.info(e);
                    }
                });
                stream.on('error',(e:string)=>{
                    log.info(e);
                });
            })

            node.handle(`/vreath/${data.id}/tx/post`, (protocol:string, conn:any)=>{
                pull(
                    conn,
                    pull.drain((msg:Buffer)=>{
                        try{
                            tx_routes.post(msg,chain_info_db,root_db,trie_db,tx_db,block_db,state_db,lock_db,output_db,log);
                        }
                        catch(e){
                            log.info(e);
                        }
                    })
                )
            });

            node.handle(`/vreath/${data.id}/block/get`, async (protocol:string, conn:any) => {
                pull(
                    conn,
                    pull.drain((msg:Buffer)=>{
                        try{
                            block_routes.get(msg,node,block_db,log);
                        }
                        catch(e){
                            log.info(e);
                        }
                    })
                )
            });

            node.handle(`/vreath/${data.id}/block/post`, (protocol:string, conn:string) => {
                pull(
                    conn,
                    pull.drain((msg:Buffer)=>{
                        try{
                            block_routes.post(msg,chain_info_db,root_db,trie_db,block_db,state_db,lock_db,tx_db,log);
                        }
                        catch(e){
                            log.info(e);
                        }
                    })
                )
            });

            node.handle(`/vreath/${data.id}/chain/get`, (protocol:string, conn:any) => {
                try{
                    const stream = toStream(conn);
                    let data:string[] = [];
                    stream.on('data',(msg:Buffer)=>{
                        try{
                            if(msg!=null&&msg.length>0){
                                const str = msg.toString('utf-8');
                                if(str!='end1') data.push(str);
                                else {
                                    const res = data.reduce((json:string,str)=>json+str,'');
                                    const hashes:{[key:string]:string} = JSON.parse(res);
                                    chain_routes.get(hashes,stream,chain_info_db,block_db,output_db,log);
                                    data = [];
                                }
                            }
                        }
                        catch(e){
                            log.info(e);
                        }
                    });
                    stream.on('error',(e:string)=>{
                        log.info(e);
                    });
                }
                catch(e){
                    log.info(e);
                }
            });

            node.handle(`/vreath/${data.id}/chain/post`, (protocol:string, conn:string) => {
                pull(
                    conn,
                    pull.drain((msg:Buffer)=>{
                        try{
                            chain_routes.post(msg.toString('utf-8'),block_db,chain_info_db,root_db,trie_db,state_db,lock_db,tx_db,log);
                        }
                        catch(e){
                            log.info(e);
                        }
                    })
                )
            });

            node.handle(`/vreath/${data.id}/unit/post`, async (protocol:string, conn:any)=>{
                pull(
                    conn,
                    pull.drain((msg:Buffer)=>{
                        try{
                            unit_routes.post(msg,block_db,chain_info_db,root_db,trie_db,state_db,unit_db,log);
                        }
                        catch(e){
                            log.info(e);
                        }
                    })
                )
            });

            node.on('error',(e:string)=>{
                log.info(e);
            })

            intervals.shake_hands(node,peer_list_db,log);
            intervals.get_new_chain(node,peer_list_db,chain_info_db,block_db,root_db,trie_db,state_db,lock_db,tx_db,log);
            if(config.validator.flag){
                intervals.staking(private_key,node,chain_info_db,root_db,trie_db,block_db,state_db,lock_db,output_db,tx_db,peer_list_db,log);
                intervals.buying_unit(private_key,config,node,chain_info_db,root_db,trie_db,block_db,state_db,lock_db,output_db,tx_db,unit_db,peer_list_db,log);
            }
            if(config.miner.flag){
                intervals.refreshing(private_key,config,node,chain_info_db,root_db,trie_db,block_db,state_db,lock_db,output_db,tx_db,peer_list_db,log);
                intervals.making_unit(private_key,config,node,chain_info_db,root_db,trie_db,block_db,state_db,unit_db,peer_list_db,log);
            }
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