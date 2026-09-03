const mongoose = require('mongoose');

const { Schema } = mongoose;

const vehicleSchema = new Schema(
  {
    registrationNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    vehicleNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['truck', 'mini-truck', 'van', 'container', 'refrigerated-truck'],
      default: 'truck',
    },
    capacity: {
      type: Number,
      min: 0,
    },
    capacityKg: {
      type: Number,
      min: 0,
    },
    status: {
      type: String,
      enum: ['available', 'on-trip', 'in-transit', 'maintenance'],
      required: true,
      default: 'available',
    },
    currentLocation: {
      lat: Number,
      lng: Number,
      address: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.Vehicle || mongoose.model('Vehicle', vehicleSchema);