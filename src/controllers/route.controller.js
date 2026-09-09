const weatherService = require('../services/weather.service');
const aiRouteService = require('../services/aiRoute.service');
const { sendEarlyWarningAlert } = require('../services/notificationService');
const apiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

const evaluateRouteRisk = async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (lat === undefined || lng === undefined) {
      return apiResponse.error(res, 400, 'Latitude and longitude are required');
    }

    const weatherData = await weatherService.getWeatherData(lat, lng);
    const riskLevel = await aiRouteService.calculateRouteRisk(weatherData, lat, lng);

    // Asynchronously trigger early warning if risk level is HIGH
    if (String(riskLevel).toUpperCase() === 'HIGH') {
      const locStr = `Sector Coordinates [${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}]`;
      const hazardDesc = 'Elevated terrain and corridor risk evaluated by Route Intelligence';

      setImmediate(() => {
        sendEarlyWarningAlert(
          locStr,
          'HIGH',
          hazardDesc,
          req.body.adminPhone || process.env.ADMIN_PHONE,
          req.body.adminEmail || process.env.ADMIN_EMAIL
        ).catch((err) => {
          logger.error(`[Early Warning Error] ${err.message}`);
        });
      });
    }

    return apiResponse.success(res, 200, 'Route risk evaluated successfully', {
      riskLevel,
    });
  } catch (error) {
    return apiResponse.error(
      res,
      500,
      'Failed to evaluate route risk',
      error.message
    );
  }
};

module.exports = {
  evaluateRouteRisk,
};
