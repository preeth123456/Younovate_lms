// src/server.js
// Younovate LMS — Main Express + Socket.io server
'use strict';

const path = require('path');
const os   = require('os');                         // ← ADDED (was missing → crash on os.homedir())
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('express-async-errors');

const express      = require('express');
const http         = require('http');
const cors         = require('cors');
const helmet       = require('helmet');
const cookieParser = require('cookie-parser');
const morgan       = require('morgan');
const { globalLimiter } = require('./middleware/rateLimiters');

const connectDB      = require('./config/database');
const { corsOriginChecker } = require('./config/corsOrigins');
const { initSocket } = require('./services/socketService');
const errorHandler   = require('./middleware/errorHandler');

// ── Route imports ─────────────────────────────────────────────────────────────
const authRoutes         = require('./routes/authRoutes');
const adminRoutes        = require('./routes/adminRoutes');
const trainerRoutes      = require('./routes/trainerRoutes');
const trainerWorkshopRoutes = require('./routes/trainerWorkshopRoutes');
const traineeRoutes      = require('./routes/traineeRoutes');
const hrRoutes           = require('./routes/hrRoutes');
const sessionRoutes      = require('./routes/sessionRoutes');
const attendanceRoutes   = require('./routes/attendanceRoutes');
const assignmentRoutes   = require('./routes/assignmentRoutes');
const batchRoutes        = require('./routes/batchRoutes');
const batches        = require('./routes/batches');
const userRoutes         = require('./routes/userRoutes');
const courseRoutes       = require('./routes/courseRoutes');
const subjectContentRoutes = require('./routes/subjectContentRoutes');
const subscriptionRoutes = require('./routes/courseSubscriptionRoutes');
const livekitWebhook     = require('./routes/livekitWebhook');
const sessionCtrl        = require('./controllers/sessionController');
const workshopRoutes     = require('./routes/workshopRoutes');
const searchRoutes       = require('./routes/searchRoutes');
const workshopSessionRoutes = require('./routes/workshopSessionRoutes');
const livekitTokenRoutes = require('./routes/livekit');
const notificationRoutes = require('./routes/notificationRoutes');
const lmsCertificateRoutes = require('./routes/lmsCertificateRoutes');
const lmsAssessmentRoutes = require('./routes/lmsAssessmentRoutes');
const publicRegistrationRoutes = require('./routes/publicRegistrationRoutes');
require('./jobs/autoEndSessions');

const app    = express();
const server = http.createServer(app);

app.set('trust proxy', 1);

// ── Database + Socket ─────────────────────────────────────────────────────────
connectDB();
initSocket(server);

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: corsOriginChecker, credentials: true }));

// ════════════════════════════════════════════════════════════════════════════
// LIVEKIT WEBHOOK — raw body only on /webhook (token route needs express.json below)
app.use('/api/livekit/webhook', express.raw({ type: ['application/json', 'application/webhook+json'] }), livekitWebhook);





// ── Rate limiters ─────────────────────────────────────────────────────────────
app.use(globalLimiter);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Static file serving ───────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/recordings', (req, res, next) => {
  // Frontend (:3000) loads videos from API (:8080) — allow cross-origin media embedding.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  const csp = res.getHeader('Content-Security-Policy');
  if (csp && !String(csp).includes('media-src')) {
    res.setHeader('Content-Security-Policy', String(csp) + " media-src 'self' http://localhost:3000 http://localhost:8080 data: blob:;");
  }
  next();
});
app.use('/recordings', express.static(path.join(__dirname, '..', '..', 'lms-recordings')));

// ── HTTP logging (dev only) ───────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) =>
  res.json({
    success:   true,
    status:    'ok',
    version:   '3.0.0',
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV,
  })
);

// ── LiveKit token (needs JSON body, so AFTER express.json) ─────────────────────
// sessionCtrl.getToken handles LMS sessions; livekitTokenRoutes handles both LMS + Workshop
app.use('/api/livekit', livekitTokenRoutes);

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',           authRoutes);
app.use('/api/admin',          adminRoutes);
app.use('/api/trainer',        trainerRoutes);
app.use('/api/trainer/workshops', trainerWorkshopRoutes);
app.use('/api/trainee',        traineeRoutes);
app.use('/api/hr',             hrRoutes);
app.use('/api/sessions',       sessionRoutes);
app.use('/api/attendance',     attendanceRoutes);
app.use('/api/assignments',    assignmentRoutes);
app.use('/api/batches',        batchRoutes);
app.use('/api/batches/assign',        batches);
app.use('/api/users',          userRoutes);
app.use('/api/courses',        courseRoutes);
app.use('/api/courses_subject', subjectContentRoutes);
app.use('/api/subscriptions',  subscriptionRoutes);
app.use('/api/workshops',      workshopRoutes);
app.use('/api/search',         searchRoutes);
app.use('/api/workshop-sessions', workshopSessionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/lms-certificates', lmsCertificateRoutes);
app.use('/api/lms-assessments', lmsAssessmentRoutes);
app.use('/api/public-registrations', publicRegistrationRoutes);

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((req, res) =>
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` })
);

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`\n🚀  Younovate LMS API running on :${PORT}`);
  console.log(`🌍  Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = { app, server };