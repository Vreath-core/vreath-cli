"use strict";
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
var express = require("express");
var vr = require("vreath");
var fs = require("fs");
var util_1 = require("util");
var logic = require("../../logic/data");
var P = require("p-iteration");
var router = express.Router();
exports["default"] = router.post('/block', function (req, res) { return __awaiter(_this, void 0, void 0, function () {
    var block_1, version, net_id, chain_id, chain_1, _a, _b, roots_1, _c, _d, pool_1, _e, _f, S_Trie_1, StateData_1, L_Trie_1, LockData_1, check, accepted, new_chain, new_roots, txs_hash_1, new_pool_keys, new_pool, e_1;
    var _this = this;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                _g.trys.push([0, 14, , 15]);
                block_1 = req.body;
                if (!vr.block.isBlock(block_1))
                    res.send('invalid block');
                version = block_1.meta.version || 0;
                net_id = block_1.meta.network_id || 0;
                chain_id = block_1.meta.chain_id || 0;
                if (!(version < vr.con.constant.compatible_version || net_id != vr.con.constant.my_net_id || chain_id != vr.con.constant.my_chain_id)) return [3 /*break*/, 1];
                res.send('unsupported　version');
                return [3 /*break*/, 13];
            case 1:
                _b = (_a = JSON).parse;
                return [4 /*yield*/, util_1.promisify(fs.readFile)('./json/chain.json', 'utf-8')];
            case 2:
                chain_1 = _b.apply(_a, [_g.sent()]);
                _d = (_c = JSON).parse;
                return [4 /*yield*/, util_1.promisify(fs.readFile)('./json/root.json', 'utf-8')];
            case 3:
                roots_1 = _d.apply(_c, [_g.sent()]);
                _f = (_e = JSON).parse;
                return [4 /*yield*/, util_1.promisify(fs.readFile)('./json/pool.json', 'utf-8')];
            case 4:
                pool_1 = _f.apply(_e, [_g.sent()]);
                S_Trie_1 = logic.state_trie_ins(roots_1.stateroot);
                return [4 /*yield*/, logic.get_block_statedata(block_1, chain_1, S_Trie_1)];
            case 5:
                StateData_1 = _g.sent();
                L_Trie_1 = logic.lock_trie_ins(roots_1.lockroot);
                return [4 /*yield*/, logic.get_block_lockdata(block_1, chain_1, L_Trie_1)];
            case 6:
                LockData_1 = _g.sent();
                check = (function () {
                    if (block_1.meta.kind === 'key')
                        return vr.block.verify_key_block(block_1, chain_1, roots_1.stateroot, roots_1.lockroot, StateData_1);
                    else if (block_1.meta.kind === 'micro')
                        return vr.block.verify_micro_block(block_1, chain_1, roots_1.stateroot, roots_1.lockroot, StateData_1, LockData_1);
                    else
                        return false;
                })();
                if (!!check) return [3 /*break*/, 7];
                res.status(404).send('invalid block');
                return [3 /*break*/, 13];
            case 7:
                accepted = (function () {
                    if (block_1.meta.kind === 'key')
                        return vr.block.accept_key_block(block_1, chain_1, StateData_1, LockData_1);
                    else
                        return vr.block.accept_micro_block(block_1, chain_1, StateData_1, LockData_1);
                })();
                return [4 /*yield*/, P.forEach(accepted[0], function (state) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    if (!(state.kind === 'state')) return [3 /*break*/, 2];
                                    return [4 /*yield*/, S_Trie_1.put(state.owner, state)];
                                case 1:
                                    _a.sent();
                                    return [3 /*break*/, 4];
                                case 2: return [4 /*yield*/, S_Trie_1.put(state.token, state)];
                                case 3:
                                    _a.sent();
                                    _a.label = 4;
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); })];
            case 8:
                _g.sent();
                return [4 /*yield*/, P.forEach(accepted[1], function (lock) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, L_Trie_1.put(lock.address, lock)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 9:
                _g.sent();
                new_chain = chain_1.concat(block_1);
                return [4 /*yield*/, util_1.promisify(fs.writeFile)('./json/chain.json', JSON.stringify(new_chain, null, 4), 'utf-8')];
            case 10:
                _g.sent();
                new_roots = {
                    stateroot: S_Trie_1.now_root(),
                    lockroot: L_Trie_1.now_root()
                };
                return [4 /*yield*/, util_1.promisify(fs.writeFile)('./json/root.json', JSON.stringify(new_roots, null, 4), 'utf-8')];
            case 11:
                _g.sent();
                txs_hash_1 = block_1.txs.map(function (pure) { return pure.hash; });
                new_pool_keys = Object.keys(pool_1).filter(function (key) { return txs_hash_1.indexOf(key) === -1; });
                new_pool = new_pool_keys.map(function (key) { return pool_1[key]; });
                return [4 /*yield*/, util_1.promisify(fs.writeFile)('./json/pool.json', JSON.stringify(new_pool, null, 4), 'utf-8')];
            case 12:
                _g.sent();
                res.status(200).send('success');
                _g.label = 13;
            case 13: return [3 /*break*/, 15];
            case 14:
                e_1 = _g.sent();
                console.log(e_1);
                res.status(404).send('error');
                return [3 /*break*/, 15];
            case 15: return [2 /*return*/];
        }
    });
}); });
