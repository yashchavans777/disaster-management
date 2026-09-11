const Notification = require('../models/Notification');
const apiResponse = require('../utils/apiResponse');

const createNotification = async (req, res) => {
  try {
    const notification = await Notification.create(req.body);

    return apiResponse.success(
      res,
      201,
      'Notification created successfully',
      notification
    );
  } catch (err) {
    return apiResponse.error(
      res,
      500,
      'Failed to create notification',
      err.message
    );
  }
};

const getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;

    const notifications = await Notification.find({ userId }).populate(
      'userId'
    );

    return apiResponse.success(
      res,
      200,
      'User notifications fetched successfully',
      notifications
    );
  } catch (err) {
    return apiResponse.error(
      res,
      500,
      'Failed to fetch notifications',
      err.message
    );
  }
};

module.exports = {
  createNotification,
  getUserNotifications,
};
