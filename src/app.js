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

const { startWeatherCron } = require('./jobs/weatherCron');
const { startSyncWorker } = require('./jobs/syncWorker');

// ── CORS ─────────────────────────────────────────────────────────────────────
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
