"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const web3_1 = __importDefault(require("web3"));
const child_process_1 = require("child_process");
const works = __importStar(require("../../logic/work"));
const get_last_blockheader = async (web3) => {
    const height = await web3.eth.getBlockNumber();
    const block = await web3.eth.getBlock(height);
    console.log(JSON.stringify(block, null, 4));
};
(async () => {
    await child_process_1.exec('parity --light --chain kovan  --ws-origins all');
    console.log('start a light client of ethereum...');
    await works.sleep(1000);
    const provider = new web3_1.default.providers.WebsocketProvider('ws://127.0.0.1:8546');
    const web3 = new web3_1.default(provider);
    await get_last_blockheader(web3);
})();
