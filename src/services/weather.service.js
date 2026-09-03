<<<<<<< HEAD
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
 * @returns {Promise<Object>} The `current_weather` object:
 *   { temperature, windspeed, winddirection, weathercode, is_day, time }.
 * @throws {Error} If the request fails, the API returns a non-OK status,
 *   or the API reports an application-level error.
 */
const getWeatherData = async (lat, lng) => {
  const url = `${OPEN_METEO_BASE_URL}?latitude=${lat}&longitude=${lng}&current_weather=true`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Open-Meteo API responded with status ${response.status}`);
    }

    const data = await response.json();

    // Open-Meteo signals failures with an application-level error flag.
    if (data.error) {
      throw new Error(`Open-Meteo API error: ${data.reason || 'Unknown reason'}`);
    }

    return data.current_weather;
  } catch (err) {
    throw new Error(`Failed to fetch weather data: ${err.message}`);
  }
};

module.exports = { getWeatherData };
=======
//
>>>>>>> origin/main
