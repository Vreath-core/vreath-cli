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
import * as vr from 'vreath'
import Web3 from 'web3'
import {exec} from 'child_process'
import * as works from '../../logic/work'
import bigInt, {BigInteger} from 'big-integer';
import { Block as Eth_Block } from 'web3/eth/types';

/*
const ethereum_run = async (ethereum_db:vr.db,ethereum_last_height:string)=>{
    await exec('parity --light --chain kovan  --ws-origins all');
    console.log('start a light client of ethereum...');
    await works.sleep(5000);
    const provider = new Web3.providers.WebsocketProvider('ws://127.0.0.1:8546');
    const web3 = new Web3(provider);
    const new_height = bigInt(ethereum_last_height,16).add(1).toJSNumber();
    const last_block = await get_last_blockheader(web3,new_height);
}

const get_last_blockheader = async (web3:Web3,height:number)=>{
    const block = await web3.eth.getBlock(height);
    return block;
}

const block2header = (block:Eth_Block)=>{

    /*const header:vr.ethereum_header = {
        difficulty:vr.crypto.bigint2hex(bigInt(block.difficulty)),
        extraData:block.extraData.slice(2),
        hash:block.hash.slice(2),
        logsBloom:block.logsBloom.slice(2),
        miner:block.miner.slice(2),
        number:vr.crypto.bigint2hex(bigInt(block.number)),
        parentHash:block.parentHash.slice(2),
        receiptsRoot:block.receiptRoot.slice(2),
        size:vr.crypto.bigint2hex(bigInt(block.size)),
        stateRoot:block.stateRoot.slice(2)

    }*/
/*}

(async ()=>{
    //await exec('parity --chain=ropsten  --ws-origins all');
    //console.log('start a light client of ethereum...');
    //await works.sleep(3000);
    const provider = new Web3.providers.WebsocketProvider('ws://127.0.0.1:8450');
    const web3 = new Web3(provider);
    const block = await get_last_blockheader(web3,0);
    //console.log(block);
    //web3.eth.getWork().then(console.log);
    web3.eth.isMining().then(console.log)
    const num = await web3.eth.getBlockNumber();
    console.log(num)
})();
*/