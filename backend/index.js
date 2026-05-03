require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { connectDatabase } = require('./db');
const { errorHandler, notFound } = require('./middleware');

const app = express();

/** Must match backend `routePrefix` in root vercel.json. Override with SERVICE_ROUTE_PREFIX if you change it. */
const serviceRoutePrefix = (process.env.SERVICE_ROUTE_PREFIX || (process.env.VERCEL ? '/_/backend' : '')).replace(/\/$/, '');
const apiMountPath = serviceRoutePrefix ? `${serviceRoutePrefix}/api/v1` : '/api/v1';
const rootMountPath = serviceRoutePrefix ? `${serviceRoutePrefix}/` : '/';

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((origin) => origin.trim());

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/** Vercel Functions: ensure MongoDB before handling requests (no separate listen()). */
if (process.env.VERCEL) {
  app.use(async (req, res, next) => {
    try {
      await connectDatabase();
      next();
    } catch (err) {
      next(err);
    }
  });
}

app.use(apiMountPath, require('./routes'));
app.get(rootMountPath, (req, res) => res.json({ name: 'Team Task Manager API', version: 'v1' }));
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

async function startServer() {
  await connectDatabase();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = app;
