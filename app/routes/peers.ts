import * as express from 'express'
import {peer} from './handshake'
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

const router = express.Router();

export default router.post('/',async (req,res)=>{
    try{
        const list:peer[] = req.body;
        if(!Array.isArray(list)||list.some(p=>typeof p.ip!='string'||typeof p.timestamp!='number')){
            res.status(500).send('invalid list');
            return 0;
        }
        const my_list:peer[] = await get_peer_list();
        const peers_ip = list.map(peer=>peer.ip);
        const new_list = my_list.map(peer=>{
            const i = peers_ip.indexOf(peer.ip);
            if(i===-1) return peer;
            else return list[i];
        }).sort((a,b)=>b.timestamp-a.timestamp);
        let peer:peer;
        for(peer of new_list){
            await write_peer(peer);
        }
        res.send(my_list);
        return 1;
    }
    catch(e){
        log.info(e);
        res.status(500).send('error');
    }
});