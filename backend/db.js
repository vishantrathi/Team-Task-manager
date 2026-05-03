const fs = require('fs');
const mongoose = require('mongoose');

function isRunningInDocker() {
  return fs.existsSync('/.dockerenv') || fs.existsSync('/run/.containerenv');
}

function resolveMongoUri() {
  const configuredUri = process.env.MONGODB_URI || process.env.DATABASE_URL;

  if (!configuredUri) {
    return isRunningInDocker()
      ? 'mongodb://host.docker.internal:27017/teamtaskmanager'
      : 'mongodb://127.0.0.1:27017/teamtaskmanager';
  }

  if (isRunningInDocker() && /^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(configuredUri)) {
    return configuredUri.replace(/^mongodb:\/\/(127\.0\.0\.1|localhost)/, 'mongodb://host.docker.internal');
  }

  return configuredUri;
}

async function connectDatabase() {
  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  const connectionString = resolveMongoUri();

  try {
    await mongoose.connect(connectionString, {
      autoIndex: process.env.NODE_ENV !== 'production',
    });
  } catch (error) {
    throw new Error('Unable to connect to MongoDB. Set MONGODB_URI to a reachable MongoDB instance, or start MongoDB on the host when running the backend inside Docker.');
  }

  return mongoose.connection;
}

module.exports = { connectDatabase };
