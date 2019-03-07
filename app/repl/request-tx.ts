import * as vr from 'vreath'
import * as works from '../../logic/work'
import * as data from '../../logic/data'
import rp from 'request-promise-native'
import * as P from 'p-iteration'

export default async (input:string,config:{[key:string]:any},my_private:string)=>{
    try{
        const splited = input.split('--').slice(1);;
        const user_pub:string = config.pub_keys[config.user.use];
        const type:vr.TxType = splited[0].split('=')[1].trim() as vr.TxType;
        const tokens = splited[1].split('=')[1].trim().split(',');
        const bases = splited[2].split('=')[1].trim().split(',');
        const feeprice = Number(splited[3].split('=')[1].trim());
        const gas = Number(splited[4].split('=')[1].trim());
        const input_raw = splited[5].split('=')[1].trim().split(',');
        const log = splited[6].split('=')[1].trim();
        const chain:vr.Block[] = await data.read_chain(2*(10**9));
        const roots:{stateroot:string,lockroot:string} = await data.read_root();
        const S_Trie = data.state_trie_ins(roots.stateroot);
        const L_Trie = data.lock_trie_ins(roots.lockroot);
        const tx = await works.make_req_tx([user_pub],type,tokens,bases,feeprice,gas,input_raw,log,my_private,user_pub,chain,S_Trie,L_Trie);
        const pool:vr.Pool = await data.read_pool(10**9)
        const StateData = await data.get_tx_statedata(tx,chain,S_Trie);
        const LockData = await data.get_tx_lockdata(tx,chain,L_Trie);
        const new_pool = vr.pool.tx2pool(pool,tx,chain,StateData,LockData);
        await data.write_pool(new_pool);
        if(new_pool[tx.hash]!=null){
            const peers = await data.get_peer_list();
            await P.forEach(peers,async peer=>{
                const url = 'http://'+peer.ip+':57750/tx';
                const option = {
                    url:url,
                    body:tx,
                    json:true
                }
                await rp.post(option);
            });
        }
    }
    catch(e){
        console.log(e);
    }
}