import { peer } from '../app/routes/handshake';
import { write_peer } from '../logic/data';

export default async (ip:string)=>{
    const new_peer:peer = {
        ip:ip,
        timestamp:(new Date()).getTime()
    }
    await write_peer(new_peer);
}