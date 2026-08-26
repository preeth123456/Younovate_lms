// src/controllers/sessionController.js  — CORRECTED
'use strict';
const Session   = require('../models/Session');
const Recording = require('../models/Recording');
const { AccessToken } = require('livekit-server-sdk');

const {
  generateLiveKitToken,
  stopRecording,
  roomNameFor,
  roomService,
  LIVEKIT_URL,
} = require('../services/livekitService');

const { emitToRole, emitToUser, emitToSession } = require('../services/socketService');
const Attendance = require('../models/Attendance');
const { classifyAttendance, finalizeAttendanceOnEnd } = require('../utils/attendanceUtils');
const { reconcileRecordingByEgressId } = require('../utils/recordingStorage');

// ════════════════════════════════════════════════════════════════════
// Basic CRUD (unchanged behaviour, kept for completeness)
// ════════════════════════════════════════════════════════════════════

// LMS-only filter — same logic as sessionRoutes.js
const LMS_FILTER = { $or: [{ sessionType: 'LMS' }, { sessionType: { $exists: false } }, { sessionType: null }] };

const getSessions = async (req, res) => {
  const { status, batchId, limit = 50, page = 1 } = req.query;
  const filter = { ...LMS_FILTER };
  if (req.user.role === 'trainer') filter.trainerId = req.user._id;
  if (req.user.role === 'trainee') filter.batchId  = { $in: req.user.batchIds || [] };
  if (status)  filter.status  = status;
  if (batchId) filter.batchId = batchId;

  const sessions = await Session.find(filter)
    .populate('trainerId', 'name avatar')
    .populate('batchId', 'name')
    .sort({ scheduledAt: -1 })
    .limit(Number(limit))
    .skip((Number(page) - 1) * Number(limit));

  const total = await Session.countDocuments(filter);
  res.json({ success: true, sessions, total, page: Number(page) });
};

const getSessionById = async (req, res) => {
  const session = await Session.findById(req.params.id)
    .populate('trainerId', 'name email avatar')
    .populate('batchId', 'name');
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
  res.json({ success: true, session });
};

const createSession = async (req, res) => {
  // Always stamp sessionType: 'LMS' so Workshop sessions never appear here
  const session = await Session.create({ ...req.body, sessionType: 'LMS', trainerId: req.user._id });
  await session.populate('trainerId', 'name avatar');
  emitToRole('trainer', 'notification', { type: 'info', message: `New session: ${session.title}` });
  res.status(201).json({ success: true, session });
};

const updateSession = async (req, res) => {
  const session = await Session.findByIdAndUpdate(req.params.id, req.body, {
    new: true, runValidators: true,
  }).populate('trainerId', 'name avatar');
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
  res.json({ success: true, session });
};

const deleteSession = async (req, res) => {
  const session = await Session.findByIdAndDelete(req.params.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
  res.json({ success: true, message: 'Session deleted' });
};

// ════════════════════════════════════════════════════════════════════
// LIVE SESSION — the trainer↔trainee communication core
// ════════════════════════════════════════════════════════════════════

// POST /api/trainer/sessions/:id/start   (trainer "Go Live")
// → marks the session live, fixes the canonical room name, returns a
//   PUBLISH token so the trainer can stream camera/mic immediately.
//   Recording is best-effort: if egress isn't configured the session
//   still goes live (recording must never block the class).
const goLive = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    if (String(session.trainerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not your session' });
    }

    const now = Date.now();
    const scheduledMs = new Date(session.scheduledAt).getTime();
    if (!isNaN(scheduledMs) && now < scheduledMs) {
      return res.status(400).json({
        success: false,
        message: `Session cannot start before the scheduled time`,
      });
    }
    if (session.status === 'completed') {
      return res.status(409).json({ success: false, message: 'Session is already completed and cannot be restarted' });
    }

    const roomName = roomNameFor(session._id);   // ← canonical, shared by trainees

    // Already live — return a fresh token so the trainer can re-enter
    if (session.status === 'live') {
      const token = await generateLiveKitToken(req.user, session.roomName || roomName, { canPublish: true });
      return res.json({
        success:  true,
        message:  'Session is live',
        token,
        url:      LIVEKIT_URL,
        roomName: session.roomName || roomName,
        role:     'trainer',
        session,
      });
    }

    // Recording is manual — trainer uses POST /:id/recording/start
    try {
      await roomService.createRoom({ name: roomName, emptyTimeout: 300, maxParticipants: 200 });
    } catch (_) {}
    session.status          = 'live';
    session.roomName        = roomName;
    session.startedAt       = new Date();
    session.recordingStatus = 'none';
    session.egressId        = '';
    await session.save();

    const token = await generateLiveKitToken(req.user, roomName, { canPublish: true });

    // Tell trainees in real time that the room is open.
    emitToRole('trainee', 'session:status', { id: String(session._id), status: 'live' });
    (session.trainees || []).forEach((t) =>
      emitToUser(String(t), 'session:live', { sessionId: String(session._id), title: session.title })
    );

    return res.json({
      success:  true,
      message:  'Session is live',
      token,
      url:      LIVEKIT_URL,
      roomName,
      role:     'trainer',
      session,
    });
  } catch (err) {
    console.error('goLive error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/trainee/sessions/:id/join   (trainee joins as VIEWER)
// → SUBSCRIBE-only media token (no camera/mic) + canPublishData for chat.
const joinSession = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.status !== 'live') {
      return res.status(409).json({ success: false, message: 'Session is not live yet' });
    }

    const isTrainer = String(session.trainerId) === String(req.user._id);

    // Trainer re-joining their own live session — publish token, no attendance row
    if (isTrainer) {
      const roomName = session.roomName || roomNameFor(session._id);
      const token    = await generateLiveKitToken(req.user, roomName, { canPublish: true });
      return res.json({ success: true, token, url: LIVEKIT_URL, roomName, role: 'trainer' });
    }

    // membership check (trainees)
    const batchIds   = (req.user.batchIds || []).map(String);
    const inBatch    = session.batchId && batchIds.includes(String(session.batchId));
    const isEnrolled = (session.trainees || []).some((t) => String(t) === String(req.user._id));
    if (!inBatch && !isEnrolled) {
      return res.status(403).json({ success: false, message: 'You are not enrolled in this session' });
    }

    if (session.passcode && req.body?.passcode !== session.passcode) {
      return res.status(403).json({ success: false, message: 'Invalid passcode' });
    }

    // Canonical room — IDENTICAL to the trainer's go-live room (roomNameFor),
    // so the trainee actually joins the trainer's room.
    const roomName = roomNameFor(session._id);
    const token    = await generateLiveKitToken(req.user, roomName, { canPublish: false });

    // ── Capture attendance: create or update the trainee's record ────────────
    try {
      const now = new Date();
      let att = await Attendance.findOne({ session: session._id, trainee: req.user._id });
      if (!att) {
        att = new Attendance({ session: session._id, trainee: req.user._id, batch: session.batchId });
      }
      if (!att.joinedAt) att.joinedAt = now;
      const { status } = classifyAttendance({ session, joinedAt: att.joinedAt, leftAt: null });
      att.status = status; att.source = 'self'; att.markedAt = now;
      if (session.batchId && !att.batch) att.batch = session.batchId;
      await att.save();
    } catch (attErr) {
      console.warn('Attendance join-capture failed (joining anyway):', attErr.message);
    }

    return res.json({ success: true, token, url: LIVEKIT_URL, roomName, role: 'student' });
  } catch (err) {
    console.error('joinSession error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// PUT/POST /api/trainer/sessions/:id/end
const endSession = async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, trainerId: req.user._id });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const stoppedEgressId = session.egressId;

    try { await stopRecording(stoppedEgressId); } catch (_) { /* webhook still finalises */ }

    if (stoppedEgressId) {
      try {
        const endedAt = new Date();
        const recording = await Recording.findOne({ egressId: stoppedEgressId }).lean();
        let durationSeconds = 0;
        if (recording && recording.startedAt) {
          durationSeconds = Math.round((endedAt.getTime() - new Date(recording.startedAt).getTime()) / 1000);
        } else if (session.startedAt) {
          durationSeconds = Math.round((endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000);
        }
        await Recording.findOneAndUpdate(
          { egressId: stoppedEgressId },
          { $set: { endedAt, durationSeconds, status: recording?.status === 'completed' ? 'completed' : 'processing' } },
          { new: true }
        );
        if (session.recordingStatus === 'recording') session.recordingStatus = 'processing';
      } catch (_) {}
    }

    session.status  = 'completed';
    session.endedAt = new Date();
    await session.save();

    if (stoppedEgressId) {
      try {
        const reconciled = await reconcileRecordingByEgressId(stoppedEgressId, { maxAttempts: 15, delayMs: 2000, markFailed: true });
        if (reconciled?.status === 'completed') {
          session.recordingStatus = 'available';
          session.recordingUrl = reconciled.url || session.recordingUrl;
          session.egressId = '';
        } else if (reconciled?.status === 'failed') {
          session.recordingStatus = 'failed';
          session.egressId = '';
        }
        await session.save();
        try {
          emitToSession(session._id.toString(), 'recording:status', {
            sessionId: session._id,
            status: session.recordingStatus,
          });
        } catch (_) {}
      } catch (recErr) {
        console.warn('LMS end recording reconcile:', recErr.message);
      }
    }

    await session.populate('batchId', 'name');

    // ── Finalize attendance for trainees still connected ─────────────────────
    // Any trainee whose Attendance record has no `leftAt` is treated as having
    // stayed until the session ended, so their record is finalized with the
    // correct overlap-based status instead of being left provisional.
    try {
      const endedAt = new Date();
      await finalizeAttendanceOnEnd(Attendance, session._id, endedAt, session);
    } catch (finalizeErr) {
      console.warn('Attendance finalization on end failed:', finalizeErr.message);
    }

    emitToRole('trainee', 'session:status', { id: String(session._id), status: 'completed' });

    return res.json({ success: true, message: 'Session ended', session });
  } catch (err) {
    console.error('endSession error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/livekit/token
// Backward-compatible token endpoint. Accepts BOTH request shapes:
//   • Trainer Dashboard.jsx →  { room, identity, name }   (room === session._id)
//   • Newer components      →  { sessionId }
// Role (canPublish) is derived from the SESSION when possible so the client
// can't promote itself; it falls back to the JWT role, then to a body hint.
const getToken = async (req, res) => {
  try {
    const body = req.body || {};

    // Accept ANY shape the various callers send: { room }, { sessionId }, a bare
    // session id, or a room that already carries a "session_" / "session-" prefix.
    // Whatever arrives, resolve it down to the bare session id and then rebuild
    // the ONE canonical room name with roomNameFor(). This is the fix that makes
    // the trainer (who sends room=<id>) and the trainees (who join "session_<id>")
    // land in the EXACT same LiveKit room — without it they were in different rooms
    // and could not see/hear/chat each other.
    const rawRoom = String(body.room || body.sessionId || '');
    if (!rawRoom) {
      return res.status(400).json({
        success: false,
        message: 'room (or sessionId) is required',
      });
    }
    const sessionId = rawRoom.replace(/^session[_-]/, '');   // strip any prefix → bare id
    let room = roomNameFor(sessionId);                        // canonical "session_<id>"

    const apiKey    = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl     = process.env.LIVEKIT_URL;
    if (!apiKey || !apiSecret || !wsUrl) {
      console.error('[livekit] missing env →', { key: !!apiKey, secret: !!apiSecret, url: !!wsUrl });
      return res.status(500).json({ success: false, message: 'LiveKit is not configured on the server.' });
    }

    // Load the session (by the bare id parsed above) to set the role securely.
    let session = null;
    try { session = await Session.findById(sessionId); } catch (_) { /* not a valid id */ }

    const user = req.user || null;   // present only if the route is behind `protect`
    let canPublish;
    if (session && user)      canPublish = String(session.trainerId) === String(user._id);
    else if (user)            canPublish = user.role === 'trainer';
    else                      canPublish = (body.role || 'trainer') !== 'student'; // legacy unauth path

    const identity = body.identity || (user ? String(user._id) : `guest-${Date.now()}`);
    const name     = body.name || user?.name || (canPublish ? 'Trainer' : 'Trainee');

    const at = new AccessToken(apiKey, apiSecret, { identity, name, ttl: '3h' });
    at.addGrant({
      roomJoin:       true,
      room,
      canPublish,
      canSubscribe:   true,
      canPublishData: true,        // everyone can chat
      roomRecord:     canPublish,
      roomAdmin:      canPublish,
    });

    const token = await at.toJwt();
    return res.json({ success: true, token, url: wsUrl, role: canPublish ? 'trainer' : 'student' });
  } catch (err) {
    console.error('getToken error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getSessions,
  getSessionById,
  createSession,
  updateSession,
  deleteSession,
  goLive,        // trainer go-live (returns publish token)
  joinSession,   // trainee join (returns viewer token)
  endSession,
  getToken,
};