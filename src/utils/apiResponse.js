/**
 * Standard API response helpers.
 *
 * Keeps every endpoint returning the same JSON envelope:
 *   { success: Boolean, message: String, data: Any }
 */

/**
 * Send a success response.
 *
 * @param {import('express').Response} res - Express response object.
 * @param {*} [data=null] - Payload to send back to the client.
 * @param {string} [message='Success'] - Human-readable success message.
 * @param {number} [statusCode=200] - HTTP status code.
 * @returns {import('express').Response} The Express response object.
 */
const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Send an error response.
 *
 * Accepts either a plain string message or an Error object
 * (e.g. from a caught exception in a controller/service).
 *
 * @param {import('express').Response} res - Express response object.
 * @param {string|Error} [error='Internal Server Error'] - Error message or Error instance.
 * @param {number} [statusCode=500] - HTTP status code.
 * @returns {import('express').Response} The Express response object.
 */
const sendError = (res, error = 'Internal Server Error', statusCode = 500) => {
  const message =
    error instanceof Error ? error.message : error || 'Internal Server Error';

  return res.status(statusCode).json({
    success: false,
    message,
    data: null,
  });
};

module.exports = { sendSuccess, sendError };

