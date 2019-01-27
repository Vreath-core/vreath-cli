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
exports.default = async (ip) => {
    const peer_list = JSON.parse(await util_1.promisify(fs.readFile)('./json/peer_list.json', 'utf-8'));
    const new_peer = {
        ip: ip,
        timestamp: (new Date()).getTime()
    };
    const sorted = peer_list.concat(new_peer).sort((a, b) => b.timestamp - a.timestamp);
    const ips_array = sorted.map(peer => peer.ip);
    const new_list = sorted.filter((peer, i) => ips_array.indexOf(peer.ip) === i);
    await util_1.promisify(fs.writeFile)('./json/peer_list.json', JSON.stringify(new_list, null, 4), 'utf-8');
};
//# sourceMappingURL=add_peer.js.map