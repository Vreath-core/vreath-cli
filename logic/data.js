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
var levelup_1 = require("levelup");
var leveldown_1 = require("leveldown");
var P = require("p-iteration");
var vr = require("vreath");
var native = vr.con.constant.native;
var unit = vr.con.constant.unit;
var state_db = levelup_1["default"](leveldown_1["default"]('state_trie'));
var lock_db = levelup_1["default"](leveldown_1["default"]('lock_trie'));
var Trie = /** @class */ (function (_super) {
    __extends(Trie, _super);
    function Trie() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return Trie;
}(vr.trie));
exports.state_trie_ins = function (root) {
    try {
        return new vr.trie(state_db, root);
    }
    catch (e) {
        console.log(e);
        return new vr.trie(state_db);
    }
};
exports.lock_trie_ins = function (root) {
    try {
        return new vr.trie(lock_db, root);
    }
    catch (e) {
        console.log(e);
        return new vr.trie(lock_db);
    }
};
var output_keys = function (tx) {
    if (tx.meta.kind === "request")
        return [];
    var states = tx.raw.raw.map(function (r) { return JSON.parse(r); });
    return states.map(function (s) { return s.owner; });
};
var pays = function (tx, chain) {
    if (tx.meta.kind === "request") {
        var requester = vr.crypto.genereate_address(native, vr.crypto.merge_pub_keys(tx.meta.pub_key));
        return [requester];
    }
    else if (tx.meta.kind === "refresh") {
        var req_tx = vr.tx.find_req_tx(tx, chain);
        var requester = vr.crypto.genereate_address(native, vr.crypto.merge_pub_keys(req_tx.meta.pub_key));
        var refresher = vr.crypto.genereate_address(native, vr.crypto.merge_pub_keys(tx.meta.pub_key));
        return [requester, refresher];
    }
    else
        return [];
};
exports.get_tx_statedata = function (tx, chain, S_Trie) { return __awaiter(_this, void 0, void 0, function () {
    var base, base_states, outputs, output_states, payes, pay_states, concated, hashes_1, e_1;
    var _this = this;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                base = tx.meta.bases;
                return [4 /*yield*/, P.reduce(base, function (result, key) { return __awaiter(_this, void 0, void 0, function () {
                        var getted;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, S_Trie.get(key)];
                                case 1:
                                    getted = _a.sent();
                                    if (getted == null)
                                        return [2 /*return*/, result];
                                    else
                                        return [2 /*return*/, result.concat(getted)];
                                    return [2 /*return*/];
                            }
                        });
                    }); }, [])];
            case 1:
                base_states = _a.sent();
                outputs = output_keys(tx);
                return [4 /*yield*/, P.reduce(outputs, function (result, key) { return __awaiter(_this, void 0, void 0, function () {
                        var getted, token;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, S_Trie.get(key)];
                                case 1:
                                    getted = _a.sent();
                                    token = key.split(':')[1];
                                    if (getted == null)
                                        return [2 /*return*/, result.concat(vr.state.create_state(0, key, token, 0))];
                                    else
                                        return [2 /*return*/, result.concat(getted)];
                                    return [2 /*return*/];
                            }
                        });
                    }); }, [])];
            case 2:
                output_states = _a.sent();
                payes = pays(tx, chain);
                return [4 /*yield*/, P.reduce(payes, function (result, key) { return __awaiter(_this, void 0, void 0, function () {
                        var getted;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, S_Trie.get(key)];
                                case 1:
                                    getted = _a.sent();
                                    if (getted == null)
                                        return [2 /*return*/, result.concat(vr.state.create_state(0, key, native, 0))];
                                    else
                                        return [2 /*return*/, result.concat(getted)];
                                    return [2 /*return*/];
                            }
                        });
                    }); }, [])];
            case 3:
                pay_states = _a.sent();
                concated = base_states.concat(output_states).concat(pay_states);
                hashes_1 = concated.map(function (state) { return vr.crypto.object_hash(state); });
                return [2 /*return*/, concated.filter(function (val, i) { return hashes_1.indexOf(vr.crypto.object_hash(val)) === i; })];
            case 4:
                e_1 = _a.sent();
                console.log(e_1);
                return [2 /*return*/, []];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.get_tx_lockdata = function (tx, chain, L_Trie) { return __awaiter(_this, void 0, void 0, function () {
    var target, keys, result, e_2;
    var _this = this;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                target = (function () {
                    if (tx.meta.kind === "request")
                        return tx;
                    else
                        return vr.tx.find_req_tx(tx, chain);
                })();
                keys = target.meta.bases.filter(function (val, i, array) { return array.indexOf(val) === i; });
                return [4 /*yield*/, P.reduce(keys, function (array, key) { return __awaiter(_this, void 0, void 0, function () {
                        var getted, new_loc;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    if (vr.crypto.verify_address(key))
                                        return [2 /*return*/, array];
                                    return [4 /*yield*/, L_Trie.get(key)];
                                case 1:
                                    getted = _a.sent();
                                    if (getted == null) {
                                        new_loc = {
                                            address: key,
                                            state: 'yet',
                                            height: 0,
                                            block_hash: '',
                                            index: 0,
                                            tx_hash: ''
                                        };
                                        return [2 /*return*/, array.concat(new_loc)];
                                    }
                                    else
                                        return [2 /*return*/, array.concat(getted)];
                                    return [2 /*return*/];
                            }
                        });
                    }); }, [])];
            case 1:
                result = _a.sent();
                return [2 /*return*/, result];
            case 2:
                e_2 = _a.sent();
                console.log(e_2);
                return [2 /*return*/, []];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.get_block_statedata = function (block, chain, S_Trie) { return __awaiter(_this, void 0, void 0, function () {
    var validatorPub, native_validator, native_validator_state, txs, tx_states, all_units, native_token, unit_token, concated, hashes_2, e_3;
    var _this = this;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 6, , 7]);
                validatorPub = (function () {
                    if (block.meta.kind === 'key')
                        return block.meta.validatorPub;
                    else
                        return vr.block.search_key_block(chain).meta.validatorPub;
                })();
                native_validator = vr.crypto.genereate_address(native, vr.crypto.merge_pub_keys(validatorPub));
                return [4 /*yield*/, S_Trie.get(native_validator)];
            case 1:
                native_validator_state = (_a.sent()) || vr.state.create_state(0, native_validator, native);
                txs = block.txs.map(function (tx) { return vr.tx.pure2tx(tx, block); });
                return [4 /*yield*/, P.reduce(txs, function (result, tx) { return __awaiter(_this, void 0, void 0, function () { var _a, _b; return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                _b = (_a = result).concat;
                                return [4 /*yield*/, exports.get_tx_statedata(tx, chain, S_Trie)];
                            case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
                        }
                    }); }); }, [])];
            case 2:
                tx_states = _a.sent();
                return [4 /*yield*/, S_Trie.filter(function (state) { return vr.state.isState(state) && state.kind === "state" && state.token === unit; })];
            case 3:
                all_units = _a.sent();
                return [4 /*yield*/, S_Trie.get(native)];
            case 4:
                native_token = (_a.sent()) || vr.state.create_info(0, native);
                return [4 /*yield*/, S_Trie.get(unit)];
            case 5:
                unit_token = (_a.sent()) || vr.state.create_info(0, unit);
                concated = tx_states.concat(native_validator_state).concat(all_units).concat(native_token).concat(unit_token);
                hashes_2 = concated.map(function (s) { return vr.crypto.object_hash(s); });
                return [2 /*return*/, concated.filter(function (val, i) { return hashes_2.indexOf(vr.crypto.object_hash(val)) === i; })];
            case 6:
                e_3 = _a.sent();
                console.log(e_3);
                return [2 /*return*/, []];
            case 7: return [2 /*return*/];
        }
    });
}); };
exports.get_block_lockdata = function (block, chain, L_Trie) { return __awaiter(_this, void 0, void 0, function () {
    var txs, tx_loc, validatorPub, native_validator, unit_validator, concated, hashes_3, e_4;
    var _this = this;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                txs = block.txs.map(function (tx) { return vr.tx.pure2tx(tx, block); });
                return [4 /*yield*/, P.reduce(txs, function (result, tx) { return __awaiter(_this, void 0, void 0, function () { var _a, _b; return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                _b = (_a = result).concat;
                                return [4 /*yield*/, exports.get_tx_lockdata(tx, chain, L_Trie)];
                            case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
                        }
                    }); }); }, [])];
            case 1:
                tx_loc = _a.sent();
                validatorPub = (function () {
                    if (block.meta.kind === 'key')
                        return block.meta.validatorPub;
                    else
                        return vr.block.search_key_block(chain).meta.validatorPub;
                })();
                return [4 /*yield*/, L_Trie.get(vr.crypto.genereate_address(native, vr.crypto.merge_pub_keys(validatorPub)))];
            case 2:
                native_validator = _a.sent();
                return [4 /*yield*/, L_Trie.get(vr.crypto.genereate_address(unit, vr.crypto.merge_pub_keys(validatorPub)))];
            case 3:
                unit_validator = _a.sent();
                concated = tx_loc.concat(native_validator).concat(unit_validator).filter(function (lock) { return lock != null; });
                hashes_3 = concated.map(function (l) { return vr.crypto.object_hash(l); });
                return [2 /*return*/, concated.filter(function (val, i) { return hashes_3.indexOf(vr.crypto.object_hash(val)) === i; })];
            case 4:
                e_4 = _a.sent();
                console.log(e_4);
                return [2 /*return*/, []];
            case 5: return [2 /*return*/];
        }
    });
}); };
