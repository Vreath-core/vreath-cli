import * as vr from 'vreath'
import * as data from '../../logic/data'
import * as fs from 'fs'
import * as P from 'p-iteration'
import bigInt from 'big-integer'
import archiver from 'archiver'

export default async ()=>{
    try{
        const info:data.chain_info|null = await data.chain_info_db.read_obj("00");
        if(info==null) throw new Error("chain_info doesn't exist");
        const last_height = info.last_height;
        let height = bigInt(0);
        let block:vr.Block|null;
        const dri_pass = `output_chain_${last_height}`
        const output = fs.createWriteStream(`${dri_pass}.zip`);
        const archive = archiver('zip');
        archive.pipe(output);
        while(1){
            block = await data.block_db.read_obj(vr.crypto.bigint2hex(height));
            if(block==null) continue;
            archive.append(JSON.stringify(block,null,4),{name:`${dri_pass}/block_${vr.crypto.bigint2hex(height)}`});
            if(height.eq(bigInt(last_height,16))) break;
        }
        archive.finalize();
    }
    catch(e){
        console.log(e);
    }
}