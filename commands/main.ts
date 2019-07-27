#! /usr/bin/env node

import * as vr from 'vreath'
import setup from './setup'
import generate_keys from './generate-keys'
import set_peer_id from './set-peer-id'
import {set_config, config} from './config'
import {run} from './run'
import handshake from '../app/routes/handshake'
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
import {setup_data} from '../test/setup'
import {run_node1,run_node2,run_node3,run_node4} from '../test/nodes'
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



const log = bunyan.createLogger({
    name:'vreath-cli',
    streams:[
        {
            path:path.join(__dirname,'../log/main.log')
        }
    ]
});

const config:config = JSON.parse(fs.readFileSync(path.join(__dirname,'../config/config.json'),'utf-8'));

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
        await run(config,log);
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
        const setup_data:setup_data = JSON.parse(await promisify(fs.readFile)(path.join(__dirname,'../test/test_genesis_data.json'),'utf8'));
        const nodes = [run_node1,run_node2,run_node3,run_node4];
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

