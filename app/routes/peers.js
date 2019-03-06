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
const express = __importStar(require("express"));
const bunyan_1 = __importDefault(require("bunyan"));
const data_1 = require("../../logic/data");
const log = bunyan_1.default.createLogger({
    name: 'vreath-cli',
    streams: [
        {
            path: './log/log.log'
        }
    ]
});
const router = express.Router();
exports.default = router.post('/', async (req, res) => {
    try {
        const list = req.body;
        if (!Array.isArray(list) || list.some(p => typeof p.ip != 'string' || typeof p.timestamp != 'number')) {
            res.status(500).send('invalid list');
            return 0;
        }
        const my_list = await data_1.get_peer_list();
        const peers_ip = list.map(peer => peer.ip);
        const new_list = my_list.map(peer => {
            const i = peers_ip.indexOf(peer.ip);
            if (i === -1)
                return peer;
            else
                return list[i];
        }).sort((a, b) => b.timestamp - a.timestamp);
        let peer;
        for (peer of new_list) {
            await data_1.write_peer(peer);
        }
        res.send(my_list);
        return 1;
    }
    catch (e) {
        log.info(e);
        res.status(500).send('error');
    }
});
//# sourceMappingURL=peers.js.map