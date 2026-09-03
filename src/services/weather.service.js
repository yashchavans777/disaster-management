const axios = require('axios');

const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

const parseNumber = (value, fallback = 0) => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

/**
 * Fetch current weather data for a coordinate from the Open-Meteo API.
 *
 * @async
 * @param {number|string} lat - Latitude of the location.
 * @param {number|string} lng - Longitude of the location.
 * @returns {Promise<{temperature: number, precipitation: number, rain: number, wind_speed: number, windspeed: number, raw: Object}>}
 * @throws {Error} If the request fails or the API responds with an error.
 */
const getWeatherData = async (lat, lng) => {
  const latitude = parseNumber(lat, null);
  const longitude = parseNumber(lng, null);

  if (latitude === null || longitude === null) {
    throw new Error('Valid latitude and longitude are required to fetch weather data');
  }

  try {
    const response = await axios.get(OPEN_METEO_BASE_URL, {
      params: {
        latitude,
        longitude,
        current: 'temperature_2m,precipitation,wind_speed_10m',
      },
      timeout: 10000,
    });

    const data = response.data;

    if (data?.error) {
      throw new Error(data.reason || 'Open-Meteo returned an error');
    }

    const current = data?.current || {};
    const precipitation = parseNumber(current.precipitation);
    const windSpeed = parseNumber(current.wind_speed_10m);

    return {
      temperature: parseNumber(current.temperature_2m),
      precipitation,
      rain: precipitation,
      wind_speed: windSpeed,
      windspeed: windSpeed,
      raw: data,
    };
  } catch (error) {
    const statusCode = error.response?.status;
    const apiReason = error.response?.data?.reason || error.response?.data?.error;
    const detail = apiReason || error.message;
    throw new Error(`Failed to fetch weather data${statusCode ? ` (${statusCode})` : ''}: ${detail}`);
  }
};

module.exports = { getWeatherData };