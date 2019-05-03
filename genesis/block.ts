import * as vr from 'vreath'
import bigInt from 'big-integer'

const gen_meta:vr.BlockMeta = {
    kind:0,
    height:"00",
    previoushash:vr.crypto.get_sha256(''),
    timestamp:1545629491,
    pos_diff:vr.con.constant.one_hex,
    trie_root:vr.crypto.get_sha256(''),
    tx_root:vr.crypto.get_sha256(''),
    fee_sum:"00",
    extra:Buffer.from("Vreath bring cryptocurrency to everyone.").toString('hex')
}
const id = vr.con.constant.my_version+vr.con.constant.my_chain_id+vr.con.constant.my_net_id;
const meta_array = vr.block.block_meta2array(gen_meta).concat(id);
const gen_sign_data = '4586cb3b9f32c88b4b2caf49bf15f55c6c075d1596575cfa97658ca25256d2071bb9fab6b8cdc701abc0f7d328e0bce472a2a86ca3d9920eba6e768a47714f9d'
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