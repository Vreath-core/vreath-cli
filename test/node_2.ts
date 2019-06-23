import * as vr from 'vreath'
import bigInt from 'big-integer'
import {promisify} from 'util'
import {peer_info} from '../logic/data'
import {config} from '../commands/config'
import {run_node,DBSet} from './common'
import * as setup from './setup'
const PeerId = require('peer-id');

export const run_node2 = async ()=>{
    const setup_data = await setup.test_setup();
    const db_set = new DBSet();
    const genesis_db_set = await setup.add_setup_data(db_set,setup_data);
    const peer = await setup.set_peer_id('2');
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
    return await run_node(privKey,config,"2",[setup_data.peer],genesis_db_set,2);
}