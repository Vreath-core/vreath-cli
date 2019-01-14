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
const crypto_js_1 = __importDefault(require("crypto-js"));
const fs = __importStar(require("fs"));
const util_1 = require("util");
exports.default = async (password) => {
    try {
        const pass = vr.crypto.hash(password);
        const pri = vr.crypto.genereate_key();
        const pub = vr.crypto.private2public(pri);
        const key = vr.crypto.hash(pass).slice(0, 122);
        const encrypted = crypto_js_1.default.AES.encrypt(pri, key).toString();
        await util_1.promisify(fs.writeFile)('./keys/private/' + key + '.txt', encrypted);
        await util_1.promisify(fs.writeFile)('./keys/public/' + key + '.txt', pub);
    }
    catch (e) {
        console.log(e);
    }
};
//# sourceMappingURL=generate-keys.js.map