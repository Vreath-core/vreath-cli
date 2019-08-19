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
const works = __importStar(require("../../logic/work"));
const big_integer_1 = __importDefault(require("big-integer"));
exports.default = async (input, my_private, chain_info_db, root_db, trie_db, state_db, lock_db, tx_db) => {
    try {
        const splited = input.trim().split('--').slice(1);
        let bases = splited[0].trim().split(',');
        if (bases[0] === '' && bases.length === 1)
            bases = [];
        const my_public = vr.crypto.private2public(my_private);
        const main_token = bases.length > 0 ? vr.crypto.slice_token_part(bases[0]) : vr.con.constant.native;
        const my_address = vr.crypto.generate_address(main_token, my_public);
        bases = [my_address].concat(bases);
        const feeprice = vr.crypto.bigint2hex(big_integer_1.default(splited[1].trim()));
        const gas = vr.crypto.bigint2hex(big_integer_1.default(splited[2].trim()));
        let input_raw = splited[3].trim().split(',').map(data => vr.crypto.bigint2hex(big_integer_1.default(data, 10)));
        if (input_raw[0] === '' && input_raw.length === 1)
            input_raw = [];
        const log = Buffer.from(splited[4].trim(), 'utf8').toString('hex');
        let info = await chain_info_db.read_obj("00");
        if (info == null)
            throw new Error("chain_info doesn't exist");
        const root = await root_db.get(info.last_height);
        if (root == null)
            throw new Error("root doesn't exist");
        const trie = vr.data.trie_ins(trie_db, root);
        const requesting = info.manual_requesting.flag;
        if (requesting)
            throw new Error("requesting now");
        const first_state = await vr.data.read_from_trie(trie, state_db, bases[0], 0, vr.state.create_state("00", main_token, my_address));
        const tx = await works.make_req_tx(0, first_state.nonce, bases, feeprice, gas, input_raw, log, my_private, false, trie, state_db, lock_db);
        await tx_db.write_obj(tx.hash, tx);
        info.manual_requesting.flag = true;
        info.manual_requesting.address = my_address;
        info.manual_requesting.tx_hash = tx.hash;
        info.manual_requesting.nonce = first_state.nonce;
        await chain_info_db.write_obj("00", info);
        return tx;
    }
    catch (e) {
        console.log(e);
    }
};
