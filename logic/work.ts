import * as vr from 'vreath'
import * as data from './data'
import * as P from 'p-iteration'
import * as math from 'mathjs'
import * as fs from 'fs'
import {promisify} from 'util'
import {cloneDeep} from 'lodash'
import share_data from '../json/share_data';
import { genesis_block } from '../genesis/block';

math.config({
  number: 'BigNumber'
});

class Trie extends vr.trie{}

export const sleep = (msec:number)=>{
    return new Promise(function(resolve) {
        setTimeout(function() {resolve()}, msec);
     });
}

export const copy = <T>(data:T)=>{
  return cloneDeep(data);
}


export const new_obj = <T>(obj:T,fn:(obj:T)=>T)=>{
  return fn(copy(obj));
}

export type chain_info = {
    net_id:number;
    chain_id:number;
    version:number;
    compatible_version:number;
    last_height:number;
    last_hash:string;
    pos_diffs:number[];
}

export const read_chain = async (max_size:number)=>{
    try{
        const net_id = vr.con.constant.my_net_id;
        const pre_chain = share_data.chain;
        const info:chain_info = JSON.parse((await promisify(fs.readFile)('./json/chain/net_id_'+net_id.toString()+'/info.json','utf-8')));
        if(pre_chain.length-1>=info.last_height&&pre_chain[pre_chain.length-1]!=null&&pre_chain[pre_chain.length-1].hash===info.last_hash){
            return pre_chain;
        }
        let chain:vr.Block[] = [];
        let block:vr.Block;
        let size_sum = 0;
        let i:number;
        for(i=info.last_height; i>=0; i--){
            block = JSON.parse(await promisify(fs.readFile)('./json/chain/net_id_'+net_id.toString()+'/block_'+i.toString()+'.json','utf-8'));
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
        const net_id = vr.con.constant.my_net_id;
        const info:chain_info = JSON.parse((await promisify(fs.readFile)('./json/chain/net_id_'+net_id.toString()+'/info.json','utf-8')));
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
        await promisify(fs.writeFile)('./json/chain/net_id_'+net_id.toString()+'/block_'+height.toString()+'.json',JSON.stringify(block,null, 4),'utf-8');
        await promisify(fs.writeFile)('./json/chain/net_id_'+net_id.toString()+'/info.json',JSON.stringify(new_info,null, 4),'utf-8');
        share_data.chain.push(block);
    }
    catch(e){
        throw new Error(e);
    }
}

export const back_chain = async (height:number)=>{
    try{
        if(share_data.chain.length-1===height) return 0;
        const net_id = vr.con.constant.my_net_id;
        const info:chain_info = JSON.parse((await promisify(fs.readFile)('./json/chain/net_id_'+net_id.toString()+'/info.json','utf-8')));
        let i:number;
        for(i=height+1; i<=info.last_height; i++){
            try{
                await promisify(fs.unlink)('./json/chain/net_id_'+net_id.toString()+'/block_'+i.toString()+'.json');
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
        await promisify(fs.writeFile)('./json/chain/net_id_'+net_id.toString()+'/info.json',JSON.stringify(new_info,null, 4),'utf-8');
        const post_block = share_data.chain[height+1];
        const new_roots = {
            stateroot:post_block.meta.stateroot,
            lockroot:post_block.meta.lockroot
        }
        await promisify(fs.writeFile)('./json/root.json',JSON.stringify(new_roots,null, 4),'utf-8');
        share_data.chain = backed_chain;
        return 1;
    }
    catch(e){
        throw new Error(e);
    }
}

export const read_pool = async (max_size:number)=>{
    try{
        const filenames = await promisify(fs.readdir)('./json/pool','utf8') || [];
        let size = 0;
        let name:string;
        let tx:vr.Tx;
        let pool:vr.Pool = {};
        for(name of filenames){
            tx = JSON.parse(await promisify(fs.readFile)('./json/pool/'+name,'utf-8'));
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
        const filenames = await promisify(fs.readdir)('./json/pool','utf8') || [];
        const tx_names = Object.keys(pool);
        const for_save = tx_names.filter(name=>filenames.indexOf(name+'.json')===-1);
        const for_del = filenames.filter(name=>tx_names.indexOf(name+'.json')===-1);
        let name:string;
        let file_name:string;
        let tx:vr.Tx;
        for(name of filenames){
            if(for_del.indexOf(name)!=-1) await promisify(fs.unlink)('./json/pool/'+name);
        }
        for(name of tx_names){
            file_name = name+'.json';
            if(for_save.indexOf(name)!=-1){
                tx = pool[name];
                await promisify(fs.writeFile)('./json/pool/'+file_name,JSON.stringify(tx,null,4),'utf-8');
            }
        }
    }
    catch(e){
        throw new Error(e);
    }
}


const choose_txs = async (unit_mode:boolean,pool:vr.Pool,L_Trie:Trie)=>{
    const pool_txs:vr.Tx[] = Object.keys(pool).map(key=>pool[key]);
    const requested_bases:string[] = (await L_Trie.filter((val:vr.Lock)=>{
        const getted:vr.Lock = val;
        if(getted!=null&&getted.state==="already") return true;
        else return false;
    })).map(l=>l.address);
    const not_same = pool_txs.reduce((result:vr.Tx[],tx)=>{
        const bases = result.reduce((r:string[],t)=>{
            if(t.meta.kind==="request") return r.concat(t.meta.bases);
            else return r;
        },requested_bases);
        const requests = result.reduce((r:string[],t)=>{
            if(t.meta.kind==="refresh") return r.concat(t.meta.req_tx_hash);
            else return r;
        },[]);
        if(tx.meta.kind==="request"&&!bases.some(b=>tx.meta.bases.indexOf(b)!=-1)) return result.concat(tx);
        else if(tx.meta.kind==="refresh"&&requests.indexOf(tx.meta.req_tx_hash)===-1) return result.concat(tx);
        else return result;
    },[]);
    let size_sum = 0;
    const unit_prioritized = not_same.filter(tx=>{
        if(unit_mode){
            return tx.meta.kind==='refresh'||vr.crypto.object_hash(tx.meta.bases)===vr.crypto.object_hash([vr.con.constant.unit,vr.con.constant.native])
        }
        else{
            return tx.meta.kind==='refresh'||vr.crypto.object_hash(tx.meta.bases)!=vr.crypto.object_hash([vr.con.constant.unit,vr.con.constant.native])
        }
    });
    const sorted = unit_prioritized.slice().sort((a,b)=>{
        return math.chain(vr.tx.get_tx_fee(b)).subtract(vr.tx.get_tx_fee(a)).done();
    });
    const choosed = sorted.reduce((txs:vr.Tx[],tx)=>{
        if(math.chain(vr.con.constant.block_size).multiply(0.9).smaller(size_sum).done() as boolean) return txs;
        size_sum = math.chain(size_sum).add(Buffer.from(JSON.stringify(tx)).length).done();
        return txs.concat(tx);
    },[]);
    return choosed;
}


export const make_block = async (chain:vr.Block[],pubs:string[],stateroot:string,lockroot:string,extra:string,pool:vr.Pool,private_key:string,public_key:string,S_Trie:Trie,L_Trie:Trie)=>{
    try{
        const pre_key_block = vr.block.search_key_block(chain);
        const pre_micro_blocks = vr.block.search_micro_block(chain,pre_key_block);
        if(vr.crypto.merge_pub_keys(pre_key_block.meta.validatorPub)!=vr.crypto.merge_pub_keys(pubs)||pre_micro_blocks.length>=vr.con.constant.max_blocks){
            const key_block = vr.block.create_key_block(chain,pubs,stateroot,lockroot,extra,private_key,public_key);
            const StateData = await data.get_block_statedata(key_block,chain,S_Trie);
            if(!vr.block.verify_key_block(key_block,chain,stateroot,lockroot,StateData)) throw new Error('fail to create valid block');
            return key_block;
        }
        else{
            const unit_mode = (chain.length-1)%10 === 0;
            const txs = await choose_txs(unit_mode,pool,L_Trie)
            const created_micro_block = vr.block.create_micro_block(chain,stateroot,lockroot,txs,extra,private_key,public_key);
            const txs_hash = txs.map(tx=>tx.hash);
            const micro_block = new_obj(
                created_micro_block,
                block=>{
                    block.txs.forEach(tx=>{
                        tx.additional.hash = created_micro_block.hash;
                        tx.additional.height = created_micro_block.meta.height;
                        tx.additional.index = txs_hash.indexOf(tx.hash);
                    });
                    return block;
                }
            );
            const StateData = await data.get_block_statedata(micro_block,chain,S_Trie);
            const LockData = await data.get_block_lockdata(micro_block,chain,L_Trie);
            if(!vr.block.verify_micro_block(micro_block,chain,stateroot,lockroot,StateData,LockData)){
                const invalid_tx_hashes = await P.reduce(micro_block.txs, async (result:string[],pure)=>{
                    const tx = vr.tx.pure2tx(pure,micro_block);
                    const s_data = await data.get_tx_statedata(tx,chain,S_Trie);
                    const l_data = await data.get_tx_lockdata(tx,chain,L_Trie);
                    if(tx.meta.kind==='request'&&!vr.tx.verify_req_tx(tx,false,s_data,l_data)){
                        console.log(tx);
                        return result.concat(tx.hash)
                    }
                    else if(tx.meta.kind==='refresh'&&!vr.tx.verify_ref_tx(tx,chain,true,s_data,l_data))return result.concat(tx.hash);
                    else return result;
                },[]);
                const pool:vr.Pool = await read_pool(10**9);
                const new_pool:vr.Pool = Object.keys(pool).filter(key=>invalid_tx_hashes.indexOf(key)===-1).reduce((res:vr.Pool,key)=>{
                    res[key] = pool[key];
                    return res;
                },{});
                await write_pool(new_pool);
                throw new Error('remove invalid txs');
            }
            return micro_block;
        }
    }
    catch(e){
        throw new Error(e);
    }
}

export const make_req_tx = async (pubs:string[],type:vr.TxType,tokens:string[],bases:string[],feeprice:number,gas:number,input_raw:string[],log:string,private_key:string,public_key:string,chain:vr.Block[],S_Trie:Trie,L_Trie:Trie):Promise<vr.Tx>=>{
    try{
        if(tokens.some(t=>t!=vr.con.constant.native&&t!=vr.con.constant.unit)) throw new Error('unsupported token');
        const tx = vr.tx.create_req_tx(pubs,type,tokens,bases,feeprice,gas,input_raw,log,private_key,public_key);
        const StateData = await data.get_tx_statedata(tx,chain,S_Trie);
        const LockData = await data.get_tx_lockdata(tx,chain,L_Trie);
        if(!vr.tx.verify_req_tx(tx,true,StateData,LockData)) throw new Error('fail to create valid request tx');
        return tx;
    }
    catch(e){
        throw new Error(e);
    }
}
export const compute_output = (req_tx:vr.Tx,StateData:vr.State[],chain:vr.Block[])=>{
    try{
        const computed = (()=>{
            const main_token = req_tx.meta.tokens[0];
            const pre_StateData_keys = StateData.map(s=>s.owner);
            const base_states = req_tx.meta.bases.map(key=>StateData[pre_StateData_keys.indexOf(key)]||vr.state.create_state(0,key,key.split(':')[1],0,{}));
            if(main_token===vr.con.constant.native) return vr.tx.native_contract(base_states,req_tx);
            else if(main_token===vr.con.constant.unit) return vr.tx.unit_contract(base_states,req_tx,chain);
            else return base_states;
        })();
        const success = !computed.some(s=>vr.state.verify_state(s));
        if(success) return computed;
        else return StateData;
    }
    catch(e){
        throw new Error(e);
    }
}

export const get_nonce = (request:string,height:number,block_hash:string,refresher:string,output:string,unit_price:number)=>{
    let nonce = 0;
    let flag = true;
    setTimeout(()=>{
        nonce = -1;
        flag = false;
    },10000);
    while(flag&&!vr.tx.mining(request,height,block_hash,refresher,output,unit_price,nonce)){
        nonce ++;
    }
    return nonce;
}

export const make_ref_tx = async (pubs:string[],feeprice:number,unit_price:number,height:number,index:number,log:string,private_key:string,public_key:string,chain:vr.Block[],S_Trie:Trie,L_Trie:Trie):Promise<vr.Tx>=>{
    try{
        const target_block = chain[height]||vr.block.empty_block;
        const req_tx_pure = target_block.txs[index] || vr.tx.empty_tx;
        const req_tx = vr.tx.pure2tx(req_tx_pure,target_block);
        const pre_StateData = await P.reduce(req_tx.meta.bases, async (result:vr.State[],key:string)=>{
            const getted:vr.State = await S_Trie.get(key);
            if(getted==null) return result;
            else return result.concat(getted);
        },[]);
        const computed = (()=>{
            const main_token = req_tx.meta.tokens[0];
            const pre_StateData_keys = pre_StateData.map(s=>s.owner);
            const base_states = req_tx.meta.bases.map(key=>pre_StateData[pre_StateData_keys.indexOf(key)]||vr.state.create_state(0,key,key.split(':')[1],0,{}));
            if(main_token===vr.con.constant.native) return vr.tx.native_contract(base_states,req_tx);
            else if(main_token===vr.con.constant.unit) return vr.tx.unit_contract(base_states,req_tx,chain);
            else return base_states;
        })();
        const success = !computed.some(s=>!vr.state.verify_state(s));
        const output = (()=>{
            if(success) return computed;
            else return pre_StateData;
        })();
        const refresher = vr.crypto.generate_address(vr.con.constant.unit,vr.crypto.merge_pub_keys(pubs));
        const nonce = get_nonce(req_tx.hash,height,target_block.hash,refresher,vr.crypto.object_hash(output),unit_price);
        if(nonce===-1) throw new Error('fail to get valid nonce')
        const tx = vr.tx.create_ref_tx(pubs,feeprice,unit_price,height,target_block.hash,index,req_tx_pure.hash,success,nonce,output.map(s=>JSON.stringify(s)),log,private_key,public_key);
        const StateData = await data.get_tx_statedata(tx,chain,S_Trie);
        const LockData = await data.get_tx_lockdata(tx,chain,L_Trie);
        if(!vr.tx.verify_ref_tx(tx,chain,true,StateData,LockData)) throw new Error('fail to create valid refresh tx');
        return tx;
    }
    catch(e){
        throw new Error(e);
    }
}