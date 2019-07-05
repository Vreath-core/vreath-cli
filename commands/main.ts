#! /usr/bin/env node

import * as vr from 'vreath'
import setup from './setup'
import generate_keys from './generate-keys'
import set_peer_id from './set-peer-id'
import {set_config} from './config'
import * as tx_routes from '../app/routes/tx'
import * as block_routes from '../app/routes/block'
import * as chain_routes from '../app/routes/chain'
import * as unit_routes from '../app/routes/unit'
import req_tx_com from '../app/repl/request-tx'
import repl_get_block from '../app/repl/get_block'
import repl_get_chain_info from '../app/repl/get_chain_info'
import output_chain from '../app/repl/output_chain'
import get_balance from '../app/repl/balance'
import * as data from '../logic/data'
import * as intervals from '../logic/interval'
import {test_setup} from '../test/setup'
import {run_node1} from '../test/node_1'
import {run_node2} from '../test/node_2'
import {promisify} from 'util'
import * as fs from 'fs'
import * as path from 'path'
import bunyan from 'bunyan'
import yargs from 'yargs'
import * as repl from 'repl'
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
const search_ip = require('ip');
/*
export class Node extends libp2p {
    constructor (_options:any,_bootstrapList:string[]) {
      const defaults = {
        // The libp2p modules for this libp2p bundle
        modules: {
          transport: [
            TCP           // It can take instances too!
          ],
          streamMuxer: [
            MPLEX,
            SPDY
          ],
          connEncryption: [
            SECIO
          ],
          /** Encryption for private networks. Needs additional private key to work **/
          // connProtector: new Protector(/*protector specific opts*/),
          /** Enable custom content routers, such as delegated routing **/
          // contentRouting: [
          //   new DelegatedContentRouter(peerInfo.id)
          // ],
          /** Enable custom peer routers, such as delegated routing **/
          // peerRouting: [
          //   new DelegatedPeerRouter()
          // ],
          /*peerDiscovery: [
            Bootstrap
          ]           // DHT enables PeerRouting, ContentRouting and DHT itself components
        },*/

        // libp2p config options (typically found on a config.json)
        /*config: {                       // The config object is the part of the config that can go into a file, config.json.
          peerDiscovery: {
            autoDial: true,
            /* *//*autoDial: true,             // Auto connect to discovered peers (limited by ConnectionManager minPeers)
            mdns: {                     // mdns options
              interval: 1000,           // ms
              enabled: true
            },
            webrtcStar: {               // webrtc-star options
              interval: 1000,           // ms
              enabled: false
            },*/
            /*bootstrap: {
                interval: 2000,
                enabled: true,
                list: _bootstrapList
            }
            // .. other discovery module options.
          },
          /*dht: {
            kBucketSize: 20,
          }*/
       /* }
      }
      // overload any defaults of your bundle using https://github.com/nodeutils/defaults-deep
      super(defaultsDeep(_options, defaults))
    }
}*/


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


const log = bunyan.createLogger({
    name:'vreath-cli',
    streams:[
        {
            path:path.join(__dirname,'../log/main.log')
        }
    ]
});

const config = JSON.parse(fs.readFileSync(path.join(__dirname,'../config/config.json'),'utf-8'));

yargs
.usage('Usage: $0 <command> [options]')
.command('setup','setup data', {}, async ()=>{
    try{
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
        const my_password = readlineSync.question('Your password:',{hideEchoBack: true, defaultInput: 'password'});
        await setup((Buffer.from(my_password,'utf-8').toString('hex')),state_db,lock_db,trie_db,chain_info_db,block_db,root_db,tx_db,output_db,unit_db,peer_list_db);
        process.exit(1)
    }
    catch(e){
        console.log(e);
        process.exit(1)
    }
})
.command('run','run node', {}, async ()=>{
    try{
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
        await peer_list_db.del(Buffer.from(config.peer.id).toString('hex'));
        const node = new Node(peer_info,['spdy','mplex'],peer_address_list);

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
                peer_list_db.write_obj(Buffer.from(peer_obj.identity.id).toString('hex'),peer_obj);
            });

            node.handle(`/vreath/${data.id}/tx/post`, (protocol:string, conn:any)=>{
                pull(
                    conn,
                    pull.drain((msg:Buffer)=>{
                        try{
                            tx_routes.post(msg,chain_info_db,root_db,trie_db,tx_db,block_db,state_db,lock_db,output_db);
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
                            block_routes.get(msg,node,block_db);
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
                            block_routes.post(msg,chain_info_db,root_db,trie_db,block_db,state_db,lock_db,tx_db);
                        }
                        catch(e){
                            log.info(e);
                        }
                    })
                )
            });

            node.handle(`/vreath/${data.id}/chain/get`, (protocol:string, conn:any) => {
                const stream = toStream(conn);
                try{
                    chain_routes.get(stream,chain_info_db,block_db,output_db);
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
                            chain_routes.post(msg,block_db,chain_info_db,root_db,trie_db,state_db,lock_db,tx_db);
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
                            unit_routes.post(msg,block_db,chain_info_db,root_db,trie_db,state_db,unit_db);
                        }
                        catch(e){
                            log.info(e);
                        }
                    })
                )
            });

            node.on('error',(err:string)=>{
                log.info(err);
            })

            intervals.get_new_chain(node,peer_list_db,chain_info_db,block_db,root_db,trie_db,state_db,lock_db,tx_db,log);
            if(config.validator.flag){
                intervals.staking(private_key,node,chain_info_db,root_db,trie_db,block_db,state_db,lock_db,output_db,tx_db,peer_list_db,log);
                intervals.buying_unit(private_key,config,node,chain_info_db,root_db,trie_db,block_db,state_db,lock_db,output_db,tx_db,unit_db,peer_list_db,log);

            }
            if(config.miner.flag){
                intervals.refreshing(private_key,config,node,chain_info_db,root_db,trie_db,block_db,state_db,lock_db,output_db,tx_db,peer_list_db,log);
                intervals.making_unit(private_key,config,node,chain_info_db,root_db,trie_db,block_db,state_db,unit_db,peer_list_db,log);
            }
            intervals.maintenance(node,chain_info_db,block_db,root_db,trie_db,state_db,lock_db,tx_db,peer_list_db,log);

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
                            pull(pull.values([JSON.stringify([tx,[]])]), conn);
                        });
                        return false;
                    });
                }
            });

            /*replServer.defineCommand('remit',{
                help: 'Create request tx',
                async action(input){
                    await remit(input,config,my_private);
                }
            });*/

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
                    const info = await repl_get_chain_info(chain_info_db);
                    console.log(JSON.stringify(info,null,4));
                }
            });

            replServer.defineCommand('output-chain',{
                help:'output chain as zip of json files',
                async action(){
                    await output_chain(chain_info_db,block_db);
                }
            });
        });
    }
    catch(e){
        log.info(e);
    }
})
.command('demo <id>','demonstration',{
    'id':{
        describe:'node id(1:validator,2:miner)',
        type:'number'
    }
},async (argv)=>{
    try{
        const id = argv.id;
        if(id==null) throw new Error('enter node id');
        const setup_data = await test_setup();
        const nodes = [run_node1,run_node2];
        await nodes[id-1](setup_data);
    }
    catch(e){
        console.log(e);
    }
})
.command('generate-keys','generate new key', {}, async ()=>{
    try{
        await generate_keys();
        process.exit(1)
    }
    catch(e){
        console.log(e);
        process.exit(1)
    }
})
.command('get-native-balance','get native balance',{}, async ()=>{
    try{
        const trie_db = data.make_db_obj(path.join(__dirname,`../db/net_id_${data.id}/trie`));
        const state_db = data.make_db_obj(path.join(__dirname,`../db/net_id_${data.id}/state`));
        const chain_info_db = data.make_db_obj(path.join(__dirname,`../db/net_id_${data.id}/chain_info`));
        const root_db = data.make_db_obj(path.join(__dirname,`../db/net_id_${data.id}/root`));
        const my_password = readlineSync.question('Your password:',{hideEchoBack: true, defaultInput: 'password'});
        const my_key = vr.crypto.get_sha256(Buffer.from(my_password,'utf-8').toString('hex')).slice(0,122);
        const get_private = fs.readFileSync('./keys/private/'+my_key+'.txt','utf-8');
        const private_key = CryptoJS.AES.decrypt(get_private,my_key).toString(CryptoJS.enc.Utf8);
        console.log(await get_balance(private_key,chain_info_db,root_db,trie_db,state_db));
        process.exit(1)
    }
    catch(e){
        console.log(e);
        process.exit(1)
    }
})
.command('set-peer-id','set my peer id',{}, async ()=>{
    try{
        await set_peer_id();
    }
    catch(e){
        console.log(e);
        process.exit(1);
    }
})
.command('decrypt-genesis-peers','decrypt genesis peers', {}, async ()=>{
    try{
        const my_setup_pass = readlineSync.question('Key for Testnet:',{hideEchoBack: true, defaultInput: 'password'});
        const my_key = vr.crypto.get_sha256(Buffer.from(my_setup_pass,'utf-8').toString('hex')).slice(0,122);
        const genesis_crypted_peers:string = await promisify(fs.readFile)(path.join(__dirname,'../crypted_genesis_peer.txt'),'utf-8');
        const genesis_peers = CryptoJS.AES.decrypt(genesis_crypted_peers,my_key).toString(CryptoJS.enc.Utf8);
        await promisify(fs.writeFile)(path.join(__dirname,'../genesis_peers.json'),genesis_peers);
        process.exit(1)
    }
    catch(e){
        console.log(e);
        process.exit(1)
    }
})
.command('config [miner_mode] [miner_interval] [miner_gas_share] [miner_unit_price] [validator_mode] [validator_min] [validator_fee] [validator_gas]','set config',{
    'miner_mode':{
        describe:'flag for mining',
        type:'boolean'
    },
    'miner_interval':{
        describe:'mining interval',
        type:'number'
    },
    'miner_gas_share':{
        describe:'gas-share of refresh-tx',
        type:'number'
    },
    'miner_unit_price':{
        describe:'unit price',
        type:'string'
    },
    'validator_mode':{
        describe:'flag for validate',
        type:'boolean'
    },
    'validator_min':{
        describe:'minimum balance to buy units',
        type:'string'
    },
    'validator_fee':{
        describe:'fee for unit-buying-tx',
        type:'string'
    },
    'validator_gas':{
        describe:'gas for unit-buying-tx',
        type:'string'
    }
}, async (argv)=>{
    try{
        await set_config(config,argv);
        process.exit(1)
    }
    catch(e){
        console.log(e);
        process.exit(1)
    }
})
.fail((msg,err)=>{
    if(err) console.log(err);
    else console.log(msg);
    process.exit(1);
}).help().recommendCommands().argv;

