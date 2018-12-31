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
        const block = await works.make_block(chain,[validator_pub],roots.stateroot,roots.lockroot,'',pool,private_key,validator_pub,S_Trie,L_Trie);
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
        //console.log(accepted[1]);

        const new_chain = chain.concat(block);
        await promisify(fs.writeFile)('./json/chain.json',JSON.stringify(new_chain,null, 4),'utf-8');

        const new_roots = {
            stateroot:S_Trie.now_root(),
            lockroot:L_Trie.now_root()
        }
        await promisify(fs.writeFile)('./json/root.json',JSON.stringify(new_roots,null, 4),'utf-8');

        const txs_hash = block.txs.map(pure=>pure.hash);
        const new_pool_keys = Object.keys(pool).filter(key=>txs_hash.indexOf(key)===-1);
        const new_pool = new_pool_keys.reduce((obj:vr.Pool,key)=>{
            obj[key] = pool[key];
            return obj;
        },{});
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

const refreshing = async (private_key:string)=>{
    try{
        const config = JSON.parse(await promisify(fs.readFile)('./config/config.json','utf-8'));
        const validator_pub:string = config.pub_keys[config.refresher.use];
        const feeprice = Number(config.refresher.fee_price);
        const unit_price = Number(config.refresher.unit_price);
        const log = "";
        const chain:vr.Block[] = JSON.parse(await promisify(fs.readFile)('./json/chain.json','utf-8'));
        let refreshed:string[] = [];
        let search_block:vr.Block;
        let tx_i:string;
        let search_tx:vr.TxPure;
        let block_height = -1;
        let tx_index = -1;
        for(search_block of chain.slice().reverse()){
            for(tx_i in search_block.txs){
                search_tx = search_block.txs[Number(tx_i)];
                if(search_tx.meta.kind==='request'&&refreshed.indexOf(search_tx.hash)===-1){
                    block_height = search_block.meta.height;
                    tx_index = Number(tx_i);
                    break;
                }
                else if(search_tx.meta.kind==='refresh'){
                    refreshed.push(search_tx.meta.req_tx_hash);
                }
            }
        }
        if(block_height===-1||tx_index===-1) throw new Error('any request tx is already refreshed.');
        const roots:{stateroot:string,lockroot:string} = JSON.parse(await promisify(fs.readFile)('./json/root.json','utf-8'));
        const S_Trie = data.state_trie_ins(roots.stateroot);
        const L_Trie = data.lock_trie_ins(roots.lockroot);
        const tx = await works.make_ref_tx([validator_pub],feeprice,unit_price,block_height,tx_index,log,private_key,validator_pub,chain,S_Trie,L_Trie);

        const pool:vr.Pool = JSON.parse(await promisify(fs.readFile)('./json/pool.json','utf-8'));
        const StateData = await data.get_tx_statedata(tx,chain,S_Trie);
        const LockData = await data.get_tx_lockdata(tx,chain,L_Trie);

        const new_pool = vr.pool.tx2pool(pool,tx,chain,StateData,LockData);
        await promisify(fs.writeFile)('./json/pool.json',JSON.stringify(new_pool,null, 4),'utf-8');

        const peers:{protocol:string,ip:string,port:number}[] = JSON.parse(await promisify(fs.readFile)('./json/peer_list.json','utf-8')||"[]");
        const header = {
            'Content-Type':'application/json'
        };
        peers.forEach(peer=>{
            const url = peer.protocol+'://'+peer.ip+':'+peer.port+'/tx';
            const option = {
                url: url,
                method: 'POST',
                headers: header,
                json: true,
                form:tx
            }
            request(option,(err,res)=>{
            });
        });
    }
    catch(e){
        //console.log(e);
    }
}

const app = express();
app.listen(57750);
app.use(bodyParser.json());
app.use(express.urlencoded({extended: true}));

app.use('/tx',tx_routes);
app.use('/block',block_routes);

/*app.get('/get_ip',(req,res)=>{
    const remote_add = req.connection.remoteAddress || "";
    const splited_add = remote_add.split(':');
    res.send()
})*/

const my_private = readlineSync.question('Your private key:',{hideEchoBack: true});


setInterval(async ()=>{
    const config = JSON.parse(await promisify(fs.readFile)('./config/config.json','utf-8'));
    if(config.validator.flag) await staking(my_private);
    if(config.miner.flag) await refreshing(my_private);
},1000);

const replServer = repl.start({prompt:'>',terminal:true});

replServer.defineCommand('setup',{
    help: 'Setup genesis data',
    async action(){
      await setup();
      console.log('finish set up');
    }
});

replServer.defineCommand('request-tx',{
    help: 'Create request tx',
    async action(input){
        try{
            const splited = input.split('--').slice(1);;
            const config = JSON.parse(await promisify(fs.readFile)('./config/config.json','utf-8'));
            const user_pub:string = config.pub_keys[config.user.use];
            const type:vr.TxType = splited[0].split('=')[1].trim() as vr.TxType;
            const tokens = splited[1].split('=')[1].trim().split(',');
            const bases = splited[2].split('=')[1].trim().split(',');
            const feeprice = Number(splited[3].split('=')[1].trim());
            const gas = Number(splited[4].split('=')[1].trim());
            const input_raw = splited[5].split('=')[1].trim().split(',');
            const log = splited[6].split('=')[1].trim();
            const chain:vr.Block[] = JSON.parse(await promisify(fs.readFile)('./json/chain.json','utf-8'));
            const roots:{stateroot:string,lockroot:string} = JSON.parse(await promisify(fs.readFile)('./json/root.json','utf-8'));
            const S_Trie = data.state_trie_ins(roots.stateroot);
            const L_Trie = data.lock_trie_ins(roots.lockroot);
            const tx = await works.make_req_tx([user_pub],type,tokens,bases,feeprice,gas,input_raw,log,my_private,user_pub,chain,S_Trie,L_Trie);
            const pool:vr.Pool = JSON.parse(await promisify(fs.readFile)('./json/pool.json','utf-8'));
            const StateData = await data.get_tx_statedata(tx,chain,S_Trie);
            const LockData = await data.get_tx_lockdata(tx,chain,L_Trie);
            const new_pool = vr.pool.tx2pool(pool,tx,chain,StateData,LockData);

            await promisify(fs.writeFile)('./json/pool.json',JSON.stringify(new_pool,null, 4),'utf-8');
            const peers:{protocol:string,ip:string,port:number}[] = JSON.parse(await promisify(fs.readFile)('./json/peer_list.json','utf-8')||"[]");
            const header = {
                'Content-Type':'application/json'
            };
            peers.forEach(peer=>{
                const url = peer.protocol+'://'+peer.ip+':'+peer.port+'/tx';
                const option = {
                    url: url,
                    method: 'POST',
                    headers: header,
                    json: true,
                    form:tx
                }
                request(option,(err,res)=>{
                });
            });
        }
        catch(e){
            console.log(e);
        }
    }
});

replServer.defineCommand('remit',{
    help: 'Create request tx',
    async action(input){
        try{
            const splited = input.split('--').slice(1);
            const config = JSON.parse(await promisify(fs.readFile)('./config/config.json','utf-8'));
            const user_pub:string = config.pub_keys[config.user.use];
            const type:vr.TxType = "change"
            const tokens = [vr.con.constant.native];
            const remitter = vr.crypto.genereate_address(vr.con.constant.native,user_pub);
            const receiver = splited[0].split('=')[1].trim().split(',').map(add=>{
                if(add==="remitter") return remitter;
                else return add;
            });
            const bases = [remitter].concat(receiver).filter((val,i,array)=>array.indexOf(val)===i);
            const feeprice = Number(splited[1].split('=')[1].trim());
            const gas = Number(splited[2].split('=')[1].trim());
            const amount = splited[3].split('=')[1].trim().split(',');
            if(receiver.length!=amount.length) throw new Error('invalid amount');
            const log = splited[4].split('=')[1].trim();
            const chain:vr.Block[] = JSON.parse(await promisify(fs.readFile)('./json/chain.json','utf-8'));
            const roots:{stateroot:string,lockroot:string} = JSON.parse(await promisify(fs.readFile)('./json/root.json','utf-8'));
            const S_Trie = data.state_trie_ins(roots.stateroot);
            const L_Trie = data.lock_trie_ins(roots.lockroot);
            //console.log(await S_Trie.filter());
            const tx = await works.make_req_tx([user_pub],type,tokens,bases,feeprice,gas,amount,log,my_private,user_pub,chain,S_Trie,L_Trie);

            const pool:vr.Pool = JSON.parse(await promisify(fs.readFile)('./json/pool.json','utf-8'));
            const StateData = await data.get_tx_statedata(tx,chain,S_Trie);
            const LockData = await data.get_tx_lockdata(tx,chain,L_Trie);

            const new_pool = vr.pool.tx2pool(pool,tx,chain,StateData,LockData);
            await promisify(fs.writeFile)('./json/pool.json',JSON.stringify(new_pool,null, 4),'utf-8');

            const peers:{protocol:string,ip:string,port:number}[] = JSON.parse(await promisify(fs.readFile)('./json/peer_list.json','utf-8')||"[]");
            const header = {
                'Content-Type':'application/json'
            };
            peers.forEach(peer=>{
                const url = peer.protocol+'://'+peer.ip+':'+peer.port+'/tx';
                const option = {
                    url: url,
                    method: 'POST',
                    headers: header,
                    json: true,
                    form:tx
                }
                request(option,(err,res)=>{
                });
            });
            this.close();
        }
        catch(e){
            console.log(e);
        }
    }
});
