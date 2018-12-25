import * as vr from 'vreath'
import {genesis_roots as roots, genesis_pub} from './state'


const gen_meta:vr.BlockMeta = {
    kind:'key',
    version:vr.con.constant.my_version,
    network_id:vr.con.constant.my_net_id,
    chain_id:vr.con.constant.my_chain_id,
    validator:vr.crypto.genereate_address(vr.con.constant.native,genesis_pub),
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
const gen_sign = '8762f2d1162be7a24389ba1c45b46f6ca969da31e5bf4c4a6a2608e311b012d96c3fa4ca4991ac90c193e3f5ac6bc1d36547c6bf1bd15645d182b1e2d175b3b4';


export const genesis_block:vr.Block = {
    hash:gen_hash,
    validatorSign:[gen_sign],
    meta:gen_meta,
    txs:[],
    raws:[]
}
