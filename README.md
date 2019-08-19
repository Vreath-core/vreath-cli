# vreath-cli

### CLI wallet for Vreath
---

![demo](https://github.com/Vreath-core/Documents/blob/master/vreath_demo_node4.gif?raw=true)  

## Attention
This is under development.  
Our main net is not launched yet.  
As we could reset the blockchain, at present, our token has no value.  

## Requirements
- nodebrew  
    1. Install nodebrew. (https://github.com/hokaccha/nodebrew)  
        `curl -L git.io/nodebrew | perl - setup`  
        `export PATH=$HOME/.nodebrew/current/bin:$PATH`  
        `source ~/.bash_profile`
    2. Check nodebrew is installed.  
        `nodebrew help`  

- nodejs v11.13.0+  
- npm v6.7.0+  
    1. Install nodejs and npm with nodebrew.  
        `nodebrew install latest`  
    2. Check nodejs and npm is installed.  
        `node -v`  
        `npm -v`  

- yarn 1.17.3+  
    1. Install yarn with npm.  
        `npm install -g yarn`  
    2. Check yarn is installed.
        `yarn -v`  
- cargo v1.35.0+ (nightly)  
    1. Install cargo, rustup and rustc. (https://doc.rust-lang.org/cargo/getting-started/installation.html)  
    2. Change the version of rustc into nightly.  
       `rustup default nightly`  
    3. Check cargo, rustup and rustc is installed.  
        `cargo -V`  
        `rustup -V`  
        `rustc -V`  

## Installation
`git clone https://github.com/Vreath-core/vreath-cli.git`  
`cd ./vreath-cli`  
`yarn build`  

## Quick Start
Generate private key to use:  
`vreath generate-keys`  
You have to set new password to encrypt the private key and keep it secretly!  

Decrypt genesis peers:  
`vreath decrypt-genesis-peers`  

Set your peer info:  
`vreath set-peer-id`  

Setup data such as the genesis block, genesis state and so on:  
`vreath setup`  

If you want to make units as miner and get the mining fees, enable the miner mode in your config file:  
`vreath config --miner_mode=true`  
It puts stress on your CPU or GPU.  

Run your PC as a node:  
`vreath run`  

## Usage --Commands
- vreath generate-keys  
New private key and public key are generated.  
You have to set new password to encrypt the private key and keep it secretly.  

- vreath set-peer-id  
Peer id is set in config.json.  

- vreath setup  
The database is initialized: blocks, states and so on are removed.  

- vreath run  
Your PC runs as a node.  
After it begins well, the following repl-commands are available.  

## Usage --Repl
- .get-block (block height)  
The block having the specified height is displayed.  
(A block height is counted from zero.)  
For example, `.get-block 9` shows you the tenth block.

- .get-chain-info  
The meta data about your blockchain is displayed.  

    - id: the node id. (default: 1)  
    - native_balance: the amount of native token(VRT).  
    - unit_balance: the amount of unit token.  
    - last_height: the height of the last block.  
    - last_hash: the hash of the last block.  

- .output-chain  
A zip file of your chain is output.  

- .balance  
Your balance of VRT is displayed.  

- .request-tx --(addresses to request) --(feeprice) --(gas) --(input data) --(log data)  
A request transaction is published.  

## Demonstration
You can try a Vreath demonstration!  

### Terminal1
`vreath demo 1`  
Node 1 begins to run.  
It is a validator, miner and the genesis-peer.  

### Terminal2
`vreath demo 2`  
Node 2 begins to run.  
It is a miner.  

### Terminal3
`vreath demo 3`  
Node 3 begins to run.  
It is a miner.  

### Terminal4
`vreath demo 4`  
Node 4 begins to run.  
It is a validator and miner.  


## License
[MIT](https://github.com/Vreath-core/vreath-cli/blob/master/LICENSE)
