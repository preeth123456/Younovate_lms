// routes/sessions.js — LMS session lifecycle for trainer + trainees
// Workshop sessions are served exclusively by /api/workshop-sessions
'use strict';
const express = require('express');
const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const auth = require('../middleware/auth');
const { roomService, stopRecording, roomNameFor, generateLiveKitToken, LIVEKIT_URL } = require('../services/livekitService');
const { AccessToken } = require('livekit-server-sdk');
const { classifyAttendance, finalizeAttendanceOnEnd } = require('../utils/attendanceUtils');
const { reconcileRecordingByEgressId } = require('../utils/recordingStorage');

const router = express.Router();

const uid = (req) => String(req.user.id || req.user._id);

function toScheduledAt({ scheduledAt, date, time }) {
  if (scheduledAt) return new Date(scheduledAt);
  if (date && time) return new Date(`${date}T${time}`);
  if (date) return new Date(date);
  return null;
}

// LMS-only filter — never return WORKSHOP sessions
const LMS_FILTER = {
  $or: [{ sessionType: 'LMS' }, { sessionType: { $exists: false } }, { sessionType: null }],
};

// GET /api/sessions
router.get('/', auth, async (req, res) => {
  try {
    const me = uid(req);
    const filter = {
      $and: [
        LMS_FILTER,
        { $or: [{ trainerId: me }, { trainees: me }] },
      ],
    };
    if (req.query.batchId) filter.batchId = req.query.batchId;
    if (req.query.status)  filter.status  = req.query.status;

    const sessions = await Session.find(filter)
      .populate('trainerId', 'name email')
      .sort({ scheduledAt: -1 });

    res.json(sessions);
  } catch (err) {
    console.error('list sessions error ->', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/sessions — always stamps sessionType: 'LMS'
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role && req.user.role !== 'trainer') {
      return res.status(403).json({ message: 'Only trainers can create sessions' });
    }

    const { title, description, batchId, durationMinutes, topics, resources, trainees, timezone, passcode } = req.body || {};
    const scheduledAt = toScheduledAt(req.body || {});

    if (!title)       return res.status(400).json({ message: 'title is required' });
    if (!scheduledAt) return res.status(400).json({ message: 'scheduledAt (or date/time) is required' });

    const session = await Session.create({
      title,
      description,
      batchId,
      scheduledAt,
      durationMinutes,
      timezone,
      passcode,
      topics,
      resources,
      sessionType: 'LMS',
      trainerId: uid(req),
      trainees: Array.isArray(trainees) ? trainees : [],
    });

    session.roomName = roomNameFor(session._id);
    await session.save();

    res.status(201).json(session);
  } catch (err) {
    console.error('create session error ->', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/sessions/:id/enroll
router.post('/:id/enroll', auth, async (req, res) => {
  try {
    const me = uid(req);
    const session = await Session.findOne({ _id: req.params.id, ...LMS_FILTER });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (['completed', 'cancelled'].includes(session.status)) {
      return res.status(409).json({ message: `Cannot enroll in a ${session.status} session` });
    }
    if (String(session.trainerId) === me) {
      return res.status(400).json({ message: 'You are the trainer/host of this session' });
    }

    await Session.updateOne({ _id: session._id }, { $addToSet: { trainees: me } });
    const updated = await Session.findById(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('enroll error ->', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/sessions/:id/start
router.post('/:id/start', auth, async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, ...LMS_FILTER });
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (String(session.trainerId) !== uid(req)) {
      return res.status(403).json({ message: 'Only the trainer can start this session' });
    }

    const roomName = roomNameFor(req.params.id);

    session.roomName = roomName;

    await roomService.createRoom({ name: roomName, emptyTimeout: 300, maxParticipants: 200 });

    // Recording is manual — trainer uses POST /api/trainer/sessions/:id/recording/start
    session.status          = 'live';
    session.startedAt       = session.startedAt || new Date();
    session.recordingStatus = 'none';
    session.egressId        = '';
    await session.save();

    const token = await generateLiveKitToken(req.user, roomName, { canPublish: true });

    res.json({ session, roomName: session.roomName, token, url: LIVEKIT_URL });
  } catch (err) {
    console.error('start session error ->', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/sessions/:id/join
router.post('/:id/join', auth, async (req, res) => {
  try {
    const me = uid(req);
    const session = await Session.findOne({ _id: req.params.id, ...LMS_FILTER });
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (session.status !== 'live') return res.status(409).json({ message: 'Session is not live' });

    const isTrainer  = String(session.trainerId) === me;
    const isEnrolled = (session.trainees || []).some((t) => String(t) === me);
    if (!isTrainer && !isEnrolled) {
      return res.status(403).json({ message: 'You are not enrolled in this session' });
    }

    if (!isTrainer && session.passcode && req.body?.passcode !== session.passcode) {
      return res.status(403).json({ message: 'Invalid passcode' });
    }

    const role     = isTrainer ? 'trainer' : 'student';
    const identity = `${role}-${me}`;
    const roomName = roomNameFor(session._id);

    const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET,
      { identity, name: req.user.name, ttl: '3h' });
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: isTrainer,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: isTrainer,
    });

    if (!isTrainer) {
      try {
        const Attendance = require('../models/Attendance');
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
    }

    res.json({ token: await at.toJwt(), url: process.env.LIVEKIT_URL, role });
  } catch (err) {
    console.error('join error ->', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/sessions/:id/end
router.post('/:id/end', auth, async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, ...LMS_FILTER });
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (String(session.trainerId) !== uid(req)) {
      return res.status(403).json({ message: 'Only the trainer can end this session' });
    }

    const stoppedEgressId = session.egressId;

    if (stoppedEgressId) {
      try { await stopRecording(stoppedEgressId); }
      catch (e) { console.error('stop recording failed ->', e.message); }
      session.recordingStatus = 'processing';
    }
    try { await roomService.deleteRoom(session.roomName); } catch (_) {}

    session.status  = 'completed';
    session.endedAt = new Date();
    await session.save();

    if (stoppedEgressId) {
      try {
        const Recording = require('../models/Recording');
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
      } catch (_) {}
    }

    try {
      const Attendance = require('../models/Attendance');
      const endedAt = new Date();
      await finalizeAttendanceOnEnd(Attendance, session._id, endedAt, session);
    } catch (finalizeErr) {
      console.warn('Attendance finalization on end failed:', finalizeErr.message);
    }

    res.json(session);
  } catch (err) {
    console.error('end session error ->', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
