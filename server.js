require('dotenv').config();

const { server } = require('./src/app');

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Node.js backend running on port ${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the existing process or set a different PORT.`);
    process.exit(1);
  }

  console.error('Failed to start backend server:', error);
  process.exit(1);
});