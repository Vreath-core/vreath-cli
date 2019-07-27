import * as data from '../../logic/data'
import {dialog_data} from '../../logic/work'
import * as vr from 'vreath'

export default async (chain_info_db:vr.db,root_db:vr.db,trie_db:vr.db,state_db:vr.db,native_address:string,unit_address:string)=>{
    try{
        const info:data.chain_info|null = await chain_info_db.read_obj("00");
        if(info==null) throw new Error("chain_info doesn't exist");
        return await dialog_data(chain_info_db,root_db,trie_db,state_db,native_address,unit_address,1);
    }
    catch(e){
        console.log(e);
    }
}