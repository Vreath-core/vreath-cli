import * as vr from 'vreath'
export const genesis_pub = '02395a2f9ac5de9cb1c3843b161d1d41234d3c45af5f7e8c4d5c5b3e7081d1cb92';
const genesis_unit_address = vr.crypto.generate_address(vr.con.constant.unit,genesis_pub);
export const genesis_state:vr.State[] = [vr.state.create_state("00",vr.con.constant.unit,genesis_unit_address,"01",["01","00"])];
export const genesis_token:vr.Token[] = [vr.state.create_token("00",vr.con.constant.native),vr.state.create_token("00",vr.con.constant.unit,"01")];
export const genesis_lock:vr.Lock[] = [vr.lock.create_lock(genesis_unit_address,0,"00",vr.crypto.get_sha256(''),0,vr.crypto.get_sha256(''),)];
