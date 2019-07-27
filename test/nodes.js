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
exports.run_node1 = async (setup_data) => {
    const db_set = new common_1.DBSet();
    const genesis_db_set = await setup.add_setup_data(db_set, setup_data, 1);
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
    return await common_1.run_node(setup_data.privKey, config, "127.0.0.1", "8000", [setup_data.peer], genesis_db_set, 1);
};
exports.run_node2 = async (setup_data) => {
    const db_set = new common_1.DBSet();
    const genesis_db_set = await setup.add_setup_data(db_set, setup_data, 2);
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
    return await common_1.run_node(privKey, config, "0.0.0.0", "8001", [setup_data.peer], genesis_db_set, 2);
};
exports.run_node3 = async (setup_data) => {
    const db_set = new common_1.DBSet();
    const genesis_db_set = await setup.add_setup_data(db_set, setup_data, 3);
    const peer = await setup.set_peer_id('8002');
    const config = {
        miner: {
            flag: true,
            interval: 0.5,
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
    return await common_1.run_node(privKey, config, "0.0.0.0", "8002", [setup_data.peer], genesis_db_set, 3);
};
exports.run_node4 = async (setup_data) => {
    const db_set = new common_1.DBSet();
    const genesis_db_set = await setup.add_setup_data(db_set, setup_data, 4);
    const peer = await setup.set_peer_id('8003');
    const config = {
        miner: {
            flag: true,
            interval: 0.5,
            gas_share: 0,
            unit_price: "e8d4a51000"
        },
        validator: {
            flag: true,
            minimum: "0a",
            fee_price: "00",
            gas: "00"
        },
        peer: peer.identity
    };
    const privKey = vr.crypto.genereate_key();
    return await common_1.run_node(privKey, config, "0.0.0.0", "8003", [setup_data.peer], genesis_db_set, 4);
};
