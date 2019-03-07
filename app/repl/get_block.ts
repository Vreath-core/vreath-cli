import * as data from '../../logic/data'

export default async (input:string)=>{
    try{
        const height = Number(input);
        const chain = await data.read_chain(2*(10**9));
        if(chain[height]==null) throw new Error('not exist block');
        return chain[height];
    }
    catch(e){
        console.log(e);
    }
}