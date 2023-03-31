require('dotenv').config()
module.exports = {
  env: process.env.NODE_ENV,
  port: process.env.PORT,
  scheme: process.env.SCHEME,
  radius: process.env.RADIUS_COVERAGE,
  baseUrl: process.env.API_BASE_URL,
  financialPort: process.env.FINANCIAL_PORT,
  usersPort: process.env.USERS_PORT,
  travelPort: process.env.TRAVEL_PORT,
  deliveryPort: process.env.DELIVERY_PORT,
  apiVersion: process.env.API_VERSION
}
