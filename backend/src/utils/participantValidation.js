'use strict';

const { WorkshopPublicRegistration } = require('../models/WorkshopModels');

function idStr(val) {
  if (val == null) return '';
  if (typeof val === 'object' && val._id != null) return String(val._id);
  return String(val);
}

/** LMS: batch enrollment or explicit session trainee list. */
function isEnrolledInLmsSession(session, user) {
  const userId = idStr(user._id);
  const batchIds = (user.batchIds || []).map(idStr);
  const sessionBatchId = idStr(session.batchId);
  const inBatch = sessionBatchId && batchIds.includes(sessionBatchId);
  const inTrainees = (session.trainees || []).some((t) => idStr(t) === userId);
  return inBatch || inTrainees;
}

const LMS_ATTENDED_QUERY = {
  $or: [
    { joinedAt: { $exists: true, $ne: null } },
    { status: { $in: ['present', 'late', 'partial'] } },
  ],
};

const WORKSHOP_ATTENDED_QUERY = {
  $or: [
    { joinTime: { $exists: true, $ne: null } },
    { attendanceStatus: { $in: ['Present', 'Late', 'Partial'] } },
  ],
};

/** LMS: attended the live session (attendance record). */
async function hasLmsAttendance(Attendance, sessionId, userId) {
  const att = await Attendance.findOne({ session: sessionId, trainee: userId, ...LMS_ATTENDED_QUERY })
    .select('joinedAt status')
    .lean();
  return !!att;
}

/** Session IDs where the trainee has LMS attendance. */
async function getLmsAttendedSessionIds(Attendance, userId) {
  return Attendance.find({ trainee: userId, ...LMS_ATTENDED_QUERY }).distinct('session');
}

/** Session IDs where the trainee has workshop attendance. */
async function getWorkshopAttendedSessionIds(WorkshopAttendance, userId) {
  return WorkshopAttendance.find({ studentId: userId, ...WORKSHOP_ATTENDED_QUERY }).distinct('sessionId');
}

/** LMS participant = enrolled OR has attendance for the session. */
async function isLmsParticipant(session, user, Attendance) {
  if (isEnrolledInLmsSession(session, user)) return true;
  return hasLmsAttendance(Attendance, session._id, user._id);
}

/** Workshop batch membership via students[] or approved registration.userId. */
async function isWorkshopBatchMember(batch, userId) {
  const uid = idStr(userId);
  if ((batch.students || []).some((s) => idStr(s) === uid)) return true;

  const regIds = batch.registrationIds || [];
  if (!regIds.length) return false;

  const count = await WorkshopPublicRegistration.countDocuments({
    _id: { $in: regIds },
    userId,
    registrationStatus: 'Approved',
  });
  return count > 0;
}

/** Workshop: joined the session (attendance record). */
async function hasWorkshopAttendance(WorkshopAttendance, sessionId, userId) {
  const att = await WorkshopAttendance.findOne({ sessionId, studentId: userId, ...WORKSHOP_ATTENDED_QUERY })
    .select('joinTime attendanceStatus')
    .lean();
  return !!att;
}

/** Workshop participant = batch member OR has session attendance. */
async function isWorkshopParticipant(batch, session, userId, WorkshopAttendance) {
  if (await isWorkshopBatchMember(batch, userId)) return true;
  if (session?._id) return hasWorkshopAttendance(WorkshopAttendance, session._id, userId);
  return false;
}

/** Batch IDs the user belongs to (students[] or approved registration). */
async function getWorkshopBatchIdsForUser(userId, WorkshopBatch) {
  const direct = await WorkshopBatch.find({ students: userId }).select('_id').lean();
  const ids = new Set(direct.map((b) => idStr(b._id)));

  const regs = await WorkshopPublicRegistration.find({
    userId,
    registrationStatus: 'Approved',
  }).select('_id').lean();

  if (regs.length) {
    const regIds = regs.map((r) => r._id);
    const viaReg = await WorkshopBatch.find({ registrationIds: { $in: regIds } }).select('_id').lean();
    viaReg.forEach((b) => ids.add(idStr(b._id)));
  }

  return [...ids];
}

/** Keep students[] in sync when user is a valid approved registrant. */
async function syncWorkshopStudent(batchId, userId, WorkshopBatch) {
  const batch = await WorkshopBatch.findById(batchId).select('students registrationIds').lean();
  if (!batch) return;
  if (await isWorkshopBatchMember(batch, userId)) {
    await WorkshopBatch.findByIdAndUpdate(batchId, { $addToSet: { students: userId } });
  }
}

/** Optional sub-ratings: schema allows 0 = not provided. */
function optionalRatings({ trainerRating, contentRating, audioRating, videoRating }) {
  const out = {};
  const set = (k, v) => { if (v != null && Number(v) >= 1) out[k] = Number(v); };
  set('trainerRating', trainerRating);
  set('contentRating', contentRating);
  set('audioRating', audioRating);
  set('videoRating', videoRating);
  return out;
}

module.exports = {
  idStr,
  isEnrolledInLmsSession,
  hasLmsAttendance,
  isLmsParticipant,
  getLmsAttendedSessionIds,
  isWorkshopBatchMember,
  hasWorkshopAttendance,
  isWorkshopParticipant,
  getWorkshopAttendedSessionIds,
  getWorkshopBatchIdsForUser,
  syncWorkshopStudent,
  optionalRatings,
};
