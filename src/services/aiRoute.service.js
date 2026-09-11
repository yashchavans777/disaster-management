const axios = require('axios');

const IncidentReport = require('../models/IncidentReport');
const { isWithinRadius } = require('../utils/geoHelpers');
const logger = require('../utils/logger');

const AI_SERVICE_BASE_URL =
  process.env.AI_SERVICE_URL || 'http://localhost:8000';

// ─────────────────────────────────────────────
// Risk helpers
// ─────────────────────────────────────────────

const normalizeRiskLevel = (riskLevel) => {
  const normalizedRisk = String(riskLevel || '').toLowerCase();

  return ['high', 'moderate', 'low'].includes(normalizedRisk)
    ? normalizedRisk
    : 'low';
};

const fallbackRiskCalculation = ({
  precipitation = 0,
  wind_speed = 0,
}) => {
  if (wind_speed > 30 || precipitation > 50) {
    return 'high';
  }

  if (wind_speed > 20 || precipitation > 20) {
    return 'moderate';
  }

  return 'low';
};

// ─────────────────────────────────────────────
// Historical incidents
// ─────────────────────────────────────────────

const getHistoricalBiasScore = async (lat, lng) => {
  try {
    if (lat == null || lng == null) {
      return 0;
    }

    const cutoff = new Date(
      Date.now() - 48 * 60 * 60 * 1000
    );

    const recentIncidents = await IncidentReport.find({
      createdAt: { $gte: cutoff },
      status: { $in: ['active', 'reported', 'verified'] },
    })
      .select('location severity')
      .lean();

    const nearby = recentIncidents.filter((incident) => {
      const incidentLat = incident.location?.lat;
      const incidentLng = incident.location?.lng;

      if (incidentLat == null || incidentLng == null) {
        return false;
      }

      return isWithinRadius(
        [lat, lng],
        [incidentLat, incidentLng],
        50
      );
    });

    const severityWeights = {
      low: 0.1,
      medium: 0.3,
      high: 0.6,
      critical: 1.0,
    };

    const weightedSum = nearby.reduce(
      (acc, incident) =>
        acc + (severityWeights[incident.severity] || 0.3),
      0
    );

    return Math.min(weightedSum / 5, 1);
  } catch (error) {
    logger.warn(
      `Historical bias lookup failed: ${error.message}`
    );

    return 0;
  }
};

// ─────────────────────────────────────────────
// Local weighted risk model
// ─────────────────────────────────────────────

const WEIGHTS = {
  windspeed: 0.031,
  precipitation: 0.018,
  weathercode: 0.008,
  temperature: -0.004,
  relativeHumidity: 0.005,
  historicalBias: 0.25,
};

const BIAS = -2.1;

const sigmoid = (x) => {
  return 1 / (1 + Math.exp(-x));
};

const normalise = {
  windspeed: (v) => Math.min(Math.max(Number(v) || 0, 0) / 80, 1),

  precipitation: (v) =>
    Math.min(Math.max(Number(v) || 0, 0) / 200, 1),

  weathercode: (v) =>
    Math.min(Math.max(Number(v) || 0, 0) / 100, 1),

  temperature: (v) =>
    Math.min(Math.max(Number(v) || 0, 0) / 50, 1),

  relativeHumidity: (v) =>
    Math.min(Math.max(Number(v) || 0, 0) / 100, 1),
};

const calculateRawRiskScore = async (
  weatherData = {},
  lat = null,
  lng = null
) => {
  const windspeed = normalise.windspeed(
    weatherData.windspeed ??
      weatherData.wind_speed_10m ??
      weatherData.wind_speed ??
      0
  );

  const precipitation = normalise.precipitation(
    weatherData.rain ??
      weatherData.precipitation ??
      0
  );

  const weathercode = normalise.weathercode(
    weatherData.weathercode ??
      weatherData.weather_code ??
      0
  );

  const temperature = normalise.temperature(
    weatherData.temperature ??
      weatherData.temperature_2m ??
      25
  );

  const relativeHumidity = normalise.relativeHumidity(
    weatherData.relativehumidity_2m ??
      weatherData.relative_humidity ??
      60
  );

  const historicalBias =
    await getHistoricalBiasScore(lat, lng);

  const z =
    BIAS +
    WEIGHTS.windspeed * windspeed +
    WEIGHTS.precipitation * precipitation +
    WEIGHTS.weathercode * weathercode +
    WEIGHTS.temperature * temperature +
    WEIGHTS.relativeHumidity * relativeHumidity +
    WEIGHTS.historicalBias * historicalBias;

  return Number(sigmoid(z).toFixed(4));
};

// ─────────────────────────────────────────────
// Python AI service
// ─────────────────────────────────────────────

const calculateRouteRisk = async (weatherData = {}) => {
  const precipitation = Number(
    weatherData.precipitation ??
      weatherData.rain ??
      0
  );

  const windSpeed = Number(
    weatherData.wind_speed ??
      weatherData.windspeed ??
      0
  );

  const payload = {
    precipitation: Number.isFinite(precipitation)
      ? precipitation
      : 0,

    wind_speed: Number.isFinite(windSpeed)
      ? windSpeed
      : 0,
  };

  try {
    const response = await axios.post(
      `${AI_SERVICE_BASE_URL}/route-risk`,
      payload,
      {
        timeout: 10000,
      }
    );

    return normalizeRiskLevel(
      response.data?.riskLevel ??
        response.data?.risk_level
    );
  } catch (error) {
    logger.warn(
      `Python AI route risk service failed: ${error.message}`
    );

    return fallbackRiskCalculation(payload);
  }
};

module.exports = {
  calculateRouteRisk,
  calculateRawRiskScore,
  getHistoricalBiasScore,
};