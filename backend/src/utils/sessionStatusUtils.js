'use strict';

/** Session end time in ms (scheduledAt + durationMinutes). */
function getSessionEndsAtMs(session) {
  const start = new Date(session.scheduledAt).getTime();
  const durMs = (session.durationMinutes || 60) * 60 * 1000;
  return start + durMs;
}

function getSessionStartMs(session) {
  return new Date(session.scheduledAt).getTime();
}

/**
 * Derive effective status for display/join.
 * Persisted completed/cancelled/endedAt always win over time-based rules.
 */
function effectiveSessionStatus(session, now = Date.now()) {
  const status = String(session?.status || '').toLowerCase();

  if (status === 'completed' || status === 'cancelled') return status;
  if (session?.endedAt) return 'completed';

  const endMs = getSessionEndsAtMs(session);
  if (!Number.isNaN(endMs) && now > endMs) return 'completed';

  if (status === 'live' || status === 'ongoing') return 'live';

  const startMs = getSessionStartMs(session);
  if (!Number.isNaN(startMs) && now >= startMs) return 'live';

  return 'scheduled';
}

function applyEffectiveSessionStatus(session, now = Date.now()) {
  const effective = effectiveSessionStatus(session, now);
  const plain = session?.toObject ? session.toObject() : { ...session };
  return { ...plain, status: effective };
}

/**
 * Persist status transitions for sessions in the active window:
 * - Past end time → completed
 * - Started (not ended) scheduled → live
 * Never modifies completed/cancelled sessions.
 */
async function autoUpdatePastScheduledSessions(Session, filter = {}) {
  const now = Date.now();
  const pending = await Session.find({
    status: { $in: ['scheduled', 'live', 'awaiting_confirmation'] },
    ...filter,
  }).lean();

  const completeIds = [];
  const liveIds = [];

  for (const s of pending) {
    const endMs = getSessionEndsAtMs(s);
    const startMs = getSessionStartMs(s);

    if (s.endedAt || (!Number.isNaN(endMs) && now > endMs)) {
      completeIds.push(s._id);
      continue;
    }

    if (
      (s.status === 'scheduled' || s.status === 'awaiting_confirmation')
      && !Number.isNaN(startMs)
      && now >= startMs
    ) {
      liveIds.push(s._id);
    }
  }

  if (completeIds.length) {
    await Session.updateMany(
      { _id: { $in: completeIds } },
      { $set: { status: 'completed', endedAt: new Date() } }
    );
  }
  if (liveIds.length) {
    await Session.updateMany(
      { _id: { $in: liveIds } },
      { $set: { status: 'live', startedAt: new Date() } }
    );
  }

  return completeIds.length + liveIds.length;
}

/** Workshop sessions — same lifecycle rules as LMS. */
async function autoCompletePastWorkshopSessions(Session, filter = {}) {
  return autoUpdatePastScheduledSessions(Session, { sessionType: 'WORKSHOP', ...filter });
}

module.exports = {
  getSessionEndsAtMs,
  getSessionStartMs,
  effectiveSessionStatus,
  applyEffectiveSessionStatus,
  autoUpdatePastScheduledSessions,
  autoCompletePastWorkshopSessions,
};
