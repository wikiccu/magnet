const { createClient } = require('redis')
const { radius } = require('../../config/env.js')
const redis = createClient({ url: 'redis://localhost:7300' })
redis.connect()
redis.on('connect', async () => {
  await Promise.allSettled([
    redis.del('driversPosition'),
    redis.del('passengers'),
    redis.del('inTripDrivers'),
    redis.del('managers'),
    redis.del('drivers')
  ])
  const [agents, superAgents] = await Promise.all([
    redis.keys('agent-*'),
    redis.keys('superAgent-*')
  ])
  for (const i in agents) { await redis.del(agents[i]) }
  for (const i in superAgents) { await redis.del(superAgents[i]) }
  console.log('Redis Connected')
})
redis.on('error', (err) => console.log('Error ' + err))
class RedisService {
  setDriver = async ({ longitude, latitude, driverId, agentId, superAgentId, socketId }) => {
    await Promise.all([
      redis.geoAdd('driversPosition', { longitude, latitude, member: driverId }),
      redis.hSet('drivers', `${driverId}`, `${socketId}`),
      redis.hSet(`agent-${agentId}`, `${driverId}`, `${socketId}`),
      redis.hSet(`superAgent-${superAgentId}`, `${driverId}`, `${socketId}`)
    ])
  }

  unsetUser = async (agentId, superAgentId, userId) =>
    await Promise.allSettled([
      redis.hDel('drivers', `${userId}`),
      redis.hDel(`agent-${agentId}`, `${userId}`),
      redis.hDel(`superAgent-${superAgentId}`, `${userId}`),
      redis.zRem('driversPosition', `${userId}`),
      redis.hDel('inTripDrivers', `${userId}`),
      redis.hDel('passengers', `${userId}`),
      redis.hDel('managers', `${userId}`)
    ])

  setInTripDrivers = async (driverId, socketId) => await redis.hSet('inTripDrivers', `${driverId}`, `${socketId}`)

  setManagers = async (agentId, socketId) => await redis.hSet('managers', `${agentId}`, `${socketId}`)

  getManager = async (agentId) => await redis.hGet('managers', `${agentId}`)

  removeInTripDrivers = async (driverId) => await redis.hDel('inTripDrivers', `${driverId}`)

  getInTripDrivers = async (keys = false) => (keys ? await redis.hKeys('inTripDrivers') : await redis.hVals('inTripDrivers'))

  updateDriverLocation = async (longitude, latitude, driverId) => await redis.geoAdd('driversPosition', { longitude, latitude, member: driverId })

  getCloseDrivers = async ({ long: longitude, lat: latitude }, WITHCOORD = false) =>
    WITHCOORD
      ? await redis.geoSearchWith('driversPosition', { longitude, latitude }, { unit: 'm', radius }, ['WITHCOORD'], { SORT: 'ASC' })
      : await redis.geoSearch('driversPosition', { longitude, latitude }, { unit: 'm', radius }, { SORT: 'ASC' })

  getDriverLocation = async (driverId) => await redis.geoPos('driversPosition', driverId)

  agentOnlineDrivers = async (agentId, keys = false) => (keys ? await redis.hKeys(`agent-${agentId}`) : await redis.hVals(`agent-${agentId}`))

  superAgentOnlineDrivers = async (superAgentId, keys = false) => (keys ? await redis.hKeys(`superAgent-${superAgentId}`) : await redis.hVals(`superAgent-${superAgentId}`))

  setPassenger = async (passengerId, socketId) => await redis.hSet('passengers', `${passengerId}`, `${socketId}`)

  getPassenger = async (passengerId) => await redis.hGet('passengers', `${passengerId}`)

  getPassengers = async () => await redis.hVals('passengers')

  getDriver = async (driverId) => await redis.hGet('drivers', `${driverId}`)

  getAllPaid = async () => await redis.hGetAll('paidUsers')

  removePaid = async (field) => await redis.hDel('paidUsers', `${field}`)

  getAllDrivers = async (keys = false) =>
    keys
      ? await redis.hKeys('drivers')
      : await redis.hVals('drivers')
}

module.exports = new RedisService()
