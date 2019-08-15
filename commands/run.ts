import * as vr from 'vreath'
import {config} from './config'
import handshake from '../app/routes/handshake'
import * as tx_routes from '../app/routes/tx'
import * as block_routes from '../app/routes/block'
import * as chain_routes from '../app/routes/chain'
import * as unit_routes from '../app/routes/unit'
import * as finalize_routes from '../app/routes/finalize'
import req_tx_com from '../app/repl/request-tx'
import repl_get_block from '../app/repl/get_block'
import repl_get_chain_info from '../app/repl/get_chain_info'
import output_chain from '../app/repl/output_chain'
import get_balance from '../app/repl/balance'
import * as data from '../logic/data'
import * as intervals from '../logic/interval'
import {promisify} from 'util'
import * as fs from 'fs'
import * as path from 'path'
import bunyan from 'bunyan'
import * as repl from 'repl'
import readlineSync from 'readline-sync'
import CryptoJS from 'crypto-js'
import * as P from 'p-iteration'
const PeerInfo = require('peer-info');
const PeerId = require('peer-id');
const Multiaddr = require('multiaddr');
const libp2p = require('libp2p');
const TCP = require('libp2p-tcp')
const WS = require('libp2p-websockets')
const SPDY = require('libp2p-spdy')
const MPLEX = require('libp2p-mplex')
const SECIO = require('libp2p-secio')
const MulticastDNS = require('libp2p-mdns')
const Bootstrap = require('libp2p-bootstrap')
const pull = require('pull-stream');
const toStream = require('pull-stream-to-stream');
const search_ip = require('ip');

const mapMuxers = (list:string[])=>{
    return list.map((pref) => {
        if (typeof pref !== 'string') {
          return pref
        }
        switch (pref.trim().toLowerCase()) {
          case 'spdy': return SPDY
          case 'mplex': return MPLEX
          default:
            throw new Error(pref + ' muxer not available')
        }
    })
}


const getMuxers = (muxers:string[])=>{
    const muxerPrefs = process.env.LIBP2P_MUXER
    if (muxerPrefs && !muxers) {
      return mapMuxers(muxerPrefs.split(','))
    } else if (muxers) {
      return mapMuxers(muxers)
    } else {
      return [MPLEX, SPDY]
    }
}

export class Node extends libp2p {
    constructor (_peerinfo:any,_muxer:string[],_bootstrapList:string[]) {
      const option = {
        modules: {
          transport: [
            TCP,
            WS
          ],
          streamMuxer: getMuxers(_muxer),
          connEncryption: [ SECIO ],
          peerDiscovery: [
            MulticastDNS,
            Bootstrap
          ]
        },
        config: {
          peerDiscovery: {
            mdns: {
              interval: 10000,
              enabled: false
            },
            bootstrap: {
              interval: 10000,
              enabled: false,
              list: _bootstrapList
            }
          },
          dht: {
            kBucketSize: 20
          }
        },
        peerInfo:_peerinfo
      }

      super(option);
    }
}

export const run = async (config:config,log:bunyan)=> {
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
    const uniter_db = data.make_db_obj(path.join(__dirname,`../db/net_id_${data.id}/uniter`));
    const finalize_db = data.make_db_obj(path.join(__dirname,`../db/net_id_${data.id}/finalize`));
    const my_password = readlineSync.question('Your password:',{hideEchoBack: true, defaultInput: 'password'});
    const my_key = vr.crypto.get_sha256(Buffer.from(my_password,'utf-8').toString('hex')).slice(0,122);
    const get_private = fs.readFileSync('./keys/private/'+my_key+'.txt','utf-8');
    const private_key = CryptoJS.AES.decrypt(get_private,my_key).toString(CryptoJS.enc.Utf8);
    const peer_id = await promisify(PeerId.createFromJSON)(config.peer);
    const peer_info = new PeerInfo(peer_id);
    const ip = search_ip.address();
    peer_info.multiaddrs.add(`/ip4/${ip}/tcp/5577`);
    const bootstrapList:data.peer_info[] = JSON.parse(Buffer.from(await promisify(fs.readFile)(path.join(__dirname,'../genesis_peers.json'),'utf-8')).toString());
    const peer_address_list = bootstrapList.map(peer=>`${peer.multiaddrs[0]}/p2p/${peer.identity.id}`);
    await P.forEach(bootstrapList, async peer=>{
        await peer_list_db.write_obj(Buffer.from(config.peer.id).toString('hex'),peer)
    })
    await peer_list_db.del(Buffer.from(config.peer.id).toString('hex'));
    let info:data.chain_info|null = await chain_info_db.read_obj('00');
    if(info==null) throw new Error('chain_info is empty');
    info.syncing = false;
    await chain_info_db.write_obj(info.last_height,info);
    const node = new Node(peer_info,['spdy','mplex'],peer_address_list);

    node.start((err:string)=>{

        node_handles(node,private_key,config,chain_info_db,root_db,trie_db,block_db,state_db,lock_db,output_db,tx_db,unit_db,peer_list_db,finalize_db,uniter_db,log);

        run_intervals(node,private_key,config,chain_info_db,root_db,trie_db,block_db,state_db,lock_db,output_db,tx_db,unit_db,peer_list_db,finalize_db,uniter_db,log);

        accept_repl(node,private_key,chain_info_db,root_db,trie_db,block_db,state_db,lock_db,tx_db,peer_list_db,log);
    });
}

export const node_handles  = (node:Node,private_key:string,config:config,chain_info_db:vr.db,root_db:vr.db,trie_db:vr.db,block_db:vr.db,state_db:vr.db,lock_db:vr.db,output_db:vr.db,tx_db:vr.db,unit_db:vr.db,peer_list_db:vr.db,finalize_db:vr.db,uniter_db:vr.db,log:bunyan)=>{
    node.on('peer:connect', (peerInfo:any) => {
        try{
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
            peer_list_db.write_obj(Buffer.from(peer_obj.identity.id).toString('hex'),peer_obj);
        }
        catch(e){
            log.info(e);
        }
    });

    node.on('peer:disconnect', (peerInfo:any)=>{
        try{
            const ids = new PeerInfo(PeerId.createFromB58String(peerInfo.id._idB58String));
            const id = ids.id._idB58String;
            peer_list_db.del(Buffer.from(id).toString('hex'));
        }
        catch(e){
            log.info(e);
        }
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
                        handshake(res,peer_list_db,config.peer.id,node,log);
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
        let data:string[] = [];
        pull(
            conn,
            pull.drain((msg:Buffer)=>{
                try{
                    if(msg!=null&&msg.length>0){
                        const str = msg.toString('utf-8');
                        if(str!='end') data.push(str);
                        else {
                            const res = data.reduce((json:string,str)=>json+str,'');
                            tx_routes.post(Buffer.from(res,'utf-8'),chain_info_db,root_db,trie_db,tx_db,block_db,state_db,lock_db,output_db,log);
                            data = [];
                        }
                    }
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
        let data:string[] = [];
        chain_info_db.read_obj<data.chain_info>('00').then((info:data.chain_info|null)=>{
            if(info==null) throw new Error('chain_info is empty');
            const syncing = info.syncing;
            if(syncing) throw new Error('syncing now');
            pull(
                conn,
                pull.drain((msg:Buffer)=>{
                    try{
                        if(msg!=null&&msg.length>0){
                            const str = msg.toString('utf-8');
                            if(str!='end') data.push(str);
                            else {
                                const res = data.reduce((json:string,str)=>json+str,'');
                                block_routes.post(Buffer.from(res,'utf-8'),chain_info_db,root_db,trie_db,block_db,state_db,lock_db,tx_db,peer_list_db,finalize_db,uniter_db,private_key,node,log);
                                data = [];
                            }
                        }
                    }
                    catch(e){
                        log.info(e);
                    }
                })
            )
        }).catch((e)=>{log.info(e)});
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
                    stream.end();
                }
            });
            stream.on('error',(e:string)=>{
                log.info(e);
                stream.end();
            });
        }
        catch(e){
            log.info(e);
        }
    });

    /*node.handle(`/vreath/${data.id}/chain/post`, (protocol:string, conn:string) => {
        pull(
            conn,
            pull.drain((msg:Buffer)=>{
                try{
                    chain_routes.post(msg.toString('utf-8'),block_db,finalize_db,uniter_db,chain_info_db,root_db,trie_db,state_db,lock_db,tx_db,peer_list_db,private_key,node,log);
                }
                catch(e){
                    log.info(e);
                }
            })
        )
    });*/

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

    node.handle(`/vreath/${data.id}/finalize/post`, (protocol:string, conn:string) => {
        let data:string[] = [];
        pull(
            conn,
            pull.drain((msg:Buffer)=>{
                try{
                    if(msg!=null&&msg.length>0){
                        const str = msg.toString('utf-8');
                        if(str!='end') data.push(str);
                        else {
                            const res = data.reduce((json:string,str)=>json+str,'');
                            finalize_routes.post(Buffer.from(res,'utf-8'),block_db,uniter_db,root_db,trie_db,state_db,finalize_db,log);
                            data = [];
                        }
                    }
                }
                catch(e){
                    log.info(e);
                }
            })
        )
    });

    node.on('error',(err:string)=>{
        log.info(err);
    });
}

export const run_intervals = (node:Node,private_key:string,config:config,chain_info_db:vr.db,root_db:vr.db,trie_db:vr.db,block_db:vr.db,state_db:vr.db,lock_db:vr.db,output_db:vr.db,tx_db:vr.db,unit_db:vr.db,peer_list_db:vr.db,finalize_db:vr.db,uniter_db:vr.db,log:bunyan)=>{
    intervals.shake_hands(node,peer_list_db,log);
        intervals.get_new_chain(private_key,node,peer_list_db,chain_info_db,block_db,finalize_db,uniter_db,root_db,trie_db,state_db,lock_db,tx_db,log);
        if(config.validator.flag){
            intervals.staking(private_key,node,chain_info_db,root_db,trie_db,block_db,state_db,lock_db,output_db,tx_db,peer_list_db,finalize_db,uniter_db,log);
            intervals.buying_unit(private_key,config,node,chain_info_db,root_db,trie_db,block_db,state_db,lock_db,output_db,tx_db,unit_db,peer_list_db,log);
        }
        if(config.miner.flag){
            intervals.refreshing(private_key,config,node,chain_info_db,root_db,trie_db,block_db,state_db,lock_db,output_db,tx_db,peer_list_db,log);
            intervals.making_unit(private_key,config,node,chain_info_db,root_db,trie_db,block_db,state_db,unit_db,peer_list_db,log);
        }
}

export const accept_repl = (node:Node,private_key:string,chain_info_db:vr.db,root_db:vr.db,trie_db:vr.db,block_db:vr.db,state_db:vr.db,lock_db:vr.db,tx_db:vr.db,peer_list_db:vr.db,log:bunyan)=>{
    const replServer = repl.start({prompt:'>',terminal:true});

    replServer.defineCommand('request-tx',{
        help: 'Create request tx',
        async action(input){
            const tx = await req_tx_com(input,private_key,chain_info_db,root_db,trie_db,state_db,lock_db,tx_db);
            await peer_list_db.filter('hex','utf8',async (key:string,peer:data.peer_info)=>{
                const peer_id = await promisify(PeerId.createFromJSON)(peer.identity);
                const peer_info = new PeerInfo(peer_id);
                peer.multiaddrs.forEach(add=>peer_info.multiaddrs.add(add));
                node.dialProtocol(peer_info,`/vreath/${data.id}/tx/post`,(err:string,conn:any) => {
                    if (err) { log.info(err) }
                    pull(pull.values([JSON.stringify([tx,[]]),'end']), conn);
                });
                return false;
            });
        }
    });

    replServer.defineCommand('balance',{
        help: 'Show your VRT balance',
        async action(){
            const balance = await get_balance(private_key,chain_info_db,root_db,trie_db,state_db);
            console.log(balance);
        }
    });

    replServer.defineCommand('get-block',{
        help:'Show the block specified by height',
        async action(input){
            const block = await repl_get_block(input,block_db);
            console.log(JSON.stringify(block,null,4));
        }
    });

    replServer.defineCommand('get-chain-info',{
        help:'Show the chain info',
        async action(){
            const pub_key = vr.crypto.private2public(private_key);
            const native_address = vr.crypto.generate_address(vr.con.constant.native,pub_key);
            const unit_address = vr.crypto.generate_address(vr.con.constant.unit,pub_key);
            const info = await repl_get_chain_info(chain_info_db,root_db,trie_db,state_db,native_address,unit_address);
            console.log(JSON.stringify(info,null,4));
        }
    });

    replServer.defineCommand('output-chain',{
        help:'output chain as zip of json files',
        async action(){
            await output_chain(chain_info_db,block_db);
        }
    });
}
