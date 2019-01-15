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
const readline_sync_1 = __importDefault(require("readline-sync"));
const fs = __importStar(require("fs"));
const util_1 = require("util");
const crypto_js_1 = __importDefault(require("crypto-js"));
const work_1 = require("../logic/work");
const my_password = readline_sync_1.default.question('Your password:', { hideEchoBack: true, defaultInput: 'password' });
(async () => {
    try {
        const my_key = vr.crypto.hash(my_password).slice(0, 122);
        const private_key = vr.crypto.genereate_key();
        const public_key = vr.crypto.private2public(private_key);
        const encrypted_pri = crypto_js_1.default.AES.encrypt(private_key, my_key).toString();
        const config = JSON.parse(await util_1.promisify(fs.readFile)('./config/config.json', 'utf-8'));
        const new_config = work_1.new_obj(config, con => {
            con.pub_keys.push(public_key);
            return con;
        });
        await util_1.promisify(fs.writeFile)('./keys/private/' + my_key + '.txt', encrypted_pri);
        await util_1.promisify(fs.writeFile)('./keys/public/' + my_key + '.txt', public_key);
        await util_1.promisify(fs.writeFile)('./config/config.json', JSON.stringify(new_config, null, 4), 'utf-8');
    }
    catch (e) {
        console.log(e);
    }
})();
//# sourceMappingURL=generate-keys.js.map