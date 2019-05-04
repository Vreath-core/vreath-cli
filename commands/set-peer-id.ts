import {promisify} from 'util'
const PeerId = require('peer-id');
import * as works from '../logic/work'
import {peer_info} from '../logic/data'
import * as fs from 'fs'
import * as path from 'path'

export default async ()=>{
    const peer_id = await promisify(PeerId.create)();
    const obj:peer_info = peer_id.toJSON();
    const config = JSON.parse(fs.readFileSync(path.join(__dirname,'../config/config.json'),'utf-8'));
    const new_config = works.new_obj(config, (config)=>{
        config.peer = obj;
        return config
    });
    await promisify(fs.writeFile)(path.join(__dirname,'../config/config.json'),JSON.stringify(new_config,null,4));
}