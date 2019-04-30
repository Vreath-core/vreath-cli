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
const data = __importStar(require("../../logic/data"));
const fs = __importStar(require("fs"));
const P = __importStar(require("p-iteration"));
const archiver_1 = __importDefault(require("archiver"));
exports.default = async () => {
    try {
        const chain = await data.read_chain(2 * (10 ** 9));
        const splitted = chain.reduce((blocks, block) => {
            const last = blocks[blocks.length - 1];
            if (last.length > 2000) {
                blocks.push([block]);
                return blocks;
            }
            else {
                blocks[blocks.length - 1].push(block);
                return blocks;
            }
        }, [[]]);
        const dri_pass = `output_chain_${chain[chain.length - 1].meta.height}`;
        const output = fs.createWriteStream(`${dri_pass}.zip`);
        const archive = archiver_1.default('zip');
        archive.pipe(output);
        await P.forEach(splitted, async (blocks) => {
            archive.append(JSON.stringify(blocks, null, 4), { name: `${dri_pass}/block_${blocks[0].meta.height}_${blocks[blocks.length - 1].meta.height}` });
        });
        archive.finalize();
    }
    catch (e) {
        console.log(e);
    }
};
