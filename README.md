# Magnet Realtime App

## Introduction

Magnet is a real-time application for receiving client requests and sending them to multiple servers. This app is built using Node.js and Socket.io for real-time communication.

## Requirements

- Node.js (version 10 or above)

## Installation

1. Clone the repository
2. Install the dependencies using `npm install`
3. Create a `.env` file and update the values for the following environment variables:
   - `PORT`: the port number for the server
   - `REDIS_HOST`: the hostname for the Redis server
   - `REDIS_PORT`: the port number for the Redis server
   - `RABBITMQ_URL`: the URL for the RabbitMQ server
4. Start the server using `npm start`

## Usage

Once the server is running, clients can connect to the server using the Socket.io client library. Clients can send requests to the server and the server will forward the requests to the appropriate servers based on the request parameters.

## Dependencies

This project uses the following dependencies:

- [amqplib](https://www.npmjs.com/package/amqplib) - a client library for RabbitMQ
- [axios](https://www.npmjs.com/package/axios) - a promise-based HTTP client
- [cors](https://www.npmjs.com/package/cors) - a middleware for handling Cross-Origin Resource Sharing (CORS)
- [dotenv](https://www.npmjs.com/package/dotenv) - a zero-dependency module for loading environment variables
- [redis](https://www.npmjs.com/package/redis) - a client library for Redis
- [socket.io](https://www.npmjs.com/package/socket.io) - a real-time engine for Node.js

## License

This project is licensed under the ISC License - see the [LICENSE.md](LICENSE.md) file for details.
