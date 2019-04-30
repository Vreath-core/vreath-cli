#! /usr/bin/env node

/*import * as vr from 'vreath'
import req_tx_com from '../app/repl/request-tx'
import remit from '../app/repl/remit'
import repl_balance from '../app/repl/balance'
import repl_get_block from '../app/repl/get_block'
import repl_get_chain_info from '../app/repl/get_chain_info'
import output_chain from '../app/repl/output_chain'
import share_data from '../share/share_data'
import express from 'express'
import * as bodyParser from 'body-parser'
import * as P from 'p-iteration'
import CryptoJS from 'crypto-js'
import rp from 'request-promise-native'
import * as repl from 'repl'
import readlineSync from 'readline-sync'
import yargs from 'yargs'*/
import * as vr from 'vreath'
import setup from './setup'
import generate_keys from './generate-keys'
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
const DHT = require('libp2p-kad-dht')
const defaultsDeep = require('@nodeutils/defaults-deep')
const pull = require('pull-stream');

export class Node extends libp2p {
    constructor (_options:any) {
      const defaults = {
        // The libp2p modules for this libp2p bundle
        modules: {
          transport: [
            TCP,
            WS                   // It can take instances too!
          ],
          streamMuxer: [
            SPDY,
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
            MulticastDNS
          ],
          dht: DHT                      // DHT enables PeerRouting, ContentRouting and DHT itself components
        },

        // libp2p config options (typically found on a config.json)
        config: {                       // The config object is the part of the config that can go into a file, config.json.
          peerDiscovery: {
            autoDial: true,             // Auto connect to discovered peers (limited by ConnectionManager minPeers)
            mdns: {                     // mdns options
              interval: 1000,           // ms
              enabled: true
            },
            webrtcStar: {               // webrtc-star options
              interval: 1000,           // ms
              enabled: false
            }
            // .. other discovery module options.
          },
          dht: {
            kBucketSize: 20,
          }
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

const peer_book = new PeerBook();

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
        const peer_id = await promisify(PeerId.create)();
        const peerInfo = await promisify(PeerInfo.create)(peer_id);
        peerInfo.multiaddrs.add('/ip4/0.0.0.0/tcp/5577');
        const node = new Node({ peerInfo: peerInfo });
        node.on('peer:connect', (peerInfo:any) => {
            peer_book.put(peerInfo,true);
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
            const peer_info = await promisify(conn.getPeerInfo).bind(conn)();
            pull(
                conn,
                pull.drain(async (msg:Buffer)=>{
                    const chain = await chain_routes.get(msg);
                    node.dialProtocol(peer_info,`/vreath/${data.id}/chain/post`,(err:string,conn:any) => {
                        if (err) { throw err }
                        pull(pull.values([chain]), conn);
                    })
                })
            )
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

        node.start((err:string)=>{
            if(err) console.error(err);
            if(config.validator.flag){
                intervals.staking(private_key,peer_book,node);
                intervals.buying_unit(private_key,config,peer_book,node);
            }
            if(config.miner.flag){
                intervals.refreshing(private_key,config,peer_book,node);
                intervals.making_unit(private_key,config,peer_book,node);
            }

            const replServer = repl.start({prompt:'>',terminal:true});

            replServer.defineCommand('request-tx',{
                help: 'Create request tx',
                async action(input){
                    const tx = await req_tx_com(input,private_key);
                    const peers = peer_book.getAll();
                    await P.forEach(peers, async (peer)=>{
                        node.dialProtocol(peer,`/vreath/${data.id}/tx/post`,(err:string,conn:any) => {
                            if (err) { throw err }
                            pull(pull.values([JSON.stringify([tx,[]])]), conn);
                        });
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
                    console.log(block);
                }
            });

            replServer.defineCommand('get-chain-info',{
                help:'Show the chain info',
                async action(){
                    const info = await repl_get_chain_info();
                    console.log(info);
                }
            });

            replServer.defineCommand('output-chain',{
                help:'output chain as zip of json files',
                async action(){
                    await output_chain();
                }
            })
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
/*.command('config [new_pub] [user_id] [miner_mode] [miner_id] [miner_interval] [miner_fee] [miner_unit_price] [validator_mode] [validator_id] [validator_min] [validator_fee] [validator_gas]','set config',{
    'new_pub':{
        describe:'new public key',
        type:'string'
    },
    'user_id':{
        describe:'key id used for user',
        type:'number'
    },
    'miner_mode':{
        describe:'flag for mining',
        type:'boolean'
    },
    'miner_id':{
        describe:'key id used for miner',
        type:'number'
    },
    'miner_interval':{
        describe:'mining interval',
        type:'number'
    },
    'miner_fee':{
        describe:'fee of refresh-tx',
        type:'number'
    },
    'miner_unit_price':{
        describe:'unit price',
        type:'number'
    },
    'validator_mode':{
        describe:'flag for validate',
        type:'boolean'
    },
    'validator_id':{
        describe:'key id used for validator',
        type:'number'
    },
    'validator_min':{
        describe:'minimum balance to buy units',
        type:'number'
    },
    'validator_fee':{
        describe:'fee for unit-buying-tx',
        type:'number'
    },
    'validator_gas':{
        describe:'gas for unit-buying-tx',
        type:'number'
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
})*/
.fail((msg,err)=>{
    if(err) console.log(err);
    else console.log(msg);
    process.exit(1);
}).help().recommendCommands().argv;


/*(async ()=>{
    const peer_id1:{id:string,privKey:string,pubKey:string} = (await promisify(PeerId.create)()).toJSON();
    const peerInfo1 = await promisify(PeerInfo.create)(peer_id1);
    peerInfo1.multiaddrs.add('/ip4/0.0.0.0/tcp/0');
    const peer_id2:{id:string,privKey:string,pubKey:string} = (await promisify(PeerId.create)()).toJSON();
    const peerInfo2 = await promisify(PeerInfo.create)(peer_id2);
    peerInfo2.multiaddrs.add('/ip4/0.0.0.0/tcp/0');
    const peer_book = new PeerBook();
    peer_book.put(peerInfo1,true);
    peer_book.put(peerInfo2,true);

    {
        const node = new Node({ peerInfo: peerInfo1 });

        node.on('peer:connect', (peerInfo:any) => {
            //console.log('received dial to me from:', peerInfo.id.toB58String());
        });

        node.handle('/vreath/block', async (protocol:string, conn:any) => {
            const peer_info = await promisify(conn.getPeerInfo).bind(conn)();
            pull(
                conn,
                pull.drain((msg:string)=>{
                    console.log(msg.toString());
                    node.dialProtocol(peer_info,'/vreath/block',(err:string,conn:any) => {
                        if (err) { throw err }
                        pull(pull.values(['semver me please']), conn);
                        //console.log(conn);
                        //console.log('nodeA dialed to nodeB on protocol: /vreath/1.0.0')
                    });
                })
            )
        });

        node.start((err:string)=>{
            console.error(err)
        });
    }
    {
        const node = new Node({ peerInfo: peerInfo2 });

        node.on('peer:connect', (peerInfo:any) => {
            //console.log('received dial to me from:', peerInfo.id.toB58String());
        });

        node.handle('/vreath/block', async (protocol:string, conn:any) => {
            pull(
                conn,
                pull.map((data:Buffer) => data.toString()),
                pull.log()
            )
        });

        node.start((err:string)=>{
            node.dialProtocol(peerInfo1,'/vreath/block',(err:string,conn:any) => {
                if (err) { throw err }
                console.log('go!');
                pull(pull.values(['semver me please']), conn);
                //console.log(conn);
                //console.log('nodeA dialed to nodeB on protocol: /vreath/1.0.0')
            });
            console.error(err);
        });
    }
})();*/
/*
PeerInfo.create({bits: 2048},(err:string, id:any) =>{
    const peer_id = new PeerId
    console.log(id);
    /*const node = new Node(peerInfo);
    Node.start((err:string)=>console.error(err));*/
//});

/*PeerInfo.create((err:string, peerInfo:any) => {
    if (err)
        throw new Error(err)
    // Load your .proto file
    protobuf.load(path.join(__dirname, './protocol.proto')).then((root) => {
        console.log(peerInfo);
        // Create Node
        const node = new Node(peerInfo, root, config);

        node.on('peer:connection', (conn:any, peer:any, type:any) => {
            console.log('peer:connection');
            console.log('start')
            peer.rpc.get_block({height:"0"},(response:any, peer:any) => {
                console.log('Response', response)
            });
        });

        node.handle('get_block',block_routes.get);
        node.handle('post_block',block_routes.post);

        // Lets starts node
        node.start().then(console.log, console.error);
    }, console.error)
});

PeerInfo.create((err:string, peerInfo:any) => {
    if (err)
        throw new Error(err)
    // Load your .proto file
    protobuf.load(path.join(__dirname, './protocol.proto')).then((root) => {
        console.log(peerInfo);
        // Create Node
        const node = new Node(peerInfo, root, config);

        node.on('peer:connection', (conn:any, peer:any, type:any) => {
            console.log('peer:connection');
            console.log('start')
            peer.rpc.get_block({height:"0"},(response:any, peer:any) => {
                console.log('Response', response)
            });
        });

        node.handle('get_block',block_routes.get);
        node.handle('post_block',block_routes.post);

        // Lets starts node
        node.start().then(console.log, console.error);
    }, console.error)
});*/

/*(async ()=>{
    const peer_id1:{id:string,privKey:string,pubKey:string} = (await promisify(PeerId.create)()).toJSON();
    const peerInfo1 = await promisify(PeerInfo.create)(peer_id1);
    const peer_id2:{id:string,privKey:string,pubKey:string} = (await promisify(PeerId.create)()).toJSON();
    const peerInfo2 = await promisify(PeerInfo.create)(peer_id2);

    const config = {
        name: 'vreath',  // Protocol name used for handshake
        version: data.id,            // Protocol version used for handshake
        service: 'Vreath',         // Name of service in .proto file
        bootstrapers: [],            // Bootstrapping nodes
        multicastDNS: {
            interval: 1000,
            enabled: true
        }
    };

    protobuf.load(path.join(__dirname, './protocol.proto')).then((root) => {
        // Create Node
        const node = new Node(peerInfo1,root, config);

        node.on('peer:connection', (conn:any, peer:any, type:any) => {
            console.log('peer:connection');
            console.log('start')
            peer.rpc.get_block({height:"0"},(response:any, peer:any) => {
                console.log('Response', response)
            });
        });

        node.handle('get_block',block_routes.get);
        node.handle('post_block',block_routes.post);

        // Lets starts node
        node.start().then(console.log, console.error);
    }, console.error);

    protobuf.load(path.join(__dirname, './protocol.proto')).then((root) => {
        // Create Node
        const node = new Node(peerInfo2,root, config);

        node.on('peer:connection', (conn:any, peer:any, type:any) => {
            console.log('peer:connection');
            console.log('start')
            peer.rpc.get_block({height:"0"},(response:any, peer:any) => {
                console.log('Response', response)
            });
        });

        node.handle('get_block',block_routes.get);
        node.handle('post_block',block_routes.post);

        // Lets starts node
        node.start().then(()=>{
            peerInfo1.rpc.get_block({height:"0"},(response:any, peer:any) => {
                console.log('Response', response)
            });
        });
    }, console.error);

})();*/

/*
math.config({
    number: 'BigNumber'
});

const app = express();
app.listen(57750);
app.use(bodyParser.json({limit:'2gb'}));
app.use(express.urlencoded({limit:'2gb',extended: true}));

app.use('/handshake',handshake_route);
app.use('/peer',peer_routes);
app.use('/tx',tx_routes);
app.use('/block',block_routes);
app.use('/unit',unit_routes);
app.use('/chain',chain_routes);

const log = bunyan.createLogger({
    name:'vreath-cli',
    streams:[
        {
            path:'./log/log.log'
        }
    ]
});

const config = JSON.parse(fs.readFileSync('./config/config.json','utf-8'));

const shake_hands = async ()=>{
    try{
        const my_node_info = make_node_info();
        const peers:peer[] = await data.get_peer_list();
        const new_peer_list = await P.reduce(peers.slice(0,8), async (list:peer[],peer)=>{
            const url1 = 'http://'+peer.ip+':57750/handshake';
            const option1 = {
                uri: url1,
                body:my_node_info,
                json: true
            }
            const this_info:node_info = await rp.post(option1);
            if(typeof this_info.version != 'number' || typeof this_info.net_id != 'number' || typeof this_info.chain_id != 'number' || typeof this_info.timestamp != 'number' || this_info.version<vr.con.constant.compatible_version || this_info.net_id!=vr.con.constant.my_net_id || this_info.chain_id!=vr.con.constant.my_chain_id) return list;
            const this_peer:peer = {
                ip:peer.ip,
                timestamp:this_info.timestamp
            }
            const this_index = list.map(p=>p.ip).indexOf(peer.ip);
            const refreshed_list = list.map((p,i)=>{
                if(i===this_index) return this_peer;
                else return p;
            }).sort((a,b)=>b.timestamp-a.timestamp);
            const url2 = 'http://'+peer.ip+':57750/peer';
            const option2 = {
                url: url2,
                body:peers,
                json: true
            }
            const get_list:peer[] = await rp.post(option2);
            if(!Array.isArray(get_list)||get_list.some(p=>typeof p.ip!='string'||typeof p.timestamp!='number')) return refreshed_list;
            const get_list_ips =  get_list.map(p=>p.ip);
            return refreshed_list.map(p=>{
                const i = get_list_ips.indexOf(p.ip);
                if(i===-1) return p;
                else return get_list[i];
            }).sort((a,b)=>b.timestamp-a.timestamp);
        },peers);
        let w_peer:peer;
        for(w_peer of new_peer_list){
            await data.write_peer(w_peer);
        }
    }
    catch(e){
        log.info(e);
    }
    await works.sleep(600000);
    setImmediate(shake_hands);
    return 0;
}

const get_new_blocks = async ()=>{
    try{
        const peers:peer[] = await data.get_peer_list();
        const peer = peers[0];
        if(peer==null) throw new Error('no peer');
        const info:data.chain_info = await data.read_chain_info();
        const diff_sum = info.pos_diffs.reduce((sum,diff)=>math.chain(sum).add(diff).done(),0);
        const option = {
            url:'http://'+peer.ip+':57750/chain',
            body:{diff_sum:diff_sum},
            json:true,
            timeout: 8000
        }
        const new_chain:vr.Block[] = await rp.get(option);
        if(new_chain.some(block=>!vr.block.isBlock(block))) return 0;
        const back_height = Math.max(1,new_chain[0].meta.height);
        const pre_blocks = share_data.chain.slice(back_height);
        await data.back_chain(back_height-1);
        let block:vr.Block
        for(block of new_chain.slice().sort((a,b)=>a.meta.height-b.meta.height).filter(b=>b.meta.height>=1)){
            try{
                await rp.post({
                    url:'http://localhost:57750/block',
                    body:block,
                    json:true
                });
            }
            catch(e){
                continue;
            }
        }
        if(share_data.chain.length===back_height){
            for(block of pre_blocks.slice().sort((a,b)=>a.meta.height-b.meta.height)){
                await rp.post({
                    url:'http://localhost:57750/block',
                    body:block,
                    json:true
                });
            }
        }
    }
    catch(e){
        log.info(e);
    }
    await works.sleep(30000);
    setImmediate(get_new_blocks);
    return 0;
}

const staking = async (private_key:string)=>{
    try{
        const read:vr.Block[] = await data.read_chain(2*(10**9));
        const key = vr.block.search_key_block(read);
        const micros = vr.block.search_micro_block(read,key);
        const pre_validator = key.meta.validator;
        const slice_height = key.meta.height + 1 + micros.length + (micros.findIndex(block=>pre_validator!=block.meta.validator)+1||0)
        const chain:vr.Block[] = read.slice(0,slice_height);
        const validator_pub:string = config.pub_keys[config.validator.use];
        if(validator_pub==null) throw new Error('invalid validator public key');
        const roots:{stateroot:string,lockroot:string} = await data.read_root();
        const pool:vr.Pool = await data.read_pool(10**9);
        const S_Trie = data.state_trie_ins(roots.stateroot);
        const unit_validator = vr.crypto.generate_address(vr.con.constant.unit,validator_pub);
        const unit_validator_state:vr.State = await data.read_state(S_Trie,unit_validator,vr.state.create_state());
        if(unit_validator_state==null||unit_validator_state.amount===0) throw new Error('the validator has no units');
        const L_Trie = data.lock_trie_ins(roots.lockroot);
        const block = await works.make_block(chain,[validator_pub],roots.stateroot,roots.lockroot,'',pool,private_key,validator_pub,S_Trie,L_Trie);
        await rp.post({
            url:'http://localhost:57750/block',
            body:block,
            json:true
        });

        const peers:peer[] = await data.get_peer_list();
        await P.forEach(peers,async peer=>{
            const url1 = 'http://'+peer.ip+':57750/block';
            const option1 = {
                url:url1,
                body:block,
                json:true
            }
            await rp.post(option1);
        });
    }
    catch(e){
        log.info(e);
    }
    await works.sleep(1000);
    setImmediate(()=>staking.apply(null,[private_key]));
    return 0;
}

const buying_unit = async (private_key:string)=>{
    try{
        const pub_key:string = config.pub_keys[config.validator.use];
        const type:vr.TxType = "change";
        const tokens = [vr.con.constant.unit,vr.con.constant.native];
        const chain:vr.Block[] = await data.read_chain(2*(10**9));
        const roots:{stateroot:string,lockroot:string} = await data.read_root();
        const S_Trie = data.state_trie_ins(roots.stateroot);
        const L_Trie = data.lock_trie_ins(roots.lockroot);
        const native_validator = vr.crypto.generate_address(vr.con.constant.native,vr.crypto.merge_pub_keys([pub_key]))
        const unit_validator = vr.crypto.generate_address(vr.con.constant.unit,vr.crypto.merge_pub_keys([pub_key]))
        const pool:vr.Pool = await data.read_pool(10**9)
        if(Object.values(pool).some(tx=>tx.meta.kind==='request'&&tx.meta.bases.indexOf(unit_validator)!=-1&&tx.meta.tokens[0]===vr.con.constant.unit&&tx.raw.raw[0]==='buy')) throw new Error('already bought units');
        const validator_state:vr.State = await data.read_state(S_Trie,native_validator,vr.state.create_state());
        const validator_amount = validator_state.amount || 0;
        const minimum:number = config.validator.minimum;
        if(validator_state==null||math.smaller(validator_amount,minimum)) throw new Error("You don't have enough amount");

        const unit_store = await data.get_unit_store();
        const unit_values = Object.values(unit_store);
        const sorted_units = unit_values.slice().sort((a,b)=>a.unit_price-b.unit_price);
        let price_sum:number = 0;
        const units = await P.reduce(sorted_units, async (res:vr.Unit[],unit)=>{
            if(math.chain(validator_amount).subtract(price_sum).subtract(unit.unit_price).smaller(minimum).done() as boolean) return res;
            const unit_state = await data.read_state(S_Trie,unit.address,vr.state.create_state(0,unit.address,vr.con.constant.unit,0,{used:"[]"}));
            const unit_used = JSON.parse(unit_state.data.used||'[]');
            const iden_hash = vr.crypto.hash(unit.request+unit.height.toString(16)+unit.block_hash);
            if(unit_used.indexOf(iden_hash)!=-1) return res;
            price_sum = math.chain(price_sum).add(unit.unit_price).done();
            return res.concat(unit);
        },[]);
        if(units.length===0) throw new Error('no units');
        const unit_addresses = [unit_validator].concat(units.map(u=>u.address)).filter((val,i,array)=>array.indexOf(val)===i);
        const native_addresses = [native_validator].concat(units.map(u=>"Vr:"+vr.con.constant.native+":"+u.address.split(':')[2])).filter((val,i,array)=>array.indexOf(val)===i);
        const bases = unit_addresses.concat(native_addresses);
        const feeprice:number = config.validator.fee_price;
        const gas:number = config.validator.gas;
        const input_raw = ["buy",JSON.stringify(units)];
        const tx = await works.make_req_tx([pub_key],type,tokens,bases,feeprice,gas,input_raw,"",private_key,pub_key,chain,S_Trie,L_Trie);

        const StateData = await data.get_tx_statedata(tx,chain,S_Trie);
        const LockData = await data.get_tx_lockdata(tx,chain,L_Trie);
        const new_pool = vr.pool.tx2pool(pool,tx,chain,StateData,LockData);

        if(new_pool[tx.hash]!=null){
            await data.write_pool(new_pool);
            await P.forEach(units, async (unit)=>{
                await data.del_unit(unit);
            });

            const peers:peer[] = await data.get_peer_list();
            await P.forEach(peers,async peer=>{
                const url = 'http://'+peer.ip+':57750/tx';
                const option = {
                    url:url,
                    body:tx,
                    json:true
                }
                await rp.post(option);
            });
        }

    }
    catch(e){
        log.info(e);
    }
    await works.sleep(2000);
    setImmediate(()=>buying_unit.apply(null,[private_key]));
    return 0;
}


const refreshing = async (private_key:string)=>{
    try{
        const miner_pub:string = config.pub_keys[config.miner.use];
        const feeprice = Number(config.miner.fee_price);
        const unit_price = Number(config.miner.unit_price);
        const log = "";
        const chain:vr.Block[] = await data.read_chain(2*(10**9));
        const pool:vr.Pool = await data.read_pool(10**9)
        const pool_txs = Object.values(pool);
        let refreshed:string[] = [];
        let search_block:vr.Block;
        let tx_i:string;
        let search_tx:vr.TxPure;
        let block_height = -1;
        let tx_index = -1;
        let checker = false;
        for(search_block of chain.slice().reverse()){
            for(tx_i in search_block.txs){
                if(checker) break;
                search_tx = search_block.txs[Number(tx_i)];
                if(search_tx.meta.kind==='request'&&refreshed.indexOf(search_tx.hash)===-1&&!pool_txs.some(tx=>tx.meta.kind==='refresh'&&tx.meta.req_tx_hash===search_tx.hash&&tx.meta.block_hash===search_block.hash&&tx.meta.height===search_block.meta.height&&tx.meta.index===Number(tx_i))){
                    checker = true;
                    block_height = search_block.meta.height;
                    tx_index = Number(tx_i);
                    break;
                }
                else if(search_tx.meta.kind==='refresh'){
                    refreshed.push(search_tx.meta.req_tx_hash);
                }
            }
        }
        if(block_height===-1||tx_index===-1) throw new Error('any request tx is already refreshed.');
        const roots:{stateroot:string,lockroot:string} = await data.read_root();
        const S_Trie = data.state_trie_ins(roots.stateroot);
        const L_Trie = data.lock_trie_ins(roots.lockroot);
        const tx = await works.make_ref_tx([miner_pub],feeprice,unit_price,block_height,tx_index,log,private_key,miner_pub,chain,S_Trie,L_Trie);

        const StateData = await data.get_tx_statedata(tx,chain,S_Trie);
        const LockData = await data.get_tx_lockdata(tx,chain,L_Trie);
        const new_pool = vr.pool.tx2pool(pool,tx,chain,StateData,LockData);
        await data.write_pool(new_pool);

        const peers:peer[] = await data.get_peer_list();
        await P.forEach(peers,async peer=>{
            const url = 'http://'+peer.ip+':57750/tx';
            const option = {
                url:url,
                body:tx,
                json:true
            }
            await rp.post(option);
        });
    }
    catch(e){
        log.info(e);
    }
    await works.sleep(2000);
    setImmediate(()=>refreshing.apply(null,[private_key]));
    return 0;
}

const making_unit = async ()=>{
    try{
        const pub = config.pub_keys[config.miner.use];
        const miner = vr.crypto.generate_address(vr.con.constant.unit,pub);
        const chain:vr.Block[] = await data.read_chain(2*(10**9));
        const unit_price:number = config.miner.unit_price;
        const roots:{stateroot:string,lockroot:string} = await data.read_root();
        const S_Trie = data.state_trie_ins(roots.stateroot);
        const unit_state = await data.read_state(S_Trie,miner,vr.state.create_state(0,miner,vr.con.constant.unit,0,{data:"[]"}));
        const used:string[] = JSON.parse(unit_state.data.used||"[]");
        const unit_store = await data.get_unit_store();
        let search_block:vr.Block;
        let search_tx:vr.TxPure;
        let unit_iden_hash:string = '';
        let unit_store_key:string = '';
        let pre_unit:vr.Unit = {
            request:vr.crypto.hash(''),
            height:0,
            block_hash:vr.crypto.hash(''),
            nonce:0,
            address:miner,
            output:vr.crypto.hash(''),
            unit_price:0
        };
        let found = false;
        for(search_block of chain.slice().reverse()){
            for(search_tx of search_block.txs){
                if(search_tx.meta.kind==="refresh"){
                    unit_iden_hash = vr.crypto.hash(search_tx.meta.req_tx_hash+search_tx.meta.height.toString(16)+search_tx.meta.block_hash);
                    unit_store_key = vr.crypto.hash(search_tx.meta.req_tx_hash+search_tx.meta.height.toString(16)+search_tx.meta.block_hash+miner);
                    if(used.indexOf(unit_iden_hash)!=-1||unit_store[unit_store_key]!=null) continue;
                    pre_unit = {
                        request:search_tx.meta.req_tx_hash,
                        height:search_tx.meta.height,
                        block_hash:search_tx.meta.block_hash,
                        nonce:0,
                        address:miner,
                        output:search_tx.meta.output,
                        unit_price:unit_price
                    }
                    found = true;
                    break;
                }
            }
        }
        if(!found) throw new Error('no new refresh-tx');

        const nonce = works.get_nonce(pre_unit.request,pre_unit.height,pre_unit.block_hash,miner,pre_unit.output,unit_price);
        if(nonce===-1) throw new Error('fail to get valid nonce')
        const unit = works.new_obj(
            pre_unit,
            u=>{
                u.nonce = nonce;
                return u;
            }
        );
        await data.write_unit(unit);

        const peers:peer[] = await data.get_peer_list();
        await P.forEach(peers,async peer=>{
            const url = 'http://'+peer.ip+':57750/unit';
            const option = {
                url:url,
                body:unit,
                json:true
            }
            await rp.post(option);
        });
    }
    catch(e){
        log.info(e);
    }
    await works.sleep(2000);
    setImmediate(making_unit);
    return 0;
}



yargs
.usage('Usage: $0 <command> [options]')
.command('setup','setup data', {}, async ()=>{
    try{
        const my_password = readlineSync.question('Your password:',{hideEchoBack: true, defaultInput: 'password'});
        await setup(my_password);
        process.exit(1)
    }
    catch(e){
        console.log(e);
        process.exit(1)
    }
}).command('run','run node', {}, async ()=>{
    try{
        const my_password = readlineSync.question('Your password:',{hideEchoBack: true, defaultInput: 'password'});
        const my_key = vr.crypto.hash(my_password).slice(0,122);
        const get_private = fs.readFileSync('./keys/private/'+my_key+'.txt','utf-8');
        const my_private = CryptoJS.AES.decrypt(get_private,my_key).toString(CryptoJS.enc.Utf8);
        share_data.chain = await data.read_chain(2*(10**9));
        /*(async ()=>{
            await shake_hands();
            await get_new_blocks();
            return 0;
        })();*/

        /*setInterval(async ()=>{
            await shake_hands(log);
            return 0;
        },600000);*/

        /*setInterval(async ()=>{
            await get_new_blocks(log);
            return 0;
        },30000);

        if(config.validator.flag){
            await staking(my_private,config,log);
            setInterval(async ()=>{
                await buying_unit(my_private,config,log);
                return 0;
            },1000);
        }

        if(config.miner.flag){
            const my_miner_pub = config.pub_keys[config.miner.use];
            const my_miner = vr.crypto.generate_address(vr.con.constant.unit,my_miner_pub);
            setInterval(async ()=>{
                await refreshing(my_private,config,log);
                await making_unit(my_miner,config,log);
                return 0;
            },60000*config.miner.interval);
        }*/
        /*shake_hands();
        get_new_blocks();
        if(config.validator.flag){
            staking(my_private);
            buying_unit(my_private);
        }
        if(config.miner.flag){
            refreshing(my_private);
            making_unit();
        }

        const replServer = repl.start({prompt:'>',terminal:true});

        replServer.defineCommand('request-tx',{
            help: 'Create request tx',
            async action(input){
                await req_tx_com(input,config,my_private);
            }
        });

        replServer.defineCommand('remit',{
            help: 'Create request tx',
            async action(input){
                await remit(input,config,my_private);
            }
        });

        replServer.defineCommand('balance',{
            help: 'Show your VRT balance',
            async action(){
                const balance = await repl_balance(my_private);
                console.log(balance);
            }
        });

        replServer.defineCommand('get-block',{
            help:'Show the block specified by height',
            async action(input){
                const block = await repl_get_block(input);
                console.log(block);
            }
        });

        replServer.defineCommand('get-chain-info',{
            help:'Show the chain info',
            async action(){
                const info = await repl_get_chain_info();
                console.log(info);
            }
        });

        replServer.defineCommand('output-chain',{
            help:'output chain as zip of json files',
            async action(){
                await output_chain();
            }
        })


    }
    catch(e){
        console.log(e);
        process.exit(1)
    }
}).command('add-peer <ip>','add peer ip address', {
    'ip':{
        describe:'new ip',
        type:'string',
        default:'localhost'
    }
}, async (argv)=>{
    try{
        const ip:string = argv.ip;
        await add_peer(ip);
        process.exit(1)
    }
    catch(e){
        console.log(e);
        process.exit(1)
    }
}).command('generate-keys','generate new key', {}, async ()=>{
    try{
        await generate_keys();
        process.exit(1)
    }
    catch(e){
        console.log(e);
        process.exit(1)
    }
}).command('get-native-balance <id>','get native balance', {
    'id':{
        describe:'key id to check the balance',
        type:'number'
    }
}, async (argv)=>{
    try{
        const id:number = argv.id!=null ? argv.id : 0;
        console.log(await get_native_balance(config,id));
        process.exit(1)
    }
    catch(e){
        console.log(e);
        process.exit(1)
    }
}).command('config [new_pub] [user_id] [miner_mode] [miner_id] [miner_interval] [miner_fee] [miner_unit_price] [validator_mode] [validator_id] [validator_min] [validator_fee] [validator_gas]','set config',{
    'new_pub':{
        describe:'new public key',
        type:'string'
    },
    'user_id':{
        describe:'key id used for user',
        type:'number'
    },
    'miner_mode':{
        describe:'flag for mining',
        type:'boolean'
    },
    'miner_id':{
        describe:'key id used for miner',
        type:'number'
    },
    'miner_interval':{
        describe:'mining interval',
        type:'number'
    },
    'miner_fee':{
        describe:'fee of refresh-tx',
        type:'number'
    },
    'miner_unit_price':{
        describe:'unit price',
        type:'number'
    },
    'validator_mode':{
        describe:'flag for validate',
        type:'boolean'
    },
    'validator_id':{
        describe:'key id used for validator',
        type:'number'
    },
    'validator_min':{
        describe:'minimum balance to buy units',
        type:'number'
    },
    'validator_fee':{
        describe:'fee for unit-buying-tx',
        type:'number'
    },
    'validator_gas':{
        describe:'gas for unit-buying-tx',
        type:'number'
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
}).fail((msg,err)=>{
    if(err) console.log(err);
    else console.log(msg);
    process.exit(1);
}).help().recommendCommands().argv;
*/