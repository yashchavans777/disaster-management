const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';

/**
 * Fetches a driving route between two Leaflet coordinates using OSRM.
 *
 * @param {[number, number]} startCoords - Origin as [lat, lng].
 * @param {[number, number]} endCoords - Destination as [lat, lng].
 * @returns {Promise<Array<[number, number]>>} Route coordinates formatted for Leaflet as [lat, lng].
 */
export async function fetchRoute(startCoords, endCoords) {
  const [startLat, startLng] = startCoords;
  const [endLat, endLng] = endCoords;

  const url = `${OSRM_BASE_URL}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`OSRM route request failed with status ${response.status}`);
  }

  const data = await response.json();
  const coordinates = data.routes?.[0]?.geometry?.coordinates;

  if (!Array.isArray(coordinates)) {
    return [];
  }

  // OSRM GeoJSON coordinates are [lng, lat]; Leaflet expects [lat, lng].
  return coordinates.map(([lng, lat]) => [lat, lng]);
}