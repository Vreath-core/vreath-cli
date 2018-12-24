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
    timestamp:1545629491469,
    pos_diff:vr.con.constant.def_pos_diff,
    validatorPub:[genesis_pub],
    stateroot:roots.stateroot,
    lockroot:roots.lockroot,
    tx_root:vr.crypto.hash(''),
    fee_sum:0,
    extra:'Vreath bring cryptocurrency to everyone.'
}

const gen_hash = vr.crypto.object_hash(gen_meta);
const gen_sign = '902683e69a80185af0b3d1d001a0894970e9d5351b12b1143bff9e991637eef4609ac1ab4fbba1040febfe29d983afeebf0a14b50e1370eccc1065bc69ec1779'
console.log(gen_sign);

export const genesis_block:vr.Block = {
    hash:gen_hash,
    validatorSign:[gen_sign],
    meta:gen_meta,
    txs:[],
    raws:[]
}
console.log(genesis_block)
