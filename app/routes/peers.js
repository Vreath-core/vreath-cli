"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const express = __importStar(require("express"));
const fs = __importStar(require("fs"));
const util_1 = require("util");
const router = express.Router();
exports.default = router.post('/peer', async (req, res) => {
    try {
        const list = req.body;
        if (!Array.isArray(list) || list.some(p => typeof p.ip != 'string' || typeof p.timestamp != 'number')) {
            res.status(500).send('invalid list');
            return 0;
        }
        const my_list = JSON.parse(await util_1.promisify(fs.readFile)('./json/peer_list.json', 'utf-8'));
        const peers_ip = list.map(peer => peer.ip);
        const new_list = my_list.map(peer => {
            const i = peers_ip.indexOf(peer.ip);
            if (i === -1)
                return peer;
            else
                return list[i];
        }).sort((a, b) => b.timestamp - a.timestamp);
        await util_1.promisify(fs.writeFile)('./json/peer_list.json', JSON.stringify(new_list, null, 4), 'utf-8');
        res.send(my_list);
        return 1;
    }
    catch (e) {
        console.log(e);
        res.status(500).send('error');
    }
});
//# sourceMappingURL=peers.js.map