import * as vr from 'vreath'
import * as data from '../logic/data'
import * as genesis from '../genesis/index'
import readlineSync from 'readline-sync'
import * as fs from 'fs'
import * as fse from 'fs-extra'
import {promisify} from 'util'
import * as P from 'p-iteration'
import CryptoJS from 'crypto-js'
import { write_chain, chain_info, new_obj} from '../logic/work';

const my_password = readlineSync.question('Your password:',{hideEchoBack: true, defaultInput: 'password'});
const my_key = vr.crypto.hash(my_password).slice(0,122);

(async()=>{
    try{
        const S_Trie = data.state_trie_ins('');

        await P.forEach(genesis.state, async s=>{
            if(s.kind==='state') await S_Trie.put(s.owner,s);
            else if(s.kind==='info') await S_Trie.put(s.token,s);
        },[]);

        await fse.emptyDir('./json/chain/net_id_'+vr.con.constant.my_net_id.toString());
        const info:chain_info = {
            net_id:vr.con.constant.my_net_id,
            chain_id:vr.con.constant.my_chain_id,
            version:vr.con.constant.my_version,
            compatible_version:vr.con.constant.compatible_version,
            last_height:0,
            pos_diffs:[]
        }
        await promisify(fs.writeFile)('./json/chain/net_id_'+vr.con.constant.my_net_id.toString()+'/info.json',JSON.stringify(info,null,4),'utf-8');
        await write_chain(genesis.block);
        await promisify(fs.writeFile)('./json/root.json',JSON.stringify(genesis.roots,null, 4),'utf-8');
        await promisify(fs.writeFile)('./json/pool.json',JSON.stringify({}),'utf-8');
        await promisify(fs.writeFile)('./json/peer_list.json',JSON.stringify(genesis.peers,null, 4),'utf-8');
        await promisify(fs.writeFile)('./json/unit_store.json',JSON.stringify({}),'utf-8');

        const private_key = vr.crypto.genereate_key();
        const public_key = vr.crypto.private2public(private_key);
        const encrypted_pri = CryptoJS.AES.encrypt(private_key,my_key).toString();
        const config = JSON.parse(await promisify(fs.readFile)('./config/config.json','utf-8'));
        const new_config = new_obj(
            config,
            con=>{
                con.pub_keys.push(public_key);
                return con;
            }
        )
        await promisify(fs.writeFile)('./keys/private/'+my_key+'.txt',encrypted_pri);
        await promisify(fs.writeFile)('./keys/public/'+my_key+'.txt',public_key);
        await promisify(fs.writeFile)('./config/config.json',JSON.stringify(new_config,null,4),'utf-8');
    }
    catch(e){
        console.log(e);
    }
})();
