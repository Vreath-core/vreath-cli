import * as data from '../../logic/data'

export default async ()=>{
    try{
        const info:data.chain_info|null = await data.chain_info_db.read_obj("00");
        if(info==null) throw new Error("chain_info doesn't exist");
        return info;
    }
    catch(e){
        console.log(e);
    }
}