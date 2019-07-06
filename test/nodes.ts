import * as vr from 'vreath'
import bigInt from 'big-integer'
import {promisify} from 'util'
import {peer_info} from '../logic/data'
import {config} from '../commands/config'
import {run_node,DBSet} from './common'
import * as setup from './setup'
const PeerId = require('peer-id');
const search_ip = require('ip');


export const run_node1 = async (setup_data:setup.setup_data)=>{
    const db_set = new DBSet();
    const genesis_db_set = await setup.add_setup_data(db_set,setup_data);
    const config:config = {
        miner:{
            flag:true,
            interval:0.1,
            gas_share:0,
            unit_price:"e8d4a51000"
        },
        validator:{
            flag:true,
            minimum:"0a",
            fee_price:"00",
            gas:"00"
        },
        peer:setup_data.peer.identity
    }
    //const ip:string = search_ip.address();
    return await run_node(setup_data.privKey,config,"127.0.0.1","8000",[setup_data.peer],genesis_db_set,1);
}


export const run_node2 = async (setup_data:setup.setup_data)=>{
    const db_set = new DBSet();
    const genesis_db_set = await setup.add_setup_data(db_set,setup_data);
    const peer = await setup.set_peer_id('8001');
    const config:config = {
        miner:{
            flag:true,
            interval:0.1,
            gas_share:0,
            unit_price:"e8d4a51000"
        },
        validator:{
            flag:false,
            minimum:"0a",
            fee_price:"00",
            gas:"00"
        },
        peer:peer.identity
    }
    const privKey = vr.crypto.genereate_key();
    //const ip:string = search_ip.address();
    return await run_node(privKey,config,"0.0.0.0","8001",[setup_data.peer],genesis_db_set,2);
}

export const run_node3 = async (setup_data:setup.setup_data)=>{
    const db_set = new DBSet();
    const genesis_db_set = await setup.add_setup_data(db_set,setup_data);
    const peer = await setup.set_peer_id('8002');
    const config:config = {
        miner:{
            flag:true,
            interval:0.5,
            gas_share:0,
            unit_price:"e8d4a51000"
        },
        validator:{
            flag:false,
            minimum:"0a",
            fee_price:"00",
            gas:"00"
        },
        peer:peer.identity
    }
    const privKey = vr.crypto.genereate_key();
    //const ip:string = search_ip.address();
    return await run_node(privKey,config,"0.0.0.0","8002",[setup_data.peer],genesis_db_set,3);
}

export const run_node4 = async (setup_data:setup.setup_data)=>{
    const db_set = new DBSet();
    const genesis_db_set = await setup.add_setup_data(db_set,setup_data);
    const peer = await setup.set_peer_id('8003');
    const config:config = {
        miner:{
            flag:true,
            interval:0.5,
            gas_share:0,
            unit_price:"e8d4a51000"
        },
        validator:{
            flag:true,
            minimum:"0a",
            fee_price:"00",
            gas:"00"
        },
        peer:peer.identity
    }
    const privKey = vr.crypto.genereate_key();
    //const ip:string = search_ip.address();
    return await run_node(privKey,config,"0.0.0.0","8003",[setup_data.peer],genesis_db_set,4);
}


