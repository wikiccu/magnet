const UtilService = require('../Utils/util.service')
class ManagerService {
  constructor (utilService) {
    ManagerService.utilService = utilService
  }
}
module.exports = new ManagerService(
  UtilService
)
