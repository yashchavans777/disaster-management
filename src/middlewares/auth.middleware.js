const jwt = require('jsonwebtoken');
const apiResponse = require('../utils/apiResponse');

const JWT_SECRET = process.env.JWT_SECRET || 'disaster_management_jwt_secret_key_2026';

/**
 * Protect routes by verifying JWT in the Authorization header.
 */
const protect = (req, res, next) => {
  try {
    let token = null;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return apiResponse.error(
        res,
        401,
        'Access denied. No authentication token provided.'
      );
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return apiResponse.error(res, 401, 'Authentication token has expired.');
    }
    return apiResponse.error(res, 401, 'Invalid authentication token.');
  }
};

/**
 * Restrict access to specified roles.
 * @param  {...string} roles
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return apiResponse.error(
        res,
        403,
        `Access forbidden: requires one of the following roles: [${roles.join(', ')}]`
      );
    }
    return next();
  };
};

module.exports = {
  protect,
  authorizeRoles,
};
