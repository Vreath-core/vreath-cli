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
const vr = __importStar(require("vreath"));
const fs = __importStar(require("fs"));
const util_1 = require("util");
const router = express.Router();
exports.make_node_info = () => {
    const node_info = {
        version: vr.con.constant.my_version,
        net_id: vr.con.constant.my_net_id,
        chain_id: vr.con.constant.my_chain_id,
        timestamp: (new Date()).getTime()
    };
    return node_info;
};
exports.handshake_route = router.post('/handshake', async (req, res) => {
    try {
        const info = req.body;
        if (typeof info.version != 'number' || typeof info.net_id != 'number' || typeof info.chain_id != 'number' || typeof info.timestamp != 'number') {
            res.status(500).send('invalid node info');
            return 0;
        }
        if (info.version < vr.con.constant.compatible_version || info.net_id != vr.con.constant.my_net_id || info.chain_id != vr.con.constant.my_chain_id) {
            res.status(500).send('unsupported');
            return 0;
        }
        const remote_add = req.connection.remoteAddress || '';
        const splitted = remote_add.split(':');
        const ip = splitted[splitted.length - 1];
        console.log(ip);
        const this_peer = {
            ip: ip,
            timestamp: info.timestamp
        };
        const peer_list = JSON.parse(await util_1.promisify(fs.readFile)('./json/peer_list.json', 'utf-8'));
        const this_peer_index = peer_list.map(peer => peer.ip).indexOf(this_peer.ip);
        const new_peer_list = peer_list.map((p, i) => {
            if (i === this_peer_index)
                return this_peer;
            else
                return p;
        }).sort((a, b) => b.timestamp - a.timestamp);
        await util_1.promisify(fs.writeFile)('./json/peer_list.json', JSON.stringify(new_peer_list, null, 4), 'utf-8');
        const my_node_info = exports.make_node_info();
        res.send(my_node_info);
        return 1;
    }
    catch (e) {
        console.log(e);
        res.status(500).send('error');
    }
});
//# sourceMappingURL=handshake.js.map