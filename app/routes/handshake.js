"use strict";
/*import * as express from 'express'
import * as vr from 'vreath'
import bunyan from 'bunyan'
import { get_peer_list, write_peer } from '../../logic/data';

const log = bunyan.createLogger({
    name:'vreath-cli',
    streams:[
        {
            path:'./log/log.log'
        }
    ]
});

export type node_info = {
    version:number;
    net_id:number;
    chain_id:number;
    timestamp:number;
}

export type peer = {
    ip:string;
    timestamp:number;
}

const router = express.Router();

export const make_node_info = ()=>{
    const node_info:node_info = {
        version:vr.con.constant.my_version,
        net_id:vr.con.constant.my_net_id,
        chain_id:vr.con.constant.my_chain_id,
        timestamp:(new Date()).getTime()
    }
    return node_info
}

export const handshake_route = router.post('/',async (req,res)=>{
    try{
        const info:node_info = req.body;
        if(typeof info.version != 'number'|| typeof info.net_id != 'number' || typeof info.chain_id != 'number' || typeof info.timestamp != 'number'){
            res.status(500).send('invalid node info');
            return 0;
        }
        if(info.version<vr.con.constant.compatible_version||info.net_id!=vr.con.constant.my_net_id||info.chain_id!=vr.con.constant.my_chain_id){
            res.status(500).send('unsupported');
            return 0;
        }
        const remote_add = req.connection.remoteAddress || '';
        const splitted = remote_add.split(':');
        const ip = splitted[splitted.length - 1];
        console.log(ip);
        const this_peer:peer = {
            ip:ip,
            timestamp:info.timestamp
        }
        const peer_list:peer[] = await get_peer_list();
        const this_peer_index = peer_list.map(peer=>peer.ip).indexOf(this_peer.ip);
        const new_peer_list = peer_list.map((p,i)=>{
            if(i===this_peer_index) return this_peer;
            else return p;
        }).sort((a,b)=>b.timestamp - a.timestamp);
        let peer:peer;
        for(peer of new_peer_list){
            await write_peer(peer);
        }
        const my_node_info = make_node_info();
        res.send(my_node_info);
        return 1;
    }
    catch(e){
        log.info(e);
        res.status(500).send('error');
    }
});*/ 
