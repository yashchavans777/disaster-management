const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const shipmentRoutes = require('./routes/shipment.routes');
const routeRoutes = require('./routes/route.routes');
const incidentRoutes = require('./routes/incident.routes');
const notificationRoutes = require('./routes/notification.routes');
const { startWeatherCron } = require('./jobs/weatherCron');
const { startSyncWorker } = require('./jobs/syncWorker');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/shipments', shipmentRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/notifications', notificationRoutes);

startWeatherCron();
startSyncWorker();

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('location_update', (locationUpdate) => {
    io.emit('vehicle_moved', {
      ...locationUpdate,
      updatedAt: locationUpdate?.updatedAt || new Date().toISOString(),
    });
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

module.exports = {
  app,
  server,
  io,
};
