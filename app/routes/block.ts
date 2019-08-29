import * as vr from 'vreath'
import * as data from '../../logic/data'
import * as works from '../../logic/work'
import * as P from 'p-iteration'
import * as bunyan from 'bunyan'
import { Node } from '../../commands/run';
import {post as finalize_post} from './finalize'
import {promisify} from 'util'
import bigInt from 'big-integer'
const PeerId = require('peer-id');
const PeerInfo = require('peer-info');
const pull = require('pull-stream');

export const get = async (msg:Buffer,stream:any,block_db:vr.db,log:bunyan):Promise<void>=>{
    try{
        const height = msg.toString('hex');
        if(vr.checker.hex_check(height,8,true)){
            throw new Error('invalid request data');
        }
        const block:vr.Block|null = await block_db.read_obj(height);
        if(block==null) throw new Error('invalid height');
        stream.write(JSON.stringify([block]));
        stream.write('end');
    }
    catch(e){
        log.info(e);
    }
}

export const post = async (message:Buffer,chain_info_db:vr.db,root_db:vr.db,trie_db:vr.db,block_db:vr.db,state_db:vr.db,lock_db:vr.db,tx_db:vr.db,peer_list_db:vr.db,finalize_db:vr.db,uniter_db:vr.db,private_key:string,node:Node,log:bunyan)=>{
    try{
        const msg_data:[vr.Block,vr.State[],vr.Finalize|null] = JSON.parse(message.toString('utf-8'));
        const block = msg_data[0];
        const output_state = msg_data[1];
        const finalize = msg_data[2];
        if(block==null||!vr.block.isBlock(block)||output_state==null||output_state.some(s=>!vr.state.isState(s))||(finalize!=null&&!vr.finalize.isFinalize(finalize))) throw new Error('invalid data');
        const info:data.chain_info|null = await chain_info_db.read_obj('00');
        if(info==null) throw new Error('chain_info is empty');
        const last_height = info.last_height;
        const root:string|null = await root_db.get(last_height,'hex');
        if(root==null) throw new Error('root is empty at the last height');
        const trie = vr.data.trie_ins(trie_db,root);
        let verified:boolean = await (async ()=>{
            if(block.meta.kind===0) return await vr.block.verify_key_block(block,block_db,trie,state_db,lock_db,last_height);
            else if(block.meta.kind===1) return await vr.block.verify_micro_block(block,output_state,block_db,trie,state_db,lock_db,last_height);
            else return false;
        })();
        if(!verified){
            throw new Error('invalid block');
        }
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
        const txs_hash = block.txs.map(tx=>tx.hash);
        await P.forEach(txs_hash, async (key:string)=>{
            await tx_db.del(key);
        });
        const pre_uniters:string[] = await uniter_db.read_obj(last_height) || [];
        const new_uniters = vr.finalize.rocate(pre_uniters);
        await uniter_db.write_obj(block.meta.height,new_uniters);
        if(finalize!=null) await finalize_post(Buffer.from(JSON.stringify(finalize),'utf8'),block_db,uniter_db,root_db,trie_db,state_db,finalize_db,log);
        if(block.meta.kind===0){
            const finalize = await works.make_finalize(private_key,block,chain_info_db,root_db,trie_db,uniter_db,state_db,log);
            if(finalize==null) throw new Error('fail to make valid finalize');
            const now_finalize:vr.Finalize[] = await finalize_db.read_obj(block.meta.height) || [];
            await finalize_db.write_obj(block.meta.height,now_finalize.concat(finalize));
            const peers:data.peer_info[] = await peer_list_db.filter('hex','utf8');
            await P.forEach(peers, async (peer:data.peer_info)=>{
                const peer_id = await promisify(PeerId.createFromJSON)(peer.identity);
                const peer_info = new PeerInfo(peer_id);
                peer.multiaddrs.forEach(add=>peer_info.multiaddrs.add(add));
                node.dialProtocol(peer_info,`/vreath/${data.id}/finalize/post`,(err:string,conn:any) => {
                    if (err) { log.info(err); }
                    pull(pull.values([JSON.stringify(finalize),'end']), conn);
                });
                return false;
            });
        }
        else if(new_info.manual_requesting.flag){
            const managed = await works.manual_request_manager(new_info,block,private_key,trie,state_db,lock_db,tx_db,log);
            const request_info = managed[0];
            const new_req_tx = managed[1];
            await chain_info_db.write_obj("00",request_info);
            if(new_req_tx!=null){
                await peer_list_db.filter('hex','utf8',async (key:string,peer:data.peer_info)=>{
                    const peer_id = await promisify(PeerId.createFromJSON)(peer.identity);
                    const peer_info = new PeerInfo(peer_id);
                    peer.multiaddrs.forEach(add=>peer_info.multiaddrs.add(add));
                    node.dialProtocol(peer_info,`/vreath/${data.id}/tx/post`,(err:string,conn:any) => {
                        if (err) { log.info(err) }
                        pull(pull.values([JSON.stringify([new_req_tx,[]]),'end']), conn);
                    });
                    return false;
                });
            }
        }
        return 1;
    }
    catch(e){
        log.info(e);
    }
}

