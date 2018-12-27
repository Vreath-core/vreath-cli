import * as vr from 'vreath'
import tx_routes from './app/routes/tx'
import block_routes from './app/routes/block'
import * as works from './logic/work'
import * as data from './logic/data'
import setup from './app/commands/setup'
import express from 'express'
import * as bodyParser from 'body-parser'
import * as fs from 'fs'
import {promisify} from 'util'
import * as P from 'p-iteration'
import request from 'request'
import * as repl from 'repl'
import readlineSync from 'readline-sync'

const staking = async (private_key:string)=>{
    try{
        const chain:vr.Block[] = JSON.parse(await promisify(fs.readFile)('./json/chain.json','utf-8'));
        const config = JSON.parse(await promisify(fs.readFile)('./config/config.json','utf-8'));
        const validator_pub:string = config.pub_keys[config.validator.use];
        if(validator_pub==null) throw new Error('invalid validator public key');
        const roots:{stateroot:string,lockroot:string} = JSON.parse(await promisify(fs.readFile)('./json/root.json','utf-8'));
        const pool:vr.Pool = JSON.parse(await promisify(fs.readFile)('./json/pool.json','utf-8'));
        const S_Trie = data.state_trie_ins(roots.stateroot);
        const unit_validator = vr.crypto.genereate_address(vr.con.constant.unit,validator_pub);
        const unit_validator_state:vr.State = await S_Trie.get(unit_validator);
        if(unit_validator_state==null||unit_validator_state.amount===0) throw new Error('the validator has no units');
        const L_Trie = data.lock_trie_ins(roots.lockroot);
        const block = await works.make_blocks(chain,[validator_pub],roots.stateroot,roots.lockroot,'',pool,private_key,validator_pub,S_Trie,L_Trie);
        const StateData = await data.get_block_statedata(block,chain,S_Trie);
        const LockData = await data.get_block_lockdata(block,chain,L_Trie);
        const accepted = (()=>{
            if(block.meta.kind==='key') return vr.block.accept_key_block(block,chain,StateData,LockData);
            else return vr.block.accept_micro_block(block,chain,StateData,LockData);
        })();
        await P.forEach(accepted[0], async (state:vr.State)=>{
            if(state.kind==='state') await S_Trie.put(state.owner,state);
            else await S_Trie.put(state.token,state);
        });

        await P.forEach(accepted[1], async (lock:vr.Lock)=>{
            await L_Trie.put(lock.address,lock);
        });

        const new_chain = chain.concat(block);
        await promisify(fs.writeFile)('./json/chain.json',JSON.stringify(new_chain,null, 4),'utf-8');

        const new_roots = {
            stateroot:S_Trie.now_root(),
            lockroot:L_Trie.now_root()
        }
        await promisify(fs.writeFile)('./json/root.json',JSON.stringify(new_roots,null, 4),'utf-8');

        const txs_hash = block.txs.map(pure=>pure.hash);
        const new_pool_keys = Object.keys(pool).filter(key=>txs_hash.indexOf(key)===-1);
        const new_pool = new_pool_keys.map(key=>pool[key]);
        await promisify(fs.writeFile)('./json/pool.json',JSON.stringify(new_pool,null, 4),'utf-8');

        const peers:{protocol:string,ip:string,port:number}[] = JSON.parse(await promisify(fs.readFile)('./json/peer_list.json','utf-8')||"[]");
        const header = {
            'Content-Type':'application/json'
        };
        peers.forEach(peer=>{
            const url = peer.protocol+'://'+peer.ip+':'+peer.port+'/block';
            const option = {
                url: url,
                method: 'POST',
                headers: header,
                json: true,
                form:block
            }
            request(option,(err,res)=>{
            });
        });
    }
    catch(e){
    }
}

const app = express();
app.listen(57750);
app.use(bodyParser.json());
app.use(express.urlencoded({extended: true}));

app.use('/tx',tx_routes);
app.use('/block',block_routes);

const my_private = readlineSync.question('Your private key:',{hideEchoBack: true});

setInterval(async ()=>{
    await staking(my_private);
},1000);

const replServer = repl.start({prompt:'>',terminal:true});
replServer.defineCommand('setup',{
    help: 'Setup genesis data',
    async action(){
      await setup();
      console.log('finish set up');
    }
});
