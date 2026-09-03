const axios = require('axios');

const AI_SERVICE_BASE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const normalizeRiskLevel = (riskLevel) => {
  const normalizedRisk = String(riskLevel || '').toLowerCase();
  return ['high', 'moderate', 'low'].includes(normalizedRisk) ? normalizedRisk : 'low';
};

const fallbackRiskCalculation = ({ precipitation = 0, wind_speed = 0 }) => {
  if (wind_speed > 30 || precipitation > 50) {
    return 'high';
  }

  if (wind_speed > 20 || precipitation > 20) {
    return 'moderate';
  }

  return 'low';
};

/**
 * Calculate route risk by sending real weather values to the Python AI service.
 *
 * @async
 * @param {{ precipitation?: number, rain?: number, wind_speed?: number, windspeed?: number }} [weatherData={}]
 * @returns {Promise<'high'|'moderate'|'low'>}
 */
const calculateRouteRisk = async (weatherData = {}) => {
  const precipitation = Number(weatherData.precipitation ?? weatherData.rain ?? 0);
  const windSpeed = Number(weatherData.wind_speed ?? weatherData.windspeed ?? 0);

  const payload = {
    precipitation: Number.isFinite(precipitation) ? precipitation : 0,
    wind_speed: Number.isFinite(windSpeed) ? windSpeed : 0,
  };

  try {
    const response = await axios.post(`${AI_SERVICE_BASE_URL}/route-risk`, payload, {
      timeout: 10000,
    });

    return normalizeRiskLevel(response.data?.riskLevel || response.data?.risk_level);
  } catch (error) {
    console.error('Python AI route risk service failed, using fallback calculation:', error.message);
    return fallbackRiskCalculation(payload);
  }
};

module.exports = { calculateRouteRisk };