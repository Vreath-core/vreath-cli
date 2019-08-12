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
const levelup_1 = __importDefault(require("levelup"));
const leveldown_1 = __importDefault(require("leveldown"));
const path = __importStar(require("path"));
exports.id = vr.con.constant.my_chain_id + vr.con.constant.my_net_id;
class leveldb {
    constructor(_db) {
        this.db = _db;
    }
    async get(key) {
        const got = await this.db.get(key);
        if (typeof got === 'string')
            return Buffer.from(key);
        else
            return got;
    }
    async put(key, val) {
        await this.db.put(key, val);
    }
    async del(key) {
        await this.db.del(key);
    }
    createReadStream() {
        return this.db.createReadStream();
    }
    get raw_db() {
        return this.db;
    }
}
exports.make_db_obj = (root) => {
    const levelup_obj = new levelup_1.default(leveldown_1.default(path.join(root)));
    const leveldb_obj = new leveldb(levelup_obj);
    return new vr.db(leveldb_obj);
};
