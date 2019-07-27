"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const P = __importStar(require("p-iteration"));
const PeerId = require('peer-id');
const Multiaddr = require('multiaddr');
exports.default = async (msg, peer_list_db, log) => {
    try {
        const peers = JSON.parse(msg);
        await P.forEach(peers, async (peer) => {
            await peer_list_db.write_obj(Buffer.from(peer.identity.id).toString('hex'), peer);
        });
    }
    catch (e) {
        log.info(e);
    }
};
