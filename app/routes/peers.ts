import * as express from 'express'
import {peer} from './handshake'
import * as fs from 'fs'
import {promisify} from 'util'
import bunyan from 'bunyan'

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
        const my_list:peer[] = JSON.parse(await promisify(fs.readFile)('./json/peer_list.json','utf-8'));
        const peers_ip = list.map(peer=>peer.ip);
        const new_list = my_list.map(peer=>{
            const i = peers_ip.indexOf(peer.ip);
            if(i===-1) return peer;
            else return list[i];
        }).sort((a,b)=>b.timestamp-a.timestamp);
        await promisify(fs.writeFile)('./json/peer_list.json',JSON.stringify(new_list,null,4),'utf-8');
        res.send(my_list);
        return 1;
    }
    catch(e){
        log.info(e);
        res.status(500).send('error');
    }
});