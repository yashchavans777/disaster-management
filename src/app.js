const express = require('express');

const shipmentRoutes = require('./routes/shipment.routes');
const routeRoutes = require('./routes/route.routes');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/shipments', shipmentRoutes);
app.use('/api/routes', routeRoutes);

module.exports = app;
