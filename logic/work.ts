import * as vr from 'vreath'
import * as data from './data'
import * as P from 'p-iteration'
import * as math from 'mathjs'
import * as fs from 'fs'
import {promisify} from 'util'

math.config({
  number: 'BigNumber'
});

class Trie extends vr.trie{}

export const sleep = (msec:number)=>{
    return new Promise(function(resolve) {
        setTimeout(function() {resolve()}, msec);
     });
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


export const make_blocks = async (chain:vr.Block[],my_pubs:string[],stateroot:string,lockroot:string,extra:string,pool:vr.Pool,private_key:string,public_key:string,S_Trie:Trie,L_Trie:Trie)=>{
    try{
        const pre_key_block = vr.block.search_key_block(chain);
        const pre_micro_blocks = vr.block.search_micro_block(chain,pre_key_block);
        if(vr.crypto.merge_pub_keys(pre_key_block.meta.validatorPub)!=vr.crypto.merge_pub_keys(my_pubs)||pre_micro_blocks.length>=vr.con.constant.max_blocks){
            const key_block = vr.block.create_key_block(chain,my_pubs,stateroot,lockroot,extra,public_key,private_key);
            const StateData = await data.get_block_statedata(key_block,chain,S_Trie);
            if(!vr.block.verify_key_block(key_block,chain,stateroot,lockroot,StateData)) throw new Error('fail to create valid block');
            return key_block;
        }
        else{
            const txs = await choose_txs(pool,L_Trie);
            const micro_block = vr.block.create_micro_block(chain,stateroot,lockroot,txs,extra,private_key,public_key);
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