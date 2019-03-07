import * as data from '../../logic/data'

export default async ()=>{
    try{
        return await data.read_chain_info();
    }
    catch(e){
        console.log(e);
    }
}