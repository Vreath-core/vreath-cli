"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("./common");
const setup = __importStar(require("./setup"));
const PeerId = require('peer-id');
const search_ip = require('ip');
exports.run_node1 = async (setup_data) => {
    const db_set = new common_1.DBSet();
    const genesis_db_set = await setup.add_setup_data(db_set, setup_data);
    const config = {
        miner: {
            flag: true,
            interval: 0.1,
            gas_share: 0,
            unit_price: "e8d4a51000"
        },
        validator: {
            flag: true,
            minimum: "0a",
            fee_price: "00",
            gas: "00"
        },
        peer: setup_data.peer.identity
    };
    //const ip:string = search_ip.address();
    return await common_1.run_node(setup_data.privKey, config, "127.0.0.1", "8000", [setup_data.peer], genesis_db_set, 1);
};
