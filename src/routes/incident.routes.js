const express = require('express');
const {
  createIncident,
  getIncidents,
} = require('../controllers/incident.controller');

const router = express.Router();

router.post('/', createIncident);
router.get('/', getIncidents);

module.exports = router;