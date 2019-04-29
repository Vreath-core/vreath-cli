import * as vr from 'vreath'
import {genesis_pub} from './state'
import * as data from '../logic/data'

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
const gen_hash = vr.crypto.array2hash(vr.block.block_meta2array(gen_meta));
const gen_sign_data = '8c223f35f7f51687ef0bc97a13627888cc6babbc7ab778a54a8c53fa3c43435c2a8ab2a8f88b02699296ebe243d8894b80c8087f47c4a51a630ce4d09796d5e4'
const gen_recover_id = '00';
const gen_sign:vr.Sign = {
    data:gen_sign_data,
    v:gen_recover_id
}
export const genesis_block:vr.Block = {
    hash:gen_hash,
    signature:gen_sign,
    meta:gen_meta,
    txs:[]
}