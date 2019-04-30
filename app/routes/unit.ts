import * as vr from 'vreath'
import {new_obj} from '../../logic/work'
import * as data from '../../logic/data'
import bigInt from 'big-integer'
/*unit
  height:8 byte,
  index:1 byte,
  nonce,8 byte,
  address:40 byte,
  unit_price:10 byte
*/

export const post = async (msg:Buffer)=>{
    const unit:vr.Unit = JSON.parse(msg.toString('utf-8'));
    if(!vr.unit.isUnit(unit)) throw new Error('invalid data');
    const pulled = await vr.unit.get_info_from_unit(unit,data.block_db);
    const unit_address = pulled[1];
    const hash = pulled[2]
    const info:data.chain_info|null = await data.chain_info_db.read_obj("00");
    if(info==null) throw new Error("chain_info doesn't exist");
    const last_height = info.last_height;
    const root = await data.root_db.get(last_height,"hex");
    if(root==null) throw new Error("root doesn't exist");
    const trie = vr.data.trie_ins(data.trie_db,root);
    const unit_state:vr.State = await vr.data.read_from_trie(trie,data.state_db,unit_address,0,vr.state.create_state("0",vr.con.constant.unit,unit_address,"0"));
    if(!bigInt(hash,16).lesserOrEquals(vr.con.constant.pow_target) || unit_state.data.length!=0) throw new Error('invalid unit');
    await data.unit_db.write_obj(unit_address,unit);
    return 1;
}