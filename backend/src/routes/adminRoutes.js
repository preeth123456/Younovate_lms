// src/routes/adminRoutes.js
'use strict';
const express      = require('express');
const path         = require('path');
const fs           = require('fs');
const User         = require('../models/User');
const Registration = require('../models/Registration');
const Batch        = require('../models/Batch');
const Session      = require('../models/Session');
const Attendance   = require('../models/Attendance');
const Interview    = require('../models/Interview');
const Recording    = require('../models/Recording');
const LmsFeedback  = require('../models/LmsFeedback');
const { protect, authorize } = require('../middleware/auth');
const { resolveRecordingPlayback, resolveRecordingPlaybackAsync } = require('../utils/recordingStorage');
const { rejectPastDate } = require('../utils/dateTimeValidation');
const { applyEffectiveBatchStatus } = require('../utils/batchStatusUtils');
const mongoose = require('mongoose');

const router = express.Router();

// ── Helper: normalize batch input → array of ids ──────────────────────────────
// Accepts either `batchIds` (array) or a single `batchId` from the request body
// and returns a clean array. Used wherever we create/update a user's batches.
// const normalizeBatchIds = (body = {}) => {
//   if (Array.isArray(body.batchIds)) return body.batchIds.filter(Boolean);
//   if (body.batchId) return [body.batchId];
//   return [];
// };
const normalizeBatchIds = (body = {}) => {
  if (body.batchIds !== undefined) {
    return []
      .concat(body.batchIds)
      .filter(id => id && String(id).trim());
  }

  if (body.batchId) {
    return [body.batchId];
  }

  return [];
};

// ── PUBLIC — registration form (no auth required) ─────────────────────────────
// POST /api/admin/registrations  (public — called from landing page form)
//   Body: { fullName, email, phone?, programInterest?, source? }
router.post('/registrations', async (req, res) => {
  const { fullName, email, phone, programInterest, source } = req.body;
  if (!fullName || !email)
    return res.status(400).json({ success: false, message: 'fullName and email are required' });

  const existing = await Registration.findOne({ email: email.toLowerCase() });
  if (existing)
    return res.status(409).json({ success: false, message: 'This email has already been registered' });

  const reg = await Registration.create({
    fullName, email: email.toLowerCase(),
    phone: phone || '', programInterest: programInterest || '',
    source: source || 'web', status: 'registered',
  });
  return res.status(201).json({ success: true, message: 'Registration submitted', data: reg });
});

// ── All routes below require admin JWT ───────────────────────────────────────
router.use(protect, authorize('admin'));

// ── DASHBOARD ────────────────────────────────────────────────────────────────
// GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
  const [
    totalTrainees, totalTrainers, totalBatches, activeBatches,
    totalSessions, activeRegistrations, placementReady, offerLetters, recentUsers, batchList,
  ] = await Promise.all([
    User.countDocuments({ role: 'trainee', isActive: true }),
    User.countDocuments({ role: 'trainer', isActive: true }),
    Batch.countDocuments(),
    Batch.countDocuments({ status: 'active' }),
    Session.countDocuments(),
    Registration.countDocuments({ status: { $in: ['registered', 'pending', 'lead'] } }),
    User.countDocuments({ role: 'trainee', placementStatus: 'ready' }),
    User.countDocuments({ role: 'trainee', placementStatus: 'placed' }),
    User.find({ role: 'trainee' }).sort({ createdAt: -1 }).limit(8).select('name createdAt placementStatus'),
    Batch.find({ status: 'active' }).limit(6).select('name status'),
  ]);

  const COLORS = ['#6366F1','#0D9488','#7C3AED','#C2410C','#1D4ED8','#15803D'];
  return res.json({
    success: true,
    data: {
      totalTrainees, totalTrainers, totalBatches, activeBatches,
      totalSessions, activeRegistrations, placementReady, offerLetters,
      batchAttendance: batchList.map((b, i) => ({ batchId: b._id,name: b.name, color: COLORS[i % 6] })),
      recentActivity: recentUsers.map(u => ({
        user: u.name, action: 'Joined platform', status: u.placementStatus,
        date: u.createdAt,
      })),
    },
  });
});

// ── USERS ─────────────────────────────────────────────────────────────────────
// GET /api/admin/users?role=&status=active|inactive&search=&page=1&limit=20|all
router.get('/users', async (req, res) => {
  const { role, status, search, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (role)   filter.role     = role;
  if (status) filter.isActive = status === 'active';
  if (search) filter.$or = [
    { name:  { $regex: search, $options: 'i' } },
    { email: { $regex: search, $options: 'i' } },
  ];

  // "all" (or 0) → no pagination, return every matching user.
  const fetchAll = limit === 'all' || Number(limit) === 0;
  const lim  = fetchAll ? 0 : Number(limit);                 // Mongoose .limit(0) = no cap
  const skip = fetchAll ? 0 : (Number(page) - 1) * lim;

  const total = await User.countDocuments(filter);

  // Populate the full array (batchIds) AND the first-batch virtual (batchId)
  // so both new (multi-batch) and existing (single-batch) UI code work.
  let query = User.find(filter)
    .sort({ createdAt: -1 })
    .populate('batchIds', 'name')
    .populate('batchId', 'name');
  if (!fetchAll) query = query.skip(skip).limit(lim);
  const users = await query;

  return res.json({
    success: true,
    data: {
      users: users.map(u => u.toPublic()),
      meta: {
        total,
        page:  fetchAll ? 1 : Number(page),
        limit: fetchAll ? total : Number(limit),
        pages: fetchAll ? 1 : Math.ceil(total / Number(limit)),
      },
    },
  });
});

// POST /api/admin/users
//   Body: { name, email, password, role, batchId? | batchIds? }
router.post('/users', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role)
    return res.status(400).json({ success: false, message: 'name, email, password, role required' });

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) return res.status(409).json({ success: false, message: 'Email already in use' });

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    role,
    batchIds: normalizeBatchIds(req.body),   // ← multiple batches supported
    isActive: true,
  });
  return res.status(201).json({ success: true, data: user.toPublic() });
});

// GET /api/admin/users/:id
router.get('/users/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: `Invalid ID: ${req.params.id}` });
    }

    const user = await User.findById(req.params.id)
      .populate('batchIds', 'name status')
      .populate('batchId', 'name status');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, data: user.toPublic() });
  } catch (err) {
    console.error('Get user error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/admin/users/:id
//   Body: { name?, email?, role?, batchId? | batchIds?, isActive?, phone?, bio?, skills?, expertise? }
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: `Invalid user ID: ${id}` });
    }

    // Plain (non-batch) fields that can be set directly.
    const allowedFields = ['name', 'email', 'role', 'isActive', 'phone', 'bio', 'skills', 'expertise'];
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    // Batch handling — NEVER write to the `batchId` virtual; map to `batchIds`.
    // - If `batchIds` (array) is sent, use it as the full set.
    // - If a single `batchId` is sent: '' or null clears all; a value sets [value].
    if (req.body.batchIds !== undefined) {
      updates.batchIds = normalizeBatchIds(req.body);
    } else if (req.body.batchId !== undefined) {
      updates.batchIds = (req.body.batchId === '' || req.body.batchId === null)
        ? []
        : [req.body.batchId];
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    )
      .populate('batchIds', 'name')
      .populate('batchId', 'name');

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser.toPublic(),
    });
  } catch (err) {
    console.error('Update User Error:', err);
    return res.status(400).json({ success: false, error: err.message });
  }
});

// PATCH /api/admin/users/:id/status
//   Body: { isActive: boolean }
router.patch('/users/:id/status', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: `Invalid ID: ${req.params.id}` });
    }

    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive (boolean) required' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { isActive }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, data: user.toPublic() });
  } catch (err) {
    console.error('Update user status error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/admin/users/:id  (hard delete - permanently removes user)
router.delete('/users/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: `Invalid ID: ${req.params.id}` });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, message: `User ${user.name} deleted permanently` });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── BATCHES ───────────────────────────────────────────────────────────────────
// GET /api/admin/batches?status=&page=1&limit=20
router.get('/batches', async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const skip    = (Number(page) - 1) * Number(limit);
  const total   = await Batch.countDocuments(filter);
  const batchesRaw = await Batch.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate('trainerId', 'name email');
  const batches = batchesRaw.map((b) => applyEffectiveBatchStatus(b));
  return res.json({ success: true, data: { batches, meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } } });
});

// POST /api/admin/batches
router.post('/batches', async (req, res) => {
  const { name, startDate } = req.body;
  if (!name || !startDate) return res.status(400).json({ success: false, message: 'name and startDate required' });
  const check = rejectPastDate(startDate, 'Batch start date');
  if (!check.ok) return res.status(400).json({ success: false, message: check.message });
  const batch = await Batch.create(req.body);
  return res.status(201).json({ success: true, data: batch });
});

// PUT /api/admin/batches/:id
router.put('/batches/:id', async (req, res) => {
  if (req.body.startDate) {
    const check = rejectPastDate(req.body.startDate, 'Batch start date');
    if (!check.ok) return res.status(400).json({ success: false, message: check.message });
  }
  const batch = await Batch.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
  return res.json({ success: true, data: batch });
});

// DELETE /api/admin/batches/:id
router.delete('/batches/:id', async (req, res) => {
  const batch = await Batch.findByIdAndDelete(req.params.id);
  if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
  return res.json({ success: true, message: 'Batch deleted' });
});

// ── REGISTRATIONS / LEADS ─────────────────────────────────────────────────────
// GET /api/admin/registrations?status=&search=&page=1&limit=20
router.get('/registrations', async (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (search) filter.$or = [{ fullName: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
  const skip  = (Number(page) - 1) * Number(limit);
  const total = await Registration.countDocuments(filter);
  const regs  = await Registration.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate('convertedBy', 'name email');
  return res.json({ success: true, data: { registrations: regs, meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } } });
});

// GET /api/admin/registrations/:id
router.get('/registrations/:id', async (req, res) => {
  const reg = await Registration.findById(req.params.id).populate('convertedBy traineeId', 'name email role');
  if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });
  return res.json({ success: true, data: reg });
});

// PATCH /api/admin/registrations/:id
router.patch('/registrations/:id', async (req, res) => {
  const reg = await Registration.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
  if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });
  return res.json({ success: true, data: reg });
});

// POST /api/admin/registrations/:id/convert — lead → trainee User account
router.post('/registrations/:id/convert', async (req, res) => {
  const reg = await Registration.findById(req.params.id);
  if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });
  if (reg.status === 'converted') return res.status(409).json({ success: false, message: 'Already converted' });

  const exists = await User.findOne({ email: reg.email });
  if (exists) return res.status(409).json({ success: false, message: 'A user account already exists for this email' });

  const { role } = req.body;
  const user = await User.create({
    name: reg.fullName, email: reg.email,
    password: 'Younovate@123', // temporary — trainee must reset via forgot-password
    role: role || 'trainee', phone: reg.phone || '',
    batchIds: normalizeBatchIds(req.body),   // ← multiple batches supported
    isActive: true, enrolledAt: new Date(),
  });

  reg.status = 'converted'; reg.convertedAt = new Date(); reg.convertedBy = req.user._id; reg.traineeId = user._id;
  await reg.save();

  return res.status(201).json({ success: true, message: 'Lead converted to trainee', data: user.toPublic() });
});

// DELETE /api/admin/registrations/:id
router.delete('/registrations/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: `Invalid ID: ${req.params.id}` });
    }

    const reg = await Registration.findByIdAndDelete(req.params.id);
    if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });
    return res.json({ success: true, message: 'Registration deleted' });
  } catch (err) {
    console.error('Delete registration error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── ANALYTICS ─────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// WORKSHOP FEEDBACK — real MongoDB data for admin
// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/workshops/feedback
const { WorkshopFeedback, WorkshopAttendance, WorkshopCertificate, WorkshopRecording } = require('../models/WorkshopModels');
const WorkshopBatch = require('../models/WorkshopBatch');

router.get('/workshops/feedback', async (req, res) => {
  try {
    const { workshopId, search, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (workshopId && mongoose.Types.ObjectId.isValid(workshopId)) filter.workshopId = workshopId;

    const skip = (Number(page) - 1) * Number(limit);
    const total = await WorkshopFeedback.countDocuments(filter);
    const feedback = await WorkshopFeedback.find(filter)
      .populate('studentId', 'name email profilePicture')
      .populate('workshopId', 'title date mode')
      .populate('sessionId', 'title scheduledAt status')
      .populate('trainerId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    return res.json({ success: true, feedback, total, page: Number(page) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/lms-feedback
router.get('/lms-feedback', async (req, res) => {
  try {
    const feedback = await LmsFeedback.find({})
      .populate('sessionId', 'title scheduledAt sessionType status')
      .populate('studentId', 'name email')
      .populate('trainerId', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, feedback });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// WORKSHOP RECORDINGS — real MongoDB data for admin
// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/workshops/recordings
router.get('/workshops/recordings', async (req, res) => {
  try {
    const { workshopId, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (workshopId && mongoose.Types.ObjectId.isValid(workshopId)) filter.workshopId = workshopId;

    const recordings = await Recording.find(filter)
      .populate('sessionId', 'title scheduledAt sessionType')
      .populate('trainerId', 'name email')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean();

    const total = await Recording.countDocuments(filter);

    // Enrich with batch/workshop info
    const sessionIds = [...new Set(recordings.map(r => r.sessionId?._id?.toString()).filter(Boolean))];
    const sessions = await Session.find({ _id: { $in: sessionIds } })
      .populate({ path: 'workshopBatchId', populate: { path: 'workshopId', select: 'title' } })
      .select('workshopBatchId')
      .lean();
    const sessionMap = {};
    sessions.forEach(s => {
      sessionMap[s._id.toString()] = s.workshopBatchId?.workshopId?.title || '';
    });

    const enriched = await Promise.all(recordings.map(async (r) => {
      const { url, playable } = await resolveRecordingPlaybackAsync(r);
      return { ...r, url, playable, workshopName: sessionMap[r.sessionId?._id?.toString()] || '' };
    }));

    return res.json({ success: true, recordings: enriched, total, page: Number(page) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/admin/workshops/recordings/:id
router.delete('/workshops/recordings/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid recording ID' });
    }
    const recording = await Recording.findByIdAndDelete(req.params.id);
    if (!recording) return res.status(404).json({ success: false, message: 'Recording not found' });
    return res.json({ success: true, message: 'Recording deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/workshops/recordings/:id — single recording with validation
router.get('/workshops/recordings/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid recording ID' });
    }
    const recording = await Recording.findById(req.params.id)
      .populate('sessionId', 'title scheduledAt sessionType')
      .populate('trainerId', 'name email')
      .lean();
    if (!recording) {
      return res.status(404).json({ success: false, message: 'Recording not found' });
    }

    const { url, playable } = await resolveRecordingPlaybackAsync(recording);

    return res.json({ success: true, recording: { ...recording, playable, url } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// WORKSHOP CERTIFICATES — real MongoDB data for admin
// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/workshops/certificates
router.get('/workshops/certificates', async (req, res) => {
  try {
    const { workshopId, status, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (workshopId && mongoose.Types.ObjectId.isValid(workshopId)) filter.workshopId = workshopId;
    if (status) filter.status = status;

    const total = await WorkshopCertificate.countDocuments(filter);
    const certificates = await WorkshopCertificate.find(filter)
      .populate('studentId', 'name email')
      .populate('workshopId', 'title date')
      .populate('issuedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean();

    const studentIds = [...new Set(certificates.map((c) => c.studentId?._id || c.studentId).filter(Boolean))];
    const workshopIds = [...new Set(certificates.map((c) => c.workshopId?._id || c.workshopId).filter(Boolean))];

    const attendances = studentIds.length && workshopIds.length
      ? await WorkshopAttendance.find({
          studentId: { $in: studentIds },
          workshopId: { $in: workshopIds },
        }).lean()
      : [];

    const attMap = {};
    attendances.forEach((a) => {
      const key = `${a.workshopId}_${a.studentId}`;
      if (!attMap[key] || (a.attendancePct || 0) > (attMap[key].attendancePct || 0)) {
        attMap[key] = a;
      }
    });

    const enriched = certificates.map((c) => {
      const wId = String(c.workshopId?._id || c.workshopId || '');
      const sId = String(c.studentId?._id || c.studentId || '');
      const attendance = attMap[`${wId}_${sId}`] || null;
      return {
        ...c,
        attendance,
        score: attendance?.attendancePct ?? 0,
      };
    });

    return res.json({ success: true, certificates: enriched, total, page: Number(page) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/workshops/certificates/:id/issue — generate & issue certificate
router.post('/workshops/certificates/:id/issue', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid certificate ID' });
    }

    const cert = await WorkshopCertificate.findById(req.params.id);
    if (!cert) return res.status(404).json({ success: false, message: 'Certificate not found' });
    if (!['Eligible', 'Issued'].includes(cert.status)) {
      return res.status(400).json({ success: false, message: 'Student is not eligible for certificate issuance' });
    }

    const certificateNo = cert.certificateNo
      || `CERT-${String(cert.workshopId).slice(-6).toUpperCase()}-${String(cert.studentId).slice(-6).toUpperCase()}-${Date.now()}`;

    const updated = await WorkshopCertificate.findByIdAndUpdate(
      cert._id,
      {
        status: 'Issued',
        certificateNo,
        issuedDate: cert.issuedDate || new Date(),
        issuedBy: req.user._id,
      },
      { new: true }
    )
      .populate('studentId', 'name email')
      .populate('workshopId', 'title date')
      .populate('issuedBy', 'name')
      .lean();

    const attendance = await WorkshopAttendance.findOne({
      workshopId: cert.workshopId,
      studentId: cert.studentId,
    }).sort({ attendancePct: -1 }).lean();

    return res.json({
      success: true,
      certificate: { ...updated, attendance, score: attendance?.attendancePct ?? 0 },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Certificate number already exists' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/analytics/placement
router.get('/analytics/placement', async (req, res) => {
  const pipeline = await User.aggregate([
    { $match: { role: 'trainee', isActive: true } },
    { $group: { _id: '$placementStatus', count: { $sum: 1 } } },
  ]);
  return res.json({ success: true, data: pipeline });
});
// ── PASSWORD RESET ────────────────────────────────────────────────────────────
// GET /api/admin/roles
router.get('/roles', async (req, res) => {
  try {
    const roles = await User.distinct('role');
    return res.json({ 
      success: true, 
      data: roles.filter(r => r !== 'admin')
    });
  } catch (err) {
    console.error('Get roles error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// GET /api/admin/users-by-role/:role
router.get('/users-by-role/:role', async (req, res) => {
  try {
    const { role } = req.params;
    
    if (!role) {
      return res.status(400).json({ 
        success: false, 
        message: 'Role is required' 
      });
    }
    
    const users = await User.find({ role, isActive: true })
      .select('_id name email role')
      .sort({ name: 1 })
      .limit(200);
    
    return res.json({ 
      success: true, 
      data: users 
    });
  } catch (err) {
    console.error('Get users by role error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// POST /api/admin/reset-password
//   Body: { userId, newPassword }
router.post('/reset-password', async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    
    if (!userId || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'userId and newPassword are required' 
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters' 
      });
    }
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid user ID' 
      });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    if (user.role === 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Cannot reset admin password' 
      });
    }
    
    user.password = newPassword;
    await user.save();
    
    return res.json({ 
      success: true, 
      message: `Password reset successfully for ${user.name}` 
    });
  } catch (err) {
    console.error('Password reset error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// ── ASSIGN TRAINER → BATCH ────────────────────────────────────────────────────
// POST /api/admin/trainers/:id/assign-batch   Body: { batchId }
router.post('/trainers/:id/assign-batch', async (req, res) => {
  try {
    const trainer = await User.findById(req.params.id);
    if (!trainer) {
      return res.status(404).json({ success: false, message: 'Trainer not found' });
    }
    if (trainer.role !== 'trainer') {
      return res.status(400).json({ success: false, message: 'User is not a trainer' });
    }

    const { batchId } = req.body;
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    batch.trainerId = trainer._id;
    await batch.save();

    // Add the batch to the trainer's batchIds (write to the array, NOT the virtual).
    await User.updateOne(
      { _id: trainer._id },
      { $addToSet: { batchIds: batch._id } }
    );

    return res.status(200).json({
      success: true,
      message: 'Trainer assigned successfully',
      data: { trainerId: trainer._id, batchId: batch._id },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ── ASSIGN TRAINEES → BATCH (accumulates — trainee can be in multiple batches) ──
// POST /api/admin/trainees/assign-batch   Body: { batchId, traineeIds: [] }
router.post('/trainees/assign-batch', async (req, res) => {
  try {
    const { batchId, traineeIds } = req.body;

    if (!batchId) {
      return res.status(400).json({ success: false, message: 'Batch ID is required' });
    }
    if (!Array.isArray(traineeIds) || traineeIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one trainee' });
    }

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    // $addToSet adds the batch WITHOUT removing existing batches, and won't
    // create duplicates — so a trainee can belong to several batches.
    const result = await User.updateMany(
      { _id: { $in: traineeIds }, role: 'trainee' },
      { $addToSet: { batchIds: batch._id } }
    );

    // matchedCount reflects how many selected trainees were valid (even if they
    // were already in this batch); modifiedCount counts only newly-added ones.
    const assignedCount = result.matchedCount ?? result.modifiedCount ?? 0;

    return res.json({
      success: true,
      message: `${assignedCount} trainees assigned successfully`,
      data: {
        batchId: batch._id,
        batchName: batch.name,
        assignedCount,
        newlyAdded: result.modifiedCount ?? 0,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── PLACEMENT PIPELINE ────────────────────────────────────────────────────────
const PIPELINE_STAGES = {
  enrolled: 'Pipeline Eligible',
  training: 'Profile Review',
  ready: 'Employer Matched',
  interview_scheduled: 'Interview Scheduled',
  interview_done: 'Interview Done',
  offer_extended: 'Offer Extended',
  placed: 'Placed',
  not_placed: 'Not Placed'
};

// GET /api/admin/pipeline
router.get('/pipeline', async (req, res) => {
  const { search, batch, program } = req.query;
  const filter = { role: 'trainee', isActive: true };
  
  if (search) filter.$or = [
    { name: { $regex: search, $options: 'i' } },
    { email: { $regex: search, $options: 'i' } }
  ];
  if (batch) filter.batchId = batch;
  
  const pipeline = await User.aggregate([
    { $match: filter },
    { $lookup: { from: 'batches', localField: 'batchId', foreignField: '_id', as: 'batch' } },
    { $unwind: { path: '$batch', preserveNullAndEmptyArrays: true } },
    { $group: {
      _id: '$placementStatus',
      candidates: { $push: {
        _id: '$_id',
        name: '$name',
        email: '$email',
        batch: '$batch.name',
        companyName: '$companyName',
        ctc: '$ctc',
        placementNote: '$placementNote',
        updatedAt: '$placementUpdatedAt'
      }}
    }}
  ]);
  
  const stats = {
    total: await User.countDocuments({ role: 'trainee', isActive: true }),
    stages: Object.keys(PIPELINE_STAGES).reduce((acc, stage) => {
      const stageData = pipeline.find(p => p._id === stage);
      acc[stage] = {
        name: PIPELINE_STAGES[stage],
        count: stageData ? stageData.candidates.length : 0,
        candidates: stageData ? stageData.candidates : []
      };
      return acc;
    }, {})
  };
  
  return res.json({ success: true, pipeline: stats, stages: PIPELINE_STAGES });
});

// PUT /api/admin/pipeline/:id/stage
router.put('/pipeline/:id/stage', async (req, res) => {
  const { stage, notes, companyName, ctc } = req.body;
  
  if (!Object.keys(PIPELINE_STAGES).includes(stage)) {
    return res.status(400).json({ success: false, message: 'Invalid pipeline stage' });
  }
  
  const update = { 
    placementStatus: stage, 
    placementUpdatedAt: new Date() 
  };
  if (notes) update.placementNote = notes;
  if (companyName) update.companyName = companyName;
  if (ctc) update.ctc = ctc;
  
  const trainee = await User.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!trainee) return res.status(404).json({ success: false, message: 'Trainee not found' });
  
  return res.json({ success: true, trainee: trainee.toPublic(), message: `Moved to ${PIPELINE_STAGES[stage]}` });
});

// ── INTERVIEWS ────────────────────────────────────────────────────────────────
// GET /api/admin/interviews?traineeId=&status=
router.get('/interviews', async (req, res) => {
  const { traineeId, status } = req.query;
  const filter = {};
  if (traineeId) filter.trainee = traineeId;
  if (status) filter.status = status;
  
  const interviews = await Interview.find(filter)
    .populate('trainee', 'name email batchId')
    .populate('scheduledBy', 'name')
    .sort('-scheduledAt');
  
  return res.json({ success: true, interviews });
});

// GET /api/admin/interviews/:id
router.get('/interviews/:id', async (req, res) => {
  const interview = await Interview.findById(req.params.id)
    .populate('trainee', 'name email batchId')
    .populate('scheduledBy', 'name');
  
  if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });
  return res.json({ success: true, interview });
});

// POST /api/admin/interviews
router.post('/interviews', async (req, res) => {
  const { traineeId, type, scheduledAt, interviewerName, interviewerEmail, meetingLink, notes } = req.body;
  
  if (!traineeId || !type || !scheduledAt) {
    return res.status(400).json({ success: false, message: 'traineeId, type and scheduledAt required' });
  }
  
  const interview = await Interview.create({
    trainee: traineeId,
    type,
    scheduledAt,
    interviewerName: interviewerName || '',
    interviewerEmail: interviewerEmail || '',
    meetingLink: meetingLink || '',
    notes: notes || '',
    scheduledBy: req.user._id
  });
  
  await User.findByIdAndUpdate(traineeId, { placementStatus: 'interview_scheduled' });
  
  return res.status(201).json({ success: true, interview });
});

// PUT /api/admin/interviews/:id
router.put('/interviews/:id', async (req, res) => {
  const interview = await Interview.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    .populate('trainee', 'name email');
  
  if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });
  
  // Sync placement status
  if (req.body.status === 'completed' && req.body.outcome === 'passed') {
    await User.findByIdAndUpdate(interview.trainee._id, { placementStatus: 'placed' });
  }
  
  return res.json({ success: true, interview });
});

// DELETE /api/admin/interviews/:id
router.delete('/interviews/:id', async (req, res) => {
  const interview = await Interview.findByIdAndDelete(req.params.id);
  if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });
  return res.json({ success: true, message: 'Interview deleted' });
});

// GET /api/admin/attendance — LMS attendance overview (admin)
// Query: ?session=<id>&batch=<id>&trainee=<id>
router.get('/attendance', async (req, res) => {
  try {
    const { session, batch, trainee } = req.query;
    const filter = {};
    if (session) filter.session = session;
    if (batch) filter.batch = batch;
    if (trainee) filter.trainee = trainee;

    const records = await Attendance.find(filter)
      .populate('session', 'title scheduledAt durationMinutes status')
      .populate('trainee', 'name email')
      .populate('batch', 'name')
      .sort({ createdAt: -1 });

    return res.json({ success: true, records });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
