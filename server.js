const { server } = require('./src/app');

const PORT = process.env.PORT || 5055;

server.listen(PORT, () => {
  console.log(`Node.js backend running on port ${PORT}`);
});