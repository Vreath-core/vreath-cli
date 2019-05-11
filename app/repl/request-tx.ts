import * as vr from 'vreath'
import * as works from '../../logic/work'
import * as data from '../../logic/data'
import bigInt from 'big-integer'

export default async (input:string,my_private:string)=>{
    try{
        const splited = input.trim().split('--').slice(1);
        let bases = splited[0].trim().split(',');
        if(bases[0]===''&&bases.length===1) bases = [];
        const my_public = vr.crypto.private2public(my_private);
        const main_token = bases.length>0 ? vr.crypto.slice_token_part(bases[0]) : vr.con.constant.native;
        const my_address = vr.crypto.generate_address(main_token,my_public);
        bases.push(my_address);
        const feeprice = vr.crypto.bigint2hex(bigInt(splited[1].trim()));
        const gas = vr.crypto.bigint2hex(bigInt(splited[2].trim()));
        let input_raw = splited[3].trim().split(',').map(data=>vr.crypto.bigint2hex(bigInt(data,10)));
        if(input_raw[0]===''&&input_raw.length===1) input_raw = [];
        const log = Buffer.from(splited[4].trim(),'utf8').toString('hex');
        const info:data.chain_info|null = await data.chain_info_db.read_obj("00");
        if(info==null) throw new Error("chain_info doesn't exist");
        const root = await data.root_db.get(info.last_height);
        if(root==null) throw new Error("root doesn't exist");
        const trie = vr.data.trie_ins(data.trie_db,root);
        const tx = await works.make_req_tx(0,bases,feeprice,gas,input_raw,log,my_private,trie,data.state_db,data.lock_db);
        await data.tx_db.write_obj(tx.hash,tx);
    }
    catch(e){
        console.log(e);
    }
}