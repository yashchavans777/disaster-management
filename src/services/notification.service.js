/**
 * Notification service.
 * Creates in-app notification documents and (optionally) emits
 * real-time events via the shared Socket.io instance.
 */

const Notification = require('../models/Notification');
const logger = require('../utils/logger');

/**
 * Create a notification for a user.
 *
 * @param {object} options
 * @param {string|import('mongoose').Types.ObjectId} options.userId
 * @param {string} options.message
 * @param {'info'|'alert'|'warning'} [options.type='info']
 * @param {object} [options.metadata={}]
 * @returns {Promise<import('mongoose').Document>}
 */
const sendNotification = async ({
  userId,
  message,
  type = 'info',
  metadata = {},
}) => {
  try {
    const notification = await Notification.create({
      userId,
      message,
      type,
      metadata,
    });
    logger.info(
      `Notification created for user ${userId}: [${type}] ${message}`
    );
    return notification;
  } catch (error) {
    logger.error(`Failed to create notification: ${error.message}`);
    throw error;
  }
};

/**
 * Fetch all notifications for a user, newest first.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {number} [limit=20]
 * @returns {Promise<import('mongoose').Document[]>}
 */
const getUserNotifications = async (userId, limit = 20) => {
  return Notification.find({ userId }).sort({ createdAt: -1 }).limit(limit);
};

module.exports = { sendNotification, getUserNotifications };
