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
const gen_sign = '8acf304c2d3f387ce87df9f8919094c0a38b2a00aa09749511d8303929c0e6c871de9e54ad1e236957647ae0a0afd39080029a0bbd828dfbcbe86ab7a27b96d1'


export const genesis_block:vr.Block = {
    hash:gen_hash,
    validatorSign:[gen_sign],
    meta:gen_meta,
    txs:[],
    raws:[]
}
