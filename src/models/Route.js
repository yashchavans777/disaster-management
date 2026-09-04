const mongoose = require('mongoose');

const { Schema } = mongoose;

const coordinateSchema = new Schema(
  {
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
  {
    _id: false,
  }
);

const routeSchema = new Schema(
  {
    shipmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Shipment',
      default: null,
    },
    name: {
      type: String,
      trim: true,
    },
    origin: {
      type: coordinateSchema,
    },
    destination: {
      type: coordinateSchema,
    },
    waypoints: {
      type: [coordinateSchema],
      default: [],
    },
    distanceKm: {
      type: Number,
      min: 0,
    },
    estimatedDurationHours: {
      type: Number,
      min: 0,
    },
    riskLevel: {
      type: String,
      enum: ['low', 'moderate', 'medium', 'high', 'critical'],
      default: 'low',
      required: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.Route || mongoose.model('Route', routeSchema);
