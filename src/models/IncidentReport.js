const mongoose = require('mongoose');

const { Schema } = mongoose;

const incidentReportSchema = new Schema(
  {
    location: {
      lat: {
        type: Number,
        required: true,
      },
      lng: {
        type: Number,
        required: true,
      },
    },
    type: {
      type: String,
      enum: ['landslide', 'flood', 'roadblock', 'other'],
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'resolved'],
      default: 'active',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.IncidentReport || mongoose.model('IncidentReport', incidentReportSchema);
