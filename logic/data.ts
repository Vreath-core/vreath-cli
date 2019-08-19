import * as vr from 'vreath';
import levelup, { LevelUp } from 'levelup';
import leveldown, { LevelDown} from 'leveldown';
import * as path from 'path'
export const id = vr.con.constant.my_chain_id + vr.con.constant.my_net_id;

class leveldb {
    private db:LevelUp<LevelDown>;
    constructor(_db:LevelUp<LevelDown>){
        this.db = _db;
    }

    public async get(key:Buffer):Promise<Buffer>{
        const got = await this.db.get(key);
        if(typeof got ==='string') return Buffer.from(key);
        else return got;
    }

    public async put(key:Buffer,val:Buffer):Promise<void>{
        await this.db.put(key,val);
    }

    public async del(key:Buffer):Promise<void>{
        await this.db.del(key);
    }

    public createReadStream():NodeJS.ReadableStream{
        return this.db.createReadStream();
    }

    get raw_db(){
        return this.db;
    }

}

export const make_db_obj = (root:string)=>{
    const levelup_obj = new levelup(leveldown(path.join(root)));
    const leveldb_obj = new leveldb(levelup_obj);
    return new vr.db(leveldb_obj)
}


export type chain_info = {
    version:string;
    chain_id:string;
    net_id:string;
    compatible_version:string;
    last_height:string;
    last_hash:string;
    syncing:boolean;
    manual_requesting:{
        flag:boolean,
        failed_times:number,
        address:string,
        tx_hash:string,
        nonce:string
    }
}

export type peer_info = {
    identity:{
        id:string,
        privKey:string|null,
        pubKey:string|null
    },
    multiaddrs:string[]
}

