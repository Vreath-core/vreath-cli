"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const run_1 = require("./commands/run");
const setup_1 = __importDefault(require("./commands/setup"));
const bunyan_1 = __importDefault(require("bunyan"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.run = async () => {
    const log = bunyan_1.default.createLogger({
        name: 'vreath-cli',
        streams: [
            {
                path: path.join(__dirname, '../log/main.log')
            }
        ]
    });
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/config.json'), 'utf-8'));
    await run_1.run(config, log);
};
exports.setup = async () => {
    await setup_1.default();
};
