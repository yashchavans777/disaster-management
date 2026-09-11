const express = require('express');
const { evaluateRouteRisk } = require('../controllers/route.controller');

const router = express.Router();

router.post('/evaluate-risk', evaluateRouteRisk);

module.exports = router;
