// src/routes/workshopSessionRoutes.js
// Workshop Session API — reuses the canonical Session engine.
// sessionType: 'WORKSHOP' distinguishes these from LMS sessions.
// Participants are WorkshopPublicRegistration docs (not LMS User trainees).
'use strict';
const express       = require('express');
const mongoose      = require('mongoose');
const Session       = require('../models/Session');
const Recording     = require('../models/Recording');
const WorkshopBatch = require('../models/WorkshopBatch');
const User = require('../models/User');
const { WorkshopPublicRegistration, WorkshopAttendance, WorkshopCertificate } = require('../models/WorkshopModels');
const { protect, authorize } = require('../middleware/auth');
const { generateLiveKitToken, roomNameFor, LIVEKIT_URL, startRecording, stopRecording, roomService } = require('../services/livekitService');
const { classifyAttendance, finalizeAttendanceOnEnd, finalizeWorkshopAttendanceOnEnd } = require('../utils/attendanceUtils');
const { reconcileRecordingByEgressId, defaultRecordingStorage, resolveRecordingPlaybackAsync, recordingSourceFromSession } = require('../utils/recordingStorage');
const { rejectPastDateTime } = require('../utils/dateTimeValidation');
const { isWorkshopParticipant, syncWorkshopStudent } = require('../utils/participantValidation');
const { emitToRole, emitToSession } = require('../services/socketService');
const { applyEffectiveSessionStatus, autoCompletePastWorkshopSessions } = require('../utils/sessionStatusUtils');

const router    = express.Router();
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/** Reconcile a workshop session stuck in recordingStatus=processing (Docker/local egress). */
async function reconcileProcessingSessionRecording(session) {
  if (!session || session.recordingStatus !== 'processing') return session;

  let egressId = session.egressId;
  if (!egressId) {
    const latest = await Recording.findOne({ sessionId: session._id }).sort({ createdAt: -1 }).lean();
    egressId = latest?.egressId;
  }

  if (!egressId) {
    if (session.recordingUrl) {
      await Session.findByIdAndUpdate(session._id, { $set: { recordingStatus: 'available' } });
      return { ...session, recordingStatus: 'available' };
    }
    return session;
  }

  try {
    const reconciled = await reconcileRecordingByEgressId(egressId, { maxAttempts: 3, delayMs: 1500, markFailed: true });
    if (reconciled?.status === 'completed') {
      const update = {
        recordingStatus: 'available',
        recordingUrl: reconciled.url || session.recordingUrl,
        egressId: '',
      };
      await Session.findByIdAndUpdate(session._id, { $set: update });
      return { ...session, ...update };
    }
    if (reconciled?.status === 'failed') {
      await Session.findByIdAndUpdate(session._id, { $set: { recordingStatus: 'failed', egressId: '' } });
      return { ...session, recordingStatus: 'failed', egressId: '' };
    }
  } catch (err) {
    console.warn('Workshop recording reconcile on read:', err.message);
  }
  return session;
}

function emitWorkshopAttendanceUpdate(sessionId, payload) {
  try {
    emitToSession(sessionId.toString(), 'attendance:update', { sessionId, ...payload });
  } catch (_) {}
}

// Attendance threshold: >= 60% attendance → eligible for certificate
const ATTENDANCE_ELIGIBILITY_PCT = 60;

// ── Helper: resolve participants for a workshop batch ─────────────────────────
async function getBatchParticipants(workshopBatchId) {
  const batch = await WorkshopBatch.findById(workshopBatchId)
    .populate('registrationIds', 'fullName email phone registrationStatus')
    .lean();
  return batch?.registrationIds || [];
}

// ── Helper: verify trainer owns the workshop batch ────────────────────────────
async function assertTrainerOwnsSession(session, userId) {
  if (session.trainerId.toString() !== userId.toString()) {
    return { error: 'Forbidden — not your session', status: 403 };
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/workshop-sessions
// Admin: all workshop sessions. Trainer: only sessions for their batches.
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/', protect, authorize('admin', 'trainer'), async (req, res) => {
  try {
    const { workshopBatchId, status } = req.query;
    const filter = { sessionType: 'WORKSHOP' };
    if (workshopBatchId && isValidId(workshopBatchId)) filter.workshopBatchId = workshopBatchId;
    if (status) filter.status = status;
    if (req.user.role === 'trainer') filter.trainerId = req.user._id;

    await autoCompletePastWorkshopSessions(Session, filter);

    const sessions = await Session.find(filter)
      .populate('trainerId', 'name email profilePicture')
      .populate({ path: 'workshopBatchId', populate: { path: 'workshopId', select: 'title' } })
      .sort({ scheduledAt: -1 })
      .limit(100)
      .lean();

    let processingReconciled = 0;
    const refreshed = [];
    for (const s of sessions) {
      if (s.recordingStatus === 'processing' && processingReconciled < 3) {
        refreshed.push(await reconcileProcessingSessionRecording(s));
        processingReconciled += 1;
      } else {
        refreshed.push(s);
      }
    }

    const enriched = refreshed.map(s => applyEffectiveSessionStatus({
      ...s,
      workshopName: s.workshopBatchId?.workshopId?.title || '',
      batchName:    s.workshopBatchId?.batchName || '',
      batchCode:    s.workshopBatchId?.batchCode || '',
    }));

    return res.json({ success: true, sessions: enriched, total: enriched.length });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/workshop-sessions  [admin only]
// Schedule a new Workshop Session.
// Body: { workshopBatchId, title, scheduledAt, durationMinutes, description? }
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { workshopBatchId, title, scheduledAt, durationMinutes, description } = req.body;

    if (!workshopBatchId || !isValidId(workshopBatchId))
      return res.status(400).json({ success: false, message: 'Valid workshopBatchId is required' });
    if (!title || !title.trim())
      return res.status(400).json({ success: false, message: 'title is required' });
    if (!scheduledAt)
      return res.status(400).json({ success: false, message: 'scheduledAt is required' });

    const pastCheck = rejectPastDateTime(scheduledAt, null, 'Session date/time');
    if (!pastCheck.ok) return res.status(400).json({ success: false, message: pastCheck.message });

    const batch = await WorkshopBatch.findById(workshopBatchId)
      .populate('workshopId', 'title')
      .lean();
    if (!batch) return res.status(404).json({ success: false, message: 'Workshop batch not found' });

    const trainerId = batch.trainerId;
    if (!trainerId)
      return res.status(400).json({ success: false, message: 'No trainer assigned to this batch. Assign a trainer first.' });

    const session = await Session.create({
      sessionType:      'WORKSHOP',
      workshopBatchId:  batch._id,
      title:            title.trim(),
      description:      description || '',
      scheduledAt:      new Date(scheduledAt),
      durationMinutes:  Number(durationMinutes) || 60,
      trainerId,
      status:           'scheduled',
      joinBeforeMinutes: 15,
    });

    await session.populate('trainerId', 'name email');
    await session.populate({ path: 'workshopBatchId', populate: { path: 'workshopId', select: 'title' } });

    emitToRole('trainer', 'notification', { type: 'info', message: `New workshop session: ${session.title}` });

    return res.status(201).json({ success: true, session });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/workshop-sessions/:id
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/:id', protect, authorize('admin', 'trainer'), async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid session ID' });

    const session = await Session.findOne({ _id: req.params.id, sessionType: 'WORKSHOP' })
      .populate('trainerId', 'name email profilePicture')
      .populate({ path: 'workshopBatchId', populate: { path: 'workshopId', select: 'title date mode' } })
      .lean();

    if (!session) return res.status(404).json({ success: false, message: 'Workshop session not found' });

    if (req.user.role === 'trainer' && session.trainerId._id.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Forbidden' });

    const reconciled = await reconcileProcessingSessionRecording(session);
    return res.json({ success: true, session: applyEffectiveSessionStatus(reconciled) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /api/workshop-sessions/:id  [admin only]
// ═══════════════════════════════════════════════════════════════════════════════
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid session ID' });

    const allowed = ['title', 'description', 'scheduledAt', 'durationMinutes', 'status'];
    const update  = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    if (update.scheduledAt) {
      const pastCheck = rejectPastDateTime(update.scheduledAt, null, 'Session date/time');
      if (!pastCheck.ok) return res.status(400).json({ success: false, message: pastCheck.message });
    }

    const session = await Session.findOneAndUpdate(
      { _id: req.params.id, sessionType: 'WORKSHOP' },
      update,
      { new: true, runValidators: true }
    ).populate('trainerId', 'name email')
     .populate('workshopBatchId', 'batchName batchCode');

    if (!session) return res.status(404).json({ success: false, message: 'Workshop session not found' });
    return res.json({ success: true, session });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/workshop-sessions/:id  [admin only]
// ═══════════════════════════════════════════════════════════════════════════════
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid session ID' });

    const session = await Session.findOneAndDelete({ _id: req.params.id, sessionType: 'WORKSHOP' });
    if (!session) return res.status(404).json({ success: false, message: 'Workshop session not found' });
    return res.json({ success: true, message: 'Workshop session deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/workshop-sessions/:id/start  [trainer only]
// Trainer goes live — enforces trainer ownership + scheduled time validation.
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/:id/start', protect, authorize('trainer'), async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid session ID' });

    const session = await Session.findOne({ _id: req.params.id, sessionType: 'WORKSHOP' });
    if (!session) return res.status(404).json({ success: false, message: 'Workshop session not found' });

    const authErr = await assertTrainerOwnsSession(session, req.user._id);
    if (authErr) return res.status(authErr.status).json({ success: false, message: authErr.error });

    // ── BACKEND SCHEDULED TIME VALIDATION ──────────────────────────────────
    const now = Date.now();
    const scheduledMs = new Date(session.scheduledAt).getTime();
    const sessionEndMs = scheduledMs + (session.durationMinutes || 60) * 60000;

    // Block if current time is before the scheduled start time
    if (now < scheduledMs) {
      const minsUntilStart = Math.ceil((scheduledMs - now) / 60000);
      return res.status(409).json({
        success: false,
        message: `Session cannot start yet. It opens in approximately ${minsUntilStart} minute(s).`,
        status: 'scheduled',
        scheduledAt: session.scheduledAt,
      });
    }

    // Block if session has already ended (scheduled end time passed)
    if (now > sessionEndMs && session.status !== 'live') {
      return res.status(409).json({
        success: false,
        message: 'This session has already ended based on its scheduled time.',
        status: 'completed',
      });
    }

    // Block if session is already completed or was manually ended
    if (session.status === 'completed' || session.endedAt) {
      return res.status(409).json({
        success: false,
        message: 'This session has already ended and cannot be restarted.',
        status: 'completed',
      });
    }

    // ── END VALIDATION ─────────────────────────────────────────────────────

    const roomName = roomNameFor(session._id);
    session.roomName = roomName;

    // Ensure LiveKit room exists (recording is started manually via /recording/start)
    try {
      await roomService.createRoom({ name: roomName, emptyTimeout: 300, maxParticipants: 200 });
    } catch (err) {
      console.warn('⚠️  LiveKit room creation note:', err.message);
    }

    const wasScheduled = session.status !== 'live';
    session.status    = 'live';
    session.startedAt = session.startedAt || new Date();
    if (wasScheduled) {
      session.recordingStatus = 'none';
      session.egressId = '';
    }
    await session.save();

    // Update WorkshopBatch status to Active when session goes live
    try {
      await WorkshopBatch.findByIdAndUpdate(session.workshopBatchId, { status: 'Active' });
    } catch (_) {}

    // Update Workshop status to Live
    try {
      const batch = await WorkshopBatch.findById(session.workshopBatchId).select('workshopId').lean();
      if (batch?.workshopId) {
        const Workshop = require('../models/Workshop');
        await Workshop.findByIdAndUpdate(batch.workshopId, { status: 'Live' });
      }
    } catch (_) {}

    // Create session announcement
    try {
      const { emitToSession } = require('../services/socketService');
      emitToSession(session._id.toString(), 'session:started', {
        sessionId: session._id,
        status: 'live',
        startedAt: session.startedAt,
        roomName,
      });
      // Also notify all trainers
      emitToRole('trainer', 'session:status', {
        sessionId: session._id,
        title: session.title,
        status: 'live',
      });
    } catch (_) {}

    const token = await generateLiveKitToken(req.user, roomName, { canPublish: true });

    return res.json({ success: true, message: 'Workshop session is live', token, url: LIVEKIT_URL, roomName, role: 'trainer', session });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/workshop-sessions/:id/end  [trainer only]
// Ends session, updates batch status, updates Workshop status, emits realtime events.
// Auto-finalizes all attendance, saves Recording doc, disconnects participants.
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/:id/end', protect, authorize('trainer'), async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid session ID' });

    const session = await Session.findOne({ _id: req.params.id, sessionType: 'WORKSHOP', trainerId: req.user._id });
    if (!session) return res.status(404).json({ success: false, message: 'Workshop session not found or not yours' });

    const endedAt = new Date();
    let durationSeconds = 0;

    // Stop any active recording
    let reconcileEgressId = session.egressId;
    try {
      if (session.egressId) {
        await stopRecording(session.egressId);
        const existingRecording = await Recording.findOne({ egressId: session.egressId }).lean();
        if (existingRecording && existingRecording.startedAt) {
          durationSeconds = Math.round((endedAt.getTime() - new Date(existingRecording.startedAt).getTime()) / 1000);
        } else if (session.startedAt) {
          durationSeconds = Math.round((endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000);
        }
        await Recording.findOneAndUpdate(
          { egressId: session.egressId },
          { $set: { endedAt, durationSeconds, status: 'processing' } },
          { new: true }
        );
        if (session.recordingStatus === 'recording') session.recordingStatus = 'processing';
      }
    } catch (_) {}

    session.status  = 'completed';
    session.endedAt = endedAt;
    await session.save();

    try {
      const room = session.roomName || roomNameFor(session._id);
      if (room) await roomService.deleteRoom(room);
    } catch (_) {}

    if (reconcileEgressId) {
      try {
        const reconciled = await reconcileRecordingByEgressId(reconcileEgressId, { maxAttempts: 15, delayMs: 2000, markFailed: true });
        if (reconciled?.status === 'completed') {
          session.recordingStatus = 'available';
          session.recordingUrl = reconciled.url || session.recordingUrl;
          session.egressId = '';
          await session.save();
        } else if (reconciled?.status === 'failed') {
          session.recordingStatus = 'failed';
          session.egressId = '';
          await session.save();
        }
        try {
          const { emitToSession } = require('../services/socketService');
          emitToSession(session._id.toString(), 'recording:status', {
            sessionId: session._id,
            status: session.recordingStatus,
          });
        } catch (_) {}
      } catch (_) {}
    }

    // Update WorkshopBatch status to Completed
    try {
      await WorkshopBatch.findByIdAndUpdate(session.workshopBatchId, { status: 'Completed' });
    } catch (_) {}

    // Update Workshop status to Completed
    try {
      const batch = await WorkshopBatch.findById(session.workshopBatchId).select('workshopId').lean();
      if (batch?.workshopId) {
        const Workshop = require('../models/Workshop');
        await Workshop.findByIdAndUpdate(batch.workshopId, { status: 'Completed' });
      }
    } catch (_) {}

    // Auto-finalize attendance records for trainees still in the room
    try {
      await finalizeWorkshopAttendanceOnEnd(WorkshopAttendance, session._id, endedAt, session);
    } catch (_) {}

    // Realtime: notify all participants session ended
    try {
      const { emitToSession, emitToRole } = require('../services/socketService');
      emitToSession(session._id.toString(), 'session:ended', {
        sessionId: session._id,
        status: 'completed',
        endedAt,
        message: 'Session has ended. Attendance is locked. Feedback is now available.',
      });
      emitToRole('trainer', 'session:status', {
        sessionId: session._id,
        title: session.title,
        status: 'completed',
      });
      emitToRole('trainee', 'session:status', {
        sessionId: session._id,
        id: session._id,
        status: 'completed',
      });
    } catch (_) {}

    return res.json({
      success: true,
      message: 'Workshop session ended',
      session: applyEffectiveSessionStatus(session.toObject ? session.toObject() : session),
      endedAt,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/workshop-sessions/:id/join
// Trainer/Admin: canPublish=true. Trainee (by userId in batch.students): canPublish=true.
// Enforces join-window using Session.canJoin().
// Uses userId (via WorkshopBatch.students) instead of email matching.
// Attendance record is created with all required fields including workshopId.
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/:id/join', protect, async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid session ID' });

    const session = await Session.findOne({ _id: req.params.id, sessionType: 'WORKSHOP' });
    if (!session) return res.status(404).json({ success: false, message: 'Workshop session not found' });

    if (session.status === 'completed' || session.endedAt) {
      return res.status(409).json({
        success: false,
        message: 'This session has ended and cannot be joined',
        status: 'completed',
      });
    }

    const role = req.user.role;

    // Trainer must own the session
    if (role === 'trainer' && session.trainerId.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Forbidden — not your session' });

    // Resolve batch to validate student & get workshopId
    const batch = await WorkshopBatch.findById(session.workshopBatchId).lean();
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

    const workshopId = batch.workshopId;

    // For non-admin/non-trainer: verify the user's userId is in the batch students
    if (role !== 'admin' && role !== 'trainer') {
      const isStudent = await isWorkshopParticipant(batch, session, req.user._id, WorkshopAttendance);
      if (!isStudent) return res.status(403).json({ success: false, message: 'You are not a participant of this session' });
      await syncWorkshopStudent(session.workshopBatchId, req.user._id, WorkshopBatch);
    }

    const now = Date.now();
    const scheduledMs = new Date(session.scheduledAt).getTime();
    if (now < scheduledMs) {
      return res.status(409).json({ success: false, message: 'Session is not joinable at this time', status: session.status });
    }

    if (!session.canJoin())
      return res.status(409).json({ success: false, message: 'Session is not joinable at this time', status: session.status });

    const roomName  = roomNameFor(session._id);
    const isHost    = role === 'trainer' || role === 'admin';
    const token     = await generateLiveKitToken(req.user, roomName, { canPublish: isHost });

    // Auto-create attendance record on join with ALL required fields validated
    // Use sessionId + studentId as unique key (never workshopId alone)
    const attendanceData = {
      sessionId:        session._id,
      workshopBatchId:  session.workshopBatchId,
      workshopId:       workshopId, // Resolved from batch - never null
      studentId:        req.user._id,
      attendanceStatus: 'Present',
      joinTime:         new Date(),
    };

    // Validate required fields before upsert
    if (!attendanceData.sessionId || !attendanceData.studentId) {
      return res.status(500).json({ success: false, message: 'Cannot create attendance: missing session or student reference' });
    }

    try {
      await WorkshopAttendance.findOneAndUpdate(
        { sessionId: session._id, studentId: req.user._id },
        {
          $set: {
            joinTime: new Date(),
            attendanceStatus: 'Present',
            workshopBatchId: session.workshopBatchId,
            workshopId: workshopId,
          },
          $setOnInsert: {
            sessionId: session._id,
            studentId: req.user._id,
          },
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
    } catch (attErr) {
      console.error('Attendance creation error:', attErr.message);
      // Non-blocking: allow join even if attendance fails
    }

    try {
      emitWorkshopAttendanceUpdate(session._id, {
        studentId: req.user._id,
        attendanceStatus: 'Present',
      });
    } catch (_) {}

    return res.json({ success: true, token, url: LIVEKIT_URL, roomName, role: isHost ? 'trainer' : 'student' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/workshop-sessions/:id/participants
// Returns participants for the workshop batch + their attendance for this session.
// Participants are WorkshopPublicRegistration docs — NOT LMS User trainees.
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/:id/participants', protect, authorize('admin', 'trainer'), async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid session ID' });

    const session = await Session.findOne({ _id: req.params.id, sessionType: 'WORKSHOP' }).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Workshop session not found' });

    if (req.user.role === 'trainer' && session.trainerId.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Forbidden' });

    const batch = await WorkshopBatch.findById(session.workshopBatchId)
      .populate('registrationIds', 'fullName email phone registrationStatus userId')
      .lean();
    const registrations = batch?.registrationIds || [];

    // Attendance records scoped to this specific session
    const attendanceRecords = await WorkshopAttendance.find({ sessionId: session._id }).lean();

    const attMap = {};
    attendanceRecords.forEach(a => {
      const key = a.studentId?.toString();
      if (key) attMap[key] = a;
    });

    // Build participant list: prefer matching by userId (User ObjectId) so attendance
    // keyed by studentId aligns correctly. Fall back to registration _id if userId
    // is not set yet (e.g., public registration without a User account).
    const result = registrations.map(p => {
      const userId = p.userId?._id || p.userId;
      const matchKey = userId ? userId.toString() : p._id.toString();
      return {
        _id:                p._id,
        fullName:           p.fullName,
        email:              p.email,
        phone:              p.phone,
        registrationStatus: p.registrationStatus,
        userId:             userId,
        attendance:         attMap[matchKey] || null,
      };
    });

    return res.json({ success: true, participants: result, total: result.length });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/workshop-sessions/:id/attendance/mark  [trainer/admin]
// Manually mark attendance for a workshop participant.
// Body: { participantId, status, joinTime?, leaveTime?, attendedMinutes? }
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/:id/attendance/mark', protect, authorize('admin', 'trainer'), async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid session ID' });

    const session = await Session.findOne({ _id: req.params.id, sessionType: 'WORKSHOP' }).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Workshop session not found' });

    if (req.user.role === 'trainer' && session.trainerId.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Forbidden' });

    const { participantId, status, joinTime, leaveTime, attendedMinutes } = req.body;
    if (!participantId || !status)
      return res.status(400).json({ success: false, message: 'participantId and status are required' });

    const validStatuses = ['Present', 'Absent', 'Late', 'Partial'];
    if (!validStatuses.includes(status))
      return res.status(400).json({ success: false, message: `status must be one of: ${validStatuses.join(', ')}` });

    // participantId must resolve to a User account (trainee dashboard keys by userId)
    let studentId = null;
    if (isValidId(participantId)) {
      const reg = await WorkshopPublicRegistration.findOne({
        $or: [{ _id: participantId }, { userId: participantId }],
      }).select('userId registrationStatus').lean();
      if (reg?.userId) {
        studentId = reg.userId;
      } else {
        const user = await User.findById(participantId).select('_id role').lean();
        if (user?.role === 'trainee') studentId = user._id;
      }
    }
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'Participant must have a linked user account to record attendance',
      });
    }

    const batch = await WorkshopBatch.findById(session.workshopBatchId).select('registrationIds students workshopId').lean();
    if (batch) {
      const uid = studentId.toString();
      const inStudents = (batch.students || []).some(s => s.toString() === uid);
      const inRegs = await WorkshopPublicRegistration.countDocuments({
        _id: { $in: batch.registrationIds || [] },
        userId: studentId,
        registrationStatus: 'Approved',
      });
      if (!inStudents && !inRegs)
        return res.status(400).json({ success: false, message: 'Participant is not in this workshop batch' });
    }

    const scheduledDurationMin = session.durationMinutes || 60;
    const mins = Number(attendedMinutes) || 0;
    const pct  = scheduledDurationMin > 0 ? Math.min(100, Math.round((mins / scheduledDurationMin) * 100)) : 0;

    const record = await WorkshopAttendance.findOneAndUpdate(
      { sessionId: session._id, studentId },
      {
        sessionId:        session._id,
        workshopBatchId:  session.workshopBatchId,
        workshopId:       batch?.workshopId || undefined,
        studentId,
        attendanceStatus: status,
        joinTime:         joinTime  ? new Date(joinTime)  : undefined,
        leaveTime:        leaveTime ? new Date(leaveTime) : undefined,
        duration:         mins,
        attendancePct:    pct,
        markedBy:         req.user._id,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Auto-mark certificate eligibility — resolve actual workshopId from batch
    if (pct >= ATTENDANCE_ELIGIBILITY_PCT) {
      const batchDoc = await WorkshopBatch.findById(session.workshopBatchId).select('workshopId').lean();
      if (batchDoc?.workshopId) {
        await WorkshopCertificate.findOneAndUpdate(
          { workshopId: batchDoc.workshopId, studentId },
          { workshopId: batchDoc.workshopId, studentId, status: 'Eligible' },
          { upsert: true, setDefaultsOnInsert: true }
        );
      }
    }

    emitWorkshopAttendanceUpdate(session._id, {
      studentId,
      attendanceStatus: record?.attendanceStatus,
      attendancePct: pct,
    });

    return res.json({ success: true, record });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/workshop-sessions/:id/attendance  [trainer/admin]
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/:id/attendance', protect, authorize('admin', 'trainer'), async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid session ID' });

    const session = await Session.findOne({ _id: req.params.id, sessionType: 'WORKSHOP' }).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Workshop session not found' });

    if (req.user.role === 'trainer' && session.trainerId.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Forbidden' });

    // Attendance records scoped to this specific session
    const records = await WorkshopAttendance.find({ sessionId: session._id })
      .populate('studentId', 'name email profilePicture')
      .lean();

    const enriched = records.map(r => ({
      ...r,
      participant: r.studentId || null,
    }));

    return res.json({ success: true, records: enriched, total: enriched.length });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/workshop-sessions/:id/announcement  [trainer only]
// Broadcasts an announcement to all session participants via Socket.IO.
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/:id/announcement', protect, authorize('trainer'), async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid session ID' });

    const session = await Session.findOne({ _id: req.params.id, sessionType: 'WORKSHOP' }).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Workshop session not found' });

    if (session.trainerId.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Forbidden' });

    const { message } = req.body;
    if (!message || !message.trim())
      return res.status(400).json({ success: false, message: 'Message is required' });

    // Emit via Socket.IO to all participants in this session room
    const { emitToSession } = require('../services/socketService');
    const announcement = {
      id: new mongoose.Types.ObjectId().toString(),
      message: message.trim(),
      trainerName: req.user.name || 'Trainer',
      trainerId: req.user._id,
      timestamp: new Date().toISOString(),
    };
    emitToSession(session._id.toString(), 'announcement:new', announcement);

    return res.json({ success: true, announcement });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/workshop-sessions/:id/recording/start  [trainer only]
// Starts recording via LiveKit Egress, saves Recording doc in MongoDB.
router.post('/:id/recording/start', protect, authorize('trainer'), async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid session ID' });

    const session = await Session.findOne({ _id: req.params.id, sessionType: 'WORKSHOP' });
    if (!session) return res.status(404).json({ success: false, message: 'Workshop session not found' });

    if (session.trainerId.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Forbidden' });

    if (session.status !== 'live') {
      return res.status(409).json({ success: false, message: 'Session must be live before starting a recording. Click Go Live first.' });
    }

    if (session.recordingStatus === 'recording') {
      return res.status(409).json({ success: false, message: 'Recording is already in progress' });
    }
    if (session.recordingStatus === 'processing') {
      return res.status(409).json({ success: false, message: 'A recording is still processing. Please wait before starting a new one.' });
    }
    if (session.recordingStatus === 'failed') {
      session.recordingStatus = 'none';
    }

    const roomName = roomNameFor(session._id);
    session.roomName = roomName;

    try {
      await roomService.createRoom({ name: roomName, emptyTimeout: 300, maxParticipants: 200 });
    } catch (err) {
      console.warn('⚠️  LiveKit room ensure note:', err.message);
    }

    // Start recording via LiveKit
    let egressId = '';
    try {
      egressId = await startRecording(roomName);
      if (!egressId) throw new Error('No egress ID returned by LiveKit');
    } catch (err) {
      console.error('Workshop recording start failed:', {
        sessionId: session._id,
        roomName,
        error: err.message,
        code: err.code,
      });
      const status = err.message?.includes('S3') || err.message?.includes('not configured') ? 503 : 500;
      return res.status(status).json({ success: false, message: 'Failed to start recording: ' + err.message });
    }

    // Save Recording document in MongoDB
    const recording = await Recording.create({
      sessionId: session._id,
      trainerId: req.user._id,
      egressId,
      roomName,
      status: 'active',
      storage: defaultRecordingStorage(),
      startedAt: new Date(),
    });

    // Update session
    session.egressId = egressId;
    session.recordingStatus = 'recording';
    if (!session.recordings.includes(recording._id)) {
      session.recordings.push(recording._id);
    }
    await session.save();

    // Emit realtime event
    try {
      const { emitToSession } = require('../services/socketService');
      emitToSession(session._id.toString(), 'recording:status', {
        sessionId: session._id,
        recordingId: recording._id,
        status: 'recording',
        startedAt: recording.startedAt,
      });
    } catch (_) {}

    return res.json({ success: true, message: 'Recording started', recording, egressId });
  } catch (err) {
    console.error('Workshop recording start endpoint error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/workshop-sessions/:id/recording/stop  [trainer only]
// Stops the recording, calculates duration, saves Recording doc in MongoDB.
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/:id/recording/stop', protect, authorize('trainer'), async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid session ID' });

    const session = await Session.findOne({ _id: req.params.id, sessionType: 'WORKSHOP' });
    if (!session) return res.status(404).json({ success: false, message: 'Workshop session not found' });

    if (session.trainerId.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Forbidden' });

    let durationSeconds = 0;
    let endedAt = new Date();
    let recordingDoc = null;

    // Stop via LiveKit
    try {
      await stopRecording(session.egressId);
    } catch (_) {}

    // Calculate duration from recording start, not session start
    const existingRecording = await Recording.findOne({ egressId: session.egressId }).lean();
    if (existingRecording && existingRecording.startedAt) {
      durationSeconds = Math.round((endedAt.getTime() - new Date(existingRecording.startedAt).getTime()) / 1000);
    } else if (session.startedAt) {
      durationSeconds = Math.round((endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000);
    }

    // Update the Recording document if it exists
    recordingDoc = await Recording.findOneAndUpdate(
      { egressId: session.egressId },
      {
        $set: {
          status: 'processing',
          endedAt,
          durationSeconds,
        },
      },
      { new: true }
    );

    session.recordingStatus = 'processing';
    await session.save();

    const stoppedEgressId = session.egressId;

    // Await reconcile (same as LMS) so recording finalizes before response when possible
    let finalRecordingStatus = 'processing';
    try {
      const reconciled = await reconcileRecordingByEgressId(stoppedEgressId, { maxAttempts: 15, delayMs: 2000, markFailed: true });
      if (reconciled) recordingDoc = reconciled;
      const freshSession = await Session.findById(session._id);
      if (freshSession) {
        if (recordingDoc?.status === 'completed') {
          freshSession.recordingStatus = 'available';
          freshSession.recordingUrl = recordingDoc.url || freshSession.recordingUrl;
          freshSession.egressId = '';
          finalRecordingStatus = 'available';
        } else if (recordingDoc?.status === 'failed') {
          freshSession.recordingStatus = 'failed';
          freshSession.egressId = '';
          finalRecordingStatus = 'failed';
        } else if (recordingDoc?.status === 'processing') {
          freshSession.recordingStatus = 'processing';
          finalRecordingStatus = 'processing';
        }
        await freshSession.save();
      }
    } catch (recErr) {
      console.warn('Workshop recording reconcile:', recErr.message);
    }

    try {
      emitToSession(session._id.toString(), 'recording:status', {
        sessionId: session._id,
        recordingId: recordingDoc?._id,
        status: finalRecordingStatus,
        endedAt,
        durationSeconds,
      });
    } catch (_) {}

    return res.json({
      success: true,
      message: finalRecordingStatus === 'available'
        ? 'Recording stopped and saved'
        : finalRecordingStatus === 'failed'
          ? 'Recording stopped but processing failed'
          : 'Recording stopped and processing',
      recording: recordingDoc,
      recordingStatus: finalRecordingStatus,
      durationSeconds,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/workshop-sessions/:id/recording/playback  [trainer/admin]
router.get('/:id/recording/playback', protect, authorize('trainer', 'admin'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid session ID' });
    }
    const filter = { _id: req.params.id, sessionType: 'WORKSHOP' };
    if (req.user.role === 'trainer') filter.trainerId = req.user._id;
    const session = await Session.findOne(filter).lean();
    if (!session) {
      return res.status(404).json({ success: false, message: 'Workshop session not found' });
    }
    if (!session.recordingUrl && session.recordingStatus !== 'available') {
      return res.status(404).json({ success: false, message: 'No recording available for this session' });
    }

    const recordingDoc = await Recording.findOne({ sessionId: session._id, status: 'completed' })
      .sort({ createdAt: -1 })
      .lean();
    const source = recordingDoc || recordingSourceFromSession(session);
    if (!source) {
      return res.status(404).json({ success: false, message: 'Recording not found' });
    }

    const { url, playable } = await resolveRecordingPlaybackAsync(source);
    if (!playable || !url) {
      return res.status(404).json({ success: false, message: 'Recording file is not available for playback' });
    }
    return res.json({ success: true, url, playable, expiresIn: 3600 });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/workshop-sessions/:id/leave  [any authenticated user]
// Records leftAt, calculates duration, updates completion eligibility.
// Supports reconnect: accumulates intervals via $inc on duration.
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/:id/leave', protect, async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid session ID' });

    const session = await Session.findOne({ _id: req.params.id, sessionType: 'WORKSHOP' }).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Workshop session not found' });

    const now = new Date();
    const existing = await WorkshopAttendance.findOne({ sessionId: session._id, studentId: req.user._id });
    if (!existing) return res.json({ success: true, message: 'No attendance record found' });

    const joinTime  = existing.joinTime || new Date(session.scheduledAt);
    const intervalSec = Math.max(0, Math.round((now.getTime() - joinTime.getTime()) / 1000));
    const totalSec    = (session.durationMinutes || 60) * 60;
    const newDuration = Math.min(existing.duration + Math.round(intervalSec / 60), session.durationMinutes || 60);
    const pct         = totalSec > 0 ? Math.min(100, Math.round((newDuration / (session.durationMinutes || 60)) * 100)) : 0;

    const COMPLETION_THRESHOLD = 75; // 75% attendance = completion eligible
    const completionEligible   = pct >= COMPLETION_THRESHOLD;

    const updated = await WorkshopAttendance.findOneAndUpdate(
      { sessionId: session._id, studentId: req.user._id },
      {
        $set: {
          leaveTime:        now,
          duration:         newDuration,
          attendancePct:    pct,
          attendanceStatus: pct >= 75 ? 'Present' : pct >= 25 ? 'Partial' : 'Absent',
        },
      },
      { new: true }
    );

    // Update certificate eligibility
    if (completionEligible) {
      const batchDoc = await WorkshopBatch.findById(session.workshopBatchId).select('workshopId').lean();
      if (batchDoc?.workshopId) {
        await WorkshopCertificate.findOneAndUpdate(
          { workshopId: batchDoc.workshopId, studentId: req.user._id },
          { workshopId: batchDoc.workshopId, studentId: req.user._id, status: 'Eligible' },
          { upsert: true, setDefaultsOnInsert: true }
        );
      }
    }

    emitWorkshopAttendanceUpdate(session._id, {
      studentId: req.user._id,
      attendanceStatus: updated?.attendanceStatus,
      attendancePct: pct,
    });

    return res.json({ success: true, record: updated, completionEligible, attendancePct: pct });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
