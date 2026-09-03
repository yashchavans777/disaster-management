const Shipment = require('../models/Shipment');
const apiResponse = require('../utils/apiResponse');

const createShipment = async (req, res) => {
  try {
    const shipment = await Shipment.create(req.body);

    return apiResponse.success(res, 201, 'Shipment created successfully', shipment);
  } catch (error) {
    return apiResponse.error(res, 500, 'Failed to create shipment', error.message);
  }
};

const getShipments = async (req, res) => {
  try {
    const shipments = await Shipment.find()
      .populate('driver')
      .populate('vehicle');

    return apiResponse.success(res, 200, 'Shipments fetched successfully', shipments);
  } catch (error) {
    return apiResponse.error(res, 500, 'Failed to fetch shipments', error.message);
  }
};

module.exports = {
  createShipment,
  getShipments,
};
