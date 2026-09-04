/**
 * Auth controller (stub — authentication flow not in scope for SIH prototype).
 * Provides a health-check placeholder so the module can be imported without crashing.
 */

const apiResponse = require('../utils/apiResponse');

const authStatus = (req, res) => {
  return apiResponse.success(res, 200, 'Auth service is available', {
    authenticated: false,
    message: 'JWT auth not configured for prototype. Use direct API access.',
  });
};

module.exports = { authStatus };