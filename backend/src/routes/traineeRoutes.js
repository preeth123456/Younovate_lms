'use strict';
const express    = require('express');
const mongoose   = require('mongoose');
const Session    = require('../models/Session');
const Attendance = require('../models/Attendance');
const Assignment = require('../models/Assignment');
const Batch      = require('../models/Batch');
const Enrollment = require('../models/Enrollment');
const LessonProgress = require('../models/LessonProgress');
const Course     = require('../models/Course');
const WorkshopBatch = require('../models/WorkshopBatch');
const User = require('../models/User');
const LmsFeedback = require('../models/LmsFeedback');
const Recording = require('../models/Recording');
const { resolveRecordingPlaybackAsync, recordingSourceFromSession } = require('../utils/recordingStorage');
const { WorkshopAttendance, WorkshopCertificate } = require('../models/WorkshopModels');
const { protect, authorize } = require('../middleware/auth');

const {
  generateLiveKitToken,
  roomNameFor,
  LIVEKIT_URL,
} = require('../services/livekitService');
const { classifyAttendance } = require('../utils/attendanceUtils');
const { applyEffectiveSessionStatus, autoCompletePastWorkshopSessions } = require('../utils/sessionStatusUtils');
const {
  hasLmsAttendance,
  isWorkshopParticipant,
  hasWorkshopAttendance,
  getWorkshopBatchIdsForUser,
  getLmsAttendedSessionIds,
  getWorkshopAttendedSessionIds,
  syncWorkshopStudent,
  optionalRatings,
} = require('../utils/participantValidation');

const router = express.Router();
router.use(protect, authorize('trainee'));

const LMS_FILTER = { $or: [{ sessionType: 'LMS' }, { sessionType: { $exists: false } }, { sessionType: null }] };

const traineeSessionFilter = (user) => ({
  $or: [
    { batchId:  { $in: user.batchIds || [] } },
    { trainees: user._id },
  ],
});

function ensureEnrolled(session, user) {
  const batchIds   = (user.batchIds || []).map(String);
  const inBatch    = session.batchId && batchIds.includes(String(session.batchId?._id || session.batchId));
  const isEnrolled = (session.trainees || []).some((t) => String(t?._id || t) === String(user._id));
  return inBatch || isEnrolled;
}

// GET /api/trainee/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const base = traineeSessionFilter(req.user);
    const userId = req.user._id;

    const [
      upcomingSessions,
      pendingAssignments,
      totalAttendance,
      presentAttendance,
      myWorkshopBatches,
      workshopUpcomingSessions,
      workshopLiveSessions,
      workshopAttendanceSummary,
      workshopCertificates,
    ] = await Promise.all([
      Session.find({ ...base, status: { $in: ['scheduled', 'live'] } })
        .populate('trainerId', 'name').sort('scheduledAt').limit(5),
      
      // Count trainee's pending assignments (not submitted)
      Assignment.aggregate([
        { $match: { batchId: { $in: req.user.batchIds || [] }, status: 'active' } },
        { $unwind: '$submissions' },
        { $match: { 'submissions.trainee': userId } },
        { $count: 'count' }
      ]).then(r => r[0]?.count || 0),

      Attendance.countDocuments({ trainee: userId }),
      Attendance.countDocuments({ trainee: userId, status: { $in: ['present', 'late'] } }),

      WorkshopBatch.find({ students: userId })
        .populate('workshopId', 'title date mode status')
        .sort({ createdAt: -1 })
        .lean(),

      (async () => {
        const myBatches = await WorkshopBatch.find({ students: userId }).select('_id').lean();
        const batchIds = myBatches.map(b => b._id);
        return Session.find({
          sessionType: 'WORKSHOP',
          workshopBatchId: { $in: batchIds },
          status: { $in: ['scheduled', 'live'] },
        })
          .populate('trainerId', 'name email profilePicture')
          .populate({ path: 'workshopBatchId', populate: { path: 'workshopId', select: 'title date mode' } })
          .sort({ scheduledAt: 1 })
          .limit(50)
          .lean();
      })(),

      (async () => {
        const myBatches = await WorkshopBatch.find({ students: userId }).select('_id').lean();
        const batchIds = myBatches.map(b => b._id);
        return Session.find({
          sessionType: 'WORKSHOP',
          workshopBatchId: { $in: batchIds },
          status: 'live',
        })
          .populate('trainerId', 'name email profilePicture')
          .populate({ path: 'workshopBatchId', populate: { path: 'workshopId', select: 'title date mode' } })
          .sort({ startedAt: -1 })
          .lean();
      })(),

      (async () => {
        const myBatches = await WorkshopBatch.find({ students: userId }).select('_id workshopId').lean();
        const batchIds = myBatches.map(b => b._id);
        const records = await WorkshopAttendance.find({
          workshopBatchId: { $in: batchIds },
          studentId: userId,
        }).lean();
        const total = records.length;
        const present = records.filter(r => ['Present', 'Late', 'Partial'].includes(r.attendanceStatus)).length;
        return { total, present, percentage: total ? ((present / total) * 100).toFixed(1) : '0.0' };
      })(),

      (async () => {
        const myBatches = await WorkshopBatch.find({ students: userId }).select('workshopId').lean();
        const workshopIds = myBatches.map(b => b.workshopId).filter(Boolean);
        return WorkshopCertificate.find({
          workshopId: { $in: workshopIds },
          studentId: userId,
        })
          .populate('workshopId', 'title')
          .sort({ createdAt: -1 })
          .lean();
      })(),
    ]);

    const pct = totalAttendance ? ((presentAttendance / totalAttendance) * 100).toFixed(1) : '0.0';

    return res.json({
      success: true,
      upcomingSessions,
      pendingAssignments,
      attendance: { total: totalAttendance, present: presentAttendance, percentage: pct },
      myWorkshopBatches,
      workshopUpcomingSessions,
      workshopLiveSessions,
      workshopAttendance: workshopAttendanceSummary,
      workshopCertificates,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trainee/sessions?status=
// LMS sessions ONLY — Workshop sessions served by /api/trainee/workshop-sessions
// ?forFeedback=1 — completed sessions the trainee attended (feedback eligibility)
router.get('/sessions', async (req, res) => {
  try {
    const forFeedback = req.query.forFeedback === '1' || req.query.forFeedback === 'true';
    let filter;

    if (forFeedback) {
      const attendedIds = await getLmsAttendedSessionIds(Attendance, req.user._id);
      if (!attendedIds.length) return res.json({ success: true, sessions: [] });
      filter = {
        $and: [
          LMS_FILTER,
          { _id: { $in: attendedIds } },
          { status: 'completed' },
        ],
      };
    } else {
      const attendedIds = await Attendance.find({ trainee: req.user._id }).distinct('session');
      filter = {
        $and: [
          LMS_FILTER,
          {
            $or: [
              ...traineeSessionFilter(req.user).$or,
              ...(attendedIds.length ? [{ _id: { $in: attendedIds } }] : []),
            ],
          },
          ...(req.query.status ? [{ status: req.query.status }] : []),
        ],
      };
    }

    const sessions = await Session.find(filter)
      .populate('trainerId', 'name profilePicture')
      .populate('batchId', 'name')
      .sort('-scheduledAt')
      .limit(forFeedback ? 200 : 50)
      .lean();

    const now = Date.now();
    const enriched = sessions.map(s => {
      const scheduledMs = new Date(s.scheduledAt).getTime();
      const joinBeforeMs = (s.joinBeforeMinutes || 10) * 60000;
      const endsAtMs = scheduledMs + (s.durationMinutes || 60) * 60000;
      const joinableFromMs = scheduledMs - joinBeforeMs;
      const canJoin = s.status === 'live' || (s.status === 'scheduled' && now >= joinableFromMs && now <= endsAtMs);
      const secondsUntilStart = Math.max(0, Math.round((joinableFromMs - now) / 1000));
      return { ...s, canJoin, secondsUntilStart, endsAt: new Date(endsAtMs).toISOString() };
    });

    return res.json({ success: true, sessions: enriched });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/trainee/sessions/:id/join
router.post('/sessions/:id/join', async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.status !== 'live') {
      return res.status(409).json({ success: false, message: 'Session is not live yet' });
    }
    if (!ensureEnrolled(session, req.user)) {
      return res.status(403).json({ success: false, message: 'You are not enrolled in this session' });
    }
    if (session.passcode && req.body?.passcode !== session.passcode) {
      return res.status(403).json({ success: false, message: 'Invalid passcode' });
    }

    const roomName = roomNameFor(session._id);
    const token = await generateLiveKitToken(req.user, roomName, {
      canPublish: true, roomAdmin: false, roomRecord: false,
    });

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

    return res.json({ success: true, token, url: LIVEKIT_URL, roomName, role: 'student', canPublish: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/trainee/sessions/:id/attendance/leave
router.post('/sessions/:id/attendance/leave', async (req, res) => {
  try {
    const session = await Session.findById(req.params.id).select('scheduledAt durationMinutes batchId trainees');
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (!ensureEnrolled(session, req.user)) {
      return res.status(403).json({ success: false, message: 'You are not enrolled in this session' });
    }

    const now = new Date();
    let att = await Attendance.findOne({ session: session._id, trainee: req.user._id });
    if (!att) {
      att = new Attendance({ session: session._id, trainee: req.user._id, batch: session.batchId, joinedAt: now });
    }
    att.leftAt = now;
    const { status, attendedSeconds } = classifyAttendance({ session, joinedAt: att.joinedAt || now, leftAt: now });
    att.status = status; att.attendedSeconds = attendedSeconds; att.source = 'self'; att.markedAt = now;
    if (session.batchId && !att.batch) att.batch = session.batchId;
    await att.save();

    return res.json({ success: true, record: { status: att.status, joinedAt: att.joinedAt, leftAt: att.leftAt, attendedSeconds: att.attendedSeconds } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trainee/assignments
router.get('/assignments', async (req, res) => {
  try {
    const assignments = await Assignment.find({ batchId: { $in: req.user.batchIds || [] }, status: { $ne: 'draft' } }).sort('-dueDate');
    const enriched = assignments.map((a) => {
      const sub = a.submissions.find((s) => s.trainee.toString() === req.user._id.toString());
      return { ...a.toObject(), mySubmission: sub || null };
    });
    return res.json({ success: true, assignments: enriched });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/trainee/assignments/:id/submit
router.post('/assignments/:id/submit', async (req, res) => {
  try {
    const { submissionUrl, notes } = req.body;
    if (!submissionUrl) return res.status(400).json({ success: false, message: 'submissionUrl required' });
    const assignment = await Assignment.findOne({ _id: req.params.id, batchId: { $in: req.user.batchIds || [] }, status: 'active' });
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found or closed' });
    assignment.submissions = assignment.submissions.filter((s) => s.trainee.toString() !== req.user._id.toString());
    assignment.submissions.push({ trainee: req.user._id, submissionUrl, notes: notes || '', submittedAt: new Date(), status: 'submitted' });
    await assignment.save();
    return res.status(201).json({ success: true, submission: assignment.submissions[assignment.submissions.length - 1] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trainee/attendance
router.get('/attendance', async (req, res) => {
  try {
    const records = await Attendance.find({ trainee: req.user._id }).populate('session', 'title scheduledAt durationMinutes').sort({ createdAt: -1 });
    const total = records.length;
    const present = records.filter((r) => ['present', 'late'].includes(r.status)).length;
    return res.json({ success: true, records, stats: { total, present, percentage: total ? ((present / total) * 100).toFixed(1) : '0.0' } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trainee/sessions/:id/recording/playback — presigned URL for an enrolled trainee.
// Mirrors the trainer playback endpoint but scopes access to the trainee's own
// sessions (batch/trainee-list membership or attendance record). Never returns
// the raw private S3 URL — only a temporary presigned GET URL (1h).
router.get('/sessions/:id/recording/playback', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid session ID' });
    }
    const session = await Session.findOne({ _id: req.params.id, ...LMS_FILTER }).lean();
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    const enrolled = ensureEnrolled(session, req.user);
    const attended = enrolled || await Attendance.exists({ trainee: req.user._id, session: session._id });
    if (!attended) {
      return res.status(403).json({ success: false, message: 'Not enrolled in this session' });
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

// GET /api/trainee/workshop-sessions/:id/recording/playback — same, for workshop trainees.
// Access: trainee's workshop batch membership or workshop attendance record.
router.get('/workshop-sessions/:id/recording/playback', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid session ID' });
    }
    const session = await Session.findOne({ _id: req.params.id, sessionType: 'WORKSHOP' }).lean();
    if (!session) {
      return res.status(404).json({ success: false, message: 'Workshop session not found' });
    }
    const batchIds = await getWorkshopBatchIdsForUser(req.user._id, WorkshopBatch);
    const inBatch = session.workshopBatchId && batchIds.map(String).includes(String(session.workshopBatchId));
    const attended = inBatch || await WorkshopAttendance.exists({ studentId: req.user._id, sessionId: session._id });
    if (!attended) {
      return res.status(403).json({ success: false, message: 'Not enrolled in this session' });
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
// GET /api/trainee/profile
router.get('/profile', (req, res) => res.json({ success: true, user: req.user.toPublic() }));
// GET /api/trainee/placement - read-only placement result for the logged-in trainee (HR writes, trainee reads)
router.get('/placement', async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select('name email placementStatus placementNote companyName ctc placementUpdatedAt').lean();
    if (!me) return res.status(404).json({ success: false, message: 'User not found' });
    const InterviewM = require('../models/Interview');
    const OfferM = require('../models/Offer');
    const PlacementM = require('../models/Placement');
    const EvaluationM = require('../models/Evaluation');
    const [interviews, offers, placements, evaluations] = await Promise.all([
      InterviewM.find({ trainee: req.user._id }).populate('company', 'name').populate('job', 'title').sort({ scheduledAt: -1 }).lean(),
      OfferM.find({ candidate: req.user._id }).populate('company', 'name').populate('job', 'title').sort({ createdAt: -1 }).lean(),
      PlacementM.find({ candidate: req.user._id }).populate('company', 'name').populate('job', 'title').sort({ createdAt: -1 }).lean(),
      EvaluationM.find({ candidate: req.user._id }).sort({ createdAt: -1 }).lean(),
    ]);
    return res.json({ success: true, status: me.placementStatus, note: me.placementNote || '', companyName: me.companyName || '', ctc: me.ctc || '', updatedAt: me.placementUpdatedAt || null, interviews, offers, placements, evaluations });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

// WORKSHOP ROUTES

// GET /api/trainee/workshop-batches
router.get('/workshop-batches', async (req, res) => {
  try {
    const batchIds = await getWorkshopBatchIdsForUser(req.user._id, WorkshopBatch);
    if (!batchIds.length) return res.json({ success: true, batches: [] });
    const batches = await WorkshopBatch.find({ _id: { $in: batchIds } })
      .populate('workshopId', 'title date mode status')
      .populate('trainerId', 'name email profilePicture')
      .sort({ createdAt: -1 }).lean();
    return res.json({ success: true, batches });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trainee/workshop-sessions
// ?forFeedback=1 — completed workshop sessions the trainee attended
router.get('/workshop-sessions', async (req, res) => {
  try {
    const userId = req.user._id;
    const forFeedback = req.query.forFeedback === '1' || req.query.forFeedback === 'true';
    const batchIds = await getWorkshopBatchIdsForUser(userId, WorkshopBatch);
    const attendedIds = await getWorkshopAttendedSessionIds(WorkshopAttendance, userId);

    let filter;
    if (forFeedback) {
      if (!attendedIds.length) return res.json({ success: true, sessions: [] });
      filter = {
        sessionType: 'WORKSHOP',
        _id: { $in: attendedIds },
        status: 'completed',
      };
    } else {
      const scope = [];
      if (batchIds.length) scope.push({ workshopBatchId: { $in: batchIds } });
      if (attendedIds.length) scope.push({ _id: { $in: attendedIds } });
      if (!scope.length) return res.json({ success: true, sessions: [] });

      filter = {
        sessionType: 'WORKSHOP',
        ...(scope.length === 1 ? scope[0] : { $or: scope }),
      };
      if (req.query.status) filter.status = req.query.status;
    }

    await autoCompletePastWorkshopSessions(Session, filter);

    const sessions = await Session.find(filter)
      .populate('trainerId', 'name email profilePicture')
      .populate({ path: 'workshopBatchId', populate: { path: 'workshopId', select: 'title date mode' } })
      .sort({ scheduledAt: 1 }).lean();

    const now = Date.now();
    const enriched = sessions.map(s => {
      const withStatus = applyEffectiveSessionStatus(s, now);
      const scheduledMs = new Date(withStatus.scheduledAt).getTime();
      const joinBeforeMs = (withStatus.joinBeforeMinutes || 10) * 60000;
      const endsAtMs = scheduledMs + (withStatus.durationMinutes || 60) * 60000;
      const joinableFromMs = scheduledMs - joinBeforeMs;
      const canJoin = withStatus.status === 'live';
      const secondsUntilStart = Math.max(0, Math.round((joinableFromMs - now) / 1000));
      return { ...withStatus, canJoin, secondsUntilStart, endsAt: new Date(endsAtMs).toISOString() };
    });

    return res.json({ success: true, sessions: enriched });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/trainee/workshop-sessions/:id/join
router.post('/workshop-sessions/:id/join', async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, sessionType: 'WORKSHOP' });
    if (!session) return res.status(404).json({ success: false, message: 'Workshop session not found' });

    const batch = await WorkshopBatch.findById(session.workshopBatchId).select('students workshopId registrationIds').lean();
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

    const isStudent = await isWorkshopParticipant(batch, session, req.user._id, WorkshopAttendance);
    if (!isStudent) return res.status(403).json({ success: false, message: 'You are not a participant of this session' });

    await syncWorkshopStudent(session.workshopBatchId, req.user._id, WorkshopBatch);

    const effective = applyEffectiveSessionStatus(session.toObject ? session.toObject() : session);
    if (effective.status === 'completed') {
      return res.status(409).json({
        success: false,
        message: 'This session has ended and cannot be joined',
        status: 'completed',
      });
    }
    if (effective.status !== 'live') {
      return res.status(409).json({
        success: false,
        message: 'Session is not live yet',
        status: effective.status,
      });
    }

    const roomName = roomNameFor(session._id);
    const token = await generateLiveKitToken(req.user, roomName, { canPublish: true, roomAdmin: false });

    // Validate required fields before upsert
    const attendanceData = {
      sessionId:        session._id,
      workshopBatchId:  session.workshopBatchId,
      workshopId:       batch.workshopId, // Resolved from batch - never null
      studentId:        req.user._id,
      attendanceStatus: 'Present',
      joinTime:         new Date(),
    };

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
            workshopId: batch.workshopId,
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

    return res.json({ success: true, token, url: LIVEKIT_URL, roomName, role: 'student' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/trainee/workshop-sessions/:id/leave
router.post('/workshop-sessions/:id/leave', async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, sessionType: 'WORKSHOP' }).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Workshop session not found' });

    const now = new Date();
    const existing = await WorkshopAttendance.findOne({ sessionId: session._id, studentId: req.user._id });
    if (!existing) return res.json({ success: true, message: 'No attendance record found' });

    const joinTime = existing.joinTime || new Date(session.scheduledAt);
    const intervalMin = Math.max(0, Math.round((now.getTime() - joinTime.getTime()) / 60000));
    const totalMin = session.durationMinutes || 60;
    const newDuration = Math.min(existing.duration + intervalMin, totalMin);
    const pct = Math.min(100, Math.round((newDuration / totalMin) * 100));
    const status = pct >= 75 ? 'Present' : pct >= 25 ? 'Partial' : 'Absent';

    const updated = await WorkshopAttendance.findOneAndUpdate(
      { sessionId: session._id, studentId: req.user._id },
      { $set: { leaveTime: now, duration: newDuration, attendancePct: pct, attendanceStatus: status } },
      { new: true }
    );

    if (pct >= 60) {
      const batchDoc = await WorkshopBatch.findById(session.workshopBatchId).select('workshopId').lean();
      if (batchDoc?.workshopId) {
        await WorkshopCertificate.findOneAndUpdate(
          { workshopId: batchDoc.workshopId, studentId: req.user._id },
          { workshopId: batchDoc.workshopId, studentId: req.user._id, status: 'Eligible' },
          { upsert: true, setDefaultsOnInsert: true }
        );
      }
    }

    return res.json({ success: true, record: updated, attendancePct: pct, completionEligible: pct >= 60 });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trainee/workshop-attendance
router.get('/workshop-attendance', async (req, res) => {
  try {
    const records = await WorkshopAttendance.find({ studentId: req.user._id })
      .populate({ path: 'sessionId', select: 'title scheduledAt durationMinutes' })
      .populate({ path: 'workshopId', select: 'title date mode' })
      .populate({ path: 'workshopBatchId', select: 'batchName' })
      .sort({ createdAt: -1 }).lean();
    const total = records.length;
    const present = records.filter(r => ['Present', 'Late', 'Partial'].includes(r.attendanceStatus)).length;
    return res.json({ success: true, records, stats: { total, present, percentage: total ? ((present / total) * 100).toFixed(1) : '0.0' } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trainee/workshop-certificates
router.get('/workshop-certificates', async (req, res) => {
  try {
    const certificates = await WorkshopCertificate.find({ studentId: req.user._id })
      .populate('studentId', 'name email')
      .populate('workshopId', 'title date mode')
      .sort({ createdAt: -1 }).lean();
    return res.json({ success: true, certificates });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════
// FEEDBACK ROUTES
// ═════════════════════════════════════════════════════════════════════

// POST /api/trainee/workshop-feedback
// Submit feedback for a completed workshop session
// One submission per trainee per workshop (enforced by unique index)
router.post('/workshop-feedback', async (req, res) => {
  try {
    const { sessionId, workshopId, overallRating, trainerRating, contentRating, audioRating, videoRating, comment, suggestions } = req.body;

    // Validate session exists and is completed
    const session = await Session.findOne({ _id: sessionId, sessionType: 'WORKSHOP' }).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    const effective = applyEffectiveSessionStatus(session);
    if (effective.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Feedback can only be submitted after session completion' });
    }

    const batch = await WorkshopBatch.findById(session.workshopBatchId).lean();
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
    if (!(await hasWorkshopAttendance(WorkshopAttendance, session._id, req.user._id))) {
      return res.status(403).json({ success: false, message: 'You must attend the session before submitting feedback' });
    }

    await syncWorkshopStudent(session.workshopBatchId, req.user._id, WorkshopBatch);

    const resolvedWorkshopId = batch.workshopId || workshopId;
    if (!resolvedWorkshopId) {
      return res.status(400).json({ success: false, message: 'Cannot determine workshop for this session' });
    }

    const WorkshopFeedback = mongoose.models.WorkshopFeedback || require('../models/WorkshopModels').WorkshopFeedback;
    const existing = await WorkshopFeedback.findOne({ sessionId, studentId: req.user._id });
    if (existing) return res.status(409).json({ success: false, message: 'You have already submitted feedback for this session' });

    const { WorkshopFeedback: FeedbackModel } = require('../models/WorkshopModels');

    if (!overallRating || overallRating < 1 || overallRating > 5) {
      return res.status(400).json({ success: false, message: 'Overall rating must be between 1 and 5' });
    }

    const feedback = await FeedbackModel.create({
      workshopId: resolvedWorkshopId,
      sessionId,
      studentId: req.user._id,
      trainerId: session.trainerId,
      rating: overallRating,
      ...optionalRatings({ trainerRating, contentRating, audioRating, videoRating }),
      comment: comment || '',
      suggestions: suggestions || '',
    });

    // Trainer inbox: new workshop feedback (best-effort).
    try {
      const notify = require('../utils/notificationService');
      if (session.trainerId) {
        await notify.notifyUsers([{
          userId: session.trainerId, role: 'trainer', module: 'Workshop',
          type: 'feedback_received', kind: 'workshop_feedback_received',
          title: 'New Workshop Feedback',
          message: `${req.user?.name || 'A trainee'} submitted feedback for "${session.title}".`,
          dedupeKey: `workshop:feedback:${notify.idOf(session._id)}:${notify.idOf(req.user._id)}`,
          link: '/trainer/workshops/feedback',
          meta: { sessionId: notify.idOf(session._id), entityType: 'feedback' },
        }]);
      }
    } catch (_) {}

    return res.status(201).json({ success: true, feedback });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'You have already submitted feedback for this workshop' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trainee/workshop-feedback
// Get the trainee's feedback submissions
router.get('/workshop-feedback', async (req, res) => {
  try {
    const { WorkshopFeedback } = require('../models/WorkshopModels');
    const feedback = await WorkshopFeedback.find({ studentId: req.user._id })
      .populate('workshopId', 'title date')
      .populate('sessionId', 'title scheduledAt sessionType')
      .sort({ createdAt: -1 }).lean();
    return res.json({ success: true, feedback });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════
// LMS FEEDBACK ROUTES (Teaching LMS)
// ═════════════════════════════════════════════════════════════════════

// POST /api/trainee/lms-feedback
// Submit feedback for a completed LMS session
// One submission per trainee per session (enforced by unique index)
router.post('/lms-feedback', async (req, res) => {
  try {
    const {
      sessionId,
      overallRating,
      trainerRating,
      contentRating,
      audioRating,
      videoRating,
      comment,
      suggestions,
    } = req.body;

    const session = await Session.findOne({
      _id: sessionId,
      ...LMS_FILTER,
    }).lean();

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    const effective = applyEffectiveSessionStatus(session);
    if (effective.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Feedback can only be submitted after session completion',
      });
    }
    if (!(await hasLmsAttendance(Attendance, session._id, req.user._id))) {
      return res.status(403).json({ success: false, message: 'You must attend the session before submitting feedback' });
    }
    if (!overallRating || overallRating < 1 || overallRating > 5) {
      return res.status(400).json({ success: false, message: 'Overall rating must be between 1 and 5' });
    }

    const existing = await LmsFeedback.findOne({ sessionId, studentId: req.user._id });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You have already submitted feedback for this session' });
    }

    const feedback = await LmsFeedback.create({
      sessionId,
      studentId: req.user._id,
      trainerId: session.trainerId,
      rating: overallRating,
      ...optionalRatings({ trainerRating, contentRating, audioRating, videoRating }),
      comment: comment || '',
      suggestions: suggestions || '',
    });

    // Trainer inbox: new feedback on their session (best-effort).
    try {
      const notify = require('../utils/notificationService');
      if (session.trainerId) {
        await notify.notifyUsers([{
          userId: session.trainerId, role: 'trainer', module: 'LMS',
          type: 'feedback_received', kind: 'lms_feedback_received',
          title: 'New Session Feedback',
          message: `${req.user?.name || 'A trainee'} submitted feedback for "${session.title}".`,
          dedupeKey: `lms:feedback:${notify.idOf(session._id)}:${notify.idOf(req.user._id)}`,
          link: '/trainer/feedback',
          meta: { sessionId: notify.idOf(session._id), entityType: 'feedback' },
        }]);
      }
    } catch (_) {}

    return res.status(201).json({ success: true, feedback });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'You have already submitted feedback for this session' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trainee/lms-feedback
// Get the trainee's LMS feedback submissions
router.get('/lms-feedback', async (req, res) => {
  try {
    const feedback = await LmsFeedback.find({ studentId: req.user._id })
      .populate('sessionId', 'title scheduledAt sessionType')
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, feedback });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trainee/workshop-sessions/:id/join-status
// Returns the join state for a trainee for a specific session
router.get('/workshop-sessions/:id/join-status', async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, sessionType: 'WORKSHOP' }).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Workshop session not found' });

    const now = Date.now();
    const effective = applyEffectiveSessionStatus(session, now);
    const scheduledMs = new Date(effective.scheduledAt).getTime();
    const endsAtMs = scheduledMs + (effective.durationMinutes || 60) * 60000;
    const joinBeforeMs = (effective.joinBeforeMinutes || 10) * 60000;
    const joinableFromMs = scheduledMs - joinBeforeMs;

    let joinState = effective.status;
    let canJoin = false;
    let message = '';

    if (effective.status === 'completed') {
      joinState = 'completed';
      canJoin = false;
      message = 'Session Completed';
    } else if (effective.status === 'live') {
      joinState = 'live';
      canJoin = true;
      message = 'Join Session';
    } else if (now < joinableFromMs) {
      joinState = 'scheduled';
      canJoin = false;
      const secondsUntilStart = Math.ceil((joinableFromMs - now) / 1000);
      message = `Scheduled - Starts in ${Math.floor(secondsUntilStart / 60)}m ${secondsUntilStart % 60}s`;
    } else if (now >= joinableFromMs && effective.status === 'scheduled') {
      joinState = 'waiting';
      canJoin = false;
      message = 'Waiting for Trainer';
    } else if (now > endsAtMs) {
      joinState = 'completed';
      canJoin = false;
      message = 'Session Completed';
    }

    const secondsUntilStart = Math.max(0, Math.ceil((scheduledMs - now) / 1000));
    const secondsUntilEnd = Math.max(0, Math.ceil((endsAtMs - now) / 1000));
    const isWithinJoinWindow = now >= joinableFromMs && now <= endsAtMs && effective.status === 'live';

    return res.json({
      success: true,
      joinState,
      canJoin,
      message,
      secondsUntilStart,
      secondsUntilEnd,
      isWithinJoinWindow,
      session: {
        _id: effective._id,
        status: effective.status,
        scheduledAt: effective.scheduledAt,
        durationMinutes: effective.durationMinutes,
        title: effective.title,
        endedAt: effective.endedAt,
      },
    });
   } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trainee/sessions/:id/join-status
// LMS session join state (mirrors the workshop endpoint but for LMS sessions)
router.get('/sessions/:id/join-status', async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, ...LMS_FILTER }).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (!ensureEnrolled(session, req.user)) {
      return res.status(403).json({ success: false, message: 'You are not enrolled in this session' });
    }

    const now = Date.now();
    const scheduledMs = new Date(session.scheduledAt).getTime();
    const endsAtMs = scheduledMs + (session.durationMinutes || 60) * 60000;
    const joinBeforeMs = (session.joinBeforeMinutes || 10) * 60000;
    const joinableFromMs = scheduledMs - joinBeforeMs;

    let joinState = 'scheduled';
    let canJoin = false;
    let message = '';

    if (session.status === 'completed') {
      joinState = 'completed';
      canJoin = false;
      message = 'Session Completed';
    } else if (session.status === 'live') {
      joinState = 'live';
      canJoin = true;
      message = 'Join Session';
    } else if (now < joinableFromMs) {
      joinState = 'scheduled';
      canJoin = false;
      const secondsUntilStart = Math.ceil((joinableFromMs - now) / 1000);
      message = `Scheduled - Starts in ${Math.floor(secondsUntilStart / 60)}m ${secondsUntilStart % 60}s`;
    } else if (now >= joinableFromMs && session.status === 'scheduled') {
      joinState = 'waiting';
      canJoin = false;
      message = 'Waiting for Trainer';
    } else if (now > endsAtMs) {
      joinState = 'completed';
      canJoin = false;
      message = 'Session Completed';
    }

    const secondsUntilStart = Math.max(0, Math.ceil((scheduledMs - now) / 1000));
    const secondsUntilEnd = Math.max(0, Math.ceil((endsAtMs - now) / 1000));
    const isWithinJoinWindow = now >= joinableFromMs && now <= endsAtMs;

    return res.json({
      success: true,
      joinState,
      canJoin,
      message,
      secondsUntilStart,
      secondsUntilEnd,
      isWithinJoinWindow,
      session: {
        _id: session._id,
        status: session.status,
        scheduledAt: session.scheduledAt,
        durationMinutes: session.durationMinutes,
        title: session.title,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trainee/courses — ONLY the logged-in trainee's enrolled LMS courses.
// Source of truth (union, no hardcoding, no client-supplied IDs):
//   1. Enrollment docs  { student: req.user._id }  (legacy/granular progress link)
//   2. CourseSubscription docs { trainee: req.user._id, status: 'active' }
//      (current LMS enrollment flow — admin assign + public LMS registration)
//   3. Batch assignment: batches in req.user.batchIds whose `course` value matches
//      a Course code (Batch.course is a string code, e.g. 'JAVA'), resolved to
//      Course docs by code.
// A trainee with no enrollment in any of these gets [] → existing empty-state UI.
// NEVER falls back to all courses.
router.get('/courses', async (req, res) => {
  try {
    const userId = req.user._id;

    const [enrollments, subs, myBatches] = await Promise.all([
      Enrollment.find({ student: userId }).select('course progressPercent').lean(),
      // CourseSubscription is the current enrollment record (status 'active';
      // treat a missing/expired endDate via the isActive virtual).
      require('../models/CourseSubscription')
        .find({ trainee: userId, status: 'active' })
        .select('course endDate status')
        .lean(),
      Batch.find({ _id: { $in: req.user.batchIds || [] } }).select('course').lean(),
    ]);

    const courseIds = new Set();
    enrollments.forEach((e) => {
      if (e.course) courseIds.add(String(e.course));
    });
    subs.forEach((s) => {
      if (!s.course) return;
      if (s.endDate && new Date(s.endDate) <= new Date()) return; // expired
      courseIds.add(String(s.course));
    });

    const batchCodes = [...new Set(
      (myBatches || []).map((b) => String(b.course || '').trim()).filter(Boolean)
    )];
    if (batchCodes.length) {
      const codeCourses = await Course.find({ code: { $in: batchCodes } }).select('_id').lean();
      codeCourses.forEach((c) => courseIds.add(String(c._id)));
    }

    if (!courseIds.size) return res.json({ success: true, courses: [] });

    const courses = await Course.find({ _id: { $in: [...courseIds] } })
      .select('name code level status duration durationUnit')
      .sort({ name: 1 })
      .lean();

    const progressByCourse = {};
    enrollments.forEach((e) => {
      if (e.course) progressByCourse[String(e.course)] = e.progressPercent || 0;
    });

    return res.json({
      success: true,
      courses: courses.map((c) => ({ ...c, progress: progressByCourse[String(c._id)] || 0 })),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trainee/progress — aggregated learning progress for the logged-in trainee
router.get('/progress', async (req, res) => {
  try {
    const userId = req.user._id;
    const batchIds = req.user.batchIds || [];

    const attendedIds = await Attendance.find({ trainee: userId }).distinct('session');
    const sessionFilter = {
      $and: [
        LMS_FILTER,
        {
          $or: [
            ...traineeSessionFilter(req.user).$or,
            ...(attendedIds.length ? [{ _id: { $in: attendedIds } }] : []),
          ],
        },
      ],
    };

    const [
      enrollments,
      lessonRows,
      lmsSessions,
      lmsAttendance,
      assignments,
      workshopAttendance,
      myBatches,
    ] = await Promise.all([
      Enrollment.find({ student: userId })
        .populate('course', 'name code status duration')
        .populate('batch', 'name')
        .lean(),
      LessonProgress.find({ student: userId }).lean(),
      Session.find(sessionFilter).select('status title scheduledAt').lean(),
      Attendance.find({ trainee: userId })
        .populate('session', 'title scheduledAt status')
        .sort({ createdAt: -1 })
        .lean(),
      Assignment.find({ batchId: { $in: batchIds }, status: { $ne: 'draft' } }).lean(),
      WorkshopAttendance.find({ studentId: userId })
        .populate('sessionId', 'title status scheduledAt')
        .lean(),
      Batch.find({ _id: { $in: batchIds } }).select('name course').lean(),
    ]);

    const uid = userId.toString();

    // Course progress — prefer Enrollment records; supplement with LessonProgress aggregates
    const coursesMap = new Map();
    enrollments.forEach((e) => {
      if (!e.course) return;
      const id = String(e.course._id);
      coursesMap.set(id, {
        courseId: e.course._id,
        name: e.course.name,
        code: e.course.code || '',
        progressPercent: e.progressPercent || 0,
        completedLessons: e.completedLessons || 0,
        status: e.status,
        batchName: e.batch?.name || '',
        lastAccessedAt: e.lastAccessedAt,
      });
    });

    const lessonsByCourse = {};
    lessonRows.forEach((lp) => {
      const cid = String(lp.course);
      if (!lessonsByCourse[cid]) lessonsByCourse[cid] = { total: 0, completed: 0 };
      lessonsByCourse[cid].total += 1;
      if (lp.status === 'completed') lessonsByCourse[cid].completed += 1;
    });

    for (const [cid, counts] of Object.entries(lessonsByCourse)) {
      if (!coursesMap.has(cid)) {
        const course = await Course.findById(cid).select('name code').lean();
        if (course) {
          coursesMap.set(cid, {
            courseId: course._id,
            name: course.name,
            code: course.code || '',
            progressPercent: counts.total ? Math.round((counts.completed / counts.total) * 100) : 0,
            completedLessons: counts.completed,
            status: counts.completed === counts.total && counts.total > 0 ? 'completed' : 'active',
            batchName: '',
            lastAccessedAt: null,
          });
        }
      } else {
        const entry = coursesMap.get(cid);
        if (!entry.progressPercent && counts.total) {
          entry.progressPercent = Math.round((counts.completed / counts.total) * 100);
          entry.completedLessons = counts.completed;
        }
      }
    }

    const courses = [...coursesMap.values()];

    const completedSessions = lmsSessions.filter((s) => s.status === 'completed').length;
    const totalSessions = lmsSessions.length;

    const totalAssignments = assignments.length;
    const submittedAssignments = assignments.filter((a) =>
      (a.submissions || []).some((s) => String(s.trainee) === uid)
    ).length;

    const presentLms = lmsAttendance.filter((a) => ['present', 'late', 'partial'].includes(a.status)).length;
    const lmsAttendancePct = lmsAttendance.length
      ? Math.round((presentLms / lmsAttendance.length) * 100)
      : 0;

    const presentWs = workshopAttendance.filter((r) =>
      ['Present', 'Late', 'Partial'].includes(r.attendanceStatus)
    ).length;
    const workshopAttendancePct = workshopAttendance.length
      ? Math.round((presentWs / workshopAttendance.length) * 100)
      : 0;

    const lessonCompleted = lessonRows.filter((lp) => lp.status === 'completed').length;
    const lessonTotal = lessonRows.length;

    // Calculate component percentages only when there's actual data
    const courseAvg = courses.length
      ? Math.round(courses.reduce((sum, c) => sum + (c.progressPercent || 0), 0) / courses.length)
      : 0;
    const sessionPct = totalSessions ? Math.round((completedSessions / totalSessions) * 100) : 0;
    const assignmentPct = totalAssignments
      ? Math.round((submittedAssignments / totalAssignments) * 100)
      : 0;

    // Overall completion: average of components that have actual data
    // If no data at all, return 0 instead of misleading percentage
    const hasAnyData = courses.length > 0 || totalSessions > 0 || totalAssignments > 0 || lessonTotal > 0 || lmsAttendance.length > 0 || workshopAttendance.length > 0;
    
    let overallPercent = 0;
    if (hasAnyData) {
      const parts = [courseAvg, sessionPct, lmsAttendancePct, assignmentPct].filter((p) => p > 0);
      overallPercent = parts.length
        ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length)
        : (lessonTotal ? Math.round((lessonCompleted / lessonTotal) * 100) : 0);
    }

    return res.json({
      success: true,
      progress: {
        overall: {
          percent: overallPercent,
          coursesEnrolled: courses.length,
          sessionsCompleted: completedSessions,
          sessionsTotal: totalSessions,
          assignmentsSubmitted: submittedAssignments,
          assignmentsTotal: totalAssignments,
          lessonsCompleted: lessonCompleted,
          lessonsTotal: lessonTotal,
        },
        courses,
        batches: myBatches.map((b) => ({ _id: b._id, name: b.name, course: b.course })),
        sessions: {
          completed: completedSessions,
          total: totalSessions,
          percent: sessionPct,
          recent: lmsSessions
            .filter((s) => s.status === 'completed')
            .slice(0, 10)
            .map((s) => ({ _id: s._id, title: s.title, scheduledAt: s.scheduledAt, status: s.status })),
        },
        assignments: {
          submitted: submittedAssignments,
          total: totalAssignments,
          pending: totalAssignments - submittedAssignments,
          percent: assignmentPct,
        },
        attendance: {
          lms: {
            present: presentLms,
            total: lmsAttendance.length,
            percent: lmsAttendancePct,
            records: lmsAttendance.slice(0, 20).map((a) => ({
              status: a.status,
              joinedAt: a.joinedAt,
              sessionTitle: a.session?.title,
              sessionDate: a.session?.scheduledAt,
            })),
          },
          workshop: {
            present: presentWs,
            total: workshopAttendance.length,
            percent: workshopAttendancePct,
          },
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
