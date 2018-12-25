"use strict";
exports.__esModule = true;
var vr = require("vreath");
/*import * as P from 'p-iteration'
import * as data from '../logic/data'*/
exports.genesis_pub = '0234d5f4af3126a2183b633b0f9869512bcc01e4650251695ba33a7448c6091212';
var genesis_unit_address = vr.crypto.genereate_address(vr.con.constant.unit, exports.genesis_pub);
exports.genesis_state = [vr.state.create_state(0, genesis_unit_address, vr.con.constant.unit, 1), vr.state.create_info(0, vr.con.constant.native), vr.state.create_info(0, vr.con.constant.unit, 1)];
/*const S_Trie = data.state_trie_ins('');
const L_Trie = data.lock_trie_ins('');


(async ()=>{
    await P.forEach(genesis_state, async s=>{
        if(s.kind==='state') await S_Trie.put(s.owner,s);
        else if(s.kind==='info') await S_Trie.put(s.token,s);
    },[]);
    console.log(S_Trie.now_root());
    console.log(L_Trie.now_root());
})();*/
exports.genesis_roots = {
    stateroot: '5ce80f1d76ef0618b36653706fac78414a3e470c64a70e7d8ab5363da5d04158',
    lockroot: '56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421'
};
