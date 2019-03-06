"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const data_1 = require("../logic/data");
exports.default = async (ip) => {
    const new_peer = {
        ip: ip,
        timestamp: (new Date()).getTime()
    };
    await data_1.write_peer(new_peer);
};
//# sourceMappingURL=add_peer.js.map