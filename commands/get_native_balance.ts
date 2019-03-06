import * as vr from 'vreath'
import { state_trie_ins, get_native_balance, read_root } from '../logic/data';

export default async (config:any,id:number)=>{
    const pub_keys = config.pub_keys || [];
    const my_pub = pub_keys[id];
    if(my_pub==null) return 0;
    const address = vr.crypto.generate_address(vr.con.constant.native,my_pub);
    const roots:{stateroot:string,lockroot:string} = await read_root();
    const stateroot = roots.stateroot;
    const S_Trie = state_trie_ins(stateroot);
    const balance = await get_native_balance(address,S_Trie);
    return balance;
}