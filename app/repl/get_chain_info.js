"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const work_1 = require("../../logic/work");
exports.default = async (chain_info_db, root_db, trie_db, state_db, native_address, unit_address) => {
    try {
        const info = await chain_info_db.read_obj("00");
        if (info == null)
            throw new Error("chain_info doesn't exist");
        return await work_1.dialog_data(chain_info_db, root_db, trie_db, state_db, native_address, unit_address, 1);
    }
    catch (e) {
        console.log(e);
    }
};
