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
 * Scheduled sessions become live once start time is reached.
 * Completed/cancelled are never overridden.
 */
function effectiveSessionStatus(session, now = Date.now()) {
  const status = session.status;

  if (['completed', 'cancelled'].includes(status)) return status;
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
 * Persist live for scheduled sessions whose start time has arrived.
 * Also migrates legacy awaiting_confirmation rows back to live.
 */
async function autoUpdatePastScheduledSessions(Session, filter = {}) {
  const now = Date.now();
  const pending = await Session.find({
    status: { $in: ['scheduled', 'awaiting_confirmation'] },
    ...filter,
  }).lean();

  const ids = pending
    .filter((s) => {
      const startMs = getSessionStartMs(s);
      return !Number.isNaN(startMs) && now >= startMs;
    })
    .map((s) => s._id);

  if (ids.length) {
    await Session.updateMany(
      { _id: { $in: ids } },
      { $set: { status: 'live', startedAt: new Date() } }
    );
  }
  return ids.length;
}

/** @deprecated Use autoUpdatePastScheduledSessions — kept for existing imports. */
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
