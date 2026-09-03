<<<<<<< HEAD
/**
 * AI Route service.
 *
 * Calculates a route risk level from weather data.
 * NOTE: This is a dummy/mock implementation for now — it will be
 * replaced by a real AI/ML scoring model in a later step.
 */

/**
 * Calculate a (mock) route risk level from weather data.
 *
 * @async
 * @param {Object} [weatherData] - Weather data, e.g. from
 *   `weather.service.getWeatherData()`.
 * @param {number} [weatherData.windspeed=0] - Wind speed in km/h.
 * @param {number} [weatherData.rain=0] - Rain amount in mm.
 * @returns {Promise<'high'|'low'>} The route risk level.
 */
const calculateRouteRisk = async (weatherData = {}) => {
  const windspeed = weatherData.windspeed ?? 0;
  const rain = weatherData.rain ?? 0;

  if (windspeed > 30 || rain > 50) {
    return 'high';
  }

  return 'low';
};

module.exports = { calculateRouteRisk };
=======
   // 
>>>>>>> origin/main
