const UtilService = require('../Utils/util.service')
class DriverService {
  constructor (utilService) {
    DriverService.utilService = utilService
  }
}
module.exports = new DriverService(
  UtilService
)
