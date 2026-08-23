'use strict';
const express    = require('express');
const path       = require('path');
const fs         = require('fs');
const mongoose   = require('mongoose');
const Session    = require('../models/Session');
const Assignment = require('../models/Assignment');
const Attendance = require('../models/Attendance');
const Batch      = require('../models/Batch');
const WorkshopBatch = require('../models/WorkshopBatch');
const User       = require('../models/User');
const Recording  = require('../models/Recording');
const LmsFeedback = require('../models/LmsFeedback');
const { protect, authorize } = require('../middleware/auth');
const sessionCtrl = require('../controllers/sessionController');

const { resolveRecordingPlayback, reconcileRecordingByEgressId } = require('../utils/recordingStorage');
const { rejectPastDateTime } = require('../utils/dateTimeValidation');

const router = express.Router();
router.use(protect, authorize('trainer'));

const RECORDINGS_DIR = path.join(__dirname, '..', '..', '..', 'lms-recordings');
const BASE_RECORDING_URL = (process.env.PUBLIC_API_URL || 'http://localhost:8080').replace(/\/+$/, '');

// LMS-only filter — never return WORKSHOP sessions from LMS endpoints
const LMS_FILTER = { $or: [{ sessionType: 'LMS' }, { sessionType: { $exists: false } }, { sessionType: null }] };

async function resolveBatchId(batch) {
  if (!batch) return null;
  const raw = String(batch).trim();
  if (mongoose.Types.ObjectId.isValid(raw)) {
    const byId = await Batch.findById(raw).select('_id').lean();
    if (byId) return byId._id;
  }
  const byName = await Batch.findOne({ name: raw }).select('_id').lean();
  return byName?._id || null;
}

// POST /api/trainer/sessions/:id/start  (Go Live)
router.post('/sessions/:id/start', sessionCtrl.goLive);

// GET /api/trainer/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const trainerId = req.user._id;

    const [
      upcomingSessions,
      liveSessions,
      pendingGrades,
      totalTrainees,
      trainees,
      myWorkshopBatches,
      workshopSessions,
      workshopLiveSessions,
      workshopParticipantsCount,
      workshopStats,
    ] = await Promise.all([
      // LMS sessions only
      Session.find({ trainerId, status: 'scheduled', scheduledAt: { $gte: new Date() }, ...LMS_FILTER })
        .populate('batchId', 'name').sort('scheduledAt').limit(5),
      Session.find({ trainerId, status: 'live', ...LMS_FILTER })
        .populate('batchId', 'name').limit(3),
      Assignment.countDocuments({ createdBy: trainerId, 'submissions.status': 'submitted' }),
      User.countDocuments({ role: 'trainee', isActive: true }),
      User.find({ role: 'trainee', isActive: true }).select('-password').populate('batchIds', 'name').limit(100).lean(),

      WorkshopBatch.find({ trainerId })
        .populate('workshopId', 'title date mode status')
        .sort({ createdAt: -1 })
        .lean(),

      Session.find({ trainerId, sessionType: 'WORKSHOP', status: { $in: ['scheduled', 'live'] } })
        .populate({ path: 'workshopBatchId', populate: { path: 'workshopId', select: 'title' } })
        .sort({ scheduledAt: -1 })
        .lean(),

      Session.find({ trainerId, sessionType: 'WORKSHOP', status: 'live' })
        .populate({ path: 'workshopBatchId', populate: { path: 'workshopId', select: 'title' } })
        .lean(),

      WorkshopBatch.aggregate([
        { $match: { trainerId: trainerId } },
        { $group: { _id: null, totalParticipants: { $sum: { $size: { $ifNull: ['$registrationIds', []] } } } } },
      ]),

      (async () => {
        const myBatches = await WorkshopBatch.find({ trainerId }).lean();
        const total     = myBatches.length;
        const completed = myBatches.filter(b => b.status === 'Completed').length;
        const active    = myBatches.filter(b => b.status === 'Active' || b.status === 'Scheduled').length;
        const totalParticipants = myBatches.reduce((sum, b) => sum + (b.registrationIds?.length || 0), 0);
        return { total, completed, active, totalParticipants };
      })(),
    ]);

    return res.json({
      success: true,
      upcomingSessions,
      liveSessions,
      pendingGrades,
      totalTrainees,
      trainees,
      myWorkshopBatches,
      workshopSessions,
      workshopLiveSessions,
      workshopParticipantsCount: workshopParticipantsCount[0]?.totalParticipants || 0,
      workshopStats,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trainer/sessions?status=
// LMS sessions ONLY — Workshop sessions served by /api/workshop-sessions
router.get('/sessions', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { trainerId: req.user._id, ...LMS_FILTER };
    if (status) filter.status = status;
    const sessions = await Session.find(filter)
      .populate('batchId', 'name')
      .sort('-scheduledAt')
      .limit(50);
    return res.json({ success: true, sessions });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trainer/sessions/:id
router.get('/sessions/:id', async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, trainerId: req.user._id, ...LMS_FILTER })
      .populate('batchId', 'name')
      .populate('trainerId', 'name email profilePicture');
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    return res.json({ success: true, session });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/trainer/sessions
// Always stamps sessionType: 'LMS'
router.post('/sessions', async (req, res) => {
  try {
    const {
      batch,
      moduleId,
      sessionType,
      scheduledAt,
      recordingLink,
      recordingUrl,
      title,
      durationMinutes,
      description,
      trainees,
      topics,
      resources,
      passcode,
      timezone,
    } = req.body;

    if (!moduleId || !sessionType || !scheduledAt) {
      return res.status(400).json({ success: false, message: 'moduleId, sessionType and scheduledAt are required' });
    }

    const check = rejectPastDateTime(scheduledAt, null, 'Session date and time');
    if (!check.ok) return res.status(400).json({ success: false, message: check.message });

    const batchId = await resolveBatchId(batch);

    const session = await Session.create({
      title:           title || `${moduleId} — ${sessionType}`,
      description:     description || '',
      moduleId,
      lmsModuleId:     moduleId,
      sessionType:     'LMS',
      scheduledAt:     new Date(scheduledAt),
      durationMinutes: durationMinutes != null ? Number(durationMinutes) : 60,
      recordingUrl:    recordingUrl || recordingLink || '',
      timezone:        timezone || undefined,
      passcode:        passcode || '',
      topics:          Array.isArray(topics) ? topics : undefined,
      resources:       Array.isArray(resources) ? resources : undefined,
      trainees:        Array.isArray(trainees) ? trainees : [],
      status:          'scheduled',
      trainerId:       req.user._id,
      batchId:         batchId || undefined,
    });

    await session.populate('batchId', 'name');
    return res.status(201).json({ success: true, session });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/trainer/sessions/:id
router.put('/sessions/:id', async (req, res) => {
  try {
    const allowed = [
      'title', 'scheduledAt', 'status', 'recordingUrl', 'recordingLink',
      'description', 'durationMinutes', 'batchId', 'trainees', 'topics',
      'resources', 'passcode', 'timezone', 'roomName', 'moduleId', 'lmsModuleId',
    ];
    const update = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    if (update.recordingLink && !update.recordingUrl) {
      update.recordingUrl = update.recordingLink;
    }
    delete update.recordingLink;

    if (req.body.batch !== undefined) {
      update.batchId = await resolveBatchId(req.body.batch);
    }

    if (update.moduleId && !update.lmsModuleId) update.lmsModuleId = update.moduleId;

    // Never allow changing sessionType away from LMS
    update.sessionType = 'LMS';

    if (update.scheduledAt) {
      const check = rejectPastDateTime(update.scheduledAt, null, 'Session date and time');
      if (!check.ok) return res.status(400).json({ success: false, message: check.message });
      update.scheduledAt = new Date(update.scheduledAt);
    }

    if (update.durationMinutes != null) {
      update.durationMinutes = Number(update.durationMinutes);
    }

    const session = await Session.findOneAndUpdate(
      { _id: req.params.id, trainerId: req.user._id, ...LMS_FILTER },
      update,
      { new: true, runValidators: true }
    ).populate('batchId', 'name');

    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    return res.json({ success: true, session });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/trainer/sessions/:id/end
router.put('/sessions/:id/end', sessionCtrl.endSession);

// DELETE /api/trainer/sessions/:id
router.delete('/sessions/:id', async (req, res) => {
  try {
    const session = await Session.findOneAndDelete({ _id: req.params.id, trainerId: req.user._id, ...LMS_FILTER });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    return res.json({ success: true, message: 'Session deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trainer/assignments
router.get('/assignments', async (req, res) => {
  try {
    const assignments = await Assignment.find({ createdBy: req.user._id })
      .populate('batchId', 'name')
      .sort('-createdAt');
    return res.json({ success: true, assignments });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trainer/students
router.get('/students', async (req, res) => {
  try {
    const trainerId = req.user._id;

    const [workshopBatches, lmsSessions, lmsBatches] = await Promise.all([
      WorkshopBatch.find({ trainerId })
        .populate('students', 'name email phone profilePicture batchIds')
        .populate('workshopId', 'title')
        .lean(),

      Session.find({ trainerId, ...LMS_FILTER })
        .populate('batchId', 'name')
        .populate('trainees', 'name email phone profilePicture batchIds')
        .lean(),

      Session.find({ trainerId, ...LMS_FILTER })
        .distinct('batchId')
        .lean(),
    ]);

    const batchIds = lmsBatches.filter(Boolean).map(b => b.batchId || b);

    const batchTrainees = batchIds.length > 0
      ? await User.find({ role: 'trainee', isActive: true, batchIds: { $in: batchIds } })
          .select('name email phone profilePicture batchIds')
          .lean()
      : [];

    const studentMap = new Map();

    for (const batch of workshopBatches) {
      for (const student of (batch.students || [])) {
        if (student?._id) {
          const existing = studentMap.get(student._id.toString()) || {};
          studentMap.set(student._id.toString(), {
            ...existing,
            ...student,
            batchName:     existing.batchName || batch.batchName,
            workshopTitle: existing.workshopTitle || batch.workshopId?.title || '',
            source:        'workshop',
          });
        }
      }
    }

    for (const session of lmsSessions) {
      for (const trainee of (session.trainees || [])) {
        if (trainee?._id) {
          const existing = studentMap.get(trainee._id.toString()) || {};
          studentMap.set(trainee._id.toString(), {
            ...existing,
            ...trainee,
            batchName:     existing.batchName || session.batchId?.name || '',
            workshopTitle: existing.workshopTitle || '',
            source:        existing.source || 'lms',
          });
        }
      }
    }

    for (const trainee of batchTrainees) {
      if (trainee?._id) {
        const existing = studentMap.get(trainee._id.toString()) || {};
        const batchIdArr = (trainee.batchIds || []).map(b => b.toString());
        const batchName = existing.batchName || '';
        studentMap.set(trainee._id.toString(), {
          ...existing,
          ...trainee,
          batchName:     existing.batchName || batchName,
          workshopTitle: existing.workshopTitle || '',
          source:        existing.source || 'lms',
        });
      }
    }

    const students = Array.from(studentMap.values());
    return res.status(200).json({ success: true, count: students.length, students });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/trainer/assignments/:id/grade/:submissionId
router.put('/assignments/:id/grade/:submissionId', async (req, res) => {
  try {
    const { grade, feedback, allowResubmit } = req.body;
    if (grade === undefined || grade === null)
      return res.status(400).json({ success: false, message: 'grade is required' });

    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

    const sub = assignment.submissions.id(req.params.submissionId);
    if (!sub) return res.status(404).json({ success: false, message: 'Submission not found' });

    Object.assign(sub, {
      grade:         Number(grade),
      feedback:      feedback || '',
      status:        'graded',
      gradedBy:      req.user._id,
      gradedAt:      new Date(),
      allowResubmit: Boolean(allowResubmit),
    });

    await assignment.save();
    return res.json({ success: true, submission: sub });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trainer/attendance/session/:sessionId
router.get('/attendance/session/:sessionId', async (req, res) => {
  try {
    const records = await Attendance.find({ session: req.params.sessionId })
      .populate('trainee', 'name email profilePicture')
      .populate('session', 'title scheduledAt status')
      .populate('batch', 'name');
    return res.json({ success: true, records });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/trainer/sessions/:id/recording/start
const startRecordingSession = async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, trainerId: req.user._id, ...LMS_FILTER });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (String(session.trainerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not your session' });
    }
    if (session.recordingStatus === 'recording') {
      return res.status(409).json({ success: false, message: 'Recording is already in progress' });
    }
    if (session.recordingStatus === 'processing') {
      return res.status(409).json({ success: false, message: 'A recording is still processing. Please wait before starting a new one.' });
    }
    const { startRecording, stopRecording, roomNameFor, roomService } = require('../services/livekitService');
    const Recording = require('../models/Recording');
    const roomName = session.roomName || roomNameFor(session._id);
    try {
      await roomService.createRoom({ name: roomName, emptyTimeout: 300, maxParticipants: 200 });
    } catch (_) {}
    let egressId = '';
    try {
      egressId = await startRecording(roomName);
      if (egressId) {
        try {
          const recording = await Recording.create({
            sessionId: session._id,
            batchId: session.batchId,
            trainerId: session.trainerId,
            egressId,
            roomName,
            status: 'active',
            startedAt: new Date(),
          });
          session.recordings.push(recording._id);
          session.recordingStatus = 'recording';
          session.egressId = egressId;
          session.roomName = roomName;
          await session.save();
          return res.json({ success: true, message: 'Recording started', session, recording });
        } catch (dbErr) {
          try { await stopRecording(egressId); } catch (_) {}
          console.error('Recording MongoDB save failed:', dbErr.message);
          return res.status(500).json({
            success: false,
            message: 'Recording started but failed to save to database: ' + dbErr.message,
          });
        }
      }
    } catch (err) {
      console.warn('Recording start failed:', err.message);
      return res.status(500).json({ success: false, message: 'Failed to start recording: ' + err.message });
    }
    return res.status(500).json({ success: false, message: 'No egress ID returned' });
  } catch (err) {
    console.error('startRecordingSession error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/trainer/sessions/:id/recording/stop
const stopRecordingSession = async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, trainerId: req.user._id, ...LMS_FILTER });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (String(session.trainerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not your session' });
    }
    if (session.recordingStatus !== 'recording') {
      return res.status(409).json({ success: false, message: 'No active recording to stop' });
    }
    const { stopRecording } = require('../services/livekitService');
    const Recording = require('../models/Recording');
    const existingRecording = await Recording.findOne({ egressId: session.egressId }).lean();
    if (existingRecording && existingRecording.status === 'completed') {
      return res.status(409).json({ success: false, message: 'Recording has already completed' });
    }
    try { await stopRecording(session.egressId); } catch (_) { /* webhook will finalise */ }
    session.recordingStatus = 'processing';
    await session.save();

    const endedAt = new Date();
    let durationSeconds = 0;
    if (existingRecording && existingRecording.startedAt) {
      durationSeconds = Math.round((endedAt.getTime() - new Date(existingRecording.startedAt).getTime()) / 1000);
    } else if (session.startedAt) {
      durationSeconds = Math.round((endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000);
    }
    await Recording.findOneAndUpdate(
      { egressId: session.egressId },
      { $set: { status: 'processing', endedAt, durationSeconds } },
      { new: true }
    );

    const stoppedEgressId = session.egressId;
    let recordingDoc = null;
    try {
      recordingDoc = await reconcileRecordingByEgressId(stoppedEgressId, { maxAttempts: 15, delayMs: 2000, markFailed: true });
      if (recordingDoc?.status === 'completed') {
        session.recordingStatus = 'available';
        session.recordingUrl = recordingDoc.url || session.recordingUrl;
        session.egressId = '';
        await session.save();
      } else if (recordingDoc?.status === 'failed') {
        session.recordingStatus = 'failed';
        session.egressId = '';
        await session.save();
      }
    } catch (recErr) {
      console.warn('LMS recording reconcile:', recErr.message);
    }

    return res.json({
      success: true,
      message: recordingDoc?.status === 'completed'
        ? 'Recording saved and available'
        : recordingDoc?.status === 'failed'
          ? 'Recording processing failed'
          : 'Recording stopped and processing',
      session,
      recording: recordingDoc,
    });
  } catch (err) {
    console.error('stopRecordingSession error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

router.post('/sessions/:id/recording/start', startRecordingSession);
router.post('/sessions/:id/recording/stop', stopRecordingSession);

// GET /api/trainer/recordings — trainer's own recordings
router.get('/recordings', async (req, res) => {
  try {
    const recordings = await Recording.find({ trainerId: req.user._id })
      .populate('sessionId', 'title sessionType scheduledAt status')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    // Repair stuck recordings when MP4 already exists on disk
    const stuck = recordings.filter(
      (r) => r.egressId && ['processing', 'active'].includes(r.status)
    );
    for (const r of stuck.slice(0, 8)) {
      try { await reconcileRecordingByEgressId(r.egressId, { maxAttempts: 2, delayMs: 500 }); } catch (_) {}
    }

    const fresh = stuck.length
      ? await Recording.find({ trainerId: req.user._id })
          .populate('sessionId', 'title sessionType scheduledAt status')
          .sort({ createdAt: -1 })
          .limit(200)
          .lean()
      : recordings;

    const enriched = fresh.map(r => {
      const { url, playable } = resolveRecordingPlayback(r);
      return { ...r, url, playable };
    });

    return res.json({ success: true, recordings: enriched });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trainer/recordings/:id — single recording with validation
router.get('/recordings/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid recording ID' });
    }
    let recording = await Recording.findById(req.params.id)
      .populate('sessionId', 'title sessionType scheduledAt status')
      .lean();
    if (!recording) {
      return res.status(404).json({ success: false, message: 'Recording not found' });
    }

    if (recording.egressId && ['processing', 'active'].includes(recording.status)) {
      try {
        const reconciled = await reconcileRecordingByEgressId(recording.egressId, { maxAttempts: 5, delayMs: 1000 });
        if (reconciled) recording = reconciled;
      } catch (_) {}
    }

    const { url, playable } = resolveRecordingPlayback(recording);

    return res.json({ success: true, recording: { ...recording, playable, url } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trainer/lms-feedback — feedback for sessions taught by this trainer
router.get('/lms-feedback', async (req, res) => {
  try {
    const feedback = await LmsFeedback.find({ trainerId: req.user._id })
      .populate('sessionId', 'title scheduledAt sessionType status')
      .populate('studentId', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, feedback });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
