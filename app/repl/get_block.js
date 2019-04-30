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
exports.default = async (input) => {
    try {
        const height = vr.crypto.bigint2hex(big_integer_1.default(input));
        const block = await data.block_db.read_obj(height);
        if (block == null)
            throw new Error("block doesn't exist at the height");
        return block;
    }
    catch (e) {
        console.log(e);
    }
};
