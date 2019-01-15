import * as vr from 'vreath'
import * as data from '../logic/data'
import * as genesis from '../genesis/index'
import * as fs from 'fs'
import * as fse from 'fs-extra'
import readlineSync from 'readline-sync'
import {promisify} from 'util'
import * as P from 'p-iteration'
import { write_chain, chain_info} from '../logic/work';

const my_password = readlineSync.question('Your password:',{hideEchoBack: true, defaultInput: 'password'});
(async()=>{
    try{
        const my_key = vr.crypto.hash(my_password).slice(0,122);
        await promisify(fs.stat)('./keys/private/'+my_key+'.txt');
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
    }
    catch(e){
        console.log(e);
    }
})();
