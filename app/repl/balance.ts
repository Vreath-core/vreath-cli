import * as vr from 'vreath'
import * as data from '../../logic/data'
import bigInt from 'big-integer'

export default async (my_private:string,chain_info_db:vr.db,root_db:vr.db,trie_db:vr.db,state_db:vr.db)=>{
    try{
        const info:data.chain_info|null = await chain_info_db.read_obj("00");
        if(info==null) throw new Error("chain_info doesn't exist");
        const last_height = info.last_height;
        const root = await root_db.get(last_height,"hex");
        if(root==null) throw new Error("root doesn't exist");
        const trie = vr.data.trie_ins(trie_db,root);
        const pub = vr.crypto.private2public(my_private);
        const add = vr.crypto.generate_address(vr.con.constant.native,pub);
        const state:vr.State = await vr.data.read_from_trie(trie,state_db,add,0,vr.state.create_state("00",vr.con.constant.native,add,"00"));
        return bigInt(state.amount,16).toString(10);
    }
    catch(e){
        console.log(e);
    }
}