/**
 * Tracking controller.
 * Handles vehicle location updates emitted by drivers via Socket.io.
 * Also exposes a REST endpoint for polling the last-known vehicle position.
 */

const Vehicle = require('../models/Vehicle');
const apiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * GET /api/tracking/:vehicleId
 * Returns the last-known location for a vehicle.
 */
const getVehicleLocation = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const vehicle = await Vehicle.findById(vehicleId).select('currentLocation updatedAt name vehicleNumber');

    if (!vehicle) {
      return apiResponse.error(res, 404, 'Vehicle not found');
    }

    return apiResponse.success(res, 200, 'Vehicle location fetched', vehicle);
  } catch (error) {
    logger.error(`getVehicleLocation error: ${error.message}`);
    return apiResponse.error(res, 500, 'Failed to fetch vehicle location', error.message);
  }
};

/**
 * POST /api/tracking/update
 * REST fallback for drivers without WebSocket — updates vehicle location in DB.
 */
const updateVehicleLocation = async (req, res) => {
  try {
    const { vehicleId, latitude, longitude } = req.body;

    if (!vehicleId || latitude === undefined || longitude === undefined) {
      return apiResponse.error(res, 400, 'vehicleId, latitude, and longitude are required');
    }

    const vehicle = await Vehicle.findByIdAndUpdate(
      vehicleId,
      { currentLocation: { lat: latitude, lng: longitude }, updatedAt: new Date() },
      { new: true }
    );

    if (!vehicle) {
      return apiResponse.error(res, 404, 'Vehicle not found');
    }

    return apiResponse.success(res, 200, 'Vehicle location updated', vehicle);
  } catch (error) {
    logger.error(`updateVehicleLocation error: ${error.message}`);
    return apiResponse.error(res, 500, 'Failed to update vehicle location', error.message);
  }
};

module.exports = { getVehicleLocation, updateVehicleLocation };
