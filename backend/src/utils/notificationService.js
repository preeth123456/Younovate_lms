// src/utils/notificationService.js
// Single notification helper for LMS + Workshop events.
// - Creates ONE persistent Notification per intended recipient (upsert by
//   dedupeKey so retries/refreshes never duplicate).
// - Emits a real-time socket event to `user:<id>` (existing socketService;
//   no new realtime tech). Failures never break the triggering action.
'use strict';

const Notification = require('../models/Notification');

let socketApi = null;
function sockets() {
  if (!socketApi) {
    try { socketApi = require('../services/socketService'); } catch { socketApi = null; }
  }
  return socketApi;
}

const idOf = (v) => (v == null ? '' : String(v?._id || v));

function fmtDT(d) {
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

/**
 * notifyUsers([{ userId, role, module, kind, title, message, dedupeKey, link?, meta? }])
 * Skips falsy userIds; upserts by dedupeKey; emits `notification:new` per user.
 */
async function notifyUsers(items = []) {
  const list = (Array.isArray(items) ? items : []).filter((n) => n && (n.userId || n.recipient) && n.dedupeKey && n.title && n.message);
  if (!list.length) return [];
  const out = [];
  for (const n of list) {
    const recipient = n.userId || n.recipient;
    const notifType = n.type || n.kind || 'general';
    try {
      const doc = await Notification.findOneAndUpdate(
        { dedupeKey: String(n.dedupeKey) },
        {
          $setOnInsert: {
            userId: recipient,
            role: n.role || 'trainee',
            module: n.module || 'LMS',
            kind: n.kind || '',
            type: notifType,
            title: String(n.title).slice(0, 160),
            message: String(n.message).slice(0, 1000),
            dedupeKey: String(n.dedupeKey),
            link: n.link || '',
            actionUrl: n.link || n.actionUrl || '',
            relatedEntity: n.relatedEntity || {
              entityType: n.meta?.entityType || n.meta?.sessionType || '',
              entityId: n.meta?.sessionId || n.meta?.courseId || n.meta?.batchId || n.meta?.assignmentId || n.meta?.assessmentId || n.meta?.certificateId || undefined,
            },
            metadata: n.meta || {},
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      out.push(doc);
      // Realtime (best-effort) — bell updates without refresh.
      try { sockets()?.emitToUser?.(String(recipient), 'notification:new', { _id: String(doc._id), title: doc.title, message: doc.message, module: doc.module, kind: doc.kind, link: doc.link, createdAt: doc.createdAt }); } catch (_) {}
    } catch (err) {
      // Duplicate-key race on dedupeKey just means another call won — not an error.
      if (err && err.code !== 11000) console.error('NOTIFICATION ERROR:', err?.message || err);
    }
  }
  return out;
}

async function notifyAdmins({ User, module, kind, title, message, dedupeKey, link, meta }) {
  try {
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean();
    return notifyUsers(admins.map((a) => ({ userId: a._id, role: 'admin', module, kind, title, message, dedupeKey: `${dedupeKey}:admin:${a._id}`, link, meta })));
  } catch (err) {
    console.error('NOTIFICATION ERROR:', err?.message || err);
    return [];
  }
}

module.exports = { notifyUsers, notifyAdmins, fmtDT, idOf };
