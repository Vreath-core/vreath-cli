import * as vr from 'vreath'
import * as works from '../../logic/work'
import * as data from '../../logic/data'
import * as fs from 'fs'
import {promisify} from 'util'
import request from 'request'
import rp from 'request-promise-native'
import * as P from 'p-iteration'

export default async (input:string,config:{[key:string]:any},my_private:string)=>{
    try{
        const splited = input.split('--').slice(1);
        const user_pub:string = config.pub_keys[config.user.use];
        const type:vr.TxType = "change"
        const tokens = [vr.con.constant.native];
        const remitter = vr.crypto.generate_address(vr.con.constant.native,user_pub);
        const receiver = splited[0].split('=')[1].trim().split(',').map(add=>{
            if(add==="remitter") return remitter;
            else return add;
        });
        const bases = [remitter].concat(receiver).filter((val,i,array)=>array.indexOf(val)===i);
        const feeprice = Number(splited[1].split('=')[1].trim());
        const gas = Number(splited[2].split('=')[1].trim());
        const amount = (splited[3]||"").split('=')[1].trim().split(',');
        if(receiver.length!=amount.length) throw new Error('invalid amount');
        const input_raw = ["remit",JSON.stringify(amount.map(a=>Number(a)))];
        const log = splited[4].split('=')[1].trim();
        const chain:vr.Block[] = await works.read_chain(2*(10**9));
        const roots:{stateroot:string,lockroot:string} = JSON.parse(await promisify(fs.readFile)('./json/root.json','utf-8'));
        const S_Trie = data.state_trie_ins(roots.stateroot);
        const L_Trie = data.lock_trie_ins(roots.lockroot);
        const tx = await works.make_req_tx([user_pub],type,tokens,bases,feeprice,gas,input_raw,log,my_private,user_pub,chain,S_Trie,L_Trie);

        const pool:vr.Pool = JSON.parse(await promisify(fs.readFile)('./json/pool.json','utf-8'));
        const StateData = await data.get_tx_statedata(tx,chain,S_Trie);
        const LockData = await data.get_tx_lockdata(tx,chain,L_Trie);
        const new_pool = vr.pool.tx2pool(pool,tx,chain,StateData,LockData);
        await promisify(fs.writeFile)('./json/pool.json',JSON.stringify(new_pool,null, 4),'utf-8');

        if(new_pool[tx.hash]!=null){
            const peers:{protocol:string,ip:string,port:number}[] = JSON.parse(await promisify(fs.readFile)('./json/peer_list.json','utf-8')||"[]");
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