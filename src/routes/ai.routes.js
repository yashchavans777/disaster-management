const express = require('express');
const {
  predictRisk,
  ragQuery,
  graphRoute,
  syncDataToDb,
} = require('../controllers/ai.controller');

const router = express.Router();

router.post('/predict-risk', predictRisk);
router.post('/rag-query', ragQuery);
router.post('/graph-route', graphRoute);
router.post('/sync-data-to-db', syncDataToDb);


module.exports = router;
