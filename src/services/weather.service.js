/**
 * Weather service.
 *
 * Fetches live weather data from the Open-Meteo API using the
 * native `fetch` API (Node >= 18, no external dependencies).
 */

const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

/**
 * Fetch current weather data for a coordinate from the Open-Meteo API.
 *
 * @async
 * @param {number} lat - Latitude of the location.
 * @param {number} lng - Longitude of the location.
 * @returns {Promise<Object>} The current weather payload.
 * @throws {Error} If the request fails or the API responds with an error.
 */
const getWeatherData = async (lat, lng) => {
  const url = `${OPEN_METEO_BASE_URL}?latitude=${lat}&longitude=${lng}&current_weather=true`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Open-Meteo API responded with status ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Open-Meteo API error: ${data.reason || 'Unknown reason'}`);
    }

    return data.current_weather || {};
  } catch (error) {
    throw new Error(`Failed to fetch weather data: ${error.message}`);
  }
};

module.exports = { getWeatherData };