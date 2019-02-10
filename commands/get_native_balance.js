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
const fs = __importStar(require("fs"));
const util_1 = require("util");
const data_1 = require("../logic/data");
exports.default = async (config, id) => {
    const pub_keys = config.pub_keys || [];
    const my_pub = pub_keys[id];
    if (my_pub == null)
        return 0;
    const address = vr.crypto.generate_address(vr.con.constant.native, my_pub);
    const roots = JSON.parse(await util_1.promisify(fs.readFile)('./json/root.json', 'utf-8'));
    const stateroot = roots.stateroot;
    const S_Trie = data_1.state_trie_ins(stateroot);
    const balance = await data_1.get_native_balance(address, S_Trie);
    return balance;
};
//# sourceMappingURL=get_native_balance.js.map