import * as vr from 'vreath'
import * as data from '../../logic/data'
import * as bunyan from 'bunyan'
import * as P from 'p-iteration'
import {promisify} from 'util'
import { Node } from '../../commands/run';
const PeerId = require('peer-id');
const Multiaddr = require('multiaddr');
const PeerInfo = require('peer-info');
const pull = require('pull-stream');
const toStream = require('pull-stream-to-stream');

export default async (msg:string,peer_list_db:vr.db,my_id:string,node:Node,log:bunyan)=>{
    try{
        const peer_info_list:data.peer_info[] = (JSON.parse(msg)).filter((p:data.peer_info)=>p.identity.id!=my_id);
        await P.forEach(peer_info_list ,async (peer:data.peer_info)=>{
            const peer_id = await promisify(PeerId.createFromJSON)(peer.identity);
            const peer_info = new PeerInfo(peer_id);
            peer.multiaddrs.forEach(add=>peer_info.multiaddrs.add(add));
            node.dialProtocol(peer_info,`/vreath/${data.id}/handshake`,(err:string,conn:any) => {
                if (!err) {
                    const stream = toStream(conn);
                    stream.write(JSON.stringify(peer_info_list));
                    stream.write('end');
                    peer_list_db.write_obj(Buffer.from(peer.identity.id).toString('hex'),peer);
                }
            });
            return false;
        });
    }
    catch(e){
        log.info(e);
    }
}
