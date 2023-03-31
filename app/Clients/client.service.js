const UtilService = require('../Utils/util.service')
class PassengerService {
  constructor (utilService) {
    PassengerService.utilService = utilService
  }
}
module.exports = new PassengerService(
  UtilService
)
