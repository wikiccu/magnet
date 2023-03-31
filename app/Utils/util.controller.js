const UtilService = require('./util.service')
const RedisService = require('../Redis/redis.service')
const DriverService = require('../Servers/server.service')
const { USER_TYPES } = require('../Values/constants')
class UtilController {
  constructor (utilService, redisService, driverService) {
    UtilController.utilService = utilService
    UtilController.redisService = redisService
    UtilController.driverService = driverService
  }

  async disconnect (reason) {
    try {
      console.log(`|${this.userInfo.phoneNumber}|DISCONNECTED:${reason}`)
      let agentId, superAgentId
      if (this.type === USER_TYPES.DRIVER) {
        agentId = this.userInfo?.agentId
        superAgentId = this.userInfo?.superAgentId
      }
      await UtilController.redisService.unsetUser(agentId, superAgentId, this._id)
    } catch (error) {
      this.emit('exception', error.message)
      console.error(error)
    }
  }
}
module.exports = new UtilController(UtilService, RedisService, DriverService)
