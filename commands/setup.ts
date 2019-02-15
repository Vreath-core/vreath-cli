import * as vr from 'vreath'
import * as data from '../logic/data'
import * as genesis from '../genesis/index'
import * as fs from 'fs'
import * as fse from 'fs-extra'
import {promisify} from 'util'
import * as P from 'p-iteration'
import { write_chain, chain_info, new_obj, write_pool} from '../logic/work';
import * as math from 'mathjs'
math.config({
    number: 'BigNumber'
});

export default async (my_password:string)=>{
    const my_key = vr.crypto.hash(my_password).slice(0,122);
    await promisify(fs.stat)('./keys/private/'+my_key+'.txt');
    const S_Trie = data.state_trie_ins('');
    const reduced_state = genesis.state.map(s=>{
        if(s.kind!='state'||s.token!=vr.con.constant.unit) return s;
        return new_obj(
            s,
            s=>{
                s.amount = math.chain(s.amount).multiply(vr.con.constant.unit_rate).done();
                return s;
            }
        )
    })
    await P.forEach(reduced_state, async s=>{
        if(s.kind==='state') await S_Trie.put(s.owner,s);
        else if(s.kind==='info') await S_Trie.put(s.token,s);
    },[]);
    const new_roots = {
        stateroot:S_Trie.now_root(),
        lockroot:genesis.roots.lockroot
    }

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

    await fse.emptyDir('./json/pool');

    await promisify(fs.writeFile)('./json/root.json',JSON.stringify(new_roots,null, 4),'utf-8');
    await promisify(fs.writeFile)('./json/peer_list.json',JSON.stringify(genesis.peers,null, 4),'utf-8');
    await promisify(fs.writeFile)('./json/unit_store.json',JSON.stringify({}),'utf-8');
    await promisify(fs.writeFile)('./log/log.log','','utf-8');
}
