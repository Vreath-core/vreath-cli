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
const data = __importStar(require("../../logic/data"));
const fs = __importStar(require("fs"));
const util_1 = require("util");
exports.default = async (my_private) => {
    try {
        const roots = JSON.parse(await util_1.promisify(fs.readFile)('./json/root.json', 'utf-8'));
        const S_Trie = data.state_trie_ins(roots.stateroot);
        const pub = vr.crypto.private2public(my_private);
        const add = vr.crypto.generate_address(vr.con.constant.native, pub);
        const state = await S_Trie.get(add);
        if (state == null)
            return 0;
        else
            return state.amount || 0;
    }
    catch (e) {
        console.log(e);
    }
};
//# sourceMappingURL=balance.js.map