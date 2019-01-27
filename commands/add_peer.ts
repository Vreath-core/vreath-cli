import * as fs from 'fs'
import {promisify} from 'util'
import { peer } from '../app/routes/handshake';

export default async (ip:string)=>{
    const peer_list:peer[] = JSON.parse(await promisify(fs.readFile)('./json/peer_list.json','utf-8'));
    const new_peer:peer = {
        ip:ip,
        timestamp:(new Date()).getTime()
    }
    const sorted = peer_list.concat(new_peer).sort((a,b)=>b.timestamp-a.timestamp);
    const ips_array = sorted.map(peer=>peer.ip);
    const new_list = sorted.filter((peer,i)=>ips_array.indexOf(peer.ip)===i);
    await promisify(fs.writeFile)('./json/peer_list.json',JSON.stringify(new_list,null,4),'utf-8');
}