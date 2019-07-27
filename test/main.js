"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const nodes_1 = require("./nodes");
(async () => {
    const setup_data = JSON.parse(await util_1.promisify(fs.readFile)(path.join(__dirname, './test_genesis_data.json'), 'utf8'));
    nodes_1.run_node1(setup_data);
    nodes_1.run_node2(setup_data);
    nodes_1.run_node3(setup_data);
    nodes_1.run_node4(setup_data);
})();
