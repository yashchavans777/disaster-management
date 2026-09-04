const weatherService = require('../services/weather.service');
const aiRouteService = require('../services/aiRoute.service');
const apiResponse = require('../utils/apiResponse');

const evaluateRouteRisk = async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (lat === undefined || lng === undefined) {
      return apiResponse.error(res, 400, 'Latitude and longitude are required');
    }

    const weatherData = await weatherService.getWeatherData(lat, lng);
    const riskLevel = await aiRouteService.calculateRouteRisk(weatherData);

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
