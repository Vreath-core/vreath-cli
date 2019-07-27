import * as vr from 'vreath'
import * as data from './data'
import * as works from './work'
import {Node} from '../commands/main'
import * as tx_routes from '../app/routes/tx'
import * as block_routes from '../app/routes/block'
import * as chain_routes from '../app/routes/chain'
import * as P from 'p-iteration'
import bunyan from 'bunyan'
import * as path from 'path'
import {promisify} from 'util'
import bigInt, {BigInteger} from 'big-integer';
const PeerId = require('peer-id');
const PeerInfo = require('peer-info');
const pull = require('pull-stream');
const toStream = require('pull-stream-to-stream');


export const shake_hands = async (node:Node,peer_list_db:vr.db,log:bunyan)=>{
    try{
        const peer_info_list:data.peer_info[] = await peer_list_db.filter();
        await peer_list_db.filter('hex','utf8',async (key,peer:data.peer_info)=>{
            const peer_id = await promisify(PeerId.createFromJSON)(peer.identity);
            const peer_info = new PeerInfo(peer_id);
            peer.multiaddrs.forEach(add=>peer_info.multiaddrs.add(add));
            node.dialProtocol(peer_info,`/vreath/${data.id}/handshake`,(err:string,conn:any) => {
                if (err) { log.info(err); }
                const stream = toStream(conn);
                stream.write(JSON.stringify(peer_info_list));
                stream.write('end');
            });
            return false;
        });
    }
    catch(e){
        log.info(e);
    }
    await works.sleep(30000);
    setImmediate(()=>shake_hands.apply(null,[node,peer_list_db,log]));
    return 0;
}


export const get_new_chain = async (node:Node,peer_list_db:vr.db,chain_info_db:vr.db,block_db:vr.db,root_db:vr.db,trie_db:vr.db,state_db:vr.db,lock_db:vr.db,tx_db:vr.db,log:bunyan)=>{
    try{
        const peers:data.peer_info[] = await peer_list_db.filter();
        const peer = peers[Math.floor(Math.random()*peers.length)];
        if(peer==null) throw new Error('no peer');
        const peer_id = await promisify(PeerId.createFromJSON)(peer.identity);
        const peer_info = new PeerInfo(peer_id);
        peer.multiaddrs.forEach(add=>peer_info.multiaddrs.add(add));
        const info:data.chain_info|null = await chain_info_db.read_obj("00");
        if(info==null) throw new Error("chain_info doesn't exist");
        let got_block:vr.Block|null;
        let chain_hashes:{[key:string]:string} = {};
        let i:BigInteger = bigInt(0);
        const last_height = bigInt(info.last_height,16);
        let height:string;
        for(i;i.lesserOrEquals(last_height);i=i.add(1)){
            height = vr.crypto.bigint2hex(i);
            got_block = await block_db.read_obj(height);
            if(got_block==null){
                await works.maintenance(node,peer_info,height,chain_info_db,block_db,root_db,trie_db,state_db,lock_db,tx_db,log);
                break;
            }
            chain_hashes[got_block.meta.height] = got_block.hash;
        }

        node.dialProtocol(peer_info,`/vreath/${data.id}/chain/get`,(err:string,conn:any) => {
            if (err) { log.info(err); }
            const stream = toStream(conn);
            stream.write(JSON.stringify(chain_hashes));
            stream.write('end1');
            let data:string[] = [];

            stream.on('data',(msg:Buffer)=>{
                try{
                    if(msg!=null&&msg.length>0){
                        const str = msg.toString('utf-8');
                        if(str!='end2') data.push(str);
                        else {
                            const res = data.reduce((json:string,str)=>json+str,'');
                            chain_routes.post(res,block_db,chain_info_db,root_db,trie_db,state_db,lock_db,tx_db,log);
                            data = [];
                            stream.end();
                        }
                    }
                }
                catch(e){
                    log.info(e);
                }
            });
            stream.on('error',(e:string)=>{
                log.info(e);
            });
        });
    }
    catch(e){
        //err_fn.apply(null,e);
        log.info(e);
    }
    await works.sleep(30000);
    setImmediate(()=>get_new_chain.apply(null,[node,peer_list_db,chain_info_db,block_db,root_db,trie_db,state_db,lock_db,tx_db,log]));
    return 0;
}

export const staking = async (private_key:string,node:Node,chain_info_db:vr.db,root_db:vr.db,trie_db:vr.db,block_db:vr.db,state_db:vr.db,lock_db:vr.db,output_db:vr.db,tx_db:vr.db,peer_list_db:vr.db,log:bunyan)=>{
    try{
        const info:data.chain_info|null = await chain_info_db.read_obj("00");
        if(info==null) throw new Error("chain_info doesn't exist");
        const last_height = info.last_height
        const root = await root_db.get(last_height);
        if(root==null) throw new Error("root doesn't exist");
        const trie = vr.data.trie_ins(trie_db,root);
        const made = await works.make_block(private_key,"",block_db,chain_info_db,root_db,trie,trie_db,state_db,lock_db,output_db,tx_db);
        const block = made[0];
        const output_state = made[1];
        if(block.meta.kind===0) await vr.block.accept_key_block(block,block_db,last_height,trie,state_db,lock_db);
        else if(block.meta.kind===1) await vr.block.accept_micro_block(block,output_state,block_db,trie,state_db,lock_db);
        await block_db.write_obj(block.meta.height,block);
        const new_info = await works.new_obj(info,(info)=>{
            info.last_height = block.meta.height;
            info.last_hash = block.hash;
            return info;
        });
        await chain_info_db.write_obj("00",new_info);
        const new_root = trie.now_root();
        await root_db.put(block.meta.height,new_root,'hex','utf8');
        //console.log(JSON.stringify(await tx_db.filter(),null,4));
        const txs_hash = block.txs.map(tx=>tx.hash);
        await P.forEach(txs_hash, async (key:string)=>{
            await tx_db.del(key);
        });
        await peer_list_db.filter('hex','utf8',async (key,peer:data.peer_info)=>{
            const peer_id = await promisify(PeerId.createFromJSON)(peer.identity);
            const peer_info = new PeerInfo(peer_id);
            peer.multiaddrs.forEach(add=>peer_info.multiaddrs.add(add));
            node.dialProtocol(peer_info,`/vreath/${data.id}/block/post`,(err:string,conn:any) => {
                if (err) { log.info(err); }
                pull(pull.values([JSON.stringify(made)]), conn);
            });
            return false;
        });
    }
    catch(e){
        //err_fn.apply(null,e);
        log.info(e);
    }
    await works.sleep(1000);
    setImmediate(()=>staking.apply(null,[private_key,node,chain_info_db,root_db,trie_db,block_db,state_db,lock_db,output_db,tx_db,peer_list_db,log]));
    return 0;
}

export const buying_unit = async (private_key:string,config:any,node:Node,chain_info_db:vr.db,root_db:vr.db,trie_db:vr.db,block_db:vr.db,state_db:vr.db,lock_db:vr.db,output_db:vr.db,tx_db:vr.db,unit_db:vr.db,peer_list_db:vr.db,log:bunyan)=>{
    try{
        const pub_key:string = vr.crypto.private2public(private_key);
        const native_validator = vr.crypto.generate_address(vr.con.constant.native,pub_key)
        const unit_validator = vr.crypto.generate_address(vr.con.constant.unit,pub_key);
        const info:data.chain_info|null = await chain_info_db.read_obj("00");
        if(info==null) throw new Error("chain_info doesn't exist");
        const root = await root_db.get(info.last_height);
        if(root==null) throw new Error("root doesn't exist");
        const trie = vr.data.trie_ins(trie_db,root);
        const validator_native_state:vr.State = await vr.data.read_from_trie(trie,state_db,native_validator,0,vr.state.create_state("00",vr.con.constant.native,native_validator,"00"));
        const validator_amount = validator_native_state.amount || "00";
        const minimum:string = config.validator.minimum;
        if(bigInt(validator_amount,16).lesser(bigInt(minimum,16))) throw new Error("You don't have enough amount");

        await tx_db.filter('hex','utf8',async (key,tx:vr.Tx)=>{
            if(tx.meta.kind===0&&tx.meta.request.bases[0]===unit_validator) throw new Error("already bought units");
            return false;
        });

        let units:vr.Unit[] = [];
        let unit_addresses:string[] = [unit_validator];
        let price_sum = bigInt(0);

        await unit_db.filter('hex','utf8', async (key:string,unit:vr.Unit)=>{
            const maxed:boolean = bigInt(validator_amount,16).subtract(price_sum).subtract(bigInt(unit[4],16)).lesser(bigInt(minimum,16));
            if(maxed&&units[0]!=null&&bigInt(unit[4],16).lesser(bigInt(units[0][4],16))) return false;
            const unit_info = await vr.unit.get_info_from_unit(unit,block_db);
            const unit_address = unit_info[1];
            const unit_state = await vr.data.read_from_trie(trie,state_db,unit_address,0,vr.state.create_state("00",vr.con.constant.unit,unit_address,"00"));
            if(unit_state.data.length!=0){
                await unit_db.del(unit_address);
                return false;
            }
            else if(maxed){
                units[0] = unit;
                unit_addresses[0] = unit_address;
            }
            else{
                units.push(unit);
                unit_addresses.push(unit_address);
            }
            units.sort((a,b)=>bigInt(a[4],16).subtract(bigInt(b[4],16)).toJSNumber());
            price_sum = price_sum.add(bigInt(unit[4],16));
            return false;
        });
        if(units.length===0) throw new Error('no units');
        const unit_hashes = units.map(u=>vr.crypto.array2hash([u[0],vr.crypto.bigint2hex(bigInt(u[1])),u[2],u[3],u[4]]));
        units = units.filter((u,i)=>unit_hashes.indexOf(unit_hashes[i])===i);
        unit_addresses = unit_addresses.filter((val,i,array)=>array.indexOf(val)===i);
        const native_addresses = [native_validator].concat(units.map(u=>("0000000000000000"+vr.con.constant.native).slice(-16)+("0000000000000000000000000000000000000000000000000000000000000000"+u[3]).slice(-64))).filter((val,i,array)=>array.indexOf(val)===i);
        const bases = unit_addresses.concat(native_addresses);
        const feeprice:string = config.validator.fee_price;
        const gas:string = config.validator.gas;
        const input_raw = units.reduce((res,unit)=>{
            let index = (unit[1]).toString(16);
            if(index.length%2!=0) index = "0"+index;
            return res.concat(unit[0]).concat(index).concat(unit[2]).concat(unit[3]).concat(unit[4]);
        },["00"]);
        const tx = await works.make_req_tx(0,bases,feeprice,gas,input_raw,"",private_key,trie,state_db,lock_db);
        await tx_routes.post(Buffer.from(JSON.stringify([tx,[]])),chain_info_db,root_db,trie_db,tx_db,block_db,state_db,lock_db,output_db,log)
        await tx_db.write_obj(tx.hash,tx);
        await P.forEach(units, async (unit,i)=>{
            await unit_db.del(unit_addresses[i+1]);
        });
        await peer_list_db.filter('hex','utf8',async (key,peer:data.peer_info)=>{
            const peer_id = await promisify(PeerId.createFromJSON)(peer.identity);
            const peer_info = new PeerInfo(peer_id);
            peer.multiaddrs.forEach(add=>peer_info.multiaddrs.add(add));
            node.dialProtocol(peer_info,`/vreath/${data.id}/tx/post`,(err:string,conn:any) => {
                if (err) { log.info(err); }
                pull(pull.values([JSON.stringify([tx,[]])]), conn);
            });
            return false;
        });
    }
    catch(e){
        //err_fn.apply(null,e);
        log.info(e);
    }
    await works.sleep(5000);
    setImmediate(()=>buying_unit.apply(null,[private_key,config,node,chain_info_db,root_db,trie_db,block_db,state_db,lock_db,output_db,tx_db,unit_db,peer_list_db,log]));
    return 0;
}


export const refreshing = async (private_key:string,config:any,node:Node,chain_info_db:vr.db,root_db:vr.db,trie_db:vr.db,block_db:vr.db,state_db:vr.db,lock_db:vr.db,output_db:vr.db,tx_db:vr.db,peer_list_db:vr.db,log:bunyan)=>{
    try{
        const info:data.chain_info|null = await chain_info_db.read_obj("00");
        if(info==null) throw new Error("chain_info doesn't exist");
        const last_height = info.last_height;
        let height = bigInt(last_height,16);
        let index:number = -1;
        let block:vr.Block|null;
        let refreshed:string[] = [];
        let target_tx:vr.Tx|null = null;
        while(height.notEquals(0)){
            if(target_tx!=null) break;
            block = await block_db.read_obj(vr.crypto.bigint2hex(height));
            if(block==null) continue;
            await P.forEach(block.txs, async (tx,i)=>{
                const pooled = await tx_db.filter('hex','utf8', async (key:string,t:vr.Tx)=>{
                    return t.meta.kind===1&&tx.meta.refresh.height===t.meta.refresh.height&&tx.meta.refresh.index===t.meta.refresh.index&&tx.meta.refresh.output===t.meta.refresh.output;
                });
                if(tx.meta.kind===0&&refreshed.indexOf(tx.hash)===-1&&pooled.length===0){
                    target_tx = tx;
                    index = i;
                }
                else if(tx.meta.kind===1){
                    const req_tx = await vr.tx.find_req_tx(tx,block_db);
                    refreshed.push(req_tx.hash);
                }
            });
            if(index!=-1) break;
            height = height.subtract(1);
        }
        if(target_tx==null||index===-1) throw new Error('no request tx is refreshed yet.');
        await tx_db.filter('hex','utf8', async (key,tx:vr.Tx)=>{
            if(tx.meta.kind===1&&tx.meta.refresh.height===vr.crypto.bigint2hex(height)&&tx.meta.refresh.index===index) throw new Error('refresh tx exists in the pool');
            return false;
        });
        const gas_share:number = config.miner.gas_share;
        const unit_price:string = config.miner.unit_price;
        const made = await works.make_ref_tx(vr.crypto.bigint2hex(height),index,gas_share,unit_price,private_key,block_db,trie_db,root_db,state_db,lock_db,last_height);
        await tx_db.write_obj(made[0].hash,made[0]);
        await output_db.write_obj(made[0].hash,made[1]);
        await peer_list_db.filter('hex','utf8',async (key,peer:data.peer_info)=>{
            const peer_id = await promisify(PeerId.createFromJSON)(peer.identity);
            const peer_info = new PeerInfo(peer_id);
            peer.multiaddrs.forEach(add=>peer_info.multiaddrs.add(add));
            node.dialProtocol(peer_info,`/vreath/${data.id}/tx/post`,(err:string,conn:any) => {
                if (err) { log.info(err); }
                pull(pull.values([JSON.stringify(made)]), conn);
            });
            return false;
        });
    }
    catch(e){
        //err_fn.apply(null,e);
        log.info(e);
    }
    await works.sleep(4000);
    setImmediate(()=>refreshing.apply(null,[private_key,config,node,chain_info_db,root_db,trie_db,block_db,state_db,lock_db,output_db,tx_db,peer_list_db,log]));
    return 0;
}

export const making_unit = async (private_key:string,config:any,node:Node,chain_info_db:vr.db,root_db:vr.db,trie_db:vr.db,block_db:vr.db,state_db:vr.db,unit_db:vr.db,peer_list_db:vr.db,log:bunyan)=>{
    try{
        const public_key = vr.crypto.private2public(private_key);
        const my_unit_address = vr.crypto.generate_address(vr.con.constant.unit,public_key);
        const info:data.chain_info|null = await chain_info_db.read_obj("00");
        if(info==null) throw new Error("chain_info doesn't exist");
        const last_height = info.last_height;
        const root = await root_db.get(last_height);
        if(root==null) throw new Error("root doesn't exist");
        const trie = vr.data.trie_ins(trie_db,root);
        let height = bigInt(last_height,16);
        let block:vr.Block|null;
        let unit_info:[string,string,string,string,string,number,string]|null = null;
        while(height.notEquals(0)){
            if(unit_info!=null) break;
            block = await block_db.read_obj(vr.crypto.bigint2hex(height));
            if(block==null) continue;
            await P.forEach(block.txs, async (ref_tx,i)=>{
                if(ref_tx.meta.kind===1){
                    const req_height = ref_tx.meta.refresh.height || "00";
                    const req_block:vr.Block|null = await block_db.read_obj(req_height);
                    if(req_block==null) return 0;
                    const req_tx:vr.Tx|null = req_block.txs[ref_tx.meta.refresh.index];
                    if(req_tx==null) return 0;
                    const output_hash = vr.crypto.array2hash(ref_tx.meta.refresh.output);
                    const iden = vr.crypto.array2hash([req_tx.hash,req_height,req_block.hash,my_unit_address,output_hash]);
                    const unit_address = ("0000000000000000"+vr.con.constant.unit).slice(-16)+("0000000000000000000000000000000000000000000000000000000000000000"+iden).slice(-64);
                    const made_unit = await unit_db.read_obj(unit_address);
                    if(made_unit!=null) return 0;
                    const unit_state = await vr.data.read_from_trie(trie,state_db,unit_address,0,vr.state.create_state("00",vr.con.constant.unit,unit_address));
                    if(unit_state.data.length===0&&block!=null){
                        unit_info = [req_tx.hash,req_height,req_block.hash,output_hash,vr.crypto.bigint2hex(bigInt(block.meta.height,16)),i,unit_address];
                    }
                    return 1;
                }
            });
            if(unit_info!=null) break;
            height = height.subtract(1);
        }
        if(unit_info==null) throw new Error('no new refresh-tx');
        const unit_price:string = config.miner.unit_price;
        const nonce = await works.get_nonce(unit_info[0],unit_info[1],unit_info[2],my_unit_address,unit_info[3],unit_price);
        if(bigInt(nonce,16).eq(0)) throw new Error('fail to get valid nonce');
        const unit:vr.Unit = [unit_info[4],unit_info[5],nonce,my_unit_address,unit_price];
        await unit_db.write_obj(unit_info[6],unit);
        await peer_list_db.filter('hex','utf8',async (key,peer:data.peer_info)=>{
            const peer_id = await promisify(PeerId.createFromJSON)(peer.identity);
            const peer_info = new PeerInfo(peer_id);
            peer.multiaddrs.forEach(add=>peer_info.multiaddrs.add(add));
            node.dialProtocol(peer_info,`/vreath/${data.id}/unit/post`,(err:string,conn:any) => {
                if (err) { log.info(err); }
                pull(pull.values([JSON.stringify(unit)]), conn);
            });
            return false;
        });
    }
    catch(e){
        //err_fn.apply(null,e);
        log.info(e);
    }
    await works.sleep(5000);
    setImmediate(()=>making_unit.apply(null,[private_key,config,node,chain_info_db,root_db,trie_db,block_db,state_db,unit_db,peer_list_db,log]));
    return 0;
}
