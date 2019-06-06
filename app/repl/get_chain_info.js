"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = async (chain_info_db) => {
    try {
        const info = await chain_info_db.read_obj("00");
        if (info == null)
            throw new Error("chain_info doesn't exist");
        return info;
    }
    catch (e) {
        console.log(e);
    }
};
