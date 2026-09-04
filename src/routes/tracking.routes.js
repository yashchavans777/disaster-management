const express = require('express');
const {
  getVehicleLocation,
  updateVehicleLocation,
} = require('../controllers/tracking.controller');

const router = express.Router();

router.get('/:vehicleId', getVehicleLocation);
router.post('/update', updateVehicleLocation);

module.exports = router;
