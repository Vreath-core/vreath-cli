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
const P = __importStar(require("p-iteration"));
const util_1 = require("util");
const PeerId = require('peer-id');
const Multiaddr = require('multiaddr');
const PeerInfo = require('peer-info');
const pull = require('pull-stream');
const toStream = require('pull-stream-to-stream');
exports.default = async (msg, peer_list_db, my_id, node, log) => {
    try {
        const peer_info_list = (JSON.parse(msg)).filter((p) => p.identity.id != my_id);
        await P.forEach(peer_info_list, async (peer) => {
            const peer_id = await util_1.promisify(PeerId.createFromJSON)(peer.identity);
            const peer_info = new PeerInfo(peer_id);
            peer.multiaddrs.forEach(add => peer_info.multiaddrs.add(add));
            node.dialProtocol(peer_info, `/vreath/${data.id}/handshake`, (err, conn) => {
                if (!err) {
                    const stream = toStream(conn);
                    stream.write(JSON.stringify(peer_info_list));
                    stream.write('end');
                    peer_list_db.write_obj(Buffer.from(peer.identity.id).toString('hex'), peer);
                }
            });
            return false;
        });
    }
    catch (e) {
        log.info(e);
    }
};
