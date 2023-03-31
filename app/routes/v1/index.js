const serverController = require('../../Servers/server.controller')
const { validate } = require('../../middleware/')
const { EVENTS } = require('../../Values/constants')
const managerController = require('../../Manager/manager.controller')
const clientsController = require('../../Clients/client.controller')
const utilController = require('../../Utils/util.controller')
module.exports = (socket) => {
  /**
   * @DriversEvents
   */
  socket.on(EVENTS.SET_DRIVER, serverController.setDriver)
  socket.on(EVENTS.UNSET_DRIVER, serverController.unsetDriver)
  socket.on(EVENTS.UPDATE_DRIVER_LOCATION, serverController.updateDriverLocation)
  socket.on(EVENTS.ACCEPT_TRAVEL, serverController.acceptTravel)
  socket.on(EVENTS.ACCEPT_ADDITION, serverController.acceptAddition)
  socket.on(EVENTS.REJECT_ADDITION, serverController.rejectAddition)
  socket.on(EVENTS.DRIVER_ARRIVED, serverController.driverArrived)
  socket.on(EVENTS.PASSENGER_BOARDED, serverController.passengerBoarded)
  socket.on(EVENTS.CANCEL_TRAVEL_DRIVER, serverController.cancelTravelDriver)
  socket.on(EVENTS.FINISH_TRAVEL, serverController.finishTravel)
  socket.on(EVENTS.TAXI_METER_START, serverController.taximeterStart)

  /**
   * @ManagersEvents
   */

  socket.on(EVENTS.GET_DRIVER_LOCATION, managerController.getDriverLocation)
  socket.on(EVENTS.GET_MY_ONLINE_DRIVERS, managerController.getMyOnlineDrivers)
  socket.on(EVENTS.GET_MY_CLOSE_DRIVERS, managerController.getMyCloseDrivers)
  socket.on(EVENTS.GET_MY_AVAILABLE_DRIVERS, managerController.getMyAvailableDrivers)
  socket.on(EVENTS.GET_PASSENGERS, managerController.getPassengers)
  socket.on(EVENTS.REQUEST_MY_DRIVERS, managerController.requestMyDrivers)
  socket.on(EVENTS.GET_CLIENTS, managerController.getClients)

  /**
   * @PassengersEvents
   */
  socket.on(EVENTS.SET_PASSENGER, clientsController.setPassenger)

  socket.on(EVENTS.CREATE_TRAVEL, clientsController.createTravel)
  socket.on(EVENTS.RE_FIND_DRIVERS, clientsController.reFindDrivers)
  socket.on(EVENTS.RE_CREATE_TRAVEL, clientsController.reCreateTravel)
  socket.on(EVENTS.CHOOSE_AGENT, clientsController.chooseAgent)
  socket.on(EVENTS.CREATE_INSTANCE_TRAVEL, clientsController.createInstanceTravel)
  socket.on(EVENTS.CANCEL_TRAVEL_PASSENGER, clientsController.cancelTravelPassenger)
  socket.on(EVENTS.ADD_OPTIONS, clientsController.addOptions)
  socket.on(EVENTS.GET_CLOSE_DRIVERS, clientsController.getCloseDrivers)

  /**
   * @DeliveryEvents
   */

  //! driver
  socket.on(EVENTS.ACCEPT_DELIVERY, serverController.acceptDelivery)
  socket.on(EVENTS.CANCEL_DELIVERY_DRIVER, serverController.cancelDeliveryDriver)
  socket.on(EVENTS.DRIVER_ARRIVED_DELIVERY, serverController.deliveryDriverArrived)
  socket.on(EVENTS.BOX_ACHIEVEDY, serverController.boxAchieved)
  socket.on(EVENTS.FRIST_DESTINATION_FINISH, serverController.fristDestinationFinish)
  socket.on(EVENTS.FINISH_DELIVERY, serverController.finishDelivery)
  socket.on(EVENTS.CANCEL_DELIVERY_DRIVER, serverController.cancelDeliveryDriver)

  //! passenger
  socket.on(EVENTS.CREATE_DELIVERY, clientsController.createDelivery)
  socket.on(EVENTS.CHOOSE_AGENT_FOR_DELIVERY, clientsController.chooseAgentForDelivery)
  socket.on(EVENTS.CANCEL_DELIVERY_PASSENGER, clientsController.cancelDeliveryPassenger)
  socket.on(EVENTS.RE_FIND_DRIVERS_DELIVERY, clientsController.reFindDriversDelvery)

  /**
   * @ValidationAndErrorHandling
   */
  socket.use(validate)
  socket.on(EVENTS.DISCONNECT, utilController.disconnect)
  socket.on(EVENTS.ERROR, async (error) => {
    console.error(error.message)
    socket.emit('exception', error.message)
  })
}
