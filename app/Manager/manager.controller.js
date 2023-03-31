const ManagerService = require('./manager.service')
const RedisService = require('../Redis/redis.service')
const UtilService = require('../Utils/util.service')
const { USER_TYPES, STATUS_CODES, URLS, IN_TRIP_STATES, TRAVEL_TYPE, RESPONSE_STATUS } = require('../Values/constants')

class ManagerController {
  constructor (
    managerService,
    redisService,
    utilService
  ) {
    ManagerController.managerService = managerService
    ManagerController.redisService = redisService
    ManagerController.utilService = utilService
  }

  async getDriverLocation (data, callback) {
    try {
      const result = await ManagerController.redisService.getDriverLocation(data.driverId)
      callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result })
    } catch (error) {
      this.emit('exception', error.message)
      console.error(error)
    }
  }

  async getMyOnlineDrivers (data, callback) {
    try {
      switch (this.type) {
        case USER_TYPES.ADMIN: {
          const drivers = await ManagerController.redisService.getAllDrivers()
          for (let index = 0; index < drivers.length; index++) {
            drivers[index] = clients.get(drivers[index])?.userInfo
          }
          callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: { drivers } })
          break
        }
        case USER_TYPES.AGENT: {
          const drivers = await ManagerController.redisService.agentOnlineDrivers(this._id)
          for (let index = 0; index < drivers.length; index++) {
            drivers[index] = clients.get(drivers[index])?.userInfo
          }
          callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: { drivers } })
          break
        }
        case USER_TYPES.SUPER_AGENT: {
          const drivers = await ManagerController.redisService.superAgentOnlineDrivers(this._id)
          for (let index = 0; index < drivers.length; index++) {
            drivers[index] = clients.get(drivers[index])?.userInfo
          }
          callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: { drivers } })
          break
        }
        default: {
          callback(STATUS_CODES.ERROR_PARAM, { result: 'Invalid user type' })
        }
      }
    } catch (error) {
      this.emit('exception', error.message)
      console.error(error)
    }
  }

  async getMyCloseDrivers (data, callback) {
    try {
      switch (this.type) {
        case USER_TYPES.ADMIN: {
          const drivers = await ManagerController.redisService.getCloseDrivers(data, 'WITHCOORD')
          for (let index = 0; index < drivers.length; index++) {
            drivers[index].member = clients.get(await ManagerController.redisService.getDriver(drivers[index].member))?.userInfo
          }
          callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: { drivers } })
          break
        }
        case USER_TYPES.AGENT: {
          const [allDrivers, myDrivers] = await Promise.all([
            ManagerController.redisService.getCloseDrivers(data, 'WITHCOORD'),
            ManagerController.redisService.agentOnlineDrivers(this._id, true)
          ])
          const drivers = allDrivers.filter(driver => myDrivers.includes(driver.member))
          for (let index = 0; index < drivers.length; index++) {
            drivers[index].member = clients.get(await ManagerController.redisService.getDriver(drivers[index].member))?.userInfo
          }
          callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: { drivers } })
          break
        }
        case USER_TYPES.SUPER_AGENT: {
          const [allDrivers, myDrivers] = await Promise.all([
            ManagerController.redisService.getCloseDrivers(data, 'WITHCOORD'),
            ManagerController.redisService.superAgentOnlineDrivers(this._id, true)
          ])
          const drivers = allDrivers.filter(driver => myDrivers.includes(driver.member))
          for (let index = 0; index < drivers.length; index++) {
            drivers[index].member = clients.get(await ManagerController.redisService.getDriver(drivers[index].member))?.userInfo
          }
          callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: { drivers } })
          break
        }
        default: {
          callback(STATUS_CODES.ERROR_PARAM, { result: 'Invalid user type' })
        }
      }
    } catch (error) {
      this.emit('exception', error.message)
      console.error(error)
    }
  }

  async getMyAvailableDrivers (data, callback) {
    try {
      switch (this.type) {
        case USER_TYPES.ADMIN: {
          const [allDrivers, inTripDrivers] = await Promise.all([
            ManagerController.redisService.getAllDrivers(),
            ManagerController.redisService.getInTripDrivers()
          ])
          const drivers = allDrivers.filter(driver => !inTripDrivers.includes(driver))
          for (let index = 0; index < drivers.length; index++) {
            drivers[index] = clients.get(drivers[index])?.userInfo
          }
          callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: { drivers } })
          break
        }
        case USER_TYPES.AGENT: {
          const [myDrivers, inTripDrivers] = await Promise.all([
            ManagerController.redisService.agentOnlineDrivers(this._id),
            ManagerController.redisService.getInTripDrivers()
          ])
          const drivers = myDrivers.filter(driver => !inTripDrivers.includes(driver))
          for (let index = 0; index < drivers.length; index++) {
            drivers[index] = clients.get(drivers[index])?.userInfo
          }
          callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: { drivers } })
          break
        }
        case USER_TYPES.SUPER_AGENT: {
          const [myDrivers, inTripDrivers] = await Promise.all([
            ManagerController.redisService.superAgentOnlineDrivers(this._id),
            ManagerController.redisService.getInTripDrivers()
          ])
          const drivers = myDrivers.filter(driver => !inTripDrivers.includes(driver))
          for (let index = 0; index < drivers.length; index++) {
            drivers[index] = clients.get(drivers[index])?.userInfo
          }
          callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: { drivers } })
          break
        }
        default: {
          callback(STATUS_CODES.ERROR_PARAM, { result: 'Invalid user type' })
        }
      }
    } catch (error) {
      this.emit('exception', error.message)
      console.error(error)
    }
  }

  async getPassengers (data, callback) {
    try {
      if (this.type === USER_TYPES.ADMIN) {
        const passengers = await ManagerController.redisService.getPassengers()
        for (let index = 0; index < passengers.length; index++) {
          passengers[index] = clients.get(passengers[index])?.userInfo
        }
        callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: { passengers } })
      } else {
        callback(STATUS_CODES.ERROR_PARAM, { result: 'Invalid user type' })
      }
    } catch (error) {
      this.emit('exception', error.message)
      console.error(error)
    }
  }

  async getClients (data, callback) {
    try {
      if (this.type === USER_TYPES.ADMIN) {
        const connectedSockets = Array.from(clients.entries())
        const exportData = []
        for (let index = 0; index < connectedSockets.length; index++) {
          const userInfo = connectedSockets[index][1]?.userInfo
          exportData.push(userInfo)
        }
        callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: { clients: exportData } })
      } else {
        callback(STATUS_CODES.ERROR_PARAM, { result: 'Invalid user type' })
      }
    } catch (error) {
      this.emit('exception', error.message)
      console.error(error)
    }
  }

  async requestMyDrivers (data, callback) {
    try {
      const { origin, destination, stoppageTime, secondDestination, options, firstName, lastName, phoneNumber, driverId } = data
      const passenger = await ManagerController.utilService.axiosInstance({
        url: URLS.CREATE_PASSENGER, data: { firstName, lastName, phoneNumber }, token: this.token, method: 'post', type: this.type
      })
      const lastTravelOfPassenger = await ManagerController.utilService.axiosInstance({ url: URLS.RECENT_TRAVEL, data: { passengerId: passenger._id }, token: this.token, type: this.type })
      if (lastTravelOfPassenger) {
        if (IN_TRIP_STATES.includes(lastTravelOfPassenger.status)) { return callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: 'Passenger is in trip' }) }
      }
      switch (this.type) {
        case USER_TYPES.ADMIN: {
          const nearDrivers = await ManagerController.redisService.getCloseDrivers(origin)
          if (nearDrivers.length === 0) return callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: 'No drivers near you' })
          const travel = await ManagerController.utilService.axiosInstance({
            url: URLS.TRAVEL_URL,
            data: {
              origin,
              destination,
              secondDestination,
              stoppageTime,
              options,
              passengerId: passenger._id,
              travelType: TRAVEL_TYPE.AGENT_REQUESTED
            },
            token: this.token,
            method: 'post',
            type: this.type
          })
          if (travel) {
            if (driverId) {
              const driverSocketId = await ManagerController.redisService.getDriver(driverId)
              const { travelGroup } = clients.has(driverSocketId) ? clients.get(driverSocketId)?.userInfo : false
              const price = await ManagerController.utilService.axiosInstance({
                url: URLS.CALCULATE_PRICE,
                data: {
                  distance: travel.distance,
                  duration: travel.duration,
                  secondDestinationDistance: travel.secondDestinationDistance,
                  secondDestinationDuration: travel.secondDestinationDuration,
                  stoppageTime: travel.stoppageTime,
                  round: travel.roundTrip,
                  DTO: travelGroup
                },
                token: this.token,
                type: this.type
              })
              this.to(driverSocketId).emit('newTravel', { travel, price, passengerInfo: passenger })
            } else {
              for (const index in nearDrivers) {
                const driverSocketId = await ManagerController.redisService.getDriver(nearDrivers[index])
                const { travelGroup } = clients.has(driverSocketId) ? clients.get(driverSocketId)?.userInfo : false
                const price = await ManagerController.utilService.axiosInstance({
                  url: URLS.CALCULATE_PRICE,
                  data: {
                    distance: travel.distance,
                    duration: travel.duration,
                    secondDestinationDistance: travel.secondDestinationDistance,
                    secondDestinationDuration: travel.secondDestinationDuration,
                    stoppageTime: travel.stoppageTime,
                    round: travel.roundTrip,
                    DTO: travelGroup
                  },
                  token: this.token,
                  type: this.type
                })
                this.to(driverSocketId).emit('newTravel', { travel, price, passengerInfo: passenger })
              }
            }
            callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: travel })
          } else {
            callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: 'Travel not created' })
          }
          break
        }
        case USER_TYPES.AGENT: {
          const [nearDrivers, myDrivers] = await Promise.all([
            ManagerController.redisService.getCloseDrivers(origin),
            ManagerController.redisService.agentOnlineDrivers(this._id, true)
          ])
          const drivers = nearDrivers.filter(driver => myDrivers.includes(driver))
          if (drivers.length === 0) return callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: 'No drivers near you' })
          const travel = await ManagerController.utilService.axiosInstance({
            url: URLS.TRAVEL_URL,
            data: {
              origin,
              destination,
              secondDestination,
              stoppageTime,
              options,
              passengerId: passenger._id,
              travelType: TRAVEL_TYPE.AGENT_REQUESTED
            },
            token: this.token,
            method: 'post',
            type: this.type
          })
          if (travel) {
            if (driverId) {
              const driverSocketId = await ManagerController.redisService.getDriver(driverId)
              const { travelGroup } = clients.has(driverSocketId) ? clients.get(driverSocketId)?.userInfo : false
              const price = await ManagerController.utilService.axiosInstance({
                url: URLS.CALCULATE_PRICE,
                data: {
                  distance: travel.distance,
                  duration: travel.duration,
                  secondDestinationDistance: travel.secondDestinationDistance,
                  secondDestinationDuration: travel.secondDestinationDuration,
                  stoppageTime: travel.stoppageTime,
                  round: travel.roundTrip,
                  DTO: travelGroup
                },
                token: this.token,
                type: this.type
              })
              this.to(driverSocketId).emit('newTravel', { travel, price, passengerInfo: passenger })
            } else {
              for (const index in drivers) {
                const driverSocketId = await ManagerController.redisService.getDriver(drivers[index])
                const { travelGroup } = clients.has(driverSocketId) ? clients.get(driverSocketId)?.userInfo : false
                const price = await ManagerController.utilService.axiosInstance({
                  url: URLS.CALCULATE_PRICE,
                  data: {
                    distance: travel.distance,
                    duration: travel.duration,
                    secondDestinationDistance: travel.secondDestinationDistance,
                    secondDestinationDuration: travel.secondDestinationDuration,
                    stoppageTime: travel.stoppageTime,
                    round: travel.roundTrip,
                    DTO: travelGroup
                  },
                  token: this.token,
                  type: this.type
                })
                this.to(driverSocketId).emit('newTravel', { travel, price, passengerInfo: passenger })
              }
            }
            callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: travel })
          } else {
            callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: 'Travel not created' })
          }
          break
        }
        case USER_TYPES.SUPER_AGENT: {
          const [nearDrivers, myDrivers] = await Promise.all([
            ManagerController.redisService.getCloseDrivers(origin),
            ManagerController.redisService.superAgentOnlineDrivers(this._id, true)
          ])
          const drivers = nearDrivers.filter(driver => myDrivers.includes(driver))
          if (drivers.length === 0) return callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: 'No drivers near you' })
          const travel = await ManagerController.utilService.axiosInstance({
            url: URLS.TRAVEL_URL,
            data: {
              origin,
              destination,
              secondDestination,
              stoppageTime,
              options,
              passengerId: passenger._id,
              travelType: TRAVEL_TYPE.AGENT_REQUESTED
            },
            token: this.token,
            method: 'post',
            type: this.type
          })
          if (travel) {
            if (driverId) {
              const driverSocketId = await ManagerController.redisService.getDriver(driverId)
              const { travelGroup } = clients.has(driverSocketId) ? clients.get(driverSocketId)?.userInfo : false
              const price = await ManagerController.utilService.axiosInstance({
                url: URLS.CALCULATE_PRICE,
                data: {
                  distance: travel.distance,
                  duration: travel.duration,
                  secondDestinationDistance: travel.secondDestinationDistance,
                  secondDestinationDuration: travel.secondDestinationDuration,
                  stoppageTime: travel.stoppageTime,
                  round: travel.roundTrip,
                  DTO: travelGroup
                },
                token: this.token,
                type: this.type
              })
              this.to(driverSocketId).emit('newTravel', { travel, price, passengerInfo: passenger })
            } else {
              for (const index in drivers) {
                const driverSocketId = await ManagerController.redisService.getDriver(drivers[index])
                const { travelGroup } = clients.has(driverSocketId) ? clients.get(driverSocketId)?.userInfo : false
                const price = await ManagerController.utilService.axiosInstance({
                  url: URLS.CALCULATE_PRICE,
                  data: {
                    distance: travel.distance,
                    duration: travel.duration,
                    secondDestinationDistance: travel.secondDestinationDistance,
                    secondDestinationDuration: travel.secondDestinationDuration,
                    stoppageTime: travel.stoppageTime,
                    round: travel.roundTrip,
                    DTO: travelGroup
                  },
                  token: this.token,
                  type: this.type
                })
                this.to(driverSocketId).emit('newTravel', { travel, price, passengerInfo: passenger })
              }
            }
            callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: travel })
          } else {
            callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: 'Travel not created' })
          }
          break
        }
        default: {
          callback(STATUS_CODES.ERROR_PARAM, { result: 'Invalid user type' })
        }
      }
    } catch (error) {
      this.emit('exception', error.message)
      console.error(error)
    }
  }

  // find created travel by id and resend it to drivers
  async resendRequest (data, callback) {
    try {
      const { travelId } = data
      const travel = await ManagerController.utilService.axiosInstance({
        url: URLS.TRAVEL_BY_ID,
        data: { travelId },
        token: this.token,
        type: this.type
      })
      if (travel) {
        if (travel.travelType === TRAVEL_TYPE.AGENT_REQUESTED) {
          if (this.type === USER_TYPES.AGENT) {
            const [nearDrivers, myDrivers] = await Promise.all([
              ManagerController.redisService.getCloseDrivers(travel.origin),
              ManagerController.redisService.agentOnlineDrivers(this._id)
            ])
            const drivers = nearDrivers.filter(driver => myDrivers.includes(driver))
            if (drivers.length === 0) return callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: 'No drivers near you' })
            for (const index in drivers) {
              const driverSocketId = await ManagerController.redisService.getDriver(drivers[index])
              const { travelGroup } = clients.has(driverSocketId) ? clients.get(driverSocketId)?.userInfo : false
              const price = await ManagerController.utilService.axiosInstance({
                url: URLS.CALCULATE_PRICE,
                data: {
                  distance: travel.distance,
                  duration: travel.duration,
                  secondDestinationDistance: travel.secondDestinationDistance,
                  secondDestinationDuration: travel.secondDestinationDuration,
                  stoppageTime: travel.stoppageTime,
                  round: travel.roundTrip,
                  DTO: travelGroup
                },
                token: this.token,
                type: this.type
              })
              this.to(driverSocketId).emit('newTravel', { travel, price })
            }
            callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: RESPONSE_STATUS.OK })
          } else {
            callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: 'Invalid user type' })
          }
        } else {
          callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: 'Invalid travel type' })
        }
      } else {
        callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: 'Travel not found' })
      }
    } catch (error) {
      this.emit('exception', error.message)
      console.error(error)
    }
  }
}
module.exports = new ManagerController(
  ManagerService,
  RedisService,
  UtilService
)
