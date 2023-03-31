const DriverService = require("./server.service")
const RedisService = require("../Redis/redis.service")
const PassengersService = require("../Clients/client.service")
const UtilService = require("../Utils/util.service")
const { USER_STATUS, URLS, TRAVEL_STATUS, STATUS_CODES, RESPONSE_STATUS, TRAVEL_TYPE, IN_TRIP_STATES, USER_TYPES } = require("../Values/constants")

class serverController {
  constructor (driverService, redisService, passengersService, utilService) {
    serverController.driverService = driverService
    serverController.redisService = redisService
    serverController.passengersService = passengersService
    serverController.utilService = utilService
  }

  // #region driver location
  async setDriver (data, callback) {
    console.log({ driverApp: this.userInfo.driverApp })
    if (!this.userInfo.driverApp) serverController.utilService.axiosInstance({ url: URLS.UPDATE_INSTALL_APP_FLAG, token: this.token, method: "put" })
    try {
      const [travel] = await Promise.all([
        serverController.utilService.axiosInstance({ url: URLS.RECENT_TRAVEL, token: this.token }),
        serverController.redisService.setDriver({
          longitude: data.long,
          latitude: data.lat,
          driverId: this._id,
          agentId: this.userInfo.agentId,
          superAgentId: this.userInfo.superAgentId,
          socketId: this.id,
        }),
      ])

      if (travel && IN_TRIP_STATES.includes(travel.status)) {
        const passengerInformation = await serverController.utilService.axiosInstance({ url: URLS.USER_BY_ID, params: [`id=${travel.passengerId}`], token: this.token })
        Promise.all([
          serverController.utilService.axiosInstance({ url: URLS.UPDATE_DRIVER_STATUS, data: { status: USER_STATUS.IN_SERVICE }, token: this.token, method: "put" }),
          serverController.redisService.setInTripDrivers(this._id, this.id),
        ])
        this.userInfo.inTrip = true
        this.userInfo.travelType = travel.travelType
        callback(STATUS_CODES.USER_IS_IN_SERVICE, { travel, passengerInformation })
      } else {
        Promise.all([
          serverController.utilService.axiosInstance({ url: URLS.UPDATE_DRIVER_STATUS, data: { status: USER_STATUS.NO_SERVICE }, token: this.token, method: "put" }),
          serverController.redisService.removeInTripDrivers(this._id),
        ])
        this.userInfo.inTrip = false
        this.userInfo.travelType = "NOTHING"
        callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: RESPONSE_STATUS.OK })
      }
    } catch (error) {
      this.emit("exception", error.message)
      console.error(error)
    }
  }

  async unsetDriver (data, callback) {
    try {
      serverController.redisService.unsetUser(this.userInfo.agentId, this.userInfo.superAgentId, this._id)
      callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: RESPONSE_STATUS.OK })
    } catch (error) {
      this.emit("exception", error.message)
      console.error(error)
    }
  }

  async updateDriverLocation (data, callback) {
    try {
      serverController.redisService.updateDriverLocation(data.long, data.lat, this._id)
      callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: RESPONSE_STATUS.OK })
    } catch (error) {
      this.emit("exception", error.message)
      console.error(error)
    }
  }

  // #endregion
  // #region travel
  async acceptTravel (data, callback) {
    try {
      const [acceptingTravel, lastTravel, driverLocation] = await Promise.all([
        serverController.utilService.axiosInstance({ url: URLS.TRAVEL_BY_ID, data: { travelId: data.travelId }, token: this.token }),
        serverController.utilService.axiosInstance({ url: URLS.RECENT_TRAVEL, token: this.token }),
        serverController.redisService.getDriverLocation(this._id),
      ])
      if (lastTravel && IN_TRIP_STATES.includes(lastTravel.status)) {
        const { distance } =
          lastTravel.secondDestinationDistance > 0
            ? await serverController.utilService.calculateDistanceAndDuration(
              { lat: driverLocation[0].latitude, long: driverLocation[0].longitude },
              { lat: lastTravel.secondDestinationLat, long: lastTravel.secondDestinationLong }
            )
            : await serverController.utilService.calculateDistanceAndDuration(
              { lat: driverLocation[0].latitude, long: driverLocation[0].longitude },
              { lat: lastTravel.destinationLat, long: lastTravel.destinationLng }
            )
        if ([TRAVEL_TYPE.TAXIMETER, TRAVEL_TYPE.INSTANCE].includes(lastTravel.travelType) || !(distance > 1000)) {
          const [passenger, travel] = await Promise.all([
            serverController.redisService.getPassenger(lastTravel.passengerId),
            serverController.utilService.axiosInstance({
              url: URLS.FINISH_TRAVELS,
              token: this.token,
              method: "put",
            }),
          ])
          if (!travel) return callback(STATUS_CODES.ERROR_TRAVEL_NOT_FINISHED, { result: "Your last travel did not finish successfuly" })
          if (passenger) {
            this.to(passenger).emit("privateMessage", STATUS_CODES.PV_MSG_TRAVEL_FINISHED, { result: travel })
          }
        } else {
          return callback(STATUS_CODES.ERROR_NOT_IN_AREA, { result: "You must be in travel destination area" })
        }
      }
      if (!acceptingTravel || acceptingTravel.status !== TRAVEL_STATUS.REQUESTED) {
        return callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: "Travel is already accepted or canceled" })
      } else {
        const [passenger, travel] = await Promise.all([
          serverController.redisService.getPassenger(acceptingTravel.passengerId._id),
          serverController.utilService.axiosInstance({ url: URLS.ACCEPT_TRAVEL, data: { travelId: data.travelId, driverId: this._id }, token: this.token, method: "put" }),
          serverController.utilService.axiosInstance({ url: URLS.UPDATE_DRIVER_STATUS, data: { status: TRAVEL_STATUS.REACHING_TO_PASSENGER }, token: this.token, method: "put" }),
          serverController.redisService.setInTripDrivers(this._id, this.id),
        ])
        this.userInfo.inTrip = true
        this.userInfo.travelType = travel.travelType
        let passengerInformation
        if (passenger) {
          this.to(passenger).emit("privateMessage", STATUS_CODES.PV_MSG_DRIVER_ACCEPTED, { result: { driverInformation: this.userInfo, travel } })
          passengerInformation = clients.get(passenger).userInfo
        } else {
          passengerInformation = await serverController.utilService.axiosInstance({ url: URLS.USER_BY_ID, params: [`id=${acceptingTravel.passengerId._id}`], token: this.token })
        }
        if (acceptingTravel.travelType === TRAVEL_TYPE.AGENT_REQUESTED) {
          const agent = await serverController.redisService.getManager(this.userInfo.agentId)
          if (agent) {
            this.to(agent).emit("privateMessage", STATUS_CODES.PV_MSG_DRIVER_ACCEPTED, { result: { driverInformation: this.userInfo } })
          }
        }
        callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { travel, passengerInformation })
      }
      serverController.utilService.sendToLog({
        serviceName: "socket",
        userId: this._id,
        travelId: acceptingTravel._id,
        location: driverLocation[0],
        description: `driver accepted travel`,
      })
    } catch (error) {
      serverController.redisService.removeInTripDrivers(this._id)
      this.userInfo.inTrip = false
      this.userInfo.travelType = "NOTHING"
      this.emit("exception", error.message)
      console.error(error)
    }
  }

  async driverArrived (data, callback) {
    try {
      const foundedTravel = await serverController.utilService.axiosInstance({ url: URLS.RECENT_TRAVEL, token: this.token })
      if (!foundedTravel || foundedTravel.status !== TRAVEL_STATUS.ACCEPTED) {
        return callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: RESPONSE_STATUS.FAILED })
      } else {
        const [passenger] = await Promise.all([
          serverController.redisService.getPassenger(foundedTravel.passengerId),
          serverController.utilService.axiosInstance({
            url: URLS.TRAVEL_URL,
            data: { travelId: foundedTravel._id, updateFields: { status: TRAVEL_STATUS.ARRIVED } },
            token: this.token,
            method: "put",
          }),
        ])
        if (passenger) this.to(passenger).emit("privateMessage", STATUS_CODES.PV_MSG_DRIVER_ARRIVED)
        else this.emit("exception", "Passenger is not found")
        callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: RESPONSE_STATUS.OK })
      }
    } catch (error) {
      this.emit("exception", error.message)
      console.error(error)
    }
  }

  async passengerBoarded (data, callback) {
    try {
      const foundedTravel = await serverController.utilService.axiosInstance({ url: URLS.RECENT_TRAVEL, token: this.token })
      if (!foundedTravel || foundedTravel.status !== TRAVEL_STATUS.ARRIVED) {
        return callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: RESPONSE_STATUS.FAILED })
      } else {
        const [passenger] = await Promise.all([
          serverController.redisService.getPassenger(foundedTravel.passengerId),
          serverController.utilService.axiosInstance({
            url: URLS.TRAVEL_URL,
            data: { travelId: foundedTravel._id, updateFields: { status: TRAVEL_STATUS.STARTED } },
            token: this.token,
            method: "put",
          }),
        ])
        if (passenger) this.to(passenger).emit("privateMessage", STATUS_CODES.PV_MSG_TRAVEL_STARTED)
        else this.emit("exception", "Passenger is not found")
        callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: RESPONSE_STATUS.OK })
      }
    } catch (error) {
      this.emit("exception", error.message)
      console.error(error)
    }
  }

  async cancelTravelDriver (data, callback) {
    try {
      const { passengerId, travelId } = await serverController.utilService.axiosInstance({
        url: URLS.CANCEL_TRAVEL,
        token: this.token,
        method: "put",
      })
      if (passengerId) {
        const passenger = await serverController.redisService.getPassenger(passengerId)
        if (passenger) this.to(passenger).emit("privateMessage", STATUS_CODES.PV_MSG_DRIVER_CANCELED, { result: travelId })
        else this.emit("exception", "Passenger is not found")
        serverController.redisService.removeInTripDrivers(this._id)
        this.userInfo.inTrip = false
        this.userInfo.travelType = "NOTHING"
        return callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: RESPONSE_STATUS.OK })
      } else {
        return callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: "Uh oh! Could not cancel it" })
      }
    } catch (error) {
      this.emit("exception", error.message)
      console.error(error)
    }
  }

  async finishTravel (data, callback) {
    try {
      const { destination } = data
      const foundedTravel = await serverController.utilService.axiosInstance({ url: URLS.RECENT_TRAVEL, token: this.token })
      if (!foundedTravel || foundedTravel.status !== TRAVEL_STATUS.STARTED) {
        return callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: "Travel not found" })
      } else {
        if (foundedTravel.travelType === TRAVEL_TYPE.INSTANCE || foundedTravel.travelType === TRAVEL_TYPE.TAXIMETER) {
          if (!destination) {
            return callback(STATUS_CODES.ERROR_PARAM, { result: RESPONSE_STATUS.PARAM_ERROR })
          }
        }
        const [passenger, travel] = await Promise.all([
          serverController.redisService.getPassenger(foundedTravel.passengerId),
          serverController.utilService.axiosInstance({
            url: URLS.FINISH_TRAVELS,
            data: destination ? { destinationLat: destination.lat, destinationLng: destination.long } : {},
            token: this.token,
            method: "put",
          }),
        ])
        if (travel) {
          let passengerInformation
          if (passenger) {
            this.to(passenger).emit("privateMessage", STATUS_CODES.PV_MSG_TRAVEL_FINISHED, { result: travel })
            passengerInformation = clients.get(passenger)?.userInfo
          } else {
            passengerInformation = await serverController.utilService.axiosInstance({ url: URLS.USER_BY_ID, params: [`id=${foundedTravel.passengerId}`], token: this.token })
          }
          await serverController.redisService.removeInTripDrivers(this._id)
          this.userInfo.inTrip = false
          this.userInfo.travelType = "NOTHING"
          callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: travel, passengerInformation })
        } else {
          callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: "Sorry! Could not finish it" })
        }
      }
    } catch (error) {
      this.emit("exception", error.message)
      console.error(error)
    }
  }

  async taximeterStart (data, callback) {
    try {
      const { firstName, lastName, phoneNumber, origin } = data
      const { _id: passengerId, passengerInformation } = await serverController.utilService.axiosInstance({
        url: URLS.CREATE_PASSENGER,
        data: { firstName, lastName, phoneNumber },
        token: this.token,
        method: "post",
      })
      if (passengerInformation && passengerInformation.status !== USER_STATUS.NO_SERVICE) {
        return callback(STATUS_CODES.USER_IS_IN_SERVICE, { result: "User is in service" })
      } else {
        const travel = await serverController.utilService.axiosInstance({
          url: URLS.TRAVEL_URL,
          data: {
            origin,
            passengerId,
            travelType: TRAVEL_TYPE.TAXIMETER,
          },
          token: this.token,
          method: "post",
        })
        if (travel) {
          await serverController.redisService.setInTripDrivers(this._id, this.id)
          this.userInfo.inTrip = true
          this.userInfo.travelType = travel.travelType
          callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: travel })
        } else {
          callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: "Uh oh! Could not create it" })
        }
      }
    } catch (error) {
      this.emit("exception", error.message)
      console.error(error)
    }
  }

  // #endregion
  // #region additional
  async acceptAddition (data, callback) {
    try {
      const { travelId, secondDestination, secondDestinationDistance, secondDestinationDuration, secondDestinationAddress, price, roundTrip, stoppageTime, passengerId } = data
      const travel = await serverController.utilService.axiosInstance({
        url: URLS.TRAVEL_URL,
        data: {
          travelId,
          updateFields: {
            stoppageTime,
            roundTrip,
            secondDestinationDistance,
            secondDestinationDuration,
            secondDestinationAddress,
            secondDestinationLat: secondDestination?.lat || undefined,
            secondDestinationLong: secondDestination?.long || undefined,
            fee: price,
          },
        },
        token: this.token,
        method: "put",
      })
      if (travel) {
        const passenger = await serverController.redisService.getPassenger(passengerId)
        callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: travel })
        this.to(passenger).emit("privateMessage", STATUS_CODES.PV_MSG_ADDITION_ACCEPTED, { result: travel })
      } else {
        callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: RESPONSE_STATUS.PROCESS_FAILED })
      }
    } catch (error) {
      this.emit("exception", error.message)
      console.error(error)
    }
  }

  async rejectAddition (data, callback) {
    try {
      const passenger = await serverController.redisService.getPassenger(data.passengerId)
      this.to(passenger).emit("privateMessage", STATUS_CODES.PV_MSG_DRIVER_REJECTED, { result: "Rejected" })
      callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: RESPONSE_STATUS.OK })
    } catch (error) {
      this.emit("exception", error.message)
      console.error(error)
    }
  }

  // #endregion
  // #region delivery
  async acceptDelivery (data, callback) {
    try {
      const foundedDelivery = await serverController.utilService.axiosInstance({ url: `${URLS.FIND_DELIVERY_BY_ID}${data.deliveryId}`, token: this.token })
      if (!foundedDelivery || foundedDelivery.status !== TRAVEL_STATUS.REQUESTED) {
        return callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: "Travel is already accepted or canceled" })
      } else {
        const [passenger, delivery] = await Promise.all([
          serverController.redisService.getPassenger(foundedDelivery.requesterId._id),
          serverController.utilService.axiosInstance({ url: URLS.ACCEPT_DELIVERY, data: { deliveryId: data.deliveryId, driverId: this._id }, token: this.token, method: "put" }),
          serverController.utilService.axiosInstance({ url: URLS.UPDATE_DRIVER_STATUS, data: { status: TRAVEL_STATUS.REACHING_TO_PASSENGER }, token: this.token, method: "put" }),
          serverController.redisService.setInTripDrivers(this._id, this.id),
        ])
        this.userInfo.inTrip = true
        let passengerInformation
        if (passenger) {
          this.to(passenger).emit("privateMessage", STATUS_CODES.PV_MSG_DRIVER_ACCEPTED, { result: { driverInformation: this.userInfo, foundedDelivery } })
          passengerInformation = clients.get(passenger)?.userInfo
        } else {
          passengerInformation = await serverController.utilService.axiosInstance({ url: URLS.USER_BY_ID, params: [`id=${foundedDelivery.requesterId._id}`], token: this.token })
        }
        callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { delivery, passengerInformation })
      }
    } catch (error) {
      await serverController.redisService.removeInTripDrivers(this._id)
      this.userInfo.inTrip = false
      this.emit("exception", error.message)
      console.error(error)
    }
  }

  async deliveryDriverArrived (data, callback) {
    try {
      const foundedDelivery = await serverController.utilService.axiosInstance({ url: `${URLS.FIND_DELIVERY_BY_ID}${data.deliveryId}`, token: this.token })
      if (!foundedDelivery) {
        return callback(STATUS_CODES.ERROR_PARAM, { result: RESPONSE_STATUS.PARAM_ERROR })
      } else {
        const [passenger] = await Promise.all([
          serverController.redisService.getPassenger(foundedDelivery.requesterId._id),
          serverController.utilService.axiosInstance({
            url: URLS.DELIVERY_URL,
            data: { deliveryId: foundedDelivery._id, updateFields: { status: TRAVEL_STATUS.ARRIVED, ARRIVED: true } },
            token: this.token,
            method: "put",
          }),
        ])
        serverController.utilService.axiosInstance({
          url: URLS.DELIVERY_UPDATE_LOG_URL,
          data: { deliveryId: foundedDelivery._id, ARRIVED: Date.now() },
          token: this.token,
          method: "put",
        })
        if (passenger) this.to(passenger).emit("privateMessage", STATUS_CODES.PV_MSG_DRIVER_ARRIVED)
        else this.emit("exception", "Passenger is not found")
        callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: RESPONSE_STATUS.OK })
      }
    } catch (error) {
      this.emit("exception", error.message)
      console.error(error)
    }
  }

  async boxAchieved (data, callback) {
    try {
      const foundedDelivery = await serverController.utilService.axiosInstance({ url: `${URLS.FIND_DELIVERY_BY_ID}${data.deliveryId}`, token: this.token })
      if (!foundedDelivery) {
        return callback(STATUS_CODES.ERROR_PARAM, { result: RESPONSE_STATUS.PARAM_ERROR })
      } else {
        const [passenger] = await Promise.all([
          serverController.redisService.getPassenger(foundedDelivery.requesterId._id),
          serverController.utilService.axiosInstance({
            url: URLS.DELIVERY_URL,
            data: { deliveryId: foundedDelivery._id, updateFields: { status: TRAVEL_STATUS.STARTED } },
            token: this.token,
            method: "put",
          }),
        ])
        serverController.utilService.axiosInstance({
          url: URLS.DELIVERY_UPDATE_LOG_URL,
          data: { deliveryId: foundedDelivery._id, STARTED: Date.now() },
          token: this.token,
          method: "put",
        })

        if (passenger) this.to(passenger).emit("privateMessage", STATUS_CODES.PV_MSG_TRAVEL_STARTED)
        else this.emit("exception", "Passenger is not found")
        callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: RESPONSE_STATUS.OK })
      }
    } catch (error) {
      this.emit("exception", error.message)
      console.error(error)
    }
  }

  async fristDestinationFinish (data, callback) {
    try {
      const foundedDelivery = await serverController.utilService.axiosInstance({ url: `${URLS.FIND_DELIVERY_BY_ID}${data.deliveryId}`, token: this.token })
      if (!foundedDelivery) {
        return callback(STATUS_CODES.ERROR_PARAM, { result: RESPONSE_STATUS.PARAM_ERROR })
      } else {
        const [passenger] = await Promise.all([serverController.redisService.getPassenger(foundedDelivery.requesterId._id)])
        if (passenger) this.to(passenger).emit("privateMessage", STATUS_CODES.PV_MSG_FRIST_DESTINATION_FINISH)
        else this.emit("exception", "Passenger is not found")
        callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: RESPONSE_STATUS.OK })
      }
    } catch (error) {
      this.emit("exception", error.message)
      console.error(error)
    }
  }

  async finishDelivery (data, callback) {
    try {
      const foundedDelivery = await serverController.utilService.axiosInstance({ url: `${URLS.FIND_DELIVERY_BY_ID}${data.deliveryId}`, token: this.token })
      if (!foundedDelivery) {
        return callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: "Travel not found" })
      } else {
        const [passenger, delivery] = await Promise.all([
          serverController.redisService.getPassenger(foundedDelivery.requesterId._id),
          serverController.utilService.axiosInstance({
            url: URLS.FINISH_DELIVERY,
            data: { deliveryId: data.deliveryId },
            token: this.token,
            method: "put",
          }),
        ])

        if (delivery) {
          let passengerInformation
          if (passenger) {
            this.to(passenger).emit("privateMessage", STATUS_CODES.PV_MSG_TRAVEL_FINISHED, { result: delivery })
            passengerInformation = clients.get(passenger).userInfo
          } else {
            passengerInformation = await serverController.utilService.axiosInstance({ url: URLS.USER_BY_ID, params: [`id=${foundedDelivery.requesterId._id}`], token: this.token })
          }
          await serverController.redisService.removeInTripDrivers(this._id)
          this.userInfo.inTrip = false
          callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: delivery, passengerInformation })
        } else {
          callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: "Sorry! Could not finish it" })
        }
      }
    } catch (error) {
      this.emit("exception", error.message)
      console.error(error)
    }
  }

  async cancelDeliveryDriver (data, callback) {
    try {
      const canceledDeliveryId = await serverController.utilService.axiosInstance({
        url: URLS.CANCEL_DELIVERY,
        data: { deliveryId: data.deliveryId },
        token: this.token,
        method: "put",
        type: USER_TYPES.DRIVER,
      })

      if (canceledDeliveryId) {
        await serverController.utilService.axiosInstance({
          url: URLS.UPDATE_PASSENGER_STATUS,
          data: { userId: this._id, status: USER_STATUS.NO_SERVICE },
          token: this.token,
          method: "put",
          type: USER_TYPES.PASSENGER,
        })
        serverController.utilService.axiosInstance({
          url: URLS.DELIVERY_UPDATE_LOG_URL,
          data: { deliveryId: data.deliveryId, DRIVER_CANCELED: Date.now() },
          token: this.token,
          method: "put",
        })
        return callback(STATUS_CODES.SUCCESSFUL_RESPONSE, { result: RESPONSE_STATUS.OK })
      } else {
        return callback(STATUS_CODES.ERROR_PROCESS_FAILED, { result: RESPONSE_STATUS.FAILED })
      }
    } catch (error) {
      this.emit("exception", error.message)
      console.error(error)
    }
  }

  // #endregion
}
module.exports = new serverController(DriverService, RedisService, PassengersService, UtilService)
