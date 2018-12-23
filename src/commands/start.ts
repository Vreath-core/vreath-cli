import {Command} from '@oclif/command'
import * as express from 'express'
import * as bodyParser from 'body-parser'
import tx from '../../app/routes/tx'


export default class Start extends Command {
    static description = 'start server'
    async run() {
        const app = express()
        app.listen(57750)
        app.use(bodyParser.json())
        app.use(express.urlencoded({extended: true}));

        app.use('/tx',tx);
    }
}
