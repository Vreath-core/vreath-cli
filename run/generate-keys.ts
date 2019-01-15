import * as vr from 'vreath'
import readlineSync from 'readline-sync'
import * as fs from 'fs'
import {promisify} from 'util'
import CryptoJS from 'crypto-js'
import {new_obj} from '../logic/work';

const my_password = readlineSync.question('Your password:',{hideEchoBack: true, defaultInput: 'password'});

(async()=>{
    try{
        const my_key = vr.crypto.hash(my_password).slice(0,122);
        const private_key = vr.crypto.genereate_key();
        const public_key = vr.crypto.private2public(private_key);
        const encrypted_pri = CryptoJS.AES.encrypt(private_key,my_key).toString();
        const config = JSON.parse(await promisify(fs.readFile)('./config/config.json','utf-8'));
        const new_config = new_obj(
            config,
            con=>{
                con.pub_keys.push(public_key);
                return con;
            }
        );
        await promisify(fs.writeFile)('./keys/private/'+my_key+'.txt',encrypted_pri);
        await promisify(fs.writeFile)('./keys/public/'+my_key+'.txt',public_key);
        await promisify(fs.writeFile)('./config/config.json',JSON.stringify(new_config,null,4),'utf-8');
    }
    catch(e){
        console.log(e);
    }
})();