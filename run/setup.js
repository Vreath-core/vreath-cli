"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vr = __importStar(require("vreath"));
const data = __importStar(require("../logic/data"));
const genesis = __importStar(require("../genesis/index"));
const fs = __importStar(require("fs"));
const fse = __importStar(require("fs-extra"));
const readline_sync_1 = __importDefault(require("readline-sync"));
const util_1 = require("util");
const P = __importStar(require("p-iteration"));
const work_1 = require("../logic/work");
const my_password = readline_sync_1.default.question('Your password:', { hideEchoBack: true, defaultInput: 'password' });
(async () => {
    try {
        const my_key = vr.crypto.hash(my_password).slice(0, 122);
        await util_1.promisify(fs.stat)('./keys/private/' + my_key + '.txt');
        const S_Trie = data.state_trie_ins('');
        await P.forEach(genesis.state, async (s) => {
            if (s.kind === 'state')
                await S_Trie.put(s.owner, s);
            else if (s.kind === 'info')
                await S_Trie.put(s.token, s);
        }, []);
        await fse.emptyDir('./json/chain/net_id_' + vr.con.constant.my_net_id.toString());
        const info = {
            net_id: vr.con.constant.my_net_id,
            chain_id: vr.con.constant.my_chain_id,
            version: vr.con.constant.my_version,
            compatible_version: vr.con.constant.compatible_version,
            last_height: 0,
            pos_diffs: []
        };
        await util_1.promisify(fs.writeFile)('./json/chain/net_id_' + vr.con.constant.my_net_id.toString() + '/info.json', JSON.stringify(info, null, 4), 'utf-8');
        await work_1.write_chain(genesis.block);
        await util_1.promisify(fs.writeFile)('./json/root.json', JSON.stringify(genesis.roots, null, 4), 'utf-8');
        await util_1.promisify(fs.writeFile)('./json/pool.json', JSON.stringify({}), 'utf-8');
        await util_1.promisify(fs.writeFile)('./json/peer_list.json', JSON.stringify(genesis.peers, null, 4), 'utf-8');
        await util_1.promisify(fs.writeFile)('./json/unit_store.json', JSON.stringify({}), 'utf-8');
    }
    catch (e) {
        console.log(e);
    }
})();
//# sourceMappingURL=setup.js.map