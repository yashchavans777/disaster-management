/**
 * Application bootstrap.
 * Initialises Express, Socket.io, CORS, MongoDB, and all API routes.
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const { connectDB } = require('./config/db');
const logger = require('./utils/logger');

const shipmentRoutes = require('./routes/shipment.routes');
const routeRoutes = require('./routes/route.routes');
const incidentRoutes = require('./routes/incident.routes');
const notificationRoutes = require('./routes/notification.routes');
const trackingRoutes = require('./routes/tracking.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const aiRoutes = require('./routes/ai.routes');
const authRoutes = require('./routes/auth.routes');
const translateRoutes = require('./routes/translate.routes');

const { startWeatherCron } = require('./jobs/weatherCron');
const { startSyncWorker } = require('./jobs/syncWorker');

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  process.env.FRONTEND_URL,
].filter(Boolean);

const isLocalhostOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

const corsOptions = {
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1 && !isLocalhostOrigin(origin)) {
      var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// ── Express + HTTP + Socket.io ────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions });

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Expose io instance for controllers (agentic incident loop) ────────────────
app.set('io', io);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/translate', translateRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SmartLogistics NER Node.js backend',
    ts: new Date().toISOString(),
  });
});

// ── Socket.io — vehicle tracking ──────────────────────────────────────────────
io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  socket.on('location_update', (locationUpdate) => {
    io.emit('vehicle_moved', {
      ...locationUpdate,
      updatedAt: locationUpdate?.updatedAt || new Date().toISOString(),
    });
  });

  socket.on('disconnect', () => {
    logger.debug(`Socket disconnected: ${socket.id}`);
  });
});

// ── Background jobs ────────────────────────────────────────────────────────────
startWeatherCron();
startSyncWorker();

// ── Connect to MongoDB ────────────────────────────────────────────────────────
connectDB();

module.exports = { app, server, io };
