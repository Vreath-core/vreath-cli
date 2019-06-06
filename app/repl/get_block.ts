import * as vr from 'vreath'
import bigInt from 'big-integer'

export default async (input:string,block_db:vr.db)=>{
    try{
        const height = vr.crypto.bigint2hex(bigInt(input));
        const block:vr.Block|null = await block_db.read_obj(height);
        if(block==null) throw new Error("block doesn't exist at the height");
        return block;
    }
    catch(e){
        console.log(e);
    }
}