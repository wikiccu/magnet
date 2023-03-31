const PassengerService = require('./client.service')
const RedisService = require('../Redis/redis.service')
const UtilService = require('../Utils/util.service')
const { USER_STATUS, URLS, TRAVEL_STATUS, STATUS_CODES, AGENT_TYPE, RESPONSE_STATUS, TRAVEL_TYPE, TARGET_ALL, USER_TYPES, IN_TRIP_STATES } = require('../Values/constants')

class clientsController {
  constructor (passengerService, redisService, utilService) {
    clientsController.utilService = utilService
    clientsController.passengerService = passengerService
    clientsController.redisService = redisService
  }

  async setPassenger (data, callback) {
    try {
      const [lastTravel] = await Promise.all([
        clientsController.utilService.axiosInstance({ url: URLS.RECENT_TRAVEL, token: this.token, type: USER_TYPES.PASSENGER }),
        clientsController.redisService.setPassenger(this._id, this.id)
      ])
      if (lastTravel && IN_TRIP_STATES.includes(lastTravel.status)) {
        await clientsController.utilService.axiosInstance({
          url: URLS.UPDATE_PASSENGER_STATUS,
          data: { userId: this._id, status: USER_STATUS.IN_SERVICE },
          token: this.token,
          method: 'put',
          type: USER_TYPES.PASSENGER
        })
        callback(STATUS_CODES.USER_IS_IN_SERVICE, { result: lastTravel })
      } else {
        await clientsController.utilService.axiosInstance({
          url: URLS.UPDATE_PASSENGER_STATUS,
          data: { userId: this._id, status: USER_STATUS.NO_SERVICE },
          token: this.token,
          method: 'put',
          type: USER_TYPES.PASSENGER
        })
      }
      callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: RESPONSE_STATUS.OK })
    } catch (error) {
      this.emit('exception', error.message)
      console.error(error)
    }
  }

  // #region travel creation

  async createTravel (data, callback) {
    try {
      const { origin, destination, stoppageTime, secondDestination, options } = data
      const lastTravel = await clientsController.utilService.axiosInstance({ url: URLS.RECENT_TRAVEL, token: this.token, type: USER_TYPES.PASSENGER })
      if (lastTravel && IN_TRIP_STATES.includes(lastTravel.status)) {
        return callback(STATUS_CODES.USER_IS_IN_SERVICE, { result: 'User is in service' })
      } else {
        const [nearDrivers, travel] = await Promise.all([
          clientsController.redisService.getCloseDrivers(origin),
          clientsController.utilService.axiosInstance({
            url: URLS.TRAVEL_URL,
            data: {
              origin,
              destination,
              secondDestination,
              stoppageTime,
              options,
              passengerId: this._id
            },
            token: this.token,
            method: 'post',
            type: USER_TYPES.PASSENGER
          })
        ])
        if (travel) {
          const agencies = []
          for (const index in nearDrivers) {
            try {
              const driverSocketId = await clientsController.redisService.getDriver(nearDrivers[index])
              const { agentId, agentName, agentType, travelGroup, agentAverageRate, driverAverageRate } = clients.has(driverSocketId) ? clients.get(driverSocketId)?.userInfo : false
              if (agentType !== AGENT_TYPE.DELIVERY) {
                const price = await clientsController.utilService.axiosInstance({
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
                  type: USER_TYPES.PASSENGER
                })
                agencies.push({ agentId, agentName, price, agentType, agentAverageRate, driverAverageRate })
              }
            } catch (error) {
              callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: RESPONSE_STATUS.FAILED })
            }
          }
          callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: { agencies, travel: travel._id } })
        } else {
          callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: 'Could not make new travel' })
        }
      }
    } catch (error) {
      this.emit('exception', error.message)
      console.error(error)
    }
  }

  async createInstanceTravel (data, callback) {
    try {
      const { origin } = data
      const lastTravel = await clientsController.utilService.axiosInstance({ token: this.token, type: USER_TYPES.PASSENGER })
      if (lastTravel && IN_TRIP_STATES.includes(lastTravel.status)) {
        return callback(STATUS_CODES.USER_IS_IN_SERVICE, { result: 'User is in service' })
      } else {
        const [nearDrivers, travel] = await Promise.all([
          clientsController.redisService.getCloseDrivers(origin),
          clientsController.utilService.axiosInstance({
            url: URLS.TRAVEL_URL,
            data: {
              origin,
              travelType: TRAVEL_TYPE.INSTANCE,
              passengerId: this._id
            },
            token: this.token,
            method: 'post',
            type: USER_TYPES.PASSENGER
          })
        ])
        if (travel) {
          await clientsController.utilService.axiosInstance({
            url: URLS.UPDATE_PASSENGER_STATUS,
            data: { userId: this._id, status: USER_STATUS.IN_SERVICE },
            token: this.token,
            method: 'put',
            type: USER_TYPES.PASSENGER
          })
          for (const index in nearDrivers) {
            const driverSocketId = await clientsController.redisService.getDriver(nearDrivers[index])
            this.to(driverSocketId).emit('newTravel', { travel, passengerInformation: this.userInfo })
          }
          callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: travel })
        } else {
          callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: 'Could not make new travel' })
        }
      }
    } catch (error) {
      this.emit('exception', error.message)
      console.error(error)
    }
  }

  async reCreateTravel (data, callback) {
    try {
      const lastTravel = await clientsController.utilService.axiosInstance({
        url: URLS.RECENT_TRAVEL,
        token: this.token,
        type: USER_TYPES.PASSENGER
      })
      if (
        lastTravel &&
        lastTravel.status === TRAVEL_STATUS.DRIVER_CANCELED &&
        lastTravel.travelType === TRAVEL_TYPE.PASSENGER_REQUESTED &&
        lastTravel.cancelPosition !== TRAVEL_STATUS.STARTED
      ) {
        const [nearDrivers, travel] = await Promise.all([
          clientsController.redisService.getCloseDrivers({ long: lastTravel.sourceLng, lat: lastTravel.sourceLat }),
          clientsController.utilService.axiosInstance({
            url: URLS.TRAVEL_URL,
            data: {
              origin: { lat: lastTravel.sourceLat, long: lastTravel.sourceLng },
              destination: { lat: lastTravel.destinationLat, long: lastTravel.destinationLng },
              secondDestination: lastTravel.secondDestinationLat ? { lat: lastTravel.secondDestinationLat, long: lastTravel.secondDestinationLong } : undefined,
              stoppageTime: lastTravel.stoppageTime ? lastTravel.stoppageTime : undefined,
              options: { round: lastTravel.roundTrip, second: !!lastTravel.secondDestinationLat, stop: !!lastTravel.stoppageTime },
              passengerId: this._id
            },
            token: this.token,
            method: 'post',
            type: USER_TYPES.PASSENGER
          })
        ])
        const agencies = []
        for (const index in nearDrivers) {
          const driverSocketId = await clientsController.redisService.getDriver(nearDrivers[index])
          const { agentId, agentName, agentType, travelGroup, agentAverageRate, driverAverageRate } = clients.has(driverSocketId) ? clients.get(driverSocketId)?.userInfo : false
          if (agentType !== AGENT_TYPE.DELIVERY) {
            const price = await clientsController.utilService.axiosInstance({
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
              type: USER_TYPES.PASSENGER
            })
            agencies.push({ agentId, agentName, price, agentType, agentAverageRate, driverAverageRate })
          }
        }
        callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: { agencies, travel: travel._id } })
      } else {
        callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: 'Could not recreate travel' })
      }
    } catch (error) {
      this.emit('exception', error.message)
      console.error(error)
    }
  }

  async cancelTravelPassenger (data, callback) {
    try {
      const { travelId, driverId } = await clientsController.utilService.axiosInstance({
        url: URLS.CANCEL_TRAVEL,
        token: this.token,
        method: 'put',
        type: USER_TYPES.PASSENGER
      })
      if (travelId) {
        await clientsController.utilService.axiosInstance({
          url: URLS.UPDATE_PASSENGER_STATUS,
          data: { userId: this._id, status: USER_STATUS.NO_SERVICE },
          token: this.token,
          method: 'put',
          type: USER_TYPES.PASSENGER
        })
        if (driverId) {
          const driverSocketId = await clientsController.redisService.getDriver(driverId)
          this.to(driverSocketId).emit('privateMessage', { result: STATUS_CODES.PV_MSG_PASSENGER_CANCELED })
        }
        return callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: RESPONSE_STATUS.OK })
      } else {
        return callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: RESPONSE_STATUS.FAILED })
      }
    } catch (error) {
      this.emit('exception', error.message)
      console.error(error)
    }
  }

  // #endregion
  // #region find drivers
  async chooseAgent (data, callback) {
    try {
      const travel = await clientsController.utilService.axiosInstance({
        url: URLS.RECENT_TRAVEL,
        token: this.token,
        type: USER_TYPES.PASSENGER
      })
      if (travel) {
        if (travel.status === TRAVEL_STATUS.REQUESTED) {
          const nearDrivers = await clientsController.redisService.getCloseDrivers({ long: travel.sourceLng, lat: travel.sourceLat })
          if (data.target === TARGET_ALL) {
            for (const index in nearDrivers) {
              const driverSocketId = await clientsController.redisService.getDriver(nearDrivers[index])
              const { travelGroup, agentType } = clients.has(driverSocketId) ? clients.get(driverSocketId)?.userInfo : false
              if (agentType !== AGENT_TYPE.DELIVERY) {
                const price = await clientsController.utilService.axiosInstance({
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
                  type: USER_TYPES.PASSENGER
                })
                this.to(driverSocketId).emit('newTravel', { travel, price, passengerInfo: this.userInfo })
              }
            }
          } else {
            for (const index in nearDrivers) {
              const driverSocketId = await clientsController.redisService.getDriver(nearDrivers[index])
              const { agentId, travelGroup } = clients.has(driverSocketId) ? clients.get(driverSocketId)?.userInfo : false
              if (agentId === data.target) {
                const price = await clientsController.utilService.axiosInstance({
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
                  type: USER_TYPES.PASSENGER
                })
                this.to(driverSocketId).emit('newTravel', { travel, price, passengerInformation: this.userInfo })
              }
            }
          }
          callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: RESPONSE_STATUS.OK })
        } else {
          callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: 'Seems you did not create a travel' })
        }
      } else {
        callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: 'Seems you did not create a travel' })
      }
    } catch (error) {
      this.emit('exception', error.message)
      console.error(error)
    }
  }

  async reFindDrivers (data, callback) {
    try {
      const travel = await clientsController.utilService.axiosInstance({
        url: URLS.RECENT_TRAVEL,
        token: this.token,
        type: USER_TYPES.PASSENGER
      })
      if (travel && travel.status === TRAVEL_STATUS.REQUESTED) {
        const nearDrivers = await clientsController.redisService.getCloseDrivers({ long: travel.sourceLng, lat: travel.sourceLat })
        const agencies = []
        for (const index in nearDrivers) {
          const driverSocketId = await clientsController.redisService.getDriver(nearDrivers[index])
          const { agentId, agentName, agentType, travelGroup, agentAverageRate, driverAverageRate } = clients.has(driverSocketId) ? clients.get(driverSocketId)?.userInfo : false
          if (agentType !== AGENT_TYPE.DELIVERY) {
            const price = await clientsController.utilService.axiosInstance({
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
              type: USER_TYPES.PASSENGER
            })
            agencies.push({ agentId, agentName, price, agentType, agentAverageRate, driverAverageRate })
          }
          callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: { agencies, travel: travel._id } })
        }
      } else {
        callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: 'Could not refind driver' })
      }
    } catch (error) {
      this.emit('exception', error.message)
      console.error(error)
    }
  }

  async getCloseDrivers (data, callback) {
    try {
      const { driverId } = data
      let result
      if (driverId) {
        result = await clientsController.redisService.getDriverLocation(driverId)
      } else {
        result = await clientsController.redisService.getCloseDrivers(data, 'WITHCOORD')
      }
      callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result })
    } catch (error) {
      this.emit('exception', error.message)
      console.error(error)
    }
  }

  // #endregion
  // #region additional
  async addOptions (data, callback) {
    try {
      const { stoppageTime, secondDestination, round } = data
      let body
      const travel = await clientsController.utilService.axiosInstance({
        url: URLS.RECENT_TRAVEL,
        token: this.token,
        type: USER_TYPES.PASSENGER
      })
      if (travel && travel.status !== TRAVEL_STATUS.STARTED) {
        return callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: 'Travel must be started' })
      } else {
        body = { distance: travel.distance, duration: travel.duration, stoppageTime, round, driverId: travel.driverId._id }
        if (secondDestination) {
          const [distanceData, { address }] = await Promise.all([
            clientsController.utilService.calculateDistanceAndDuration({ lat: travel.destinationLat, long: travel.destinationLng }, secondDestination),
            clientsController.utilService.reverseGeoCoding(secondDestination)
          ])
          body.secondDestinationDistance = distanceData.distance
          body.secondDestinationDuration = distanceData.duration
          body.secondDestinationAddress = address
        }
      }
      const driver = await clientsController.redisService.getDriver(String(travel.driverId._id))
      const price = await clientsController.utilService.axiosInstance({
        url: URLS.CALCULATE_PRICE,
        data: body,
        token: this.token,
        type: USER_TYPES.PASSENGER
      })
      this.to(driver).emit('privateMessage', STATUS_CODES.PV_MSG_ADDITIONAL_REQUEST, {
        result: {
          secondDestinationDistance: body.secondDestinationDistance,
          secondDestinationDuration: body.secondDestinationDuration,
          secondDestinationAddress: body.secondDestinationAddress,
          secondDestination,
          stoppageTime,
          roundTrip: round,
          price,
          passengerId: travel.passengerId,
          travelId: travel._id
        }
      })
      callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: RESPONSE_STATUS.OK })
    } catch (error) {
      this.emit('exception', error.message)
      console.error(error)
    }
  }

  // #endregion
  // #region delivery
  async createDelivery (data, callback) {
    try {
      const {
        origin,
        originInformation,
        destination,
        destinationInformation,
        secondDestination,
        secondDestinationInformation,
        boxInformation,
        options,
        stoppageTime,
        deliveryType
      } = data
      const [nearDrivers, travel] = await Promise.all([
        clientsController.redisService.getCloseDrivers(origin),
        clientsController.utilService.axiosInstance({
          url: URLS.CREATE_DELIVERY,
          data: {
            origin,
            originInformation,
            destination,
            destinationInformation,
            secondDestination,
            secondDestinationInformation,
            boxInformation,
            options,
            stoppageTime,
            deliveryType
          },
          token: this.token,
          method: 'post',
          type: USER_TYPES.PASSENGER
        })
      ])

      console.error({ nearDrivers })
      if (travel) {
        const agencies = []
        for (const index in nearDrivers) {
          try {
            const driverSocketId = await clientsController.redisService.getDriver(nearDrivers[index])
            const { agentId, agentName, agentType, travelGroup, agentAverageRate, driverAverageRate } = clients.has(driverSocketId) ? clients.get(driverSocketId)?.userInfo : false
            if (agentType === USER_TYPES.DELIVERY) {
              const price = await clientsController.utilService.axiosInstance({
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
                type: USER_TYPES.PASSENGER
              })
              agencies.push({ agentId, agentName, price, agentType, agentAverageRate, driverAverageRate })
            }
          } catch (error) {
            callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: RESPONSE_STATUS.FAILED })
          }
        }
        callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: { agencies, delivery: travel._id } })
      } else {
        callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: 'Could not make new travel' })
      }
    } catch (error) {
      this.emit('exception', error.message)
      console.error(error)
    }
  }

  async chooseAgentForDelivery (data, callback) {
    try {
      console.error({ data })
      const travel = await clientsController.utilService.axiosInstance({ url: `${URLS.FIND_DELIVERY_BY_ID}${data.deliveryId}`, token: this.token, type: USER_TYPES.PASSENGER })

      if (travel) {
        if (travel.status === TRAVEL_STATUS.REQUESTED) {
          const nearDrivers = await clientsController.redisService.getCloseDrivers({ long: travel.origin.long, lat: travel.origin.lat })
          if (data.target === TARGET_ALL) {
            for (const index in nearDrivers) {
              const driverSocketId = await clientsController.redisService.getDriver(nearDrivers[index])
              const { travelGroup, agentType } = clients.has(driverSocketId) ? clients.get(driverSocketId)?.userInfo : false
              if (agentType === USER_TYPES.DELIVERY) {
                const price = await clientsController.utilService.axiosInstance({
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
                  type: USER_TYPES.PASSENGER
                })
                console.erorr({ driverSocketId })
                this.to(driverSocketId).emit('newTravel', { travel, price, passengerInfo: this.userInfo })
              }
            }
          } else {
            let price
            for (const index in nearDrivers) {
              console.error({ nearDrivers })
              const driverSocketId = await clientsController.redisService.getDriver(nearDrivers[index])
              const { agentId, agentType, travelGroup } = clients.has(driverSocketId) ? clients.get(driverSocketId)?.userInfo : false
              if (agentId === data.target) {
                if (agentType === USER_TYPES.DELIVERY) {
                  price = await clientsController.utilService.axiosInstance({
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
                    type: USER_TYPES.PASSENGER
                  })
                  console.error({ driverSocketId })
                  this.to(driverSocketId).emit('newTravel', { travel, price, passengerInformation: this.userInfo })
                }
              }
            }
          }

          await clientsController.utilService.axiosInstance({
            url: URLS.UPDATE_TO_IS_CHOOSE,
            data: { deliveryId: data.deliveryId },
            token: this.token,
            type: USER_TYPES.PASSENGER
          })

          callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: travel })
        }
        this.emit('privateMessage', STATUS_CODES.PV_MSG_PASSENGER_CHOOSE_AGENT)
      } else {
        callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: 'Seems you did not create a travel' })
      }
    } catch (error) {
      this.emit('exception', error.message)
      console.error(error)
    }
  }

  async cancelDeliveryPassenger (data, callback) {
    try {
      const canceledDeliveryId = await clientsController.utilService.axiosInstance({
        url: URLS.CANCEL_DELIVERY,
        data: { deliveryId: data.deliveryId },
        token: this.token,
        method: 'put',
        type: USER_TYPES.PASSENGER
      })

      if (canceledDeliveryId) {
        await clientsController.utilService.axiosInstance({
          url: URLS.UPDATE_PASSENGER_STATUS,
          data: { userId: this._id, status: USER_STATUS.NO_SERVICE },
          token: this.token,
          method: 'put',
          type: USER_TYPES.PASSENGER
        })

        clientsController.utilService.axiosInstance({
          url: URLS.DELIVERY_UPDATE_LOG_URL,
          data: { deliveryId: data.deliveryId, PASSENGER_CANCELED: Date.now() },
          token: this.token,
          method: 'put',
          type: USER_TYPES.PASSENGER
        })

        this.emit('privateMessage', STATUS_CODES.PV_MSG_PASSENGER_CANCELED)
        return callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: RESPONSE_STATUS.OK })
      } else {
        return callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: RESPONSE_STATUS.FAILED })
      }
    } catch (error) {
      this.emit('exception', error.message)
      console.error(error)
    }
  }

  async reFindDriversDelvery (data, callback) {
    try {
      const travel = await clientsController.utilService.axiosInstance({ url: `${URLS.FIND_DELIVERY_BY_ID}${data.deliveryId}`, token: this.token, type: USER_TYPES.PASSENGER })
      if (travel && travel.status === TRAVEL_STATUS.REQUESTED) {
        const nearDrivers = await clientsController.redisService.getCloseDrivers({ long: travel.originInformation.originLng, lat: travel.originInformation.originLat })

        const agencies = []
        for (const index in nearDrivers) {
          const driverSocketId = await clientsController.redisService.getDriver(nearDrivers[index])
          const { agentId, agentName, agentType, travelGroup, agentAverageRate, driverAverageRate } = clients.has(driverSocketId) ? clients.get(driverSocketId)?.userInfo : false
          if (agentType === USER_TYPES.DELIVERY) {
            const price = await clientsController.utilService.axiosInstance({
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
              type: USER_TYPES.PASSENGER
            })
            agencies.push({ agentId, agentName, price, agentType, agentAverageRate, driverAverageRate })
          }
        }
        callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: { agencies, travel: travel._id } })
      } else {
        callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: 'Could not refind driver' })
      }
    } catch (error) {
      this.emit('exception', error.message)
      console.error(error)
    }
  }

  // #endregion
}
module.exports = new clientsController(PassengerService, RedisService, UtilService)
