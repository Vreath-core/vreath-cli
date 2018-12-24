import {Command,flags} from '@oclif/command'
import * as express from 'express'
import * as bodyParser from 'body-parser'
import * as vr from 'vreath'
import tx from '../../app/routes/tx'
import block from '../../app/routes/block'
import * as works from '../../logic/work'
import * as data from '../../logic/data'
import * as genesis from '../../genesis/index'
import * as fs from 'fs'
import {promisify} from 'util'
import * as P from 'p-iteration'
import * as request from 'request'


export default class Start extends Command {
    static description = 'start server';
    static hidden = false;

    private async setup() {
        console.log('setup...')
        const S_Trie = data.state_trie_ins('');

        await P.forEach(genesis.state, async s=>{
            if(s.kind==='state') await S_Trie.put(s.owner,s);
            else if(s.kind==='info') await S_Trie.put(s.token,s);
        },[]);

        await promisify(fs.writeFile)('./json/chain.json',JSON.stringify(genesis.block,null, 4),'utf-8');
        await promisify(fs.writeFile)('./json/root.json',JSON.stringify(genesis.roots,null, 4),'utf-8');
        await promisify(fs.writeFile)('./json/pool.json',"{}",'utf-8');
        await promisify(fs.writeFile)('./json/peer_list.json',JSON.stringify(genesis.peers,null, 4),'utf-8');
    }

    private async staking() {
        setInterval(async ()=>{
            try{
                const chain:vr.Block[] = JSON.parse(await promisify(fs.readFile)('./json/chain.json','utf-8'));
                const config = JSON.parse(await promisify(fs.readFile)('./json/chain.json','utf-8'));
                const validator_pub:string = config.pub_keys[config.validator.use];
                if(validator_pub==null) throw new Error('invalid validator public key');
                const roots:{stateroot:string,lockroot:string} = JSON.parse(await promisify(fs.readFile)('./json/root.json','utf-8'));
                const pool:vr.Pool = JSON.parse(await promisify(fs.readFile)('./json/root.json','utf-8'));
                const S_Trie = data.state_trie_ins(roots.stateroot);
                const unit_validator = vr.crypto.genereate_address(vr.con.constant.unit,validator_pub);
                const unit_validator_state:vr.State = await S_Trie.get(unit_validator);
                if(unit_validator_state==null||unit_validator_state.amount===0) throw new Error('the validator has no units');
                const L_Trie = data.lock_trie_ins(roots.lockroot);
                const block = await works.make_blocks(chain,[validator_pub],roots.stateroot,roots.lockroot,'',pool,S_Trie,L_Trie);
                const peers:{protocol:string,ip:string,port:number}[] = JSON.parse(await promisify(fs.readFile)('./json/root.json','utf-8'));
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
                        if(err) console.log(err);
                        else console.log(res);
                    });
                });
            }
            catch(e){
                console.log(e);
            }
        },1000);
    }

    static flags = {
        setup: flags.boolean()
    }


    async run() {
        const {flags} = this.parse(Start)
        if(flags.setup) await this.setup();

        const app = express();
        app.listen(57750);
        app.use(bodyParser.json());
        app.use(express.urlencoded({extended: true}));

        app.use('/tx',tx);
        app.use('/block',block);

        const config = JSON.parse(await promisify(fs.readFile)('./json/chain.json','utf-8'));
        if(config.validator.flag) await this.staking();
    }
}

