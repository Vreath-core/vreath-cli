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
exports.default = async (my_private) => {
    try {
        const roots = await data.read_root();
        const S_Trie = data.state_trie_ins(roots.stateroot);
        const pub = vr.crypto.private2public(my_private);
        const add = vr.crypto.generate_address(vr.con.constant.native, pub);
        const state = await data.read_state(S_Trie, add, vr.state.create_state());
        if (state == null || state.amount === 0)
            return 0;
        else
            return state.amount || 0;
    }
    catch (e) {
        console.log(e);
    }
};
//# sourceMappingURL=balance.js.map