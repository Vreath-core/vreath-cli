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
const data = __importStar(require("../../logic/data"));
const big_integer_1 = __importDefault(require("big-integer"));
exports.default = async (input, my_private) => {
    try {
        const splited = input.split('--').slice(1);
        let bases = splited[0].trim().split(',');
        if (bases[0] === '' && bases.length === 1)
            bases = [];
        const my_public = vr.crypto.private2public(my_private);
        const main_token = bases.length > 0 ? vr.crypto.slice_token_part(bases[0]) : vr.con.constant.native;
        const my_address = vr.crypto.generate_address(main_token, my_public);
        bases.push(my_address);
        const feeprice = vr.crypto.bigint2hex(big_integer_1.default(splited[1].trim()));
        const gas = vr.crypto.bigint2hex(big_integer_1.default(splited[2].trim()));
        let input_raw = splited[3].trim().split(',').map(data => vr.crypto.bigint2hex(big_integer_1.default(data, 10)));
        if (input_raw[0] === '' && input_raw.length === 1)
            input_raw = [];
        const log = Buffer.from(splited[4].trim(), 'utf8').toString('hex');
        const info = await data.chain_info_db.read_obj("00");
        if (info == null)
            throw new Error("chain_info doesn't exist");
        const root = await data.root_db.get(info.last_height);
        if (root == null)
            throw new Error("root doesn't exist");
        const trie = vr.data.trie_ins(data.trie_db, root);
        const tx = await works.make_req_tx(0, bases, feeprice, gas, input_raw, log, my_private, trie, data.state_db, data.lock_db);
        await data.tx_db.write_obj(tx.hash, tx);
    }
    catch (e) {
        console.log(e);
    }
};
