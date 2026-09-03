const mongoose = require('mongoose');

const { Schema } = mongoose;

const shipmentSchema = new Schema(
  {
    origin: {
      type: String,
      required: true,
      trim: true,
    },
    destination: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'in-transit', 'delivered', 'delayed'],
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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.Shipment || mongoose.model('Shipment', shipmentSchema);