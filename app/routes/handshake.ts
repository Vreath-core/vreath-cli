import * as vr from 'vreath'
import * as data from '../../logic/data'
import * as bunyan from 'bunyan'
import * as P from 'p-iteration'
const PeerId = require('peer-id');
const Multiaddr = require('multiaddr');

export default async (msg:string,peer_list_db:vr.db,log:bunyan)=>{
    try{
        const peers:data.peer_info[] = JSON.parse(msg);
        await P.forEach(peers, async peer=>{
            await peer_list_db.write_obj(Buffer.from(peer.identity.id).toString('hex'),peer);
        });
    }
    catch(e){
        log.info(e);
    }
}
