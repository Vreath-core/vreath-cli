import * as vr from 'vreath'
import * as data from './data'
import * as P from 'p-iteration'
import * as math from 'mathjs'
import * as fs from 'fs'
import {promisify} from 'util'
import {cloneDeep} from 'lodash'

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

const choose_txs = async (pool:vr.Pool,L_Trie:Trie)=>{
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
    const sorted = not_same.slice().sort((a,b)=>{
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
            const key_block = vr.block.create_key_block(chain,pubs,stateroot,lockroot,extra,public_key,private_key);
            const StateData = await data.get_block_statedata(key_block,chain,S_Trie);
            if(!vr.block.verify_key_block(key_block,chain,stateroot,lockroot,StateData)) throw new Error('fail to create valid block');
            return key_block;
        }
        else{
            const txs = await choose_txs(pool,L_Trie)
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
                    if(tx.meta.kind==='request'&&!vr.tx.verify_req_tx(tx,false,s_data,l_data)) return result.concat(tx.hash)
                    else if(tx.meta.kind==='refresh'&&!vr.tx.verify_ref_tx(tx,chain,true,s_data,l_data)) return result.concat(tx.hash);
                    else return result;
                },[]);
                const pool:vr.Pool = JSON.parse(await promisify(fs.readFile)('./json/pool.json','utf-8'));
                const new_pool:vr.Pool = Object.keys(pool).filter(key=>invalid_tx_hashes.indexOf(key)===-1).reduce((res:vr.Pool,key)=>{
                    res[key] = pool[key];
                    return res;
                },{});
                await promisify(fs.writeFile)('./json/pool.json',JSON.stringify(new_pool,null, 4),'utf-8');
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

const get_nonce = (request:string,height:number,block_hash:string,refresher:string,output:string,unit_price:number)=>{
    try{
        let nonce = 0;
        setTimeout(()=>{
            throw new Error('fail to get valid nonce');
        },10000);
        while(!vr.tx.mining(request,height,block_hash,refresher,output,unit_price,nonce)){
            nonce ++;
        }
        return nonce;
    }
    catch(e){return -1}
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
        const computed = req_tx.meta.tokens.reduce((result:vr.State[],token)=>{
            const base_states = pre_StateData.filter(s=>s.kind==='state'&&s.token===token);
            if(token===vr.con.constant.native) return result.concat(vr.tx.native_contract(base_states,req_tx));
            else if(token===vr.con.constant.unit) return result.concat(vr.tx.unit_contract(pre_StateData,req_tx,chain));
            else return result;
        },[]);
        const success = !computed.some(s=>vr.state.verify_state(s));
        const output = (()=>{
            if(success) return computed;
            else return pre_StateData;
        })();
        const refresher = vr.crypto.genereate_address(vr.con.constant.unit,vr.crypto.merge_pub_keys(pubs));
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