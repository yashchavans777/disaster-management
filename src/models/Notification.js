const mongoose = require('mongoose');

const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['alert', 'info', 'warning'],
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    // Alias for API consistency
    read: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
