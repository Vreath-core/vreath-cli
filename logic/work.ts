import * as vr from 'vreath'
import * as P from 'p-iteration'
import bigInt, {BigInteger} from 'big-integer';
import BigNumber from "bignumber.js"
import {cloneDeep} from 'lodash'
import * as data from './data'
import req_tx_com from '../app/repl/request-tx'
import * as block_routes from '../app/routes/block'
import {promisify} from 'util'
import bunyan from 'bunyan'
import {Node} from '../commands/run'
const toStream = require('pull-stream-to-stream');
const PeerId = require('peer-id');
const PeerInfo = require('peer-info');
const pull = require('pull-stream');

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


//my_address is the validator's unit address
const choose_txs = async (unit_mode:boolean,trie:vr.trie,pool_db:vr.db,lock_db:vr.db,block_db:vr.db,my_address:string)=>{
    let requested_bases:string[] = [];
    let requested_tx_hashes:string[] = [];
    let choosed:vr.Tx[] = [];
    const txs:vr.Tx[] = await pool_db.filter();
    let tx:vr.Tx;
    for(tx of txs){
        if(tx.meta.kind===0){
            const requested_check = await P.some(tx.meta.request.bases, async (base:string)=>{
                if(requested_bases.indexOf(base)!=-1) return true;
                const lock = await vr.data.read_from_trie(trie,lock_db,base,1,vr.lock.create_lock(base));
                return lock.state===1;
            });
            if(!requested_check){
                requested_bases = requested_bases.concat(tx.meta.request.bases);
            }
            else continue;
        }
        else if(tx.meta.kind===1){
            const block:vr.Block|null = await block_db.read_obj(tx.meta.refresh.height);
            if(block==null) continue;
            const req_tx = block.txs[tx.meta.refresh.index];
            if(req_tx==null) continue;
            const hash = req_tx.hash;
            if(requested_tx_hashes.indexOf(hash)===-1){
                requested_tx_hashes.push(hash);
            }
            else continue;
        }
        else continue;


        const tokens = tx.meta.request.bases.map(key=>vr.crypto.slice_token_part(key)).filter((val,i,array)=>array.indexOf(val)===i);
        const tokens_hash = vr.crypto.array2hash(tokens);
        const unit_buying_tokens_hash = vr.crypto.array2hash([("0000000000000000"+vr.con.constant.unit).slice(-16),("0000000000000000"+vr.con.constant.native).slice(-16)]);
        if(tx.meta.kind===1||((unit_mode&&tokens_hash===unit_buying_tokens_hash)||(!unit_mode&&tokens_hash!=unit_buying_tokens_hash))) choosed.push(tx);
    }
    const sorted = choosed.slice().sort((a,b)=>{
        const a_address = vr.tx.get_info_from_tx(a)[4];
        const b_address = vr.tx.get_info_from_tx(b)[4];
        if(unit_mode&&a_address!=my_address&&b_address===my_address) return -1;
        else if(unit_mode&&a_address===my_address&&b_address!=my_address) return 1;
        else if(bigInt(vr.tx.get_tx_fee(a),16).lesser(bigInt(vr.tx.get_tx_fee(b),16))) return 1;
        else return 0;
    });
    let tx_size:BigInteger;
    let size_sum:BigInteger = bigInt(0);
    const size_checked = sorted.reduce((txs:vr.Tx[],tx)=>{
        if(bigInt(vr.con.constant.block_size).multiply(9).divide(10).lesser(size_sum)) return txs;
        const meta = tx.meta;
        const sign = tx.signature.map(s=>s.data+s.v);
        const array = vr.tx.tx_meta2array(meta).splice(2,1).concat(tx.hash).concat(sign);
        tx_size = array.reduce((sum:BigInteger,item:string)=>{
            return sum.add(Math.ceil(Buffer.from(item,'hex').length))
        },bigInt(0));
        size_sum =bigInt(size_sum).add(tx_size);
        return txs.concat(tx);
    },[]);
    return size_checked;
}


export const make_block = async (private_key:string,extra:string,block_db:vr.db,chain_info_db:vr.db,root_db:vr.db,trie:vr.trie,trie_db:vr.db,state_db:vr.db,lock_db:vr.db,output_db:vr.db,tx_db:vr.db):Promise<[vr.Block,vr.State[]]>=>{
    const my_pub:string = vr.crypto.private2public(private_key);
    const native_address = vr.crypto.generate_address(vr.con.constant.native,my_pub);
    const info:data.chain_info|null = await chain_info_db.read_obj("00");
    if(info==null) throw new Error("chain_info doesn't exist");
    const last_height = info.last_height;
    const pre_key_block = await vr.block.search_key_block(block_db,last_height);
    const pre_micro_blocks = await vr.block.search_micro_block(block_db,pre_key_block,last_height);
    const key_validator = vr.block.get_info_from_block(pre_key_block)[4];
    if(bigInt(last_height,16).eq(0)&&native_address===key_validator){
        await req_tx_com("-- --0 --0 --0,0 --",private_key,chain_info_db,root_db,trie_db,state_db,lock_db,tx_db);
    }
    if(native_address!=key_validator||pre_micro_blocks.length>=vr.con.constant.max_blocks){
        const key_block = await vr.block.create_key_block(private_key,block_db,last_height,trie,state_db,extra);
        if(!await vr.block.verify_key_block(key_block,block_db,trie,state_db,lock_db,last_height)) throw new Error('fail to create valid key block');
        return [key_block,[]];
    }
    else{
        const unit_mode = bigInt(last_height,16).add(1).mod(3).eq(0);
        const unit_address = vr.crypto.generate_address(vr.con.constant.unit,my_pub);
        const txs = await choose_txs(unit_mode,trie,tx_db,lock_db,block_db,unit_address);
        let micro_block = await vr.block.create_micro_block(private_key,block_db,last_height,trie,txs,extra);
        const txs_hash = txs.map(tx=>tx.hash);
        micro_block.txs.forEach(tx=>{
            tx.additional.hash = micro_block.hash;
            tx.additional.height = micro_block.meta.height;
            tx.additional.index = txs_hash.indexOf(tx.hash);
        });
        const output_states = await P.reduce(txs_hash, async (res:vr.State[],key:string,i:number)=>{
            if(txs[i]===null||txs[i].meta.kind===0) return res;
            const get:vr.State[]|null = await output_db.read_obj(key);
            if(get==null){
                await tx_db.del(key);
                throw new Error('output state is not found');
            }
            return res.concat(get);
        },[]);
        if(!await vr.block.verify_micro_block(micro_block,output_states,block_db,trie,state_db,lock_db,last_height)){
            const invalid_tx_hashes = await P.reduce(micro_block.txs, async (result:string[],tx)=>{
                if(tx.meta.kind===0&&!await vr.tx.verify_req_tx(tx,trie,state_db,lock_db,[0,1,2,3,4,5])){
                    result.push(tx.hash);
                    console.log('invalid req-tx');
                    console.log(JSON.stringify(tx,null,4));
                }
                if(tx.meta.kind===1){
                    const output_for_tx:vr.State[]|null = await output_db.read_obj(tx.hash);
                    if(output_for_tx==null){
                        result.push(tx.hash)
                        console.log('invalid ref-tx no output');
                        console.log(JSON.stringify(tx,null,4));
                    }
                    if(output_for_tx!=null&&!await vr.tx.verify_ref_tx(tx,output_for_tx,block_db,trie,state_db,lock_db,last_height,[0,1,2,3,5,6,7])){
                        console.log('output exist');
                        console.log('invalid ref-tx');
                        console.log(JSON.stringify(tx,null,4));
                        result.push(tx.hash)
                    }
                    return result;
                }
                else return result;
            },[]);
            await P.forEach(invalid_tx_hashes, async (key)=>{
                await tx_db.del(key);
                await output_db.del(key);
            });
            if(invalid_tx_hashes.length>0) throw new Error('remove invalid txs');
            else throw new Error('fail to create valid micro block');
        }
        return [micro_block,output_states];
    }
}

export const make_req_tx = async (tyep:vr.TxType,nonce:string,bases:string[],feeprice:string,gas:string,input:string[],log:string,private_key:string,requested_check:boolean,trie:vr.trie,state_db:vr.db,lock_db:vr.db):Promise<vr.Tx>=>{
    const tokens = bases.map(key=>vr.crypto.slice_token_part(key)).filter((val,i,array)=>array.indexOf(val)===i);
    if(tokens.some(t=>bigInt(t,16).notEquals(bigInt(vr.con.constant.native))&&bigInt(t,16).notEquals(bigInt(vr.con.constant.unit)))) throw new Error('unsupported token');
    /*const first_state = await vr.data.read_from_trie(trie,state_db,bases[0],0,vr.state.create_state("00",tokens[0],bases[0]));
    const my_txs:vr.Tx[] = await tx_db.filter('hex','utf8',(key,tx)=>{
        if(tx.meta.kind!=0) return false;
        else if(tx.meta.request.bases.indexOf(my_address)===-1) return false;
        else return true;
    });
    const now_nonce = first_state.nonce;
    const new_nonce = vr.crypto.bigint2hex(bigInt(now_nonce,16).add(my_txs.length));*/
    const tx = vr.tx.create_req_tx(tyep,nonce,bases,feeprice,gas,input,log,private_key);
    const requested = requested_check ? [6] : [5,6];
    if(!await vr.tx.verify_req_tx(tx,trie,state_db,lock_db,requested)) throw new Error('fail to create valid request tx');
    return tx;
}

export const compute_output = async (req_tx:vr.Tx,trie:vr.trie,state_db:vr.db,block_db:vr.db):Promise<[0|1,vr.State[]]>=>{
    const tokens = req_tx.meta.request.bases.map(key=>vr.crypto.slice_token_part(key)).filter((val,i,array)=>array.indexOf(val)===i);
    const main_token = tokens[0];
    const bases = req_tx.meta.request.bases.filter((val,i,array)=>array.indexOf(val)===i);
    const base_states = await P.map(bases, async (key)=>{
        return await vr.data.read_from_trie(trie,state_db,key,0,vr.state.create_state("00",vr.crypto.slice_token_part(key),key));
    });
    const input_data = req_tx.meta.request.input;
    const output = await (async ()=>{
        if(bigInt(main_token,16).eq(bigInt(vr.con.constant.native,16))) return vr.contracts.native_prove(bases,base_states,input_data);
        else if(bigInt(main_token,16).eq(bigInt(vr.con.constant.unit,16))) return await vr.contracts.unit_prove(bases,base_states,input_data,block_db,req_tx.additional.height);
        else return [];
    })();
    const state_to_hash = (state:vr.State)=>vr.crypto.array2hash(([state.nonce,state.token,state.owner,state.amount]).concat(state.data))
    const success = !output.some((s,i)=>!vr.state.verify_state(s)||base_states[i]==null||state_to_hash(s)===state_to_hash(base_states[i])) ? 1: 0;
    const return_state = success===1 ? output : base_states;
    return [success,return_state];
}

export const get_nonce = async (request:string,height:string,block_hash:string,refresher:string,output:string,unit_price:string)=>{
    let nonce = bigInt(0);
    let flag = true;
    let hash = "";
    setTimeout(()=>{
        nonce = bigInt(0);
        flag = false;
    },10000);
    while(1){
        nonce = nonce.add(1);
        hash = await vr.tx.mining(request,height,block_hash,vr.crypto.bigint2hex(nonce),refresher,output,unit_price);
        if(!flag||bigInt(hash,16).lesserOrEquals(bigInt(vr.con.constant.pow_target,16))) break;
    }
    return vr.crypto.bigint2hex(nonce);
}

export const make_ref_tx = async (height:string,index:number,gas_share:number,unit_price:string,private_key:string,block_db:vr.db,trie_db:vr.db,root_db:vr.db,state_db:vr.db,lock_db:vr.db,last_height:string):Promise<[vr.Tx,vr.State[]]>=>{
    const req_block:vr.Block|null = await block_db.read_obj(height);
    if(req_block==null||!vr.block.isBlock(req_block)) throw new Error('invalid height');
    const req_tx:vr.Tx = req_block.txs[index];
    if(req_tx==null||!vr.tx.isTx(req_tx)) throw new Error('invalid index');
    const req_root = await root_db.get(height,'hex') || "";
    const req_trie = vr.data.trie_ins(trie_db,req_root);
    const root = await root_db.get(last_height,'hex') || "";
    const trie = vr.data.trie_ins(trie_db,root);
    const computed = await compute_output(req_tx,req_trie,state_db,block_db);
    const success = computed[0];
    const output = computed[1];
    const output_hashes = output.map(s=>vr.crypto.array2hash([s.nonce,s.token,s.owner,s.amount].concat(s.data)));
    const output_hash = vr.crypto.array2hash(output_hashes);
    const my_public = vr.crypto.private2public(private_key);
    const my_address = vr.crypto.generate_address(vr.con.constant.unit,my_public);
    const nonce = await get_nonce(req_tx.hash,height,req_block.hash,my_address,output_hash,unit_price);
    if(nonce==="00") throw new Error('fail to get valid nonce');
    const ref_tx = vr.tx.create_ref_tx(height,index,success,output_hashes,[],nonce,gas_share,unit_price,private_key);
    if(!vr.tx.verify_ref_tx(ref_tx,output,block_db,trie,state_db,lock_db,last_height)) throw new Error('fail to create valid refresh tx');
    return [ref_tx,output];
}

export const dialog_data = async (chain_info_db:vr.db,root_db:vr.db,trie_db:vr.db,state_db:vr.db,native_address:string,unit_address:string,id:number):Promise<{id:number,address:string,unit_balance:string,last_height:string,last_hash:string}>=>{
    const info:data.chain_info|null = await chain_info_db.read_obj('00');
    if(info==null) throw new Error("chain_info doesn't exist");
    const last_height = info.last_height;
    const root = await root_db.get(last_height);
    if(root==null) throw new Error("root doesn't exist");
    const trie = vr.data.trie_ins(trie_db,root);
    const native_state = await vr.data.read_from_trie(trie,state_db,native_address,0,vr.state.create_state("00",vr.con.constant.native,native_address,"00"));
    const unit_state = await vr.data.read_from_trie(trie,state_db,unit_address,0,vr.state.create_state("00",vr.con.constant.unit,unit_address,"00"));
    const hex2tenstr = (amount:string,compute:(big:BigNumber)=>BigNumber)=>{
        const big_int = bigInt(amount,16);
        const big_num = new BigNumber(big_int.toString(16),16);
        return compute(big_num).toString();
    }
    const amount_divide = (big:BigNumber)=>big.dividedBy(10**12);
    const native_amount = hex2tenstr(native_state.amount,amount_divide);
    const unit_amount = hex2tenstr(unit_state.amount,amount_divide);
    const height = hex2tenstr(info.last_height,(big:BigNumber)=>big);
    const obj = {
        id:id,
        address:native_address,
        native_balance:native_amount,
        unit_balance:unit_amount,
        last_height:height,
        last_hash:info.last_hash,
        syncing:info.syncing,
        requesting:info.manual_requesting
    }
    return obj;
}

export const maintenance = async (node:Node,peer_info:any,height:string,chain_info_db:vr.db,block_db:vr.db,root_db:vr.db,trie_db:vr.db,state_db:vr.db,lock_db:vr.db,tx_db:vr.db,peer_list_db:vr.db,finalize_db:vr.db,uniter_db:vr.db,private_key:string,log:bunyan)=>{
    try{
        node.dialProtocol(peer_info,`/vreath/${data.id}/block/get`,(err:string,conn:any) => {
            if (err) { log.info(err); }
            const stream = toStream(conn)
            let data:string[] = [];
            stream.write(height);
            stream.on('data',(msg:Buffer)=>{
                const str = msg.toString('utf-8');
                if(str!='end') data.push(str);
                else {
                    const res = data.reduce((json:string,str)=>json+str,'');
                    block_routes.post(Buffer.from(res,'utf-8'),chain_info_db,root_db,trie_db,block_db,state_db,lock_db,tx_db,peer_list_db,finalize_db,uniter_db,private_key,node,log);
                    data = [];
                    stream.end();
                }
            });

            stream.on('error',(e:string)=>{
                log.info(e);
                stream.end();
            });
        });
    }
    catch(e){
        log.info(e);
    }
}

export const make_finalize = async (private_key:string,block:vr.Block,chain_info_db:vr.db,root_db:vr.db,trie_db:vr.db,uniter_db:vr.db,state_db:vr.db,log:bunyan)=>{
    try{
        const info:data.chain_info|null = await chain_info_db.read_obj("00");
        if(info==null) throw new Error("chain_info doesn't exist");
        if(block.meta.kind!=0) throw new Error("block is not key block");
        const height = block.meta.height;
        const uniters:string[]|null = await uniter_db.read_obj(height);
        if(uniters==null) throw new Error("no uniters");
        const root = await root_db.get(height);
        if(root==null) throw new Error("root doesn't exist");
        const trie = vr.data.trie_ins(trie_db,root);
        const finalize_validators = await vr.finalize.choose(uniters,height,trie,state_db);
        const pub_key = vr.crypto.private2public(private_key);
        const unit_address = vr.crypto.generate_address(vr.con.constant.unit,pub_key);
        if(finalize_validators.indexOf(unit_address)===-1) throw new Error('not finalize_validator at the height');
        const finalize = vr.finalize.sign(height,block.hash,private_key);
        return finalize;
    }
    catch(e){
        log.info(e);
        return null;
    }
}

export const manual_request_manager = async (request_info:data.chain_info,block:vr.Block,private_key:string,trie:vr.trie,state_db:vr.db,lock_db:vr.db,tx_db:vr.db,log:bunyan):Promise<[data.chain_info,vr.Tx|null]>=>{
    try{
        const exist = block.txs.some(tx=>tx.meta.kind===0&&tx.hash===request_info.manual_requesting.tx_hash);
        const times = request_info.manual_requesting.failed_times + 1;
        request_info.manual_requesting.failed_times = times;
        if(exist||times>10){
            request_info.manual_requesting.flag = false;
            request_info.manual_requesting.failed_times = 0;
            request_info.manual_requesting.address = '';
            request_info.manual_requesting.tx_hash = '';
            if(!exist) console.log('fail to send request-tx');
        }
        else{
            const address = request_info.manual_requesting.address;
            const new_state = await vr.data.read_from_trie(trie,state_db,address,0,vr.state.create_state("00",vr.crypto.slice_token_part(address),address,"00",[]));
            if(bigInt(request_info.manual_requesting.nonce,16).notEquals(bigInt(new_state.nonce,16))){
                const new_nonce = new_state.nonce;
                const req_tx:vr.Tx|null = await tx_db.read_obj(request_info.manual_requesting.tx_hash);
                if(req_tx!=null){
                    const new_req_tx = await make_req_tx(0,new_nonce,req_tx.meta.request.bases,req_tx.meta.request.feeprice,req_tx.meta.request.gas,req_tx.meta.request.input,req_tx.meta.request.log,private_key,false,trie,state_db,lock_db);
                    request_info.manual_requesting.failed_times = 0;
                    request_info.manual_requesting.tx_hash = new_req_tx.hash;
                    request_info.manual_requesting.nonce = new_nonce;
                    return [request_info,new_req_tx];
                }
            }
        }
        return [request_info,null];
    }
    catch(e){
        log.info(e);
        return [request_info,null];
    }
}


