require('dotenv').config();

const { createApp } = require('./server/create-app');
const { createServer } = require('./server/create-server');

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const { server } = createServer();
  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${port}`);
  });
}

module.exports = { createApp, createServer };
