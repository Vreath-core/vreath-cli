"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
const PeerId = require('peer-id');
const works = __importStar(require("../logic/work"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.default = async () => {
    const peer_id = await util_1.promisify(PeerId.create)();
    const obj = peer_id.toJSON();
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/config.json'), 'utf-8'));
    const new_config = works.new_obj(config, (config) => {
        config.peer = obj;
        return config;
    });
    await util_1.promisify(fs.writeFile)(path.join(__dirname, '../config/config.json'), JSON.stringify(new_config, null, 4));
};
