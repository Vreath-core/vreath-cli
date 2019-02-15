import * as vr from 'vreath'
import {genesis_roots as roots, genesis_pub} from './state'


const gen_meta:vr.BlockMeta = {
    kind:'key',
    version:vr.con.constant.my_version,
    network_id:vr.con.constant.my_net_id,
    chain_id:vr.con.constant.my_chain_id,
    validator:vr.crypto.generate_address(vr.con.constant.native,genesis_pub),
    height:0,
    previoushash:vr.crypto.hash(''),
    timestamp:1545629491,
    pos_diff:vr.con.constant.def_pos_diff,
    validatorPub:[genesis_pub],
    stateroot:roots.stateroot,
    lockroot:roots.lockroot,
    tx_root:vr.crypto.hash(''),
    fee_sum:0,
    extra:'Vreath bring cryptocurrency to everyone.'
}

const gen_hash = vr.crypto.object_hash(gen_meta);
const gen_sign = 'c9e7c3ba9635d5a3a7550440053d0017c63cae89172777019a1797ee3d463bc834878ab06c5acd44195b1dd853f3a9e4eb888f98e6f83a4b79da135343c9df62'

export const genesis_block:vr.Block = {
    hash:gen_hash,
    validatorSign:[gen_sign],
    meta:gen_meta,
    txs:[],
    raws:[]
}