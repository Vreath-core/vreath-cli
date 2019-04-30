import * as vr from 'vreath'
import {genesis_pub} from './state'
import * as data from '../logic/data'
import bigInt from 'big-integer'

const gen_meta:vr.BlockMeta = {
    kind:0,
    height:"00",
    previoushash:vr.crypto.get_sha256(''),
    timestamp:1545629491,
    pos_diff:vr.con.constant.def_pos_diff.toString(16),
    trie_root:vr.crypto.get_sha256(''),
    tx_root:vr.crypto.get_sha256(''),
    fee_sum:"00",
    extra:Buffer.from("Vreath bring cryptocurrency to everyone.").toString('hex')
}
const id = vr.con.constant.my_version+vr.con.constant.my_chain_id+vr.con.constant.my_net_id;
const meta_array = vr.block.block_meta2array(gen_meta).concat(id);
const gen_sign_data = '00a1cf887f528f063a0ec9bd72d2fbea67e5e635b9cea5dbe18529256dec674f6cf5b8a33ff4ac438d3b60a051e4910063c9872926a5d17ba35d362e464b2261'
const gen_recover_id = '01';
const gen_v = vr.crypto.bigint2hex(bigInt(id,16).multiply(2).add(8).add(bigInt(28).subtract(bigInt(gen_recover_id,16))));
const gen_sign:vr.Sign = {
    data:gen_sign_data,
    v:gen_v
}
const all_array = meta_array.concat(gen_sign.v);
const gen_hash = vr.crypto.array2hash(all_array);
export const genesis_block:vr.Block = {
    hash:gen_hash,
    signature:gen_sign,
    meta:gen_meta,
    txs:[]
}