import * as vr from 'vreath'
import * as works from '../../logic/work'
import * as data from '../../logic/data'
import bigInt from 'big-integer'

export default async (input:string,my_private:string,chain_info_db:vr.db,root_db:vr.db,trie_db:vr.db,state_db:vr.db,lock_db:vr.db,tx_db:vr.db)=>{
    try{
        const splited = input.trim().split('--').slice(1);
        let bases = splited[0].trim().split(',');
        if(bases[0]===''&&bases.length===1) bases = [];
        const my_pub = vr.crypto.private2public(my_private);
        const my_address = vr.crypto.generate_address(vr.con.constant.native,my_pub);
        bases = [my_address].concat(bases);
        const feeprice = vr.crypto.bigint2hex(bigInt(splited[1].trim()||"00").times(bigInt(vr.con.constant.one_hex,16)));
        const gas = vr.crypto.bigint2hex(bigInt(splited[2].trim()||"00").times(bigInt(vr.con.constant.one_hex,16)));
        let input_raw = splited[3].trim().split(',');//.map(data=>vr.crypto.bigint2hex(bigInt(data,10)));
        if(input_raw[0]===''&&input_raw.length===1) input_raw = [];
        const amount_bigInt = input_raw.map(str=>bigInt(str).times(bigInt(vr.con.constant.one_hex,16)));
        let amount_hex = amount_bigInt.map(int=>vr.crypto.bigint2hex(int));
        const amount_sum = amount_bigInt.reduce((sum,int)=>sum.add(int),bigInt(0));
        let info:data.chain_info|null = await chain_info_db.read_obj("00");
        if(info==null) throw new Error("chain_info doesn't exist");
        const root = await root_db.get(info.last_height);
        if(root==null) throw new Error("root doesn't exist");
        const trie = vr.data.trie_ins(trie_db,root);
        const my_native_state = await vr.data.read_from_trie(trie,state_db,my_address,0,vr.state.create_state("00",vr.con.constant.native,my_address,"00"));
        const my_balance = bigInt(my_native_state.amount,16);
        if(my_balance.lesser(amount_sum)) throw new Error('insufficient funds');
        amount_hex = ["00","00"].concat(amount_hex);
        const log = Buffer.from(splited[4].trim(),'utf8').toString('hex');
        const requesting = info.manual_requesting.flag;
        if(requesting) throw new Error("requesting now");
        const tx = await works.make_req_tx(0,my_native_state.nonce,bases,feeprice,gas,amount_hex,log,my_private,false,trie,state_db,lock_db);
        await tx_db.write_obj(tx.hash,tx);
        info.manual_requesting.flag = true;
        info.manual_requesting.address = my_address;
        info.manual_requesting.tx_hash = tx.hash;
        info.manual_requesting.nonce = my_native_state.nonce;
        await chain_info_db.write_obj("00",info);
        return tx;
    }
    catch(e){
        console.log(e);
    }
}