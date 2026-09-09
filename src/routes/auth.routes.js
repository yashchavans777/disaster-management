const express = require('express');
const {
  register,
  login,
  getMe,
  authStatus,
} = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/status', authStatus);

module.exports = router;
