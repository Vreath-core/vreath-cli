import * as vr from 'vreath'
import * as data from '../logic/data'
import * as genesis from '../genesis/index'
import * as fs from 'fs'
import {promisify} from 'util'
import * as P from 'p-iteration'
import {new_obj} from '../logic/work';
import {write_chain, chain_info} from '../logic/data';
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
        await data.write_state(s);
        const hash = vr.crypto.object_hash(s);
        if(s.kind==='state') await data.put_state_to_trie(S_Trie,hash,s.kind,s.owner);
        else if(s.kind==='info') await data.put_state_to_trie(S_Trie,hash,s.kind,s.token);
    },[]);
    const new_roots = {
        stateroot:S_Trie.now_root(),
        lockroot:genesis.roots.lockroot
    }

    await data.reset_chain();
    const info:chain_info = {
        net_id:vr.con.constant.my_net_id,
        chain_id:vr.con.constant.my_chain_id,
        version:vr.con.constant.my_version,
        compatible_version:vr.con.constant.compatible_version,
        last_height:0,
        last_hash:genesis.block.hash,
        pos_diffs:[]
    }
    await data.write_chain_info(info);
    await write_chain(genesis.block);

    await data.empty_pool();

    await data.write_root(new_roots);
    await P.forEach(genesis.peers, async peer=>await data.write_peer(peer));
    await promisify(fs.writeFile)('./log/log.log','','utf-8');
}
