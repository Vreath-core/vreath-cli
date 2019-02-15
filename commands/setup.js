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
const data = __importStar(require("../logic/data"));
const genesis = __importStar(require("../genesis/index"));
const fs = __importStar(require("fs"));
const fse = __importStar(require("fs-extra"));
const util_1 = require("util");
const P = __importStar(require("p-iteration"));
const work_1 = require("../logic/work");
const math = __importStar(require("mathjs"));
math.config({
    number: 'BigNumber'
});
exports.default = async (my_password) => {
    const my_key = vr.crypto.hash(my_password).slice(0, 122);
    await util_1.promisify(fs.stat)('./keys/private/' + my_key + '.txt');
    const S_Trie = data.state_trie_ins('');
    const reduced_state = genesis.state.map(s => {
        if (s.kind != 'state' || s.token != vr.con.constant.unit)
            return s;
        return work_1.new_obj(s, s => {
            s.amount = math.chain(s.amount).multiply(vr.con.constant.unit_rate).done();
            return s;
        });
    });
    await P.forEach(reduced_state, async (s) => {
        if (s.kind === 'state')
            await S_Trie.put(s.owner, s);
        else if (s.kind === 'info')
            await S_Trie.put(s.token, s);
    }, []);
    const new_roots = {
        stateroot: S_Trie.now_root(),
        lockroot: genesis.roots.lockroot
    };
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
    await util_1.promisify(fs.writeFile)('./json/root.json', JSON.stringify(new_roots, null, 4), 'utf-8');
    await util_1.promisify(fs.writeFile)('./json/pool.json', JSON.stringify({}), 'utf-8');
    await util_1.promisify(fs.writeFile)('./json/peer_list.json', JSON.stringify(genesis.peers, null, 4), 'utf-8');
    await util_1.promisify(fs.writeFile)('./json/unit_store.json', JSON.stringify({}), 'utf-8');
};
//# sourceMappingURL=setup.js.map