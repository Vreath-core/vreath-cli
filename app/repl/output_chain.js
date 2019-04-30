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
const fs = __importStar(require("fs"));
const big_integer_1 = __importDefault(require("big-integer"));
const archiver_1 = __importDefault(require("archiver"));
exports.default = async () => {
    try {
        const info = await data.chain_info_db.read_obj("00");
        if (info == null)
            throw new Error("chain_info doesn't exist");
        const last_height = info.last_height;
        let height = big_integer_1.default(0);
        let block;
        const dri_pass = `output_chain_${vr.crypto.bigint2hex(height)}`;
        const output = fs.createWriteStream(`${dri_pass}.zip`);
        const archive = archiver_1.default('zip');
        archive.pipe(output);
        while (1) {
            block = await data.block_db.read_obj(vr.crypto.bigint2hex(height));
            if (block == null)
                continue;
            archive.append(JSON.stringify(block, null, 4), { name: `${dri_pass}/block_${vr.crypto.bigint2hex(height)}` });
            if (height.eq(big_integer_1.default(last_height, 16)))
                break;
        }
        archive.finalize();
    }
    catch (e) {
        console.log(e);
    }
};
