import levelup from 'levelup'
import leveljs from 'level-js'
import * as P from 'p-iteration'
import * as vs from 'vreath'

const native = vs.con.constant.native;
const unit = vs.con.constant.unit;

const state_db = levelup(leveljs('state_trie'));
const lock_db = levelup(leveljs('lock_trie'));

class Trie extends vs.trie{}

export const state_trie_ins = (root:string)=>{
    try{
        return new vs.trie(state_db,root);
    }
    catch(e){
        console.log(e);
        return new vs.trie(state_db);
    }
}

export const lock_trie_ins = (root:string)=>{
    try{
        return new vs.trie(lock_db,root);
    }
    catch(e){
        console.log(e);
        return new vs.trie(lock_db);
    }
}

const output_keys = (tx:vs.Tx)=>{
    if(tx.meta.kind==="request") return [];
    const states:vs.State[] = tx.raw.raw.map(r=>JSON.parse(r));
    return states.map(s=>s.owner);
}

const pays = (tx:vs.Tx,chain:vs.Block[])=>{
    if(tx.meta.kind==="request"){
        const requester = vs.crypto.genereate_address(native,vs.crypto.merge_pub_keys(tx.meta.pub_key));
        return [requester];
    }
    else if(tx.meta.kind==="refresh"){
        const req_tx = vs.tx.find_req_tx(tx,chain);
        const requester = vs.crypto.genereate_address(native,vs.crypto.merge_pub_keys(req_tx.meta.pub_key));
        const refresher = vs.crypto.genereate_address(native,vs.crypto.merge_pub_keys(tx.meta.pub_key));
        return [requester,refresher];
    }
    else return [];
}

export const get_tx_statedata = async (tx:vs.Tx,chain:vs.Block[],S_Trie:Trie)=>{
    try{
        const base = tx.meta.bases;
        const base_states:vs.State[] = await P.reduce(base, async (result:vs.State[],key:string)=>{
            const getted:vs.State = await S_Trie.get(key);
            if(getted==null) return result;
            else return result.concat(getted);
        },[]);
        const outputs = output_keys(tx);
        const output_states:vs.State[] = await P.reduce(outputs, async (result:vs.State[],key:string)=>{
            const getted:vs.State = await S_Trie.get(key);
            const token = key.split(':')[1];
            if(getted==null) return result.concat(vs.state.create_state(0,key,token,0));
            else return result.concat(getted);
        },[]);
        const payes = pays(tx,chain);
        const pay_states:vs.State[] = await P.reduce(payes, async (result:vs.State[],key:string)=>{
            const getted:vs.State = await S_Trie.get(key);
            if(getted==null) return result.concat(vs.state.create_state(0,key,native,0));
            else return result.concat(getted);
        },[]);
        const concated = base_states.concat(output_states).concat(pay_states);
        const hashes = concated.map(state=>vs.crypto.object_hash(state));
        return concated.filter((val,i)=>hashes.indexOf(vs.crypto.object_hash(val))===i);
    }
    catch(e){
        console.log(e);
        return [];
    }
}

export const get_tx_lockdata = async (tx:vs.Tx,chain:vs.Block[],L_Trie:Trie)=>{
    try{
        const target = (()=>{
            if(tx.meta.kind==="request") return tx;
            else return vs.tx.find_req_tx(tx,chain);
        })();
        const keys = target.meta.bases.filter((val,i,array)=>array.indexOf(val)===i);
        const result:vs.Lock[] = await P.reduce(keys, async (array:vs.Lock[],key:string)=>{
            if(vs.crypto.verify_address(key)) return array;
            const getted:vs.Lock = await L_Trie.get(key);
            if(getted==null){
                const new_loc:vs.Lock = {
                    address:key,
                    state:'yet',
                    height:0,
                    block_hash:'',
                    index:0,
                    tx_hash:''
                }
                return array.concat(new_loc);
            }
            else return array.concat(getted);
        },[]);
        return result;
    }
    catch(e){
        console.log(e);
        return [];
    }
}

export const get_block_statedata = async (block:vs.Block,chain:vs.Block[],S_Trie:Trie)=>{
    try{
        const native_validator = vs.crypto.genereate_address(native,vs.crypto.merge_pub_keys(block.meta.validatorPub));
        const native_validator_state:vs.State = await S_Trie.get(native_validator) || vs.state.create_state(0,native_validator,native);
        const txs = block.txs.map(tx=>vs.tx.pure2tx(tx,block));
        const tx_states:vs.State[] = await P.reduce(txs,async (result:vs.State[],tx:vs.Tx)=>result.concat(await get_tx_statedata(tx,chain,S_Trie)),[]);
        const unit_gets_obj:{[key:string]:vs.State} = await S_Trie.filter((key,state:vs.State)=>vs.state.isState(state)&&state.kind==="state"&&state.token===unit);
        const all_units = Object.keys(unit_gets_obj).map(key=>unit_gets_obj[key]);
        const native_token = await S_Trie.get(native) || vs.state.create_info(0,native);
        const unit_token = await S_Trie.get(unit) || vs.state.create_info(0,unit);
        const concated = tx_states.concat(native_validator_state).concat(all_units).concat(native_token).concat(unit_token);
        const hashes = concated.map(s=>vs.crypto.object_hash(s))
        return concated.filter((val,i)=>hashes.indexOf(vs.crypto.object_hash(val))===i);
    }
    catch(e){
        console.log(e);
        return []
    }
}

export const get_block_lockdata = async (block:vs.Block,chain:vs.Block[],L_Trie:Trie)=>{
    try{
        const txs = block.txs.map(tx=>vs.tx.pure2tx(tx,block));
        const tx_loc:vs.Lock[] = await P.reduce(txs,async (result:vs.Lock[],tx:vs.Tx)=>result.concat(await get_tx_lockdata(tx,chain,L_Trie)),[]);
        const native_validator:vs.Lock = await L_Trie.get(vs.crypto.genereate_address(native,vs.crypto.merge_pub_keys(block.meta.validatorPub)));
        const unit_validator:vs.Lock = await L_Trie.get(vs.crypto.genereate_address(unit,vs.crypto.merge_pub_keys(block.meta.validatorPub)));
        const concated = tx_loc.concat(native_validator).concat(unit_validator).filter(lock=>lock!=null);
        const hashes = concated.map(l=>vs.crypto.object_hash(l));
        return concated.filter((val,i)=>hashes.indexOf(vs.crypto.object_hash(val))===i);
    }
    catch(e){
        console.log(e);
        return [];
    }
}

