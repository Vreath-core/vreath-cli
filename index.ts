import {run as _run} from './commands/run'
import _setup from './commands/setup'
import {config} from './commands/config'
import bunyan from 'bunyan'
import * as fs from 'fs'
import * as path from 'path'

export const run = async ()=>{
    const log = bunyan.createLogger({
        name:'vreath-cli',
        streams:[
            {
                path:path.join(__dirname,'../log/main.log')
            }
        ]
    });
    const config:config = JSON.parse(fs.readFileSync(path.join(__dirname,'../config/config.json'),'utf-8'));
    await _run(config,log);
}

export const setup = async ()=>{
    await _setup();
}
