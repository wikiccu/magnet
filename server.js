const process = require('process')
const { port, scheme } = require('./config/env.js')
const httpServer = require(scheme).createServer()
const { Server } = require('socket.io')
const app = require('./app')
const io = new Server(httpServer, { cors: { origin: '*' } })
app(io)
global.clients = io.sockets.sockets
httpServer.listen(port)
console.log(`Server is running on port ${port}`)

/**
 * Graceful shutdown
 */

process.on('SIGTERM', async () => {
  const date = new Date()
  httpServer.close(() => {
    console.warn(`SIGTERM : Socket server closed. (${date.toLocaleString('fa-IR')})`)
  })
})

process.on('SIGINT', async () => {
  const date = new Date()
  httpServer.close(() => {
    console.warn(`SIGINT : Socket server closed. (${date.toLocaleString('fa-IR')})`)
  })
})
