const mongoose = require('mongoose');

const { Schema } = mongoose;

const incidentReportSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['landslide', 'flood', 'flooding', 'roadblock', 'other'],
      required: true,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    location: {
      lat: {
        type: Number,
        required: true,
      },
      lng: {
        type: Number,
        required: true,
      },
      address: {
        type: String,
        trim: true,
      },
    },
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'reported', 'verified', 'resolved'],
      default: 'active',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.IncidentReport ||
  mongoose.model('IncidentReport', incidentReportSchema);
