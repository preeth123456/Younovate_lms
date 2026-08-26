// src/routes/sessionRoutes.js
// Management → Sessions — LMS sessions ONLY.
// Workshop sessions are served exclusively by /api/workshop-sessions.
'use strict';
const express    = require('express');
const Session    = require('../models/Session');
const { emitToRole } = require('../services/socketService');
const { protect, authorize } = require('../middleware/auth');
const { rejectPastDateTime } = require('../utils/dateTimeValidation');
const sessionCtrl = require('../controllers/sessionController');
const { applyEffectiveSessionStatus, autoUpdatePastScheduledSessions } = require('../utils/sessionStatusUtils');

const router = express.Router();
router.use(protect);

// LMS-only base filter — excludes any doc with sessionType === 'WORKSHOP'
// Covers: explicit 'LMS', legacy docs without the field, and null values.
const LMS_FILTER = { $or: [{ sessionType: 'LMS' }, { sessionType: { $exists: false } }, { sessionType: null }] };

// GET /api/sessions?status=&batchId=&page=1&limit=50
router.get('/', async (req, res) => {
  const { status, batchId, page = 1, limit = 50 } = req.query;
  const filter = { ...LMS_FILTER };
  if (req.user.role === 'trainer') filter.trainerId = req.user._id;
  if (req.user.role === 'trainee') {
    const batchIds = req.user.batchIds || [];
    if (batchIds.length) filter.batchId = { $in: batchIds };
  }
  if (status)  filter.status  = status;
  if (batchId) filter.batchId = batchId;

  await autoUpdatePastScheduledSessions(Session, LMS_FILTER);

  const total    = await Session.countDocuments(filter);
  const sessions = await Session.find(filter)
    .populate('trainerId', 'name')
    .populate('batchId',   'name')
    .sort({ scheduledAt: -1 })
    .limit(Number(limit)).skip((Number(page) - 1) * Number(limit))
    .lean();

  const enriched = sessions.map((s) => applyEffectiveSessionStatus(s));

  return res.json({ success: true, sessions: enriched, total, page: Number(page) });
});

// GET /api/sessions/:id
router.get('/:id', async (req, res) => {
  const session = await Session.findOne({ _id: req.params.id, ...LMS_FILTER })
    .populate('trainerId', 'name email profilePicture')
    .populate('batchId',   'name');
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
  return res.json({ success: true, session: applyEffectiveSessionStatus(session) });
});

// POST /api/sessions  [admin only]
// Always stamps sessionType: 'LMS' so it never bleeds into Workshop views.
router.post('/', authorize('admin'), async (req, res) => {
  const { title, batchId, trainerId, scheduledAt } = req.body;
  if (!title || !batchId || !trainerId || !scheduledAt)
    return res.status(400).json({ success: false, message: 'title, batchId, trainerId, scheduledAt required' });

  const check = rejectPastDateTime(scheduledAt, null, 'Session date and time');
  if (!check.ok) return res.status(400).json({ success: false, message: check.message });

  const session = await Session.create({ ...req.body, sessionType: 'LMS' });
  await session.populate('trainerId', 'name');
  emitToRole('trainer', 'notification', { type: 'info', message: `New session scheduled: ${session.title}` });
  return res.status(201).json({ success: true, session });
});

// PUT /api/sessions/:id  [admin]
router.put('/:id', authorize('admin'), async (req, res) => {
  // Prevent accidentally changing sessionType away from LMS
  const update = { ...req.body, sessionType: 'LMS' };

  if (update.scheduledAt) {
    const check = rejectPastDateTime(update.scheduledAt, null, 'Session date and time');
    if (!check.ok) return res.status(400).json({ success: false, message: check.message });
  }

  const session = await Session.findOneAndUpdate(
    { _id: req.params.id, ...LMS_FILTER },
    update,
    { new: true, runValidators: true }
  ).populate('trainerId', 'name');
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
  return res.json({ success: true, session });
});

// DELETE /api/sessions/:id  [admin]
router.delete('/:id', authorize('admin'), async (req, res) => {
  const session = await Session.findOneAndDelete({ _id: req.params.id, ...LMS_FILTER });
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
  return res.json({ success: true, message: 'Session deleted' });
});

// POST /api/sessions/:id/start  [trainer]
router.post('/:id/start', authorize('trainer'), sessionCtrl.goLive);

// POST /api/sessions/:id/join  [trainer re-entry | trainee]
router.post('/:id/join', authorize('trainer', 'trainee'), sessionCtrl.joinSession);

// POST /api/sessions/:id/end  [trainer]
router.post('/:id/end', authorize('trainer'), sessionCtrl.endSession);

module.exports = router;
