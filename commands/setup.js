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
const util_1 = require("util");
const P = __importStar(require("p-iteration"));
const work_1 = require("../logic/work");
const data_1 = require("../logic/data");
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
        await data.write_state(s);
        const hash = vr.crypto.object_hash(s);
        if (s.kind === 'state')
            await data.put_state_to_trie(S_Trie, hash, s.kind, s.owner);
        else if (s.kind === 'info')
            await data.put_state_to_trie(S_Trie, hash, s.kind, s.token);
    }, []);
    const new_roots = {
        stateroot: S_Trie.now_root(),
        lockroot: genesis.roots.lockroot
    };
    await data.reset_chain();
    const info = {
        net_id: vr.con.constant.my_net_id,
        chain_id: vr.con.constant.my_chain_id,
        version: vr.con.constant.my_version,
        compatible_version: vr.con.constant.compatible_version,
        last_height: 0,
        last_hash: genesis.block.hash,
        pos_diffs: []
    };
    await data.write_chain_info(info);
    await data_1.write_chain(genesis.block);
    await data.empty_pool();
    await data.write_root(new_roots);
    await P.forEach(genesis.peers, async (peer) => await data.write_peer(peer));
    await util_1.promisify(fs.writeFile)('./log/log.log', '', 'utf-8');
};
//# sourceMappingURL=setup.js.map