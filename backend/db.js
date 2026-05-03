const mongoose = require('mongoose');

async function connectDatabase() {
  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  const connectionString = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/teamtaskmanager';

  try {
    await mongoose.connect(connectionString, {
      autoIndex: process.env.NODE_ENV !== 'production',
    });
  } catch (error) {
    throw new Error('Unable to connect to MongoDB. Set MONGODB_URI in backend/.env or start a local MongoDB instance at mongodb://127.0.0.1:27017/teamtaskmanager.');
  }

  return mongoose.connection;
}

module.exports = { connectDatabase };
