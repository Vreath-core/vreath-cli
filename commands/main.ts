#! /usr/bin/env node

/*import * as vr from 'vreath'
import req_tx_com from '../app/repl/request-tx'
import remit from '../app/repl/remit'
import repl_balance from '../app/repl/balance'
import repl_get_block from '../app/repl/get_block'
import repl_get_chain_info from '../app/repl/get_chain_info'
import output_chain from '../app/repl/output_chain'
import share_data from '../share/share_data'*/
import * as vr from 'vreath'
import setup from './setup'
import generate_keys from './generate-keys'
import set_peer_id from './set-peer-id'
import set_config from './config'
import * as tx_routes from '../app/routes/tx'
import * as block_routes from '../app/routes/block'
import * as chain_routes from '../app/routes/chain'
import * as unit_routes from '../app/routes/unit'
import req_tx_com from '../app/repl/request-tx'
//import remit from '../app/repl/remit'
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
import yargs from 'yargs'
import * as repl from 'repl'
import readlineSync from 'readline-sync'
import CryptoJS from 'crypto-js'
import * as P from 'p-iteration'
const PeerInfo = require('peer-info');
const PeerId = require('peer-id');
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
const toPromise = require('stream-to-promise');
const Pushable = require('pull-pushable')
const p = Pushable();
const search_ip = require('ip');

export class Node extends libp2p {
    constructor (_options:any,_bootstrapList:string[]) {
      const defaults = {
        // The libp2p modules for this libp2p bundle
        modules: {
          transport: [
            TCP           // It can take instances too!
          ],
          streamMuxer: [
            MPLEX
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
          peerDiscovery: [
            Bootstrap
          ]           // DHT enables PeerRouting, ContentRouting and DHT itself components
        },

        // libp2p config options (typically found on a config.json)
        config: {                       // The config object is the part of the config that can go into a file, config.json.
          peerDiscovery: {
            /* *//*autoDial: true,             // Auto connect to discovered peers (limited by ConnectionManager minPeers)
            mdns: {                     // mdns options
              interval: 1000,           // ms
              enabled: true
            },
            webrtcStar: {               // webrtc-star options
              interval: 1000,           // ms
              enabled: false
            },*/
            bootstrap: {
                interval: 2000,
                enabled: true,
                list: _bootstrapList
            }
            // .. other discovery module options.
          },
          /*dht: {
            kBucketSize: 20,
          }*/
        }
      }
      // overload any defaults of your bundle using https://github.com/nodeutils/defaults-deep
      super(defaultsDeep(_options, defaults))
    }
}

/*const topic = 'hello';
const receiveMsg = (msg:{data:Buffer}) => console.log(msg.data.toString());

const listener = new multistream.Listener();
const conn = new Connection();
listener.handle(conn, () => {
    console.log('connection established')
});
const dialer = new multistream.Dialer()
dialer.handle(conn, () => {
    console.log('connection established')
});
console.log(conn);*/
/*libp2p.pubsub.subscribe('hello', receiveMsg, (err:string) => {
    if (err) {
      return console.error(`failed to subscribe to ${topic}`, err)
    }
    console.log(`subscribed to ${topic}`)
});*/

const log = bunyan.createLogger({
    name:'vreath-cli',
    streams:[
        {
            path:path.join(__dirname,'../log/log.log')
        }
    ]
});

const config = JSON.parse(fs.readFileSync(path.join(__dirname,'../config/config.json'),'utf-8'));

yargs
.usage('Usage: $0 <command> [options]')
.command('setup','setup data', {}, async ()=>{
    try{
        const my_password = readlineSync.question('Your password:',{hideEchoBack: true, defaultInput: 'password'});
        await setup((Buffer.from(my_password,'utf-8').toString('hex')));
        process.exit(1)
    }
    catch(e){
        console.log(e);
        process.exit(1)
    }
})
.command('run','run node', {}, async ()=>{
    try{
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
        await data.peer_list_db.del(Buffer.from(config.peer.id).toString('hex'));
        const node = new Node({ peerInfo: peer_info},peer_address_list);
        /*node.on('peer:connect', (peerInfo:any) => {
            await data.peer_list_db.write_obj()
        });*/

        node.start((err:string)=>{

            node.on('peer:connect', (peer:any) => {
            });

            node.handle(`/vreath/${data.id}/tx/post`, async (protocol:string, conn:any)=>{
                pull(
                    conn,
                    pull.drain(async (msg:Buffer)=>{
                        await tx_routes.post(msg);
                    })
                )
            });

            node.handle(`/vreath/${data.id}/block/get`, async (protocol:string, conn:any) => {
                const peer_info = await promisify(conn.getPeerInfo).bind(conn)();
                pull(
                    conn,
                    pull.drain(async (msg:Buffer)=>{
                        const block = await block_routes.get(msg);
                        node.dialProtocol(peer_info,`/vreath/${data.id}/block/post`,(err:string,conn:any) => {
                            if (err) { throw err }
                            pull(pull.values([block]), conn);
                        })
                    })
                )
            });

            node.handle(`/vreath/${data.id}/block/post`, (protocol:string, conn:string) => {
                pull(
                    conn,
                    pull.drain(async (msg:Buffer)=>{
                        await block_routes.post(msg);
                    })
                )
            });

            node.handle(`/vreath/${data.id}/chain/get`, async (protocol:string, conn:any) => {
                pull(
                    p,
                    conn
                )
                const read = pull(
                    conn,
                    pull.map((msg:Buffer)=>{
                        return msg;
                    })
                );
                const pro = toPromise(toStream(read));
                pro.then((msg:Buffer)=>{
                    return chain_routes.get(msg);
                }).then((chain:vr.Block[])=>{
                    p.push(chain);
                });
            });

            node.handle(`/vreath/${data.id}/chain/post`, (protocol:string, conn:string) => {
                pull(
                    conn,
                    pull.drain(async (msg:Buffer)=>{
                        await chain_routes.post(msg);
                    })
                )
            });

            node.handle(`/vreath/${data.id}/unit/post`, async (protocol:string, conn:any)=>{
                pull(
                    conn,
                    pull.drain(async (msg:Buffer)=>{
                        await unit_routes.post(msg);
                    })
                )
            });

            if(err) console.error(err);
            intervals.get_new_chain(node);
            if(config.validator.flag){
                intervals.staking(private_key,node);
                intervals.buying_unit(private_key,config,node);
            }
            if(config.miner.flag){
                intervals.refreshing(private_key,config,node);
                intervals.making_unit(private_key,config,node);
            }

            const replServer = repl.start({prompt:'>',terminal:true});

            replServer.defineCommand('request-tx',{
                help: 'Create request tx',
                async action(input){
                    const tx = await req_tx_com(input,private_key);
                    await data.peer_list_db.filter('hex','utf8',async (key,peer:data.peer_info)=>{
                        const peer_id = await promisify(PeerId.createFromJSON)(peer.identity);
                        const peer_info = new PeerInfo(peer_id);
                        peer.multiaddrs.forEach(add=>peer_info.multiaddrs.add(add));
                        node.dialProtocol(peer_info,`/vreath/${data.id}/tx/post`,(err:string,conn:any) => {
                            if (err) { throw err }
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
                    const balance = await get_balance(private_key);
                    console.log(balance);
                }
            });

            replServer.defineCommand('get-block',{
                help:'Show the block specified by height',
                async action(input){
                    const block = await repl_get_block(input);
                    console.log(JSON.stringify(block,null,4));
                }
            });

            replServer.defineCommand('get-chain-info',{
                help:'Show the chain info',
                async action(){
                    const info = await repl_get_chain_info();
                    console.log(JSON.stringify(info,null,4));
                }
            });

            replServer.defineCommand('output-chain',{
                help:'output chain as zip of json files',
                async action(){
                    await output_chain();
                }
            });
        });
    }
    catch(e){
        console.log(e);
        log.info(e);
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
.command('get-native-balance <address>','get native balance', {
    'id':{
        describe:'address of native to check the balance',
        type:'string'
    }
}, async (argv)=>{
    try{
        const my_password = readlineSync.question('Your password:',{hideEchoBack: true, defaultInput: 'password'});
        const my_key = vr.crypto.get_sha256(Buffer.from(my_password,'utf-8').toString('hex')).slice(0,122);
        const get_private = fs.readFileSync('./keys/private/'+my_key+'.txt','utf-8');
        const private_key = CryptoJS.AES.decrypt(get_private,my_key).toString(CryptoJS.enc.Utf8);
        console.log(await get_balance(private_key));
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

