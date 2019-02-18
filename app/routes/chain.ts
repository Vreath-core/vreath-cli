import * as express from 'express'
import * as vr from 'vreath'
import * as fs from 'fs'
import {promisify} from 'util'
import {read_chain, chain_info} from '../../logic/work'
import * as P from 'p-iteration'
import rp from 'request-promise-native'
import bunyan from 'bunyan'
import * as math from 'mathjs'
math.config({
    number: 'BigNumber'
});

const log = bunyan.createLogger({
    name:'vreath-cli',
    streams:[
        {
            path:'./log/log.log'
        }
    ]
});

const router = express.Router();



export default router.get('/',async (req,res)=>{
    try{
        const req_diff_sum:number = req.body.diff_sum || 0;
        if(typeof req_diff_sum != 'number'){
            res.status(500).send('invalid data');
            return 0;
        }
        const info:chain_info = JSON.parse((await promisify(fs.readFile)('./json/chain/net_id_'+vr.con.constant.my_net_id.toString()+'/info.json','utf-8')));
        const my_diffs = info.pos_diffs;
        let height:number = 0;
        let sum:number = 0;
        let i:string;
        let index:number = 0;
        for(i in my_diffs){
            index = Number(i);
            if(math.larger(sum,req_diff_sum) as boolean){
                height = index;
                break;
            }
        }
        const chain:vr.Block[] = await read_chain(2*(10**9));
        res.json(chain.slice(height));
        return 1;
    }
    catch(e){
        res.status(500).send('error');
    }
}).post('/', async (req,res)=>{
    try{
        const new_chain:vr.Block[] = req.body;
        const my_chain:vr.Block[] = await read_chain(2*(10**9));
        const same_height = (()=>{
            let same_height:number = 0;
            let index:string;
            let i:number;
            for(index in new_chain.slice().reverse()){
                i = Number(index);
                if(my_chain[new_chain.length-1-i]!=null&&my_chain[new_chain.length-1-i].hash===new_chain[new_chain.length-1-i].hash){
                    same_height = new_chain.length-1-i;
                }
            }
            return same_height;
        })();
        const add_chain = new_chain.slice(same_height+1);
        const info:chain_info = JSON.parse((await promisify(fs.readFile)('./json/chain/net_id_'+vr.con.constant.my_net_id.toString()+'/info.json','utf-8')));
        const my_diff_sum = info.pos_diffs.slice(same_height+1).reduce((sum,diff)=>math.chain(sum).add(diff).done(),0);
        const new_diff_sum:number = add_chain.reduce((sum,block)=>math.chain(sum).add(block.meta.pos_diff).done(),0);
        if(math.largerEq(my_diff_sum,new_diff_sum)as boolean){
            res.status(500).send('light chain');
            return 0;
        }
        await P.forEach(add_chain, async block=>{
            await rp.post({
                url:'http://localhost:57750/block',
                body:block,
                json:true
            });
        });
        res.status(200).send('success');
        return 1;
    }
    catch(e){
        log.info(e);
        res.status(500).send('error');
    }
});