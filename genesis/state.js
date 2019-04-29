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
exports.genesis_pub = '02395a2f9ac5de9cb1c3843b161d1d41234d3c45af5f7e8c4d5c5b3e7081d1cb92';
const genesis_unit_address = vr.crypto.generate_address(vr.con.constant.unit, exports.genesis_pub);
exports.genesis_state = [vr.state.create_state("00", vr.con.constant.unit, genesis_unit_address, "01", ["01", "00"])];
exports.genesis_token = [vr.state.create_token("00", vr.con.constant.native), vr.state.create_token("00", vr.con.constant.unit, "01")];
exports.genesis_lock = [vr.lock.create_lock(genesis_unit_address, 0, "00", vr.crypto.get_sha256(''), 0, vr.crypto.get_sha256(''))];
