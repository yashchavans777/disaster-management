const mongoose = require('mongoose');

const { Schema } = mongoose;

const waypointSchema = new Schema(
  {
    lat: {
      type: Number,
      required: true,
    },
    lng: {
      type: Number,
      required: true,
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
      required: true,
    },
    waypoints: {
      type: [waypointSchema],
      default: [],
    },
    riskLevel: {
      type: String,
      enum: ['low', 'moderate', 'high'],
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