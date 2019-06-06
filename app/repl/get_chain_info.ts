import * as data from '../../logic/data'
import * as vr from 'vreath'

export default async (chain_info_db:vr.db)=>{
    try{
        const info:data.chain_info|null = await chain_info_db.read_obj("00");
        if(info==null) throw new Error("chain_info doesn't exist");
        return info;
    }
    catch(e){
        console.log(e);
    }
}