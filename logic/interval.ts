import * as vr from 'vreath'
import * as data from './data'
import * as works from './work'
import {Node} from '../commands/main'
import * as block_routes from '../app/routes/block'
import * as P from 'p-iteration'
import bunyan from 'bunyan'
import * as path from 'path'
import bigInt, {BigInteger} from 'big-integer';

const log = bunyan.createLogger({
    name:'vreath-cli',
    streams:[
        {
            path:path.join(__dirname,'../log/log.log')
        }
    ]
});

const pull = require('pull-stream');

export const get_new_chain = async (PeerBook:any,node:Node)=>{
    const peers = PeerBook.getAll();
    const peer = peers[0];
    if(peer==null) throw new Error('no peer');
    const info:data.chain_info|null = await data.chain_info_db.read_obj("00");
    if(info==null) throw new Error("chain_info doesn't exist");
    node.dialProtocol(peer,`/vreath/${data.id}/chain/get`,(err:string,conn:any) => {
        if (err) { throw err }
        pull(pull.values([info.last_height]), conn);
    });
    await works.sleep(30000);
    setImmediate(get_new_chain);
    return 0;
}

export const staking = async (private_key:string,PeerBook:any,node:Node)=>{
    try{
        const info:data.chain_info|null = await data.chain_info_db.read_obj("00");
        if(info==null) throw new Error("chain_info doesn't exist");
        const root = await data.root_db.get(info.last_height);
        if(root==null) throw new Error("root doesn't exist");
        const trie = vr.data.trie_ins(data.trie_db,root);
        const made = await works.make_block(private_key,data.block_db,info.last_height,trie,data.state_db,data.lock_db,"",data.tx_db);
        await block_routes.post(Buffer.from(JSON.stringify(made)));
        const peers = PeerBook.getAll();
        await P.forEach(peers, async (peer)=>{
            node.dialProtocol(peer,`/vreath/${data.id}/block/post`,(err:string,conn:any) => {
                if (err) { throw err }
                pull(pull.values([JSON.stringify(made)]), conn);
            });
        });
    }
    catch(e){
        log.info(e);
    }
    await works.sleep(1000);
    setImmediate(()=>staking.apply(null,[private_key,PeerBook,node]));
    return 0;
}

export const buying_unit = async (private_key:string,config:any,PeerBook:any,node:Node)=>{
    try{
        const pub_key:string = vr.crypto.private2public(private_key);
        const native_validator = vr.crypto.generate_address(vr.con.constant.native,pub_key)
        const unit_validator = vr.crypto.generate_address(vr.con.constant.unit,pub_key);
        const info:data.chain_info|null = await data.chain_info_db.read_obj("00");
        if(info==null) throw new Error("chain_info doesn't exist");
        const root = await data.root_db.get(info.last_height);
        if(root==null) throw new Error("root doesn't exist");
        const trie = vr.data.trie_ins(data.trie_db,root);
        const validator_native_state:vr.State = await vr.data.read_from_trie(trie,data.state_db,native_validator,0,vr.state.create_state("00",vr.con.constant.native,native_validator,"00"));
        const validator_amount = validator_native_state.amount || "00";
        const minimum:string = config.validator.minimum;
        if(bigInt(validator_amount,16).lesser(bigInt(minimum,16))) throw new Error("You don't have enough amount");

        let units:vr.Unit[] = [];
        let price_sum = bigInt(0);

        await data.unit_db.filter('hex','utf8', async (key:string,unit:vr.Unit)=>{
            const maxed:boolean = bigInt(validator_amount,16).subtract(price_sum).subtract(bigInt(unit[4],16)).lesser(bigInt(minimum,16));
            if(maxed&&bigInt(unit[4],16).lesser(bigInt(units[0][4],16))) return false;
            if(maxed){
                units[0] = unit;
            }
            else{
                units.push(unit);
            }
            units.sort((a,b)=>bigInt(a[4],16).subtract(bigInt(b[4],16)).toJSNumber());
            price_sum = price_sum.add(bigInt(unit[4],16));
            return false;
        });
        if(units.length===0) throw new Error('no units');
        const unit_addresses = await P.reduce(units, async (res:string[],unit)=>{
            const unit_info = await vr.unit.get_info_from_unit(unit,data.block_db);
            const unit_addresses = unit_info[1];
            const unit_state = await vr.data.read_from_trie(trie,data.state_db,unit_addresses,0,vr.state.create_state("0",vr.con.constant.unit,unit_addresses,"0"));
            if(!bigInt(unit_info[2],16).lesserOrEquals(vr.con.constant.pow_target) || unit_state.data.length!=0) return res;
            if(res.indexOf(unit_addresses)!=-1) return res;
            return res.concat(unit_addresses);
        },[unit_validator]);
        const native_addresses = [native_validator].concat(units.map(u=>vr.crypto.generate_address(vr.con.constant.unit,vr.crypto.slice_hash_part(u[3]))).filter((val,i,array)=>array.indexOf(val)===i));
        const bases = unit_addresses.concat(native_addresses);
        const feeprice:string = config.validator.fee_price;
        const gas:string = config.validator.gas;
        const input_raw = units.reduce((res,unit)=>{
            let index = (unit[1]).toString(16);
            if(index.length%2!=0) index = "0"+index;
            return res.concat(unit[0]).concat(index).concat(unit[2]).concat(unit[3]).concat(unit[4]);
        },["0"]);
        const tx = await works.make_req_tx(0,bases,feeprice,gas,input_raw,"",private_key,trie,data.state_db,data.lock_db);
        await data.tx_db.write_obj(tx.hash,tx);
        await P.forEach(units, async (unit,i)=>{
            await data.unit_db.del(unit_addresses[i+1]);
        });
        const peers = PeerBook.getAll();
        await P.forEach(peers, async (peer)=>{
            node.dialProtocol(peer,`/vreath/${data.id}/tx/post`,(err:string,conn:any) => {
                if (err) { throw err }
                pull(pull.values([JSON.stringify([tx,[]])]), conn);
            });
        });
    }
    catch(e){
        log.info(e);
    }
    await works.sleep(2000);
    setImmediate(()=>buying_unit.apply(null,[private_key,config,PeerBook,node]));
    return 0;
}


export const refreshing = async (private_key:string,config:any,PeerBook:any,node:Node)=>{
    try{
        const info:data.chain_info|null = await data.chain_info_db.read_obj("00");
        if(info==null) throw new Error("chain_info doesn't exist");
        const last_height = info.last_height;
        let height = bigInt(last_height,16);
        let index:number = -1;
        let block:vr.Block|null;
        let refreshed:string[] = [];
        let target_tx:vr.Tx|null = null;
        while(height.notEquals(0)){
            if(target_tx!=null) break;
            block = await data.block_db.read_obj(vr.crypto.bigint2hex(height));
            if(block==null) continue;
            await P.forEach(block.txs, async (tx,i)=>{
                const pooled = await data.tx_db.filter('hex','utf8', async (key:string,t:vr.Tx)=>{
                    return t.meta.kind===1&&tx.meta.refresh.height===t.meta.refresh.height&&tx.meta.refresh.index===t.meta.refresh.index&&tx.meta.refresh.output===t.meta.refresh.output;
                });
                if(tx.meta.kind===0&&refreshed.indexOf(tx.hash)===-1&&pooled.length===0){
                    target_tx = tx;
                    index = i;
                }
                else if(tx.meta.kind===1){
                    const req_tx = await vr.tx.find_req_tx(tx,data.block_db);
                    refreshed.push(req_tx.hash);
                }
            });
            if(index!=-1) break;
            height = height.subtract(1);
        }
        if(target_tx==null||index===-1) throw new Error('no request tx is refreshed yet.');
        const gas_share:number = config.miner.gas_share;
        const unit_price:string = config.miner.unit_price;
        const root = await data.root_db.get(last_height);
        if(root==null) throw new Error("root doesn't exist");
        const trie = vr.data.trie_ins(data.trie_db,root);
        const made = await works.make_ref_tx(vr.crypto.bigint2hex(height),index,gas_share,unit_price,private_key,data.block_db,trie,data.state_db,data.lock_db,last_height);
        await data.tx_db.write_obj(made[0].hash,made[0]);
        const peers = PeerBook.getAll();
        await P.forEach(peers, async (peer)=>{
            node.dialProtocol(peer,`/vreath/${data.id}/tx/post`,(err:string,conn:any) => {
                if (err) { throw err }
                pull(pull.values([JSON.stringify(made)]), conn);
            });
        });
    }
    catch(e){
        log.info(e);
    }
    await works.sleep(2000);
    setImmediate(()=>refreshing.apply(null,[private_key,config,PeerBook,node]));
    return 0;
}

export const making_unit = async (private_key:string,config:any,PeerBook:any,node:Node)=>{
    try{
        const public_key = vr.crypto.private2public(private_key);
        const my_unit_address = vr.crypto.generate_address(vr.con.constant.unit,public_key);
        const info:data.chain_info|null = await data.chain_info_db.read_obj("00");
        if(info==null) throw new Error("chain_info doesn't exist");
        const last_height = info.last_height;
        const root = await data.root_db.get(last_height);
        if(root==null) throw new Error("root doesn't exist");
        const trie = vr.data.trie_ins(data.trie_db,root);
        let height = bigInt(last_height,16);
        let block:vr.Block|null;
        let unit_info:[string,string,string,string,string,number,string]|null = null;
        while(height.notEquals(0)){
            if(unit_info!=null) break;
            block = await data.block_db.read_obj(vr.crypto.bigint2hex(height));
            if(block==null) continue;
            await P.forEach(block.txs, async (ref_tx,i)=>{
                if(ref_tx.meta.kind===1){
                    const req_height = ref_tx.meta.refresh.height || "00";
                    const req_block:vr.Block|null = await data. block_db.read_obj(req_height);
                    if(req_block==null) throw new Error("req_block doesn't exist");
                    const req_tx:vr.Tx|null = req_block.txs[ref_tx.meta.refresh.index];
                    if(req_tx==null) throw new Error("req_tx doesn't exist");
                    const output_hash = vr.crypto.array2hash(ref_tx.meta.refresh.output);
                    const iden = vr.crypto.array2hash([req_tx.hash,req_height,req_block.hash,my_unit_address,output_hash]);
                    const unit_address = vr.crypto.generate_address(vr.con.constant.unit,iden);
                    const unit_state = await vr.data.read_from_trie(trie,data.state_db,unit_address,0,vr.state.create_state("00",vr.con.constant.unit,unit_address));
                    if(unit_state.data.length===0){
                        unit_info = [req_tx.hash,req_height,req_block.hash,output_hash,vr.crypto.bigint2hex(height),i,unit_address];
                    }
                }
            });
            height = height.subtract(1);
        }
        if(unit_info==null) throw new Error('no new refresh-tx');
        const unit_price:string = config.miner.unit_price;
        const nonce = await works.get_nonce(unit_info[0],unit_info[1],unit_info[2],my_unit_address,unit_info[3],unit_price);
        if(bigInt(nonce,16).eq(0)) throw new Error('fail to get valid nonce');
        const unit:vr.Unit = [unit_info[4],unit_info[5],nonce,my_unit_address,unit_price];
        await data.unit_db.write_obj(unit_info[6],unit);
        const peers = PeerBook.getAll();
        await P.forEach(peers, async (peer)=>{
            node.dialProtocol(peer,`/vreath/${data.id}/unit/post`,(err:string,conn:any) => {
                if (err) { throw err }
                pull(pull.values([unit]), conn);
            });
        });
    }
    catch(e){
        log.info(e);
    }
    await works.sleep(2000);
    setImmediate(()=>making_unit.apply(null,[private_key,config,PeerBook,node]));
    return 0;
}
