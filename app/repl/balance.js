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
const big_integer_1 = __importDefault(require("big-integer"));
exports.default = async (my_private, chain_info_db, root_db, trie_db, state_db) => {
    try {
        const info = await chain_info_db.read_obj("00");
        if (info == null)
            throw new Error("chain_info doesn't exist");
        const last_height = info.last_height;
        const root = await root_db.get(last_height, "hex");
        if (root == null)
            throw new Error("root doesn't exist");
        const trie = vr.data.trie_ins(trie_db, root);
        const pub = vr.crypto.private2public(my_private);
        const add = vr.crypto.generate_address(vr.con.constant.native, pub);
        const state = await vr.data.read_from_trie(trie, state_db, add, 0, vr.state.create_state("00", vr.con.constant.native, add, "00"));
        return big_integer_1.default(state.amount, 16).toString(10);
    }
    catch (e) {
        console.log(e);
    }
};
