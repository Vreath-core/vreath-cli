/*import * as vr from 'vreath'
import { state_trie_ins, get_native_balance, read_root } from '../logic/data';

export default async (config:any,id:number)=>{
    try{
        const info:data.chain_info|null = await data.chain_info_db.read_obj("00");
        if(info==null) throw new Error("chain_info doesn't exist");
        const last_height = info.last_height;
        const root = await data.root_db.get(last_height,"hex");
        if(root==null) throw new Error("root doesn't exist");
        const trie = vr.data.trie_ins(data.trie_db,root);
        const pub = vr.crypto.private2public(my_private);
        const add = vr.crypto.generate_address(vr.con.constant.native,pub);
        const state:vr.State = await vr.data.read_from_trie(trie,data.state_db,add,0,vr.state.create_state("00",vr.con.constant.native,add,"00"));
        return bigInt(state.amount,16).toString(10);
    }
    catch(e){
        console.log(e);
    }
}*/