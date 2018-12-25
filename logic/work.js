"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _this = this;
exports.__esModule = true;
var vr = require("vreath");
var data = require("./data");
var P = require("p-iteration");
var math = require("mathjs");
var fs = require("fs");
var util_1 = require("util");
math.config({
    number: 'BigNumber'
});
var Trie = /** @class */ (function (_super) {
    __extends(Trie, _super);
    function Trie() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return Trie;
}(vr.trie));
exports.sleep = function (msec) {
    return new Promise(function (resolve) {
        setTimeout(function () { resolve(); }, msec);
    });
};
var choose_txs = function (pool, L_Trie) { return __awaiter(_this, void 0, void 0, function () {
    var pool_txs, requested_bases, not_same, size_sum, sorted, choosed;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                pool_txs = Object.keys(pool).map(function (key) { return pool[key]; });
                return [4 /*yield*/, L_Trie.filter(function (val) {
                        var getted = val;
                        if (getted != null && getted.state === "already")
                            return true;
                        else
                            return false;
                    })];
            case 1:
                requested_bases = (_a.sent()).map(function (l) { return l.address; });
                not_same = pool_txs.reduce(function (result, tx) {
                    var bases = result.reduce(function (r, t) {
                        if (t.meta.kind === "request")
                            return r.concat(t.meta.bases);
                        else
                            return r;
                    }, requested_bases);
                    var requests = result.reduce(function (r, t) {
                        if (t.meta.kind === "refresh")
                            return r.concat(t.meta.req_tx_hash);
                        else
                            return r;
                    }, []);
                    if (tx.meta.kind === "request" && !bases.some(function (b) { return tx.meta.bases.indexOf(b) != -1; }))
                        return result.concat(tx);
                    else if (tx.meta.kind === "refresh" && requests.indexOf(tx.meta.req_tx_hash) === -1)
                        return result.concat(tx);
                    else
                        return result;
                }, []);
                size_sum = 0;
                sorted = not_same.slice().sort(function (a, b) {
                    return math.chain(vr.tx.get_tx_fee(b)).subtract(vr.tx.get_tx_fee(a)).done();
                });
                choosed = sorted.reduce(function (txs, tx) {
                    if (math.chain(vr.con.constant.block_size).multiply(0.9).smaller(size_sum).done())
                        return txs;
                    size_sum = math.chain(size_sum).add(Buffer.from(JSON.stringify(tx)).length).done();
                    return txs.concat(tx);
                }, []);
                return [2 /*return*/, choosed];
        }
    });
}); };
exports.make_blocks = function (chain, my_pubs, stateroot, lockroot, extra, pool, private_key, public_key, S_Trie, L_Trie) { return __awaiter(_this, void 0, void 0, function () {
    var pre_key_block, pre_micro_blocks, key_block, StateData, txs, micro_block_1, StateData, LockData, invalid_tx_hashes_1, pool_1, _a, _b, new_pool, e_1;
    var _this = this;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 11, , 12]);
                pre_key_block = vr.block.search_key_block(chain);
                pre_micro_blocks = vr.block.search_micro_block(chain, pre_key_block);
                if (!(vr.crypto.merge_pub_keys(pre_key_block.meta.validatorPub) != vr.crypto.merge_pub_keys(my_pubs) || pre_micro_blocks.length >= vr.con.constant.max_blocks)) return [3 /*break*/, 2];
                key_block = vr.block.create_key_block(chain, my_pubs, stateroot, lockroot, extra, public_key, private_key);
                return [4 /*yield*/, data.get_block_statedata(key_block, chain, S_Trie)];
            case 1:
                StateData = _c.sent();
                if (!vr.block.verify_key_block(key_block, chain, stateroot, lockroot, StateData))
                    throw new Error('fail to create valid block');
                return [2 /*return*/, key_block];
            case 2: return [4 /*yield*/, choose_txs(pool, L_Trie)];
            case 3:
                txs = _c.sent();
                micro_block_1 = vr.block.create_micro_block(chain, stateroot, lockroot, txs, extra, private_key, public_key);
                return [4 /*yield*/, data.get_block_statedata(micro_block_1, chain, S_Trie)];
            case 4:
                StateData = _c.sent();
                return [4 /*yield*/, data.get_block_lockdata(micro_block_1, chain, L_Trie)];
            case 5:
                LockData = _c.sent();
                if (!!vr.block.verify_micro_block(micro_block_1, chain, stateroot, lockroot, StateData, LockData)) return [3 /*break*/, 9];
                return [4 /*yield*/, P.reduce(micro_block_1.txs, function (result, pure) { return __awaiter(_this, void 0, void 0, function () {
                        var tx, s_data, l_data;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    tx = vr.tx.pure2tx(pure, micro_block_1);
                                    return [4 /*yield*/, data.get_tx_statedata(tx, chain, S_Trie)];
                                case 1:
                                    s_data = _a.sent();
                                    return [4 /*yield*/, data.get_tx_lockdata(tx, chain, L_Trie)];
                                case 2:
                                    l_data = _a.sent();
                                    if (tx.meta.kind === 'request' && !vr.tx.verify_req_tx(tx, false, s_data, l_data))
                                        return [2 /*return*/, result.concat(tx.hash)];
                                    else if (tx.meta.kind === 'refresh' && !vr.tx.verify_ref_tx(tx, chain, true, s_data, l_data))
                                        return [2 /*return*/, result.concat(tx.hash)];
                                    else
                                        return [2 /*return*/, result];
                                    return [2 /*return*/];
                            }
                        });
                    }); }, [])];
            case 6:
                invalid_tx_hashes_1 = _c.sent();
                _b = (_a = JSON).parse;
                return [4 /*yield*/, util_1.promisify(fs.readFile)('./json/pool.json', 'utf-8')];
            case 7:
                pool_1 = _b.apply(_a, [_c.sent()]);
                new_pool = Object.keys(pool_1).filter(function (key) { return invalid_tx_hashes_1.indexOf(key) === -1; }).reduce(function (res, key) {
                    res[key] = pool_1[key];
                    return res;
                }, {});
                return [4 /*yield*/, util_1.promisify(fs.writeFile)('./json/pool.json', JSON.stringify(new_pool, null, 4), 'utf-8')];
            case 8:
                _c.sent();
                throw new Error('remove invalid txs');
            case 9: return [2 /*return*/, micro_block_1];
            case 10: return [3 /*break*/, 12];
            case 11:
                e_1 = _c.sent();
                throw new Error(e_1);
            case 12: return [2 /*return*/];
        }
    });
}); };
