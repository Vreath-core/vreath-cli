//import assert = require('assert');
import * as vr from 'vreath'
import * as tx_routes from '../app/routes/tx'
import * as block_routes from '../app/routes/block'
import * as chain_routes from '../app/routes/chain'
import * as unit_routes from '../app/routes/unit'
import * as data from '../logic/data'
import * as intervals from '../logic/interval'
import {Node} from '../commands/main'
import {promisify} from 'util'
import * as fs from 'fs'
import * as path from 'path'
import readlineSync from 'readline-sync'
import CryptoJS from 'crypto-js'
import * as P from 'p-iteration'
import {run_node, DBSet} from './common'
import {test_setup,add_setup_data, setup_data} from './setup'
import {run_node1,run_node2,run_node3,run_node4} from './nodes'
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
//const parallel = require('mocha.parallel')


/*parallel("node test", async ()=>{
    const node1 = run_node1();
    const node2 = run_node2();
});*/

(async ()=>{
    const setup_data:setup_data = JSON.parse(await promisify(fs.readFile)(path.join(__dirname,'./test_genesis_data.json'),'utf8'));
    run_node1(setup_data);
    run_node2(setup_data);
    run_node3(setup_data);
    run_node4(setup_data);
})();