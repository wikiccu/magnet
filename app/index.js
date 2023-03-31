const router = require('./routes/v1')
const { auth } = require('./middleware')
const { EVENTS, USER_TYPES, STATUS_CODES } = require('./Values/constants')
const { setManagers, getAllPaid, removePaid, getDriver, getPassenger } = require('./Redis/redis.service.js')
let run = false
async function runner (socket) {
  setInterval(async () => {
    const allPaid = await getAllPaid()
    if (Object.keys(allPaid).length) {
      const drivers = Object.keys(allPaid)
      const passengers = Object.values(allPaid)
      for (const i in drivers) {
        const driverScoketId = await getDriver(drivers[i])
        socket.to(driverScoketId).emit('privateMessage', STATUS_CODES.PV_MSG_WALLET_SUFFICENT)
        await removePaid(drivers[i])
      }
      for (const i in passengers) {
        const passengerSocketId = await getPassenger(passengers[i])
        socket.to(passengerSocketId).emit('privateMessage', STATUS_CODES.PV_MSG_WALLET_SUFFICENT)
      }
    }
  }, 15000)
}
module.exports = async (io) => {
  io.use(auth).on(EVENTS.CONNECTION, async (socket) => {
    console.log(`|${socket.userInfo.phoneNumber}|CONNECTED`)
    if (socket.type === USER_TYPES.AGENT) { await setManagers(socket._id, socket.id) }
    router(socket)
    if (!run) {
      await runner(socket)
      run = true
    }
  })
}
