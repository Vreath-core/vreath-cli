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
const data = __importStar(require("../../logic/data"));
const big_integer_1 = __importDefault(require("big-integer"));
const path = __importStar(require("path"));
const bunyan_1 = __importDefault(require("bunyan"));
const log = bunyan_1.default.createLogger({
    name: 'vreath-cli',
    streams: [
        {
            path: path.join(__dirname, '../../log/log.log')
        }
    ]
});
/*unit
  height:8 byte,
  index:1 byte,
  nonce,8 byte,
  address:40 byte,
  unit_price:10 byte
*/
exports.post = async (msg) => {
    try {
        const unit = JSON.parse(msg.toString('utf-8'));
        if (!vr.unit.isUnit(unit))
            throw new Error('invalid data');
        const pulled = await vr.unit.get_info_from_unit(unit, data.block_db);
        const unit_address = pulled[1];
        const hash = pulled[2];
        const info = await data.chain_info_db.read_obj("00");
        if (info == null)
            throw new Error("chain_info doesn't exist");
        const last_height = info.last_height;
        const root = await data.root_db.get(last_height, "hex");
        if (root == null)
            throw new Error("root doesn't exist");
        const trie = vr.data.trie_ins(data.trie_db, root);
        const unit_state = await vr.data.read_from_trie(trie, data.state_db, unit_address, 0, vr.state.create_state("00", vr.con.constant.unit, unit_address, "00"));
        if (!big_integer_1.default(hash, 16).lesserOrEquals(big_integer_1.default(vr.con.constant.pow_target, 16)) || unit_state.data.length != 0)
            throw new Error('invalid unit');
        await data.unit_db.write_obj(unit_address, unit);
        return 1;
    }
    catch (e) {
        log.info(e);
    }
};
