import {promisify} from 'util'
import * as fs from 'fs'
import * as path from 'path'
import {setup_data, test_setup} from './setup'
import {run_node1,run_node2,run_node3,run_node4} from './nodes'


(async ()=>{
    const setup_data:setup_data = JSON.parse(await promisify(fs.readFile)(path.join(__dirname,'./test_genesis_data.json'),'utf8'));
    run_node1(setup_data);
    run_node2(setup_data);
    run_node3(setup_data);
    run_node4(setup_data);
})();