/**
 * AI Route service.
 *
 * Calculates a route risk level from weather data.
 * NOTE: This is a dummy/mock implementation for now.
 */

/**
 * Calculate a route risk level from weather data.
 *
 * @async
 * @param {Object} [weatherData={}] weather payload from weather service.
 * @returns {Promise<'high'|'moderate'|'low'>}
 */
const calculateRouteRisk = async (weatherData = {}) => {
  const windspeed = weatherData.windspeed ?? 0;
  const rain = weatherData.rain ?? 0;

  if (windspeed > 30 || rain > 50) {
    return 'high';
  }

  if (windspeed > 20 || rain > 20) {
    return 'moderate';
  }

  return 'low';
};

module.exports = { calculateRouteRisk };