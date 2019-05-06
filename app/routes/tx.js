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
const data = __importStar(require("../../logic/data"));
const path = __importStar(require("path"));
const bunyan_1 = __importDefault(require("bunyan"));
const log = bunyan_1.default.createLogger({
    name: 'vreath-cli',
    streams: [
        {
            path: path.join(__dirname, '../../log/log.log')
        }
    ]
});
exports.post = async (msg) => {
    try {
        const msg_data = JSON.parse(msg.toString('utf-8'));
        const tx = msg_data[0];
        const output_state = msg_data[1];
        if (tx == null || !vr.tx.isTx(tx) || output_state == null || output_state.some(s => !vr.state.isState(s)))
            throw new Error('invalid type of data');
        const info = await data.chain_info_db.read_obj("00");
        if (info == null)
            throw new Error("chain_info doesn't exist");
        const last_height = info.last_height;
        const root = await data.root_db.get(last_height, "hex");
        if (root == null)
            throw new Error("root doesn't exist");
        const trie = vr.data.trie_ins(data.trie_db, root);
        await vr.pool.tx2pool(data.tx_db, tx, output_state, data.block_db, trie, data.state_db, data.lock_db, last_height);
        await data.output_db.write_obj(tx.hash, output_state);
        return 1;
    }
    catch (e) {
        log.info(e);
    }
};
/*
export default router.post('/',async (req,res)=>{
    try{
        const tx:vr.Tx = req.body;
        if(!vr.tx.isTx(tx)){
            res.status(500).send('invalid tx');
            return 0;
        }
        const version = tx.meta.version || 0;
        const net_id = tx.meta.network_id || 0;
        const chain_id = tx.meta.chain_id || 0;
        if(version<vr.con.constant.compatible_version||net_id!=vr.con.constant.my_net_id||chain_id!=vr.con.constant.my_chain_id){
            res.status(500).send('unsupported　version');
            return 0;
        }
        const pool:vr.Pool = await data.read_pool(10**9)
        const chain:vr.Block[] = await data.read_chain(2*(10**9));
        const roots:{stateroot:string,lockroot:string} = await data.read_root();
        const S_Trie = data.state_trie_ins(roots.stateroot);
        const StateData = await data.get_tx_statedata(tx,chain,S_Trie);
        const L_Trie = data.lock_trie_ins(roots.lockroot);
        const LockData = await data.get_tx_lockdata(tx,chain,L_Trie);
        if(tx.meta.kind==='refresh'){
            const req_tx = vr.tx.find_req_tx(tx,chain);
            const checked = await (async ()=>{
                const not_refed = await P.some(req_tx.meta.bases, async (key:string)=>{
                    const lock:vr.Lock = await data.read_lock(L_Trie,key)
                    return lock==null||lock.address==''||!(lock.state==="already"&&lock.height===tx.meta.height&&lock.block_hash===tx.meta.block_hash&&lock.index===tx.meta.index&&lock.tx_hash===tx.meta.req_tx_hash)
                });
                if(!not_refed) return true;
                const in_pool = Object.values(pool).some(t=>{
                    return t.meta.kind==='refresh'&&t.meta.req_tx_hash===tx.meta.req_tx_hash&&t.meta.height===tx.meta.height&&t.meta.index===tx.meta.index&&t.meta.block_hash===tx.meta.block_hash
                });
                if(in_pool) return true;
                else return false;
            })();
            if(!checked){
                const valid_output = work.compute_output(req_tx,StateData,chain);
                const suc = !valid_output.some(s=>!vr.state.verify_state(s));
                const valid_out_hash = vr.crypto.object_hash(valid_output);
                if(suc!=tx.meta.success||valid_out_hash!=tx.meta.output) throw new Error('invalid output');
            }
        }
        const new_pool = vr.pool.tx2pool(pool,tx,chain,StateData,LockData);
        await data.write_pool(new_pool);
        res.status(200).send('success');
        return 1;
    }
    catch(e){
        log.info(e);
        res.status(500).send('error');
    }
});*/ 
