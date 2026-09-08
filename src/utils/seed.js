require('dotenv').config();

const mongoose = require('mongoose');

const Shipment = require('../models/Shipment');
const Vehicle = require('../models/Vehicle');
const Route = require('../models/Route');
const IncidentReport = require('../models/IncidentReport');
const User = require('../models/user');

const bcrypt = require('bcryptjs');

const mongoUri =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27017/disaster-management';

const locations = {
  guwahati: { lat: 26.1445, lng: 91.7362, address: 'Guwahati, Assam' },
  shillong: { lat: 25.5788, lng: 91.8933, address: 'Shillong, Meghalaya' },
  siliguri: {
    lat: 26.7271,
    lng: 88.3953,
    address: 'Siliguri, West Bengal Gateway to North East',
  },
  gangtok: { lat: 27.3389, lng: 88.6065, address: 'Gangtok, Sikkim' },
  itanagar: {
    lat: 27.0844,
    lng: 93.6053,
    address: 'Itanagar, Arunachal Pradesh',
  },
  imphal: { lat: 24.817, lng: 93.9368, address: 'Imphal, Manipur' },
  aizawl: { lat: 23.7271, lng: 92.7176, address: 'Aizawl, Mizoram' },
  agartala: { lat: 23.8315, lng: 91.2868, address: 'Agartala, Tripura' },
  kohima: { lat: 25.6751, lng: 94.1086, address: 'Kohima, Nagaland' },
  silchar: { lat: 24.8333, lng: 92.7789, address: 'Silchar, Cachar, Assam' },
  haflong: { lat: 25.1667, lng: 93.0167, address: 'Haflong, Dima Hasao, Assam' },
  badarpur: { lat: 24.9030, lng: 92.5950, address: 'Badarpur, Karimganj, Assam' },
  jatinga: { lat: 25.0450, lng: 92.9320, address: 'Jatinga Lampur Corridor, Dima Hasao, Assam' },
  harangajao: { lat: 24.9750, lng: 92.8350, address: 'Harangajao-NH-27 Corridor, Assam' },
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

    const salt = await bcrypt.genSalt(10);
    const hashPassword = async (pwd) => bcrypt.hash(pwd, salt);

    const [admin, driver, operatorUser, driverUser, managerUser, adminUser] = await User.insertMany([
      {
        name: 'Demo Admin',
        email: 'admin@sih26002.demo',
        password: await hashPassword('demo-admin-password'),
        role: 'admin',
        phone: '+91-90000-26002',
      },
      {
        name: 'Demo Driver',
        email: 'driver@sih26002.demo',
        password: await hashPassword('demo-driver-password'),
        role: 'driver',
        phone: '+91-90000-26003',
      },
      {
        name: 'Control Operator',
        email: 'operator@disaster.org',
        password: await hashPassword('operator123'),
        role: 'operator',
        phone: '+91-98765-00001',
      },
      {
        name: 'Logistics Driver',
        email: 'driver@disaster.org',
        password: await hashPassword('driver123'),
        role: 'driver',
        phone: '+91-98765-00002',
      },
      {
        name: 'Disaster Manager',
        email: 'manager@disaster.org',
        password: await hashPassword('manager123'),
        role: 'manager',
        phone: '+91-98765-00003',
      },
      {
        name: 'System Administrator',
        email: 'admin@disaster.org',
        password: await hashPassword('admin123'),
        role: 'admin',
        phone: '+91-98765-00004',
      },
    ]);

    const vehicles = await Vehicle.insertMany([
      {
        vehicleNumber: 'AS11-EC-2024',
        type: 'truck',
        capacityKg: 5000,
        status: 'in-transit',
        currentLocation: {
          lat: 25.0450,
          lng: 92.9320,
          address: 'NH-27 near Jatinga Ridge (Silchar to Haflong Corridor)',
        },
      },
      {
        vehicleNumber: 'AS24-DM-3031',
        type: 'mini-truck',
        capacityKg: 3000,
        status: 'in-transit',
        currentLocation: {
          lat: 24.9750,
          lng: 92.8350,
          address: 'Harangajao-Silchar Highway (Silchar to Haflong)',
        },
      },
      {
        vehicleNumber: 'AS01-GC-4412',
        type: 'refrigerated-truck',
        capacityKg: 4000,
        status: 'in-transit',
        currentLocation: {
          lat: 24.8920,
          lng: 92.6840,
          address: 'Badarpur-Silchar Flood Relief Corridor',
        },
      },
      {
        vehicleNumber: 'MN01-SIH-1004',
        type: 'truck',
        capacityKg: 3500,
        status: 'available',
        currentLocation: locations.guwahati,
      },
      {
        vehicleNumber: 'MZ01-SIH-1005',
        type: 'van',
        capacityKg: 1500,
        status: 'maintenance',
        currentLocation: locations.aizawl,
      },
    ]);

    const routes = await Route.insertMany([
      {
        name: 'Silchar to Haflong Mountain Relief Corridor',
        origin: locations.silchar,
        destination: locations.haflong,
        waypoints: [locations.harangajao, locations.jatinga],
        distanceKm: 102,
        estimatedDurationHours: 4.2,
        riskLevel: 'high',
      },
      {
        name: 'Guwahati to Silchar Strategic Supply Line',
        origin: locations.guwahati,
        destination: locations.silchar,
        waypoints: [locations.shillong],
        distanceKm: 310,
        estimatedDurationHours: 9.0,
        riskLevel: 'high',
      },
      {
        name: 'Badarpur to Haflong Emergency Corridor',
        origin: locations.badarpur,
        destination: locations.haflong,
        waypoints: [locations.harangajao],
        distanceKm: 85,
        estimatedDurationHours: 3.5,
        riskLevel: 'medium',
      },
      {
        name: 'Kohima to Imphal Emergency Route',
        origin: locations.kohima,
        destination: locations.imphal,
        waypoints: [],
        distanceKm: 137,
        estimatedDurationHours: 5,
        riskLevel: 'low',
      },
      {
        name: 'Agartala to Aizawl Communication Support Route',
        origin: locations.agartala,
        destination: locations.aizawl,
        waypoints: [],
        distanceKm: 340,
        estimatedDurationHours: 10,
        riskLevel: 'medium',
      },
    ]);

    const shipments = await Shipment.insertMany([
      {
        trackingId: 'SIH-NER-001',
        title: 'Emergency Medical Kits to Haflong Relief Camp',
        cargoType: 'Medical Kits',
        weightKg: 1500,
        priority: 'critical',
        origin: 'Silchar',
        destination: 'Haflong',
        status: 'in-transit',
        driver: driver._id,
        vehicle: vehicles[0]._id,
        route: routes[0]._id,
        expectedDelivery: new Date(Date.now() + 6 * 60 * 60 * 1000),
      },
      {
        trackingId: 'SIH-NER-002',
        title: 'High-Energy Food Rations & Drinking Water',
        cargoType: 'Food Rations & Drinking Water',
        weightKg: 2800,
        priority: 'high',
        origin: 'Silchar',
        destination: 'Haflong',
        status: 'in-transit',
        driver: driver._id,
        vehicle: vehicles[1]._id,
        route: routes[0]._id,
        expectedDelivery: new Date(Date.now() + 8 * 60 * 60 * 1000),
      },
      {
        trackingId: 'SIH-NER-003',
        title: 'Trauma First Aid & Disaster Shelter Kits',
        cargoType: 'Medical Kits & Trauma Supplies',
        weightKg: 2100,
        priority: 'critical',
        origin: 'Badarpur',
        destination: 'Haflong',
        status: 'in-transit',
        driver: driver._id,
        vehicle: vehicles[2]._id,
        route: routes[2]._id,
        expectedDelivery: new Date(Date.now() + 10 * 60 * 60 * 1000),
      },
      {
        trackingId: 'SIH-NE-004',
        title: 'Water Purification Units to Imphal',
        cargoType: 'Water purification units',
        weightKg: 1800,
        priority: 'medium',
        origin: 'Guwahati',
        destination: 'Imphal',
        status: 'assigned',
        driver: driver._id,
        vehicle: vehicles[3]._id,
        route: routes[3]._id,
        expectedDelivery: new Date(Date.now() + 36 * 60 * 60 * 1000),
      },
      {
        trackingId: 'SIH-NE-005',
        title: 'Communication Kits to Aizawl',
        cargoType: 'Communication equipment',
        weightKg: 950,
        priority: 'medium',
        origin: 'Agartala',
        destination: 'Aizawl',
        status: 'pending',
        driver: driver._id,
        vehicle: vehicles[4]._id,
        route: routes[4]._id,
        expectedDelivery: new Date(Date.now() + 28 * 60 * 60 * 1000),
      },
    ]);

    const incidents = await IncidentReport.insertMany([
      {
        type: 'landslide',
        title: 'Landslide near Shillong Bypass',
        description:
          'Moderate landslide reported near the Shillong approach road. Heavy vehicle movement should be rerouted.',
        severity: 'high',
        location: {
          lat: 25.6127,
          lng: 91.8931,
          address: 'Shillong Bypass, Meghalaya',
        },
        status: 'verified',
        reportedBy: admin._id,
      },
      {
        type: 'flooding',
        title: 'Flooded stretch near Barak Valley corridor',
        description:
          'Localized flooding affecting logistics movement towards southern Assam and Mizoram routes.',
        severity: 'medium',
        location: {
          lat: 24.8333,
          lng: 92.7789,
          address: 'Silchar-Barak Valley Corridor, Assam',
        },
        status: 'reported',
        reportedBy: driver._id,
      },
    ]);
  } catch (error) {
    process.stderr.write(`Demo seed failed: ${error.message}\n`);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

seedDatabase();
