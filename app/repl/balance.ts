import * as vr from 'vreath'
import * as data from '../../logic/data'

export default async (my_private:string)=>{
    try{
        const roots:{stateroot:string,lockroot:string} = await data.read_root();
        const S_Trie = data.state_trie_ins(roots.stateroot);
        const pub = vr.crypto.private2public(my_private);
        const add = vr.crypto.generate_address(vr.con.constant.native,pub);
        const state:vr.State = await data.read_state(S_Trie,add,vr.state.create_state());
        if(state==null||state.amount===0) return 0;
        else return state.amount || 0;
    }
    catch(e){
        console.log(e);
    }
}