"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const setup_1 = require("./setup");
const node_1_1 = require("./node_1");
const node_2_1 = require("./node_2");
const PeerInfo = require('peer-info');
const PeerId = require('peer-id');
const Multiaddr = require('multiaddr');
const PeerBook = require('peer-book');
const libp2p = require('libp2p');
const TCP = require('libp2p-tcp');
const WS = require('libp2p-websockets');
const SPDY = require('libp2p-spdy');
const MPLEX = require('libp2p-mplex');
const SECIO = require('libp2p-secio');
const MulticastDNS = require('libp2p-mdns');
const Bootstrap = require('libp2p-bootstrap');
const DHT = require('libp2p-kad-dht');
const defaultsDeep = require('@nodeutils/defaults-deep');
const pull = require('pull-stream');
const toStream = require('pull-stream-to-stream');
//const parallel = require('mocha.parallel')
/*parallel("node test", async ()=>{
    const node1 = run_node1();
    const node2 = run_node2();
});*/
(async () => {
    const setup_data = await setup_1.test_setup();
    const node1 = node_1_1.run_node1(setup_data);
    const node2 = node_2_1.run_node2(setup_data);
})();
