import * as vr from 'vreath'
import readlineSync from 'readline-sync'
import * as fs from 'fs'
import {promisify} from 'util'
import CryptoJS from 'crypto-js'


export default async ()=>{
    const one_password = readlineSync.question('enter new password:',{hideEchoBack: true, defaultInput: 'password'});
    const two_password = readlineSync.question('enter password again:',{hideEchoBack: true, defaultInput: 'password'});
    if(one_password!=two_password) throw new Error('passwords do not match');
    const my_key = vr.crypto.get_sha256(Buffer.from(one_password,'utf-8').toString('hex')).slice(0,122);
    const private_key = vr.crypto.genereate_key();
    const public_key = vr.crypto.private2public(private_key);
    const encrypted_pri = CryptoJS.AES.encrypt(private_key,my_key).toString();
    await promisify(fs.writeFile)('./keys/private/'+my_key+'.txt',encrypted_pri);
    await promisify(fs.writeFile)('./keys/public/'+my_key+'.txt',public_key);
}