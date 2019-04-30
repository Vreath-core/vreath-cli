"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const data = __importStar(require("../../logic/data"));
exports.default = async () => {
    try {
        const info = await data.chain_info_db.read_obj("00");
        if (info == null)
            throw new Error("chain_info doesn't exist");
        return info;
    }
    catch (e) {
        console.log(e);
    }
};
