const { EVENTS } = require('../../app/Values/constants')
exports.validate = async ([event, ...args], next) => {
  if (event === EVENTS.SET_DRIVER || event === EVENTS.GET_MY_CLOSE_DRIVERS) {
    const { lat, long } = args[0]
    if (lat < -90 || lat > 90 || long < -180 || long > 180 || isNaN(lat) || isNaN(long)) {
      return next(new Error('Invalid location'))
    }
  } else if (event === EVENTS.UPDATE_DRIVER_LOCATION) {
    const { lat, long, nav } = args[0]
    if (lat < -90 || lat > 90 || long < -180 || long > 180 || isNaN(lat) || isNaN(long) || isNaN(nav) || nav < 0) {
      return next(new Error('Invalid location or navigation'))
    }
  } else if (event === EVENTS.CREATE_INSTANCE_TRAVEL) {
    const { origin } = args[0]
    if (!origin || origin.lat < -90 || origin.lat > 90 || origin.long < -180 || origin.long > 180 || isNaN(origin.lat) || isNaN(origin.long)) {
      return next(new Error('Invalid location'))
    }
  } else if (event === EVENTS.CHOOSE_AGENT) {
    const { target } = args[0]
    if (target !== 'ALL') {
      if (!target || !(String(target).match(/^[0-9a-fA-F]{24}$/))) {
        return next(new Error('Invalid target'))
      }
    }
  } else if (event === EVENTS.TAXI_METER_START) {
    const { origin, firstName, lastName, phoneNumber } = args[0]
    if (!origin || origin.lat < -90 || origin.lat > 90 || origin.long < -180 || origin.long > 180 || isNaN(origin.lat) || isNaN(origin.long)) {
      return next(new Error('Invalid location'))
    }
    if (!firstName || !lastName || !phoneNumber) {
      return next(new Error('Invalid name or phone number'))
    }
    if (firstName.length > 55 || lastName.length > 55 || phoneNumber.length > 55) {
      return next(new Error('Invalid name or phone number'))
    }
    if (!(String(firstName).match(/^[^-\s][a-zA-Z آ-ی]+$/g)) || !(String(lastName).match(/^[^-\s][a-zA-Z آ-ی]+$/g)) || !(String(phoneNumber).match(/^[0-9]+$/))) {
      return next(new Error('Invalid name or phone number'))
    }
  } else if (event === EVENTS.CREATE_TRAVEL) {
    const { origin, destination, secondDestination, options, stoppageTime } = args[0]
    if (!origin || origin.lat < -90 || origin.lat > 90 || origin.long < -180 || origin.long > 180 || isNaN(origin.lat) || isNaN(origin.long)) {
      return next(new Error('Invalid origin location'))
    }
    if (origin && destination) {
      if (origin.lat === origin.long || destination.lat === destination.long) {
        return next(new Error('Invalid coordinates'))
      }
    }
    if (!destination || destination.lat < -90 || destination.lat > 90 || destination.long < -180 || destination.long > 180 || isNaN(destination.lat) || isNaN(destination.long)) {
      return next(new Error('Invalid destination location'))
    }
    if (options) {
      if (options.second && !secondDestination) return next(new Error('Invalid second destination location'))
      if (options.stop) {
        if (isNaN(stoppageTime) || stoppageTime < 1) { return next(new Error('Invalid stoppage time')) }
      }
      if (options.second && secondDestination) {
        if (secondDestination.lat < -90 || secondDestination.lat > 90 || secondDestination.long < -180 || secondDestination.long > 180 || isNaN(secondDestination.lat) || isNaN(secondDestination.long)) {
          return next(new Error('Invalid second destination location'))
        }
      }
    }
  } else if (event === EVENTS.ACCEPT_TRAVEL) {
    const { travelId } = args[0]
    if (!travelId || !(String(travelId).match(/^[0-9a-fA-F]{24}$/))) {
      return next(new Error('Invalid travelId'))
    }
  } else if (event === EVENTS.FINISH_TRAVEL) {
    const { destination } = args[0]
    if (destination) {
      if (destination.lat < -90 || destination.lat > 90 || destination.long < -180 || destination.long > 180 || isNaN(destination.lat) || isNaN(destination.long)) {
        return next(new Error('Invalid destination location'))
      }
    }
  } else if (event === EVENTS.ADD_OPTIONS) {
    const { destination, secondDestination, stoppageTime, options } = args[0]
    if (destination) {
      if (destination.lat < -90 || destination.lat > 90 || destination.long < -180 || destination.long > 180 || isNaN(destination.lat) || isNaN(destination.long)) {
        return next(new Error('Invalid destination location'))
      }
    }
    if (options) {
      if (options.second && !secondDestination) return next(new Error('Invalid second destination location'))
      if (options.stop) {
        if (isNaN(stoppageTime) || stoppageTime < 1) { return next(new Error('Invalid stoppage time')) }
      }
      if (options.second && secondDestination) {
        if (secondDestination.lat < -90 || secondDestination.lat > 90 || secondDestination.long < -180 || secondDestination.long > 180 || isNaN(secondDestination.lat) || isNaN(secondDestination.long)) {
          return next(new Error('Invalid second destination location'))
        }
      }
    }
  } else if (event === EVENTS.GET_CLOSE_DRIVERS) {
    const { driverId, lat, long } = args[0]
    if (driverId) {
      if (!(String(driverId).match(/^[0-9a-fA-F]{24}$/))) { return next(new Error('Invalid driverId')) }
    } else {
      if (lat < -90 || lat > 90 || long < -180 || long > 180 || isNaN(lat) || isNaN(long)) { return next(new Error('Invalid coordinates')) }
    }
  } else if (event === EVENTS.REQUEST_MY_DRIVERS) {
    const { origin, destination, secondDestination, options, stoppageTime, firstName, lastName, phoneNumber } = args[0]
    if (!origin || origin.lat < -90 || origin.lat > 90 || origin.long < -180 || origin.long > 180 || isNaN(origin.lat) || isNaN(origin.long)) {
      return next(new Error('Invalid origin location'))
    }
    if (!destination || destination.lat < -90 || destination.lat > 90 || destination.long < -180 || destination.long > 180 || isNaN(destination.lat) || isNaN(destination.long)) {
      return next(new Error('Invalid destination location'))
    }
    if (options) {
      if (options.second && !secondDestination) return next(new Error('Invalid second destination location'))
      if (options.stop) {
        if (isNaN(stoppageTime) || stoppageTime < 1) { return next(new Error('Invalid stoppage time')) }
      }
      if (options.second && secondDestination) {
        if (secondDestination.lat < -90 || secondDestination.lat > 90 || secondDestination.long < -180 || secondDestination.long > 180 || isNaN(secondDestination.lat) || isNaN(secondDestination.long)) {
          return next(new Error('Invalid second destination location'))
        }
      }
    }
    if (!firstName || !lastName || !phoneNumber) {
      return next(new Error('Invalid name or phone number'))
    }
    if (firstName.length > 55 || lastName.length > 55 || phoneNumber.length > 55) {
      return next(new Error('Invalid name or phone number'))
    }
    if (!(String(firstName).match(/^[^-\s][a-zA-Z آ-ی]+$/g)) || !(String(lastName).match(/^[^-\s][a-zA-Z آ-ی]+$/g)) || !(String(phoneNumber).match(/^[0-9]+$/))) {
      return next(new Error('Invalid name or phone number'))
    }
  }
  // console.log({ event, data: args[0] })
  next()
}
