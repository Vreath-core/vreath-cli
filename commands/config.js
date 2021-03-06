"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const util_1 = require("util");
exports.set_config = async (config, argv) => {
    const miner_mode = argv.miner_mode != null ? argv.miner_mode : config.miner.flag;
    const miner_interval = argv.miner_interval != null ? argv.miner_interval : config.miner.interval;
    const miner_gas_share = argv.miner_gas_share != null ? argv.miner_gas_share : config.miner.gas_share;
    const miner_unit_price = argv.miner_unit_price != null ? argv.miner_unit_price : config.miner.unit_price;
    const validator_mode = argv.validator_mode != null ? argv.validator_mode : config.validator.flag;
    const validator_min = argv.validator_min != null ? argv.validator_min : config.validator.minimum;
    const validator_fee = argv.validator_fee != null ? argv.validator_fee : config.validator.fee_price;
    const validator_gas = argv.validator_gas != null ? argv.validator_gas : config.validator.gas;
    const new_config = {
        miner: {
            flag: miner_mode,
            interval: miner_interval,
            gas_share: miner_gas_share,
            unit_price: miner_unit_price
        },
        validator: {
            flag: validator_mode,
            minimum: validator_min,
            fee_price: validator_fee,
            gas: validator_gas
        },
        peer: {
            id: config.peer.id,
            privKey: config.peer.privKey,
            pubKey: config.peer.pubKey
        }
    };
    await util_1.promisify(fs.writeFile)('./config/config.json', JSON.stringify(new_config, null, 4), 'utf-8');
};
