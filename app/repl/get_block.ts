import * as vr from 'vreath'
import * as data from '../../logic/data'
import bigInt from 'big-integer'

export default async (input:string)=>{
    try{
        const height = vr.crypto.bigint2hex(bigInt(input));
        const block:vr.Block|null = await data.block_db.read_obj(height);
        if(block==null) throw new Error("block doesn't exist at the height");
        return block;
    }
    catch(e){
        console.log(e);
    }
}