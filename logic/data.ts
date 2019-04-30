import * as vr from 'vreath';
import * as path from 'path'

export const id = vr.con.constant.my_chain_id + vr.con.constant.my_net_id;

export const trie_db = new vr.db(path.join(__dirname,`../db/net_id_${id}/trie`));
export const state_db = new vr.db(path.join(__dirname,`../db/net_id_${id}/state`));
export const lock_db =  new vr.db(path.join(__dirname,`../db/net_id_${id}/lock`));
export const block_db = new vr.db(path.join(__dirname,`../db/net_id_${id}/block`));
export const chain_info_db = new vr.db(path.join(__dirname,`../db/net_id_${id}/chain_info`));
export const tx_db = new vr.db(path.join(__dirname,`../db/net_id_${id}/tx_pool`));
export const output_db = new vr.db(path.join(__dirname,`../db/net_id_${id}/output`));
export const root_db = new vr.db(path.join(__dirname,`../db/net_id_${id}/root`));
export const unit_db = new vr.db(path.join(__dirname,`../db/net_id_${id}/unit_store`));
export const peer_list_db = new vr.db(path.join(__dirname,`../db/net_id_${id}/peer_list`));


export type chain_info = {
    version:string;
    chain_id:string;
    net_id:string;
    compatible_version:string;
    last_height:string;
    last_hash:string;
}

/*export const get_tx_statedata = async (tx:vr.Tx,chain:vr.Block[],S_Trie:Trie)=>{
    try{
        const base = tx.meta.bases;
        const base_states:vr.State[] = await P.reduce(base, async (result:vr.State[],key:string)=>{
            const state = await read_state(S_Trie,key,vr.state.create_state(0,key,key.split(':')[1],0));
            return result.concat(state);
        },[]);
        const outputs = output_keys(tx);
        const output_states:vr.State[] = await P.reduce(outputs, async (result:vr.State[],key:string)=>{
            const hash:string = await S_Trie.get(key);
            const getted:vr.State = await read_obj_from_db(state_db,hash||'');
            const token = key.split(':')[1];
            if(hash==null||getted==null) return result.concat(vr.state.create_state(0,key,token,0));
            else return result.concat(getted);
        },[]);
        const payes = pays(tx,chain);
        const pay_states:vr.State[] = await P.reduce(payes, async (result:vr.State[],key:string)=>{
            const state = await read_state(S_Trie,key,vr.state.create_state(0,key,native,0));
            return result.concat(state);
        },[]);
        const concated = base_states.concat(output_states).concat(pay_states);
        const hashes = concated.map(state=>vr.crypto.object_hash(state));
        return concated.filter((val,i)=>hashes.indexOf(vr.crypto.object_hash(val))===i);
    }
    catch(e){
        return [];
    }
}

export const get_tx_lockdata = async (tx:vr.Tx,chain:vr.Block[],L_Trie:Trie)=>{
    try{
        const target = (()=>{
            if(tx.meta.kind==="request") return tx;
            else return vr.tx.find_req_tx(tx,chain);
        })();
        const keys = target.meta.bases.filter((val,i,array)=>array.indexOf(val)===i);
        const result:vr.Lock[] = await P.reduce(keys, async (array:vr.Lock[],key:string)=>{
            if(!vr.crypto.verify_address(key)) return array;
            const new_loc:vr.Lock = {
                address:key,
                state:'yet',
                height:0,
                block_hash:vr.crypto.hash(''),
                index:0,
                tx_hash:vr.crypto.hash('')
            }
            const lock = await read_lock(L_Trie,key,new_loc);
            return array.concat(lock);
        },[]);
        return result;
    }
    catch(e){
        console.log(e);
        return [];
    }
}

export const get_block_statedata = async (block:vr.Block,chain:vr.Block[],S_Trie:Trie)=>{
    try{
        const validatorPub = (()=>{
            if(block.meta.kind==='key') return block.meta.validatorPub;
            else return vr.block.search_key_block(chain).meta.validatorPub;
        })();
        const native_validator = vr.crypto.generate_address(native,vr.crypto.merge_pub_keys(validatorPub));
        const native_validator_state:vr.State = await read_state(S_Trie,native_validator,vr.state.create_state(0,native_validator,native));
        const txs = block.txs.map(tx=>vr.tx.pure2tx(tx,block));
        const tx_states:vr.State[] = await P.reduce(txs,async (result:vr.State[],tx:vr.Tx)=>result.concat(await get_tx_statedata(tx,chain,S_Trie)),[]);
        let all_units:vr.State[] = [];
        await S_Trie.filter(async (hash:string)=>{
            const state:vr.State =  await read_obj_from_db(state_db,hash);
            if(state!=null&&vr.state.isState(state)&&state.kind==="state"&&state.token===unit){
                all_units.push(state);
                return true;
            }
            else return false;
        });
        const pre_states = await (async ()=>{
            if(block.meta.kind==='micro') return [];
            const pre_key = vr.block.search_key_block(chain);
            const pre_micros = vr.block.search_micro_block(chain,pre_key);
            const empty_state_hash = vr.crypto.object_hash(vr.state.create_state());
            const pre_changed = await P.reduce(pre_micros, async (res:vr.State[],block)=>{
                const states = await P.map(block.txs,async tx=>await read_state(S_Trie,tx.meta.address,vr.state.create_state()));
                const concated = res.concat(states.filter(state=>vr.crypto.object_hash(state)!=empty_state_hash));
                const hashes = concated.map(state=>vr.crypto.object_hash(state));
                return concated.filter((val,i)=>hashes.indexOf(vr.crypto.object_hash(val))===i);
            },[]);
            return pre_changed;
        })();
        const native_token = await read_state(S_Trie,native,vr.state.create_info(0,native));
        const unit_token = await read_state(S_Trie,unit,vr.state.create_info(0,unit));
        const concated = tx_states.concat(native_validator_state).concat(all_units).concat(pre_states).concat(native_token).concat(unit_token);
        const hashes = concated.map(s=>vr.crypto.object_hash(s))
        return concated.filter((val,i)=>hashes.indexOf(vr.crypto.object_hash(val))===i);
    }
    catch(e){
        console.log(e);
        return []
    }
}

export const get_block_lockdata = async (block:vr.Block,chain:vr.Block[],L_Trie:Trie)=>{
    try{
        const txs = block.txs.map(tx=>vr.tx.pure2tx(tx,block));
        const tx_loc:vr.Lock[] = await P.reduce(txs,async (result:vr.Lock[],tx:vr.Tx)=>{
            return result.concat(await get_tx_lockdata(tx,chain,L_Trie))
        },[]);
        const validatorPub = (()=>{
            if(block.meta.kind==='key') return block.meta.validatorPub;
            else return vr.block.search_key_block(chain).meta.validatorPub;
        })()
        const native_address = vr.crypto.generate_address(native,vr.crypto.merge_pub_keys(validatorPub));
        const unit_address = vr.crypto.generate_address(unit,vr.crypto.merge_pub_keys(validatorPub))
        const native_validator:vr.Lock = await read_lock(L_Trie,native_address,{
            address:native_address,
            state:'yet',
            height:0,
            block_hash:vr.crypto.hash(''),
            index:0,
            tx_hash:vr.crypto.hash('')
        });
        const unit_validator:vr.Lock = await read_lock(L_Trie,unit_address,{
            address:unit_address,
            state:'yet',
            height:0,
            block_hash:vr.crypto.hash(''),
            index:0,
            tx_hash:vr.crypto.hash('')
        });
        const concated = tx_loc.concat(native_validator).concat(unit_validator).filter(lock=>lock!=null);
        const hashes = concated.map(l=>vr.crypto.object_hash(l));
        return concated.filter((val,i)=>hashes.indexOf(vr.crypto.object_hash(val))===i);
    }
    catch(e){
        console.log(e);
        return [];
    }
}*/
/*
export const get_native_balance = async (address:string,trie:vr.trie)=>{
    const state:vr.State = await vr.data.read_from_trie(trie,state_db,address,0,vr.state.create_state("0",vr.con.constant.native,address));
    return state.amount;
}

export const read_chain_info = async ()=>{
    const info:chain_info = await block_db.read_obj('info');
    if(info) return info;
    return {
        net_id:vr.con.constant.my_net_id,
        chain_id:vr.con.constant.my_chain_id,
        version:vr.con.constant.my_version,
        compatible_version:vr.con.constant.compatible_version,
        last_height:-1,
        last_hash:'',
        pos_diffs:[]
    }
}

export const write_chain_info = async (info:chain_info)=>{
    await block_db.write_obj('info',info);
}

export const read_chain = async (max_size:number)=>{
    const info:chain_info = await block_db.read_obj('info');
    let chain:vr.Block[] = [];
    let block:vr.Block;
    let size_sum:BigInteger = bigInt(0);
    let i:BigInteger = bigInt(info.last_height,16);
    for(i; !i.lesser(0); i=i.subtract(1)){
        block = await block_db.read_obj(i.toString(16));
        size_sum = size_sum.add(bigInt(vr.block.compute_block_size(block),16));
        if()
    }
    try{
        const pre_chain = share_data.chain;
        const info:chain_info = await read_obj_from_db(block_db,'info');
        if(pre_chain.length-1>=info.last_height&&pre_chain[pre_chain.length-1]!=null&&pre_chain[pre_chain.length-1].hash===info.last_hash){
            return pre_chain;
        }
        let chain:vr.Block[] = [];
        let block:vr.Block;
        let size_sum = 0;
        let i:number;
        for(i=info.last_height; i>=0; i--){
            block = await read_obj_from_db(block_db,i.toString());
            size_sum = math.chain(size_sum).add(Buffer.from(JSON.stringify(block)).length).done();
            if(pre_chain[info.last_height-i]!=null&&pre_chain[info.last_height-i].hash===block.hash){
                const reversed = chain.reverse()
                chain = pre_chain.concat(reversed);
                break;
            }
            if(size_sum>max_size){
                chain.reverse();
                break;
            }
            else chain.push(block);
            if(i===0){
                chain.reverse();
                break;
            }
        }
        return chain;
    }
    catch(e){
        throw new Error(e);
    }
}

export const write_chain = async (block:vr.Block)=>{
    try{
        const info:chain_info = await read_obj_from_db(block_db,'info');
        const height = block.meta.height;
        const new_info = new_obj(
            info,
            i=>{
                i.last_height = height;
                i.last_hash = block.hash;
                i.pos_diffs.push(block.meta.pos_diff);
                return i;
            }
        )
        await write_obj_to_db(block_db,height.toString(),block);
        await write_obj_to_db(block_db,'info',new_info);
        share_data.chain.push(block);
    }
    catch(e){
        throw new Error(e);
    }
}

export const back_chain = async (height:number)=>{
    try{
        if(share_data.chain.length-1===height) return 0;
        const info:chain_info = await read_obj_from_db(block_db,'info');
        let i:number;
        for(i=height+1; i<=info.last_height; i++){
            try{
                await del_obj_from_db(block_db,i.toString());
            }
            catch(e){
                continue;
            }
        }
        const backed_chain = share_data.chain.slice(0,height+1);
        const new_info = new_obj(info,info=>{
            const last_block = backed_chain[backed_chain.length-1] || genesis_block
            info.last_height = height;
            info.last_hash = last_block.hash;
            info.pos_diffs = info.pos_diffs.slice(0,height+1);
            return info;
        });
        await write_obj_to_db(block_db,'info',new_info);
        const post_block = share_data.chain[height+1];
        const new_roots = {
            stateroot:post_block.meta.stateroot,
            lockroot:post_block.meta.lockroot
        }
        await write_obj_to_db(root_db,'root',new_roots);
        share_data.chain = backed_chain;
        return 1;
    }
    catch(e){
        throw new Error(e);
    }
}

export const reset_chain = async ()=>{
    try{
        const info = await read_chain_info().catch(e=>{
            return {
                net_id:vr.con.constant.my_net_id,
                chain_id:vr.con.constant.my_chain_id,
                version:vr.con.constant.my_version,
                compatible_version:vr.con.constant.compatible_version,
                last_height:-1,
                last_hash:'',
                pos_diffs:[]
            }
        });
        let i:number;
        for(i=0; i<=info.last_height; i++){
            await del_obj_from_db(block_db,i.toString());
        }
    }
    catch(e){
        throw new Error(e);
    }
}


export const read_pool = async (max_size:number)=>{
    try{
        const mem_pool = share_data.pool;
        let txnames:string[] = [];
        let reader = aw.createReader(tx_db.createKeyStream());
        let name:string = '';
        while(null !== (name=await reader.readAsync())){
            txnames.push(name.toString());
        }
        let size = 0;
        let tx:vr.Tx;
        let pool:vr.Pool = {};
        for(name of txnames){
            if(mem_pool[name]!=null){
                pool[name] = mem_pool[name];
                continue;
            }
            tx = await read_obj_from_db(tx_db,name);
            if(size+Buffer.from(JSON.stringify(tx)).length>max_size) break;
            pool[tx.hash] = tx;
        }
        return pool;
    }
    catch(e){
        throw new Error(e);
    }
}

export const write_pool = async (pool:vr.Pool)=>{
    try{
        let txnames:string[] = [];
        let reader = aw.createReader(tx_db.createKeyStream());
        let name:string = '';
        while(null !== (name=await reader.readAsync())){
            txnames.push(name.toString());
        }
        const tx_names = Object.keys(pool);
        const for_save = tx_names.filter(name=>txnames.indexOf(name)===-1);
        const for_del = txnames.filter(name=>tx_names.indexOf(name)===-1);
        let tx:vr.Tx;
        for(name of txnames){
            if(for_del.indexOf(name)!=-1){
                delete share_data.pool[name];
                await del_obj_from_db(tx_db,name);
            }
        }
        for(name of tx_names){
            if(for_save.indexOf(name)!=-1){
                tx = pool[name];
                share_data.pool[name] = tx;
                await write_obj_to_db(tx_db,name,tx);
            }
        }
    }
    catch(e){
        throw new Error(e);
    }
}

export const empty_pool = async ()=>{
    try{
        let txnames:string[] = [];
        let reader = aw.createReader(tx_db.createKeyStream());
        let name:string = '';
        while(null !== (name=await reader.readAsync())){
            txnames.push(name.toString());
        }
        for(name of txnames){
            await del_obj_from_db(tx_db,name);
        }
    }
    catch(e){
        throw new Error(e);
    }
}

export const read_root = async ()=>{
    try{
        const roots:{stateroot:string,lockroot:string} = await read_obj_from_db(root_db,'root');
        return roots;
    }
    catch(e){
        throw new Error(e);
    }
}

export const write_root = async (roots:{stateroot:string,lockroot:string})=>{
    try{
        await write_obj_to_db(root_db,'root',roots);
    }
    catch(e){
        throw new Error(e);
    }
}

export const read_unit = async (key:string)=>{
    try{
        return await read_obj_from_db(unit_db,key);
    }
    catch(e){
        throw new Error(e);
    }
}

export const write_unit = async (unit:vr.Unit)=>{
    try{
        const iden_hash = vr.crypto.hash(unit.request+unit.height.toString(16)+unit.block_hash+unit.address);
        await write_obj_to_db(unit_db,iden_hash,unit);
    }
    catch(e){
        throw new Error(e);
    }
}

export const del_unit = async (unit:vr.Unit)=>{
    try{
        const iden_hash = vr.crypto.hash(unit.request+unit.height.toString(16)+unit.block_hash+unit.address);
        await del_obj_from_db(unit_db,iden_hash);
    }
    catch(e){
        throw new Error(e);
    }
}

export const get_unit_store = async ()=>{
    try{
        let store:{[key:string]:vr.Unit} = {};
        let reader = aw.createReader(unit_db.createReadStream());
        let data:{key:string,value:vr.Unit};
        while(null !== (data=await reader.readAsync())){
            store[data.key.toString()] = JSON.parse(data.value.toString());
        }
        return store;
    }
    catch(e){
        throw new Error(e);
    }
}

export const read_peer = async (ip:string)=>{
    try{
        return await read_obj_from_db(peer_list_db,ip);
    }
    catch(e){
        throw new Error(e);
    }
}

export const write_peer = async (peer:peer)=>{
    try{
        await write_obj_to_db(peer_list_db,peer.ip,peer);
    }
    catch(e){
        throw new Error(e);
    }
}

export const del_peer = async (ip:string)=>{
    try{
        await del_obj_from_db(peer_list_db,ip);
    }
    catch(e){
        throw new Error(e);
    }
}

export const get_peer_list = async ()=>{
    try{
        let list:peer[] = [];
        let reader = aw.createReader(peer_list_db.createReadStream());
        let data:{key:string,value:peer};
        while(null !== (data=await reader.readAsync())){
            list.push(JSON.parse(data.value.toString()));
        }
        return list;
    }
    catch(e){
        throw new Error(e);
    }
}*/