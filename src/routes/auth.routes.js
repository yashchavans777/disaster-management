const express = require('express');
const { authStatus } = require('../controllers/auth.controller');

const router = express.Router();

router.get('/status', authStatus);

module.exports = router;
