require('dotenv').config();

const mongoose = require('mongoose');

const Shipment = require('../models/Shipment');
const Vehicle = require('../models/Vehicle');
const Route = require('../models/Route');
const IncidentReport = require('../models/IncidentReport');
const User = require('../models/user');

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smart-logistics-platform';

const locations = {
  guwahati: { lat: 26.1445, lng: 91.7362, address: 'Guwahati, Assam' },
  shillong: { lat: 25.5788, lng: 91.8933, address: 'Shillong, Meghalaya' },
  siliguri: { lat: 26.7271, lng: 88.3953, address: 'Siliguri, West Bengal Gateway to North East' },
  gangtok: { lat: 27.3389, lng: 88.6065, address: 'Gangtok, Sikkim' },
  itanagar: { lat: 27.0844, lng: 93.6053, address: 'Itanagar, Arunachal Pradesh' },
  imphal: { lat: 24.8170, lng: 93.9368, address: 'Imphal, Manipur' },
  aizawl: { lat: 23.7271, lng: 92.7176, address: 'Aizawl, Mizoram' },
  agartala: { lat: 23.8315, lng: 91.2868, address: 'Agartala, Tripura' },
  kohima: { lat: 25.6751, lng: 94.1086, address: 'Kohima, Nagaland' },
};

const clearCollections = async () => {
  await Promise.all([
    Shipment.deleteMany({}),
    Vehicle.deleteMany({}),
    Route.deleteMany({}),
    IncidentReport.deleteMany({}),
    User.deleteMany({}),
  ]);
};

const seedDatabase = async () => {
  try {
    await mongoose.connect(mongoUri);

    await clearCollections();

    const [admin, driver] = await User.insertMany([
      { name: 'Demo Admin', email: 'admin@sih26002.demo', password: 'demo-admin-password', role: 'admin', phone: '+91-90000-26002' },
      { name: 'Demo Driver', email: 'driver@sih26002.demo', password: 'demo-driver-password', role: 'driver', phone: '+91-90000-26003' },
    ]);

    const vehicles = await Vehicle.insertMany([
      { vehicleNumber: 'AS01-SIH-1001', type: 'truck', capacityKg: 5000, status: 'in-transit', currentLocation: locations.guwahati },
      { vehicleNumber: 'ML05-SIH-1002', type: 'mini-truck', capacityKg: 2800, status: 'available', currentLocation: locations.shillong },
      { vehicleNumber: 'SK02-SIH-1003', type: 'container', capacityKg: 7000, status: 'available', currentLocation: locations.siliguri },
      { vehicleNumber: 'MN01-SIH-1004', type: 'refrigerated-truck', capacityKg: 3500, status: 'in-transit', currentLocation: locations.imphal },
      { vehicleNumber: 'MZ01-SIH-1005', type: 'van', capacityKg: 1500, status: 'maintenance', currentLocation: locations.aizawl },
    ]);

    const routes = await Route.insertMany([
      { name: 'Guwahati to Shillong Relief Corridor', origin: locations.guwahati, destination: locations.shillong, waypoints: [], distanceKm: 99, estimatedDurationHours: 3.5, riskLevel: 'high' },
      { name: 'Siliguri to Gangtok Mountain Corridor', origin: locations.siliguri, destination: locations.gangtok, waypoints: [], distanceKm: 114, estimatedDurationHours: 4.5, riskLevel: 'medium' },
      { name: 'Guwahati to Itanagar Strategic Supply Route', origin: locations.guwahati, destination: locations.itanagar, waypoints: [], distanceKm: 330, estimatedDurationHours: 8.5, riskLevel: 'medium' },
      { name: 'Kohima to Imphal Emergency Route', origin: locations.kohima, destination: locations.imphal, waypoints: [], distanceKm: 137, estimatedDurationHours: 5, riskLevel: 'low' },
      { name: 'Agartala to Aizawl Communication Support Route', origin: locations.agartala, destination: locations.aizawl, waypoints: [], distanceKm: 340, estimatedDurationHours: 10, riskLevel: 'medium' },
    ]);

    const shipments = await Shipment.insertMany([
      { trackingId: 'SIH-NE-001', title: 'Emergency Medical Supplies to Shillong', cargoType: 'Medical supplies', weightKg: 1200, priority: 'critical', status: 'in-transit', driver: driver._id, vehicle: vehicles[0]._id, route: routes[0]._id, expectedDelivery: new Date(Date.now() + 18 * 60 * 60 * 1000) },
      { trackingId: 'SIH-NE-002', title: 'Food Relief Kits to Gangtok', cargoType: 'Relief food kits', weightKg: 2600, priority: 'high', status: 'assigned', driver: driver._id, vehicle: vehicles[1]._id, route: routes[1]._id, expectedDelivery: new Date(Date.now() + 30 * 60 * 60 * 1000) },
      { trackingId: 'SIH-NE-003', title: 'Bridge Repair Equipment to Itanagar', cargoType: 'Infrastructure equipment', weightKg: 4200, priority: 'high', status: 'pending', driver: driver._id, vehicle: vehicles[2]._id, route: routes[2]._id, expectedDelivery: new Date(Date.now() + 42 * 60 * 60 * 1000) },
      { trackingId: 'SIH-NE-004', title: 'Water Purification Units to Imphal', cargoType: 'Water purification units', weightKg: 1800, priority: 'medium', status: 'in-transit', driver: driver._id, vehicle: vehicles[3]._id, route: routes[3]._id, expectedDelivery: new Date(Date.now() + 36 * 60 * 60 * 1000) },
      { trackingId: 'SIH-NE-005', title: 'Communication Kits to Aizawl', cargoType: 'Communication equipment', weightKg: 950, priority: 'medium', status: 'assigned', driver: driver._id, vehicle: vehicles[4]._id, route: routes[4]._id, expectedDelivery: new Date(Date.now() + 28 * 60 * 60 * 1000) },
    ]);

    const incidents = await IncidentReport.insertMany([
      { type: 'landslide', title: 'Landslide near Shillong Bypass', description: 'Moderate landslide reported near the Shillong approach road. Heavy vehicle movement should be rerouted.', severity: 'high', location: { lat: 25.6127, lng: 91.8931, address: 'Shillong Bypass, Meghalaya' }, status: 'verified', reportedBy: admin._id },
      { type: 'flooding', title: 'Flooded stretch near Barak Valley corridor', description: 'Localized flooding affecting logistics movement towards southern Assam and Mizoram routes.', severity: 'medium', location: { lat: 24.8333, lng: 92.7789, address: 'Silchar-Barak Valley Corridor, Assam' }, status: 'reported', reportedBy: driver._id },
    ]);

  } catch (error) {
    process.stderr.write(`Demo seed failed: ${error.message}\n`);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

seedDatabase();