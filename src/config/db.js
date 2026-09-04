/**
 * MongoDB connection bootstrap.
 * Called once at server startup from src/app.js.
 */

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/disaster-management';

const connectDB = async () => {
  try {
    const connection = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    process.stdout.write(
      `MongoDB connected: ${connection.connection.host}/${connection.connection.name}\n`
    );
  } catch (error) {
    process.stderr.write(`MongoDB connection failed: ${error.message}\n`);
    process.stderr.write('Server will continue running — DB-dependent routes will return errors.\n');
  }
};

module.exports = { connectDB };