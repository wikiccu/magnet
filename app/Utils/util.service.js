const RedisService = require('../Redis/redis.service')
const axios = require('axios').default
const amqplib = require('amqplib')
axios.defaults.timeout = 8000
const { NESHAN_API_KEY, GOOGLE_API_KEY, URLS, USER_TYPES } = require('../Values/constants')
class UtilService {
  constructor (redisService) {
    UtilService.redisService = redisService
  }

  axiosInstance = async ({ url = URLS.GET_USER_PROFILE, data = {}, token, method = 'get', type = USER_TYPES.DRIVER, params }) => {
    try {
      const result = await axios({
        method,
        headers: { Authorization: `Bearer ${token}`, type },
        url: params ? url + '?' + params.join('&') : url,
        data
      })
      return result.data.result
    } catch (error) {
      if (error.response) {
        console.error({
          responseError: error.response.data,
          url,
          type,
          data: error.response.config.data,
          token
        })
        return false
      } else if (error.request) {
        console.error({ type, url, axiosRequestError: error.request })
        return Promise.reject(error.request)
      } else {
        console.log({ type, url })
      }
      console.error({ type, url, error })
      return false
    }
  }

  persianDate = async () => {
    const date = new Date()
    const toEnDigit = (n) => n.replace(/[٠-٩۰-۹]/g, (n) => 15 & n.charCodeAt(0))
    return `${toEnDigit(date.toLocaleDateString('fa'))}-${date.getHours()}:${date.getMinutes()}:${date.getSeconds()} `
  }

  calculateDistanceAndDuration = async (origin, destination) => {
    try {
      const config = {
        method: 'get',
        url: `https://api.neshan.org/v1/distance-matrix?origins=${origin.lat},${origin.long}&destinations=${destination.lat},${destination.long}`,
        headers: { 'api-key': NESHAN_API_KEY },
        json: true
      }
      const { data } = await axios(config)
      return {
        duration: Math.round(data.rows[0].elements[0].duration.value) || 1,
        distance: Math.round(data.rows[0].elements[0].distance.value) || 1
      }
    } catch (error) {
      if (error.response) {
        if (error.response.status === 470) {
          const res = await client.distancematrix({
            params: {
              destinations: [{ lat: destination.lat, lng: destination.long }],
              origins: [{ lat: origin.lat, lng: origin.long }],
              key: GOOGLE_API_KEY
            }
          })
          return {
            duration: Math.round(res.data.rows[0].elements[0].duration.value) || 1,
            distance: Math.round(res.data.rows[0].elements[0].distance.value) || 1
          }
        }
        console.error({
          axiosError: error.response.data,
          errorCode: error.response.status,
          headers: error.response.config.headers,
          data: error.response.config.data
        })
        return false
      } else if (error.request) {
        console.error({ axiosRequestError: error.request })
      } else {
        console.error({ error })
      }
      return false
    }
  }

  reverseGeoCoding = async ({ lat, long }) => {
    try {
      const { data } = await axios({
        method: 'get',
        url: `https://api.neshan.org/v5/reverse?lat=${lat}&lng=${long}`,
        headers: { 'api-key': NESHAN_API_KEY },
        json: true
      })
      return {
        address: data.formatted_address,
        city: data.county ? String(data.county).split(' ')[1] : null
      }
    } catch (error) {
      if (error.response) {
        if (error.response.status === 470) {
          const res = await client.reverseGeocode({
            params: {
              latlng: { lat, lng: long },
              key: GOOGLE_API_KEY
            }
          })
          let city; const components = res.data.results[0].address_components
          for (const i in components) {
            if (components[i].types.includes('locality')) {
              city = components[i].short_name || ''
            }
          }
          return {
            address: res.data.results[0].formatted_address,
            city
          }
        }
        console.error({
          axiosError: error.response.data,
          errorCode: error.response.status,
          headers: error.response.config.headers,
          data: error.response.config.data
        })
        return false
      } else if (error.request) {
        console.error({ axiosRequestError: error.request })
      } else {
        console.error({ error })
      }
      return false
    }
  }

  sendToLog = async (data) => {
    const connection = await amqplib.connect('amqp://localhost')
    const channel = await connection.createChannel()
    channel.sendToQueue('tasks', Buffer.from(JSON.stringify(data)))
  }
}
module.exports = new UtilService(RedisService)
