const mongoose = require('mongoose');

const { Schema } = mongoose;

const shipmentSchema = new Schema(
  {
    trackingId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },
    cargoType: {
      type: String,
      trim: true,
    },
    weightKg: {
      type: Number,
      min: 0,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    origin: {
      type: String,
      trim: true,
    },
    destination: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'assigned', 'in-transit', 'delivered', 'delayed'],
      required: true,
      default: 'pending',
    },
    assignedDriver: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedVehicle: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      default: null,
    },
    driver: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    vehicle: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      default: null,
    },
    route: {
      type: Schema.Types.ObjectId,
      ref: 'Route',
      default: null,
    },
    expectedDelivery: Date,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.Shipment || mongoose.model('Shipment', shipmentSchema);