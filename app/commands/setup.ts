import * as vr from 'vreath'
import * as data from '../../logic/data'
import * as genesis from '../../genesis/index'
import * as fs from 'fs'
import {promisify} from 'util'
import * as P from 'p-iteration'

export default async ()=>{
    const S_Trie = data.state_trie_ins('');

    await P.forEach(genesis.state, async s=>{
        if(s.kind==='state') await S_Trie.put(s.owner,s);
        else if(s.kind==='info') await S_Trie.put(s.token,s);
    },[]);

    await promisify(fs.writeFile)('./json/chain.json',JSON.stringify([genesis.block],null, 4),'utf-8');
    await promisify(fs.writeFile)('./json/root.json',JSON.stringify(genesis.roots,null, 4),'utf-8');
    await promisify(fs.writeFile)('./json/pool.json',"{}",'utf-8');
    await promisify(fs.writeFile)('./json/peer_list.json',JSON.stringify(genesis.peers,null, 4),'utf-8');
}