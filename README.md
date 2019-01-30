# vreath-cli

### CLI wallet for Vreath
---

## Attention
This is under development.  
Our main net is not launched yet.  
Our token has no value now since we could reset the blockchain.

## Installation
`npm install Vreath-core/vreath-cli -g`

## Quick Start
Generate private key to use:  
`vreath generate-keys`  
You have to set new password to encrypt the private key and keep it secretly!  

Setup data such as the genesis block, genesis state and so on:  
`vreath setup`  

If you want to make units as miner and get the mining fees, enable the miner mode in your config file:  
`vreath config --miner_mode=true`  
It puts stress on your CPU or GPU.  

Run your PC as node:  
`vreath run`  

## Usage --Commands
## Usage --Repl
## License
[MIT](https://github.com/Vreath-core/vreath-cli/blob/master/LICENSE)