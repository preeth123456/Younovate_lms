'use strict';

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://younovate-lms.vercel.app',
];

if (process.env.FRONTEND_URL && !ALLOWED_ORIGINS.includes(process.env.FRONTEND_URL)) {
  ALLOWED_ORIGINS.push(process.env.FRONTEND_URL);
}

const corsOriginChecker = (origin, callback) => {
  if (!origin || ALLOWED_ORIGINS.includes(origin)) {
    callback(null, true);
  } else {
    callback(new Error(`CORS: origin ${origin} not allowed`));
  }
};

module.exports = { ALLOWED_ORIGINS, corsOriginChecker };
