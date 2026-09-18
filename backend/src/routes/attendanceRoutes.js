// src/routes/attendanceRoutes.js
'use strict';
const express    = require('express');
const Attendance = require('../models/Attendance');
const Session    = require('../models/Session');
const { emitToSession } = require('../services/socketService');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// GET /api/attendance/session/:sessionId
//   Returns all attendance records for a session (trainer/admin)
router.get('/session/:sessionId', authorize('trainer', 'admin'), async (req, res) => {
  const records = await Attendance.find({ session: req.params.sessionId })
    .populate('trainee', 'name email profilePicture')
    .populate('markedBy', 'name')
    .populate('session', 'title scheduledAt status')
    .populate('batch', 'name');
  return res.json({ success: true, records });
});

// GET /api/attendance/trainee/:traineeId
//   Returns full attendance history for a trainee (self or trainer/admin)
router.get('/trainee/:traineeId', async (req, res) => {
  if (req.user.role === 'trainee' && req.user._id.toString() !== req.params.traineeId)
    return res.status(403).json({ success: false, message: 'Forbidden' });

  const records = await Attendance.find({ trainee: req.params.traineeId })
    .populate('session', 'title scheduledAt status')
    .populate('batch', 'name')
    .sort({ createdAt: -1 });

  const total   = records.length;
  const present = records.filter(r => ['present', 'late'].includes(r.status)).length;
  const pct     = total ? ((present / total) * 100).toFixed(1) : '0.0';

  return res.json({ success: true, records, stats: { total, present, absent: total - present, percentage: pct } });
});

// GET /api/attendance/batch/:batchId
//   Batch-level attendance summary
router.get('/batch/:batchId', authorize('trainer', 'admin'), async (req, res) => {
  const records = await Attendance.find({ batch: req.params.batchId })
    .populate('trainee', 'name email')
    .populate('session', 'title scheduledAt')
    .populate('batch', 'name');
  return res.json({ success: true, records });
});

// POST /api/attendance/mark  [trainer]
//   Body: { sessionId, traineeId, status: 'present'|'absent'|'late'|'excused', note? }
//   Upserts — safe to call multiple times
router.post('/mark', authorize('trainer', 'admin'), async (req, res) => {
  const { sessionId, traineeId, status, note } = req.body;
  if (!sessionId || !traineeId || !status)
    return res.status(400).json({ success: false, message: 'sessionId, traineeId and status required' });

  const session = await Session.findById(sessionId).select('batchId title sessionType');
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

  const record = await Attendance.findOneAndUpdate(
    { session: sessionId, trainee: traineeId },
    { status, note: note || '', markedBy: req.user._id, markedAt: new Date(), batch: session.batchId },
    { upsert: true, new: true }
  );

  // Trainee inbox: attendance marked (best-effort — never blocks the mark).
  try {
    const notify = require('../utils/notificationService');
    await notify.notifyUsers([{
      userId: traineeId, role: 'trainee', module: session.sessionType === 'WORKSHOP' ? 'Workshop' : 'LMS',
      type: 'attendance_marked', kind: 'attendance_marked',
      title: 'Attendance Marked',
      message: `Your attendance for "${session.title || 'a session'}" was marked: ${status}.`,
      dedupeKey: `attendance:${String(sessionId)}:${String(traineeId)}:${status}`,
      link: '/trainee/attendance',
      meta: { sessionId: notify.idOf(sessionId), entityType: 'attendance' },
    }]);
  } catch (_) {}

  // Real-time push
  emitToSession(sessionId, 'attendance:update', { sessionId, traineeId, status });

  return res.json({ success: true, record });
});

// POST /api/attendance/bulk  [trainer]
//   Body: { sessionId, records: [{ traineeId, status, note? }] }
router.post('/bulk', authorize('trainer', 'admin'), async (req, res) => {
  const { sessionId, records } = req.body;
  if (!sessionId || !Array.isArray(records) || !records.length)
    return res.status(400).json({ success: false, message: 'sessionId and records[] required' });

  const session = await Session.findById(sessionId).select('batchId');
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

  const ops = records.map(r => ({
    updateOne: {
      filter: { session: sessionId, trainee: r.traineeId },
      update: { $set: { status: r.status, note: r.note || '', markedBy: req.user._id, markedAt: new Date(), batch: session.batchId } },
      upsert: true,
    },
  }));

  const result = await Attendance.bulkWrite(ops);
  emitToSession(sessionId, 'attendance:bulk', { sessionId, count: records.length });
  return res.json({ success: true, message: `${records.length} records saved`, result });
});

// PATCH /api/attendance/:id  [trainer/admin — update a single record]
//   Body: { status?, note? }
router.patch('/:id', authorize('trainer', 'admin'), async (req, res) => {
  const record = await Attendance.findByIdAndUpdate(
    req.params.id,
    { $set: { ...req.body, markedBy: req.user._id, markedAt: new Date() } },
    { new: true }
  );
  if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found' });
  return res.json({ success: true, record });
});

module.exports = router;
