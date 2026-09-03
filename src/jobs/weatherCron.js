const cron = require('node-cron');

const Route = require('../models/Route');
const Shipment = require('../models/Shipment');
const Notification = require('../models/Notification');
const weatherService = require('../services/weather.service');
const aiRouteService = require('../services/aiRoute.service');

const WEATHER_CRON_EXPRESSION = '*/30 * * * *';

const buildHighRiskMessage = (shipment) => {
  const origin = shipment?.origin || 'source';
  const destination = shipment?.destination || 'destination';

  return `High weather risk detected for your route from ${origin} to ${destination}. Please review the trip immediately.`;
};

const processRouteWeatherRisk = async () => {
  const activeRoutes = await Route.find({ isBlocked: false })
    .populate({
      path: 'shipmentId',
      select: 'origin destination assignedDriver status',
    });

  for (const route of activeRoutes) {
    if (!route.shipmentId || route.shipmentId.status === 'delivered') {
      // eslint-disable-next-line no-continue
      continue;
    }

    const shipment = route.shipmentId instanceof Shipment ? route.shipmentId : route.shipmentId;
    const assignedDriver = shipment?.assignedDriver;
    const [firstWaypoint] = route.waypoints || [];

    if (!assignedDriver || !firstWaypoint) {
      // eslint-disable-next-line no-continue
      continue;
    }

    const weatherData = await weatherService.getWeatherData(firstWaypoint.lat, firstWaypoint.lng);
    const riskLevel = await aiRouteService.calculateRouteRisk(weatherData);

    if (route.riskLevel !== riskLevel) {
      route.riskLevel = riskLevel;
      await route.save();
    }

    if (riskLevel === 'high') {
      await Notification.create({
        userId: assignedDriver,
        message: buildHighRiskMessage(shipment),
        type: 'alert',
      });
    }
  }
};

const startWeatherCron = () => {
  return cron.schedule(WEATHER_CRON_EXPRESSION, async () => {
    try {
      await processRouteWeatherRisk();
    } catch (error) {
      console.error('Weather cron job failed:', error.message);
    }
  });
};

module.exports = {
  startWeatherCron,
  processRouteWeatherRisk,
};