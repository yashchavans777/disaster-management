const express = require('express');

const shipmentRoutes = require('./routes/shipment.routes');
const routeRoutes = require('./routes/route.routes');
const incidentRoutes = require('./routes/incident.routes');
const notificationRoutes = require('./routes/notification.routes');
const { startWeatherCron } = require('./jobs/weatherCron');
const { startSyncWorker } = require('./jobs/syncWorker');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/shipments', shipmentRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/notifications', notificationRoutes);

startWeatherCron();
startSyncWorker();

module.exports = app;
