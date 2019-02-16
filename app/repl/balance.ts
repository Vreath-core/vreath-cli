import * as vr from 'vreath'
import * as data from '../../logic/data'
import * as fs from 'fs'
import {promisify} from 'util'

export default async (my_private:string)=>{
    try{
        const roots:{stateroot:string,lockroot:string} = JSON.parse(await promisify(fs.readFile)('./json/root.json','utf-8'));
        const S_Trie = data.state_trie_ins(roots.stateroot);
        const pub = vr.crypto.private2public(my_private);
        const add = vr.crypto.generate_address(vr.con.constant.native,pub);
        const state:vr.State = await S_Trie.get(add);
        if(state==null) return 0;
        else return state.amount || 0;
    }
    catch(e){
        console.log(e);
    }
}