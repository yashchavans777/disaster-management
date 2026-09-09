/**
 * Notification service.
 * Creates in-app notification documents and (optionally) emits
 * real-time events via the shared Socket.io instance.
 */

const Notification = require('../models/Notification');
const User = require('../models/user');
const { translateText } = require('../utils/bhashini');
const logger = require('../utils/logger');

/**
 * Create a notification for a user.
 * Translates High-Risk alerts into the user's preferred language using Bhashini.
 *
 * @param {object} options
 * @param {string|import('mongoose').Types.ObjectId} options.userId
 * @param {string} options.message
 * @param {'info'|'alert'|'warning'} [options.type='info']
 * @param {object} [options.metadata={}]
 * @param {string} [options.language]
 * @returns {Promise<import('mongoose').Document>}
 */
const sendNotification = async ({
  userId,
  message,
  type = 'info',
  metadata = {},
  language,
}) => {
  try {
    let userLang = language || metadata.language;

    // Check user's preferred language from DB
    if (!userLang && userId) {
      try {
        const user = await User.findById(userId).select('preferredLanguage language');
        userLang = user?.preferredLanguage || user?.language || 'en';
      } catch {
        userLang = 'en';
      }
    }
    userLang = userLang || 'en';

    let finalMessage = message;
    const isHighRisk =
      type === 'alert' ||
      metadata.riskLevel === 'high' ||
      metadata.severity === 'critical';

    if (isHighRisk && userLang !== 'en') {
      finalMessage = await translateText(message, 'en', userLang);
      logger.info(
        `[Bhashini Service] Translated high-risk alert to '${userLang}': "${message}" -> "${finalMessage}"`
      );
    }

    const notification = await Notification.create({
      userId,
      message: finalMessage,
      type,
      metadata: {
        ...metadata,
        originalMessage: message,
        language: userLang,
        isHighRisk,
      },
    });
    logger.info(
      `Notification created for user ${userId}: [${type}] [${userLang.toUpperCase()}] ${finalMessage}`
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

const { sendEarlyWarningAlert } = require('./notificationService');

module.exports = {
  sendNotification,
  getUserNotifications,
  sendEarlyWarningAlert,
};
