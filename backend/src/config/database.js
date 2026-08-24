// src/config/database.js
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const { repairWorkshopPublicRegistrationIndexes } = require('./workshopRegistrationIndexes');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('\n❌  MONGODB_URI is undefined — .env not loaded or value missing.');
    console.error('    Check that .env exists and contains: MONGODB_URI=mongodb://127.0.0.1:27017/younovate_lms\n');
    process.exit(1);
  }

  try {
    mongoose.set('strictQuery', false);

    const conn = await mongoose.connect(uri, {
      dbName: 'younovate_lms',
    });

    console.log(`✅  MongoDB connected: ${conn.connection.host} → ${conn.connection.name}`);

    await repairWorkshopPublicRegistrationIndexes(conn.connection);

    // Log any future connection errors without crashing
    mongoose.connection.on('error', (err) =>
      console.error('❌  MongoDB connection error:', err.message)
    );
  } catch (err) {
    console.error('❌  MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;