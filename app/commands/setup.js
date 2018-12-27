"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const data = __importStar(require("../../logic/data"));
const genesis = __importStar(require("../../genesis/index"));
const fs = __importStar(require("fs"));
const util_1 = require("util");
const P = __importStar(require("p-iteration"));
exports.default = async () => {
    const S_Trie = data.state_trie_ins('');
    await P.forEach(genesis.state, async (s) => {
        if (s.kind === 'state')
            await S_Trie.put(s.owner, s);
        else if (s.kind === 'info')
            await S_Trie.put(s.token, s);
    }, []);
    await util_1.promisify(fs.writeFile)('./json/chain.json', JSON.stringify([genesis.block], null, 4), 'utf-8');
    await util_1.promisify(fs.writeFile)('./json/root.json', JSON.stringify(genesis.roots, null, 4), 'utf-8');
    await util_1.promisify(fs.writeFile)('./json/pool.json', "{}", 'utf-8');
    await util_1.promisify(fs.writeFile)('./json/peer_list.json', JSON.stringify(genesis.peers, null, 4), 'utf-8');
};
