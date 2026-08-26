// src/utils/attendanceUtils.js
//
// Single source of truth for turning (session timing + join/leave times) into an
// attendance status. Used by the trainee join + leave endpoints so the rule is
// identical everywhere.
//
// Rules (tweak the constants if your policy differs):
//   • Joined more than LATE_GRACE_MIN minutes after the scheduled start  -> "late"
//   • Attended >= PRESENT_FRACTION of the session window                 -> "present" (or "late")
//   • Attended >= PARTIAL_FRACTION but < PRESENT_FRACTION                -> "partial"
//   • Attended < PARTIAL_FRACTION                                        -> "absent"
//
// "Attended" = the overlap between [joinedAt, leftAt] and the scheduled
// [start, end] window, so joining early or leaving late never inflates it.
'use strict';

const LATE_GRACE_MIN  = 10;    // minutes after start before a join counts as "late"
const PRESENT_FRACTION = 0.75; // >= 75% of the session  -> present
const PARTIAL_FRACTION = 0.25; // >= 25% of the session  -> partial

/** WorkshopAttendance schema uses PascalCase enum values. */
function normalizeWorkshopStatus(status) {
  const map = {
    present: 'Present',
    late: 'Late',
    partial: 'Partial',
    absent: 'Absent',
    Present: 'Present',
    Late: 'Late',
    Partial: 'Partial',
    Absent: 'Absent',
  };
  return map[status] || 'Absent';
}

function sessionWindow(session) {
  const start    = new Date(session.scheduledAt).getTime();
  const totalSec = Math.max(1, (session.durationMinutes || 60) * 60);
  const end      = start + totalSec * 1000;
  return { start, end, totalSec };
}

/**
 * @param {{scheduledAt: Date, durationMinutes?: number}} session
 * @param {Date|string|null} joinedAt
 * @param {Date|string|null} leftAt    pass null while the trainee is still in the room
 * @returns {{ status: 'present'|'late'|'partial'|'absent', attendedSeconds: number }}
 */
function classifyAttendance({ session, joinedAt, leftAt }) {
  const { start, end, totalSec } = sessionWindow(session);
  const jt = joinedAt ? new Date(joinedAt).getTime() : start;
  const joinedLate = jt > start + LATE_GRACE_MIN * 60 * 1000;

  // Still in the room: provisional status, no duration yet.
  if (!leftAt) {
    return { status: joinedLate ? 'late' : 'present', attendedSeconds: 0 };
  }

  const lv = new Date(leftAt).getTime();
  const overlapStart = Math.max(jt, start);
  const overlapEnd   = Math.min(lv, end);
  const attendedSeconds = Math.max(0, Math.round((overlapEnd - overlapStart) / 1000));
  const fraction = attendedSeconds / totalSec;

  let status;
  if (fraction >= PRESENT_FRACTION)      status = joinedLate ? 'late' : 'present';
  else if (fraction >= PARTIAL_FRACTION) status = 'partial';
  else                                   status = 'absent';

  return { status, attendedSeconds };
}

/**
 * When a session ends, finalize attendance for every trainee who is still
 * connected (i.e. has a record with no `leftAt`). Each such record gets
 * `leftAt = endedAt` and a recomputed `status` + `attendedSeconds` based on
 * the overlap with the scheduled window.
 *
 * @param {mongoose.Model} AttendanceModel  — required so we avoid a circular require
 * @param {ObjectId|string} sessionId
 * @param {Date|string} endedAt   — when the session actually ended
 * @param {mongoose.Document} session  — the Session document (for scheduledAt / durationMinutes)
 * @returns {Promise<{ finalized: number }>}
 */
async function finalizeAttendanceOnEnd(AttendanceModel, sessionId, endedAt, session) {
  const now = endedAt ? new Date(endedAt) : new Date();

  const openRecords = await AttendanceModel.find({
    session: sessionId,
    $or: [{ leftAt: null }, { leftAt: { $exists: false } }],
  });

  let finalized = 0;
  for (const att of openRecords) {
    att.leftAt = now;
    const { status, attendedSeconds } = classifyAttendance({
      session,
      joinedAt: att.joinedAt || now,
      leftAt: now,
    });
    att.attendedSeconds = attendedSeconds;
    att.source = att.source || 'system';
    att.markedAt = now;
    if (!att.status || att.status === 'absent') {
      att.status = status;
    }
    await att.save();
    finalized += 1;
  }

  return { finalized };
}

/**
 * Workshop-specific attendance finalization.
 * Only updates records that do not already have a leaveTime.
 * Uses Workshop field names: sessionId, joinTime, leaveTime.
 */
async function finalizeWorkshopAttendanceOnEnd(AttendanceModel, sessionId, endedAt, session) {
  const now = endedAt ? new Date(endedAt) : new Date();

  const openRecords = await AttendanceModel.find({
    sessionId,
    $or: [{ leaveTime: null }, { leaveTime: { $exists: false } }],
  });

  let finalized = 0;
  for (const att of openRecords) {
    att.leaveTime = now;
    const { status, attendedSeconds } = classifyAttendance({
      session,
      joinedAt: att.joinTime || now,
      leftAt: now,
    });
    att.duration = Math.max(0, Math.round(attendedSeconds / 60));
    att.attendancePct = Math.min(100, Math.round((att.duration / (session.durationMinutes || 60)) * 100));
    att.attendanceStatus = normalizeWorkshopStatus(status);
    if (!att.markedBy) att.markedBy = att.studentId;
    await att.save();
    finalized += 1;
  }

  return { finalized };
}

module.exports = {
  classifyAttendance,
  finalizeAttendanceOnEnd,
  finalizeWorkshopAttendanceOnEnd,
  normalizeWorkshopStatus,
  LATE_GRACE_MIN,
  PRESENT_FRACTION,
  PARTIAL_FRACTION,
};