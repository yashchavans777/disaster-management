/**
 * Geospatial helper utilities.
 * Used by routing algorithms and incident proximity checks.
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Convert degrees to radians.
 * @param {number} degrees
 * @returns {number}
 */
const toRadians = (degrees) => (degrees * Math.PI) / 180;

/**
 * Haversine distance between two [lat, lng] points in kilometres.
 * @param {[number,number]} pointA
 * @param {[number,number]} pointB
 * @returns {number} Distance in km
 */
const haversineDistance = ([lat1, lng1], [lat2, lng2]) => {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
};

/**
 * Compass bearing from pointA to pointB in degrees (0–360).
 * @param {[number,number]} pointA
 * @param {[number,number]} pointB
 * @returns {number}
 */
const bearing = ([lat1, lng1], [lat2, lng2]) => {
  const dLng = toRadians(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRadians(lat2));
  const x =
    Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
    Math.sin(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

/**
 * Midpoint between two [lat, lng] coordinates.
 * @param {[number,number]} pointA
 * @param {[number,number]} pointB
 * @returns {[number,number]}
 */
const midpoint = ([lat1, lng1], [lat2, lng2]) => [
  Number(((lat1 + lat2) / 2).toFixed(6)),
  Number(((lng1 + lng2) / 2).toFixed(6)),
];

/**
 * Check if a coordinate is within radiusKm of a centre point.
 * @param {[number,number]} coord
 * @param {[number,number]} centre
 * @param {number} radiusKm
 * @returns {boolean}
 */
const isWithinRadius = (coord, centre, radiusKm) =>
  haversineDistance(coord, centre) <= radiusKm;

module.exports = {
  haversineDistance,
  bearing,
  midpoint,
  isWithinRadius,
};