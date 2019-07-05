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
const common_1 = require("./common");
const setup = __importStar(require("./setup"));
const PeerId = require('peer-id');
const search_ip = require('ip');
exports.run_node2 = async (setup_data) => {
    const db_set = new common_1.DBSet();
    const genesis_db_set = await setup.add_setup_data(db_set, setup_data);
    const peer = await setup.set_peer_id('8001');
    const config = {
        miner: {
            flag: true,
            interval: 0.1,
            gas_share: 0,
            unit_price: "e8d4a51000"
        },
        validator: {
            flag: false,
            minimum: "0a",
            fee_price: "00",
            gas: "00"
        },
        peer: peer.identity
    };
    const privKey = vr.crypto.genereate_key();
    //const ip:string = search_ip.address();
    return await common_1.run_node(privKey, config, "0.0.0.0", "8001", [setup_data.peer], genesis_db_set, 2);
};
