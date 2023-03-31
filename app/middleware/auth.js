const { axiosInstance } = require("../Utils/util.service")
const { USER_TYPES } = require("../Values/constants")
exports.auth = async (socket, next) => {
  try {
    const { token } = socket.handshake.auth
    const type = socket.handshake?.headers?.type || socket.handshake?.auth?.type
    if (token && type) {
      const result = await axiosInstance({ token, type })
      if (result) {
        if (type === USER_TYPES.DRIVER) {
          socket.token = token
          socket.userInfo = {
            _id: result._id,
            plateNumber: result.driverInformation.plateNumber,
            avatar: result.avatar,
            approved: result.driverInformation.approved,
            carBrand: result.driverInformation.carBrand,
            carModel: result.driverInformation.carModel,
            nationalCode: result.driverInformation.nationalCode,
            carSystem: result.driverInformation.carSystem,
            carColor: result.driverInformation.carColor,
            agentId: result.driverInformation.agentId._id,
            agentAverageRate: result.driverInformation.agentId.agentInformation.averageRate,
            driverAverageRate: result.driverInformation.averageRate,
            agentName: result.driverInformation.agentName,
            agentType: result.driverInformation.type,
            superAgentId: result.driverInformation.superAgentId,
            travelGroup: result.driverInformation.travelGroup,
            phoneNumber: result.phoneNumber,
            firstName: result.firstName,
            lastName: result.lastName,
            travelType: "NOTHING",
            inTrip: false,
            driverApp: result.driverInformation?.driverApp ? result.driverInformation.driverApp : false,
          }
          socket._id = result._id
          socket.type = type
        } else {
          socket.token = token
          socket.userInfo = {
            id: result._id,
            phoneNumber: result.phoneNumber,
            firstName: result.firstName,
            lastName: result.lastName,
          }
          socket._id = result._id
          socket.type = type
        }
        next()
      } else {
        next(new Error("Invalid Token or Token Expired"))
      }
    } else {
      next(new Error("Token or type not found"))
    }
  } catch (error) {
    next(new Error("Authentication error"))
  }
}
