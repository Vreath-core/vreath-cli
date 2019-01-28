import * as fs from 'fs'
import {promisify} from 'util'

export default async (config:any,argv:any)=>{
    const pushed_pubs:string[] = argv.new_pub!=null ? config.pub_keys.concat(argv.new_pub) : config.pub_keys;
    const del_pub = argv.del_pub!=null ? argv.del_pub : '';
    const new_pubs = pushed_pubs.filter(pub=>pub!=del_pub);
    const user_id = argv.user_id!=null ? argv.user_id : config.user.use;
    const miner_mode = argv.miner_mode!=null ? argv.miner_mode : config.miner.flag;
    const miner_id = argv.miner_id!=null ? argv.miner_id : config.miner.use;
    const miner_interval = argv.miner_interval!=null ? argv.miner_interval : config.miner.interval;
    const miner_fee = argv.miner_fee!=null ? argv.miner_fee : config.miner.fee_price;
    const miner_unit_price = argv.miner_unit_price!=null ? argv.miner_unit_price : config.miner.unit_price;
    const validator_mode = argv.validator_mode!=null ? argv.validator_mode : config.validator.flag;
    const validator_id = argv.validator_id!=null ? argv.validator_id : config.validator.use;
    const validator_min = argv.validator_min!=null ? argv.validator_min : config.validator.minimum;
    const validator_fee = argv.validator_fee!=null ? argv.validator_fee : config.validator.fee_price;
    const validator_gas = argv.validator_gas!=null ? argv.validator_gas : config.validator.gas;
    const new_config = {
        pub_keys:new_pubs,
        user:{
            use:user_id
        },
        miner:{
            flag:miner_mode,
            use:miner_id,
            interval:miner_interval,
            fee_price:miner_fee,
            unit_price:miner_unit_price
        },
        validator:{
            flag:validator_mode,
            use:validator_id,
            minimum:validator_min,
            fee_price:validator_fee,
            gas:validator_gas
        }
    }
    await promisify(fs.writeFile)('./config/config.json',JSON.stringify(new_config,null,4),'utf-8');
}
