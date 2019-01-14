import * as vr from 'vreath'
import CryptoJS from 'crypto-js'
import * as fs from 'fs'
import {promisify} from 'util'

export default async (password:string)=>{
    try{
        const pass = vr.crypto.hash(password);
        const pri = vr.crypto.genereate_key();
        const pub = vr.crypto.private2public(pri);
        const key = vr.crypto.hash(pass).slice(0,122);
        const encrypted = CryptoJS.AES.encrypt(pri,key).toString();
        await promisify(fs.writeFile)('./keys/private/'+key+'.txt',encrypted);
        await promisify(fs.writeFile)('./keys/public/'+key+'.txt',pub);
    }
    catch(e){
        console.log(e);
    }
}