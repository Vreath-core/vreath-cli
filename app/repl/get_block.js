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
exports.default = async (input) => {
    try {
        const height = Number(input);
        const chain = await data.read_chain(2 * (10 ** 9));
        if (chain[height] == null)
            throw new Error('not exist block');
        return chain[height];
    }
    catch (e) {
        console.log(e);
    }
};
//# sourceMappingURL=get_block.js.map