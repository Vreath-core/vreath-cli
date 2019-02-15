"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const vr = __importStar(require("vreath"));
/*import * as P from 'p-iteration'
import * as data from '../logic/data'*/
exports.genesis_pub = '0234d5f4af3126a2183b633b0f9869512bcc01e4650251695ba33a7448c6091212';
const genesis_unit_address = vr.crypto.generate_address(vr.con.constant.unit, exports.genesis_pub);
exports.genesis_state = [vr.state.create_state(0, genesis_unit_address, vr.con.constant.unit, 1, { used: "[]" }), vr.state.create_info(0, vr.con.constant.native), vr.state.create_info(0, vr.con.constant.unit, 1)];
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
    stateroot: 'ae81cfaea8e0dd7b3c6a083f5f6f10b9d66ce482a154aa399d7dba25f88d1c5b',
    lockroot: '56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421'
};
//# sourceMappingURL=state.js.map