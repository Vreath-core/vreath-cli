import * as vr from 'vreath'
import * as data from '../../logic/data'
import * as fs from 'fs'
import * as P from 'p-iteration'
import archiver from 'archiver'

export default async ()=>{
    try{
        const chain = await data.read_chain(2*(10**9));
        const splitted = chain.reduce((blocks:vr.Block[][],block)=>{
            const last = blocks[blocks.length-1];
            if(last.length>2000){
                blocks.push([block]);
                return blocks
            }
            else{
                blocks[blocks.length-1].push(block);
                return blocks;
            }
        },[[]]);
        const dri_pass = `output_chain_${chain[chain.length-1].meta.height}`
        const output = fs.createWriteStream(`${dri_pass}.zip`);
        const archive = archiver('zip');
        archive.pipe(output);
        await P.forEach(splitted, async (blocks)=>{
            archive.append(JSON.stringify(blocks,null,4),{name:`${dri_pass}/block_${blocks[0].meta.height}_${blocks[blocks.length-1].meta.height}`})
        });
        archive.finalize();
    }
    catch(e){
        console.log(e);
    }
}