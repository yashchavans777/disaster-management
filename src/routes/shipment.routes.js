const express = require('express');
const {
  createShipment,
  getShipments,
} = require('../controllers/shipment.controller');

const router = express.Router();

router.post('/', createShipment);
router.get('/', getShipments);

module.exports = router;
