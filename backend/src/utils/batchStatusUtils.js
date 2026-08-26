'use strict';

/**
 * Derive the effective LMS batch status from stored status + start/end dates.
 * Manual completed/cancelled are always preserved.
 */
function effectiveBatchStatus(batch, now = Date.now()) {
  const stored = String(batch?.status || 'upcoming').toLowerCase();

  if (stored === 'cancelled' || stored === 'completed') return stored;

  const startMs = batch?.startDate ? new Date(batch.startDate).getTime() : NaN;
  if (!Number.isFinite(startMs)) return stored;

  const endMs = batch?.endDate ? new Date(batch.endDate).getTime() : null;

  if (now < startMs) return 'upcoming';

  if (endMs != null && Number.isFinite(endMs) && now > endMs) {
    return stored === 'cancelled' ? 'cancelled' : 'completed';
  }

  if (now >= startMs) return 'active';

  return stored;
}

function applyEffectiveBatchStatus(batch, now = Date.now()) {
  const plain = batch?.toObject ? batch.toObject() : { ...batch };
  return { ...plain, status: effectiveBatchStatus(plain, now) };
}

module.exports = {
  effectiveBatchStatus,
  applyEffectiveBatchStatus,
};
