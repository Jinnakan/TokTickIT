import 'dotenv/config'
import { app } from './app.js'
import { loadConfig } from './config.js'

const config = loadConfig(process.env)

app.listen(config.port, '127.0.0.1', () => {
  console.log(`API listening at http://127.0.0.1:${config.port}`)
})
