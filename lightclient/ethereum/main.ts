/*import Web3 from 'web3';

const web3 = new Web3(new Web3.providers.HttpProvider('https://ropsten.infura.io'));
const get_last_blockheader = async ()=>{
    const height = await web3.eth.getBlockNumber();
    const block = await web3.eth.getBlock(height);
    console.log(JSON.stringify(block,null,4))
}

(async ()=>{
    await get_last_blockheader();
})();*/

import Web3 from 'web3'
import {exec} from 'child_process'
import * as works from '../../logic/work'


const get_last_blockheader = async (web3:Web3)=>{
    const height = await web3.eth.getBlockNumber();
    const block = await web3.eth.getBlock(height);
    console.log(JSON.stringify(block,null,4))
}

(async ()=>{
    await exec('parity --light --chain kovan  --ws-origins all');
    console.log('start a light client of ethereum...');
    await works.sleep(1000);
    const provider = new Web3.providers.WebsocketProvider('ws://127.0.0.1:8546');
    const web3 = new Web3(provider);
    await get_last_blockheader(web3);
})();
