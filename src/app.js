const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const shipmentRoutes = require('./routes/shipment.routes');
const routeRoutes = require('./routes/route.routes');
const incidentRoutes = require('./routes/incident.routes');
const notificationRoutes = require('./routes/notification.routes');
const { startWeatherCron } = require('./jobs/weatherCron');
const { startSyncWorker } = require('./jobs/syncWorker');

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions,
});

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/shipments', shipmentRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/notifications', notificationRoutes);

startWeatherCron();
startSyncWorker();

io.on('connection', (socket) => {
  socket.on('location_update', (locationUpdate) => {
    io.emit('vehicle_moved', {
      ...locationUpdate,
      updatedAt: locationUpdate?.updatedAt || new Date().toISOString(),
    });
  });
});

module.exports = {
  app,
  server,
  io,
};
