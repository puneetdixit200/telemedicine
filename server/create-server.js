const http = require('http');
const { initSocket } = require('../services/realtime.service');
const { createApp } = require('./create-app');

function createServer() {
  const app = createApp();
  const server = http.createServer(app);
  const io = initSocket(server);
  return { app, server, io };
}

module.exports = { createServer };
