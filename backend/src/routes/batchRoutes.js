'use strict';
const express = require('express');
const Batch   = require('../models/Batch');
const User    = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { rejectPastDate } = require('../utils/dateTimeValidation');
const { applyEffectiveBatchStatus } = require('../utils/batchStatusUtils');

const router = express.Router();
router.use(protect);

// ─── GET /api/batches?status=&page=1&limit=0 ──────────────────────────────────
// limit=0  → return ALL batches (no pagination)
// limit=N  → paginate as before
// Both trainer (own batches) and admin (all batches) use this same endpoint.
router.get('/', async (req, res) => {
  try {
    const { status, page = 1, limit = 0 } = req.query;  // ← default limit=0 = no limit

    const filter = {};
    if (status) filter.status = status;
    // Trainers only see their own batches

    console.log(req.user.role)

    if (req.user.role === 'trainer') {
   filter.trainerId = req.user._id;
}

    const total = await Batch.countDocuments(filter);

    let query = Batch.find(filter)
      .sort({ createdAt: -1 })
      .populate('trainerId', 'name email');

    // Only paginate when limit > 0
    if (Number(limit) > 0) {
      query = query
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit));
    }
    // limit = 0  →  mongoose returns everything (no .limit() call)

    const batchesRaw = await query;
    const batches = batchesRaw.map((b) => applyEffectiveBatchStatus(b));

    return res.json({
      success: true,
      data: {
        batches,
        meta: {
          total,
          page:  Number(page),
          limit: Number(limit),   // 0 means "all"
          pages: Number(limit) > 0 ? Math.ceil(total / Number(limit)) : 1,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/batches/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id)
      .populate('trainerId', 'name email');
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

    const students = await User.find({ role: 'trainee', batchIds: batch._id })
      .select('name email placementStatus');

    return res.json({ success: true, data: { batch: applyEffectiveBatchStatus(batch), students } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/batches  [admin] ───────────────────────────────────────────────
router.post('/', authorize('admin'), async (req, res) => {
  try {
    if (req.body.startDate) {
      const check = rejectPastDate(req.body.startDate, 'Batch start date');
      if (!check.ok) return res.status(400).json({ success: false, message: check.message });
    }
    const batch = await Batch.create(req.body);
    // Admin inbox (best-effort).
    try {
      const { notifyAdmins, idOf } = require('../utils/notificationService');
      const User = require('../models/User');
      await notifyAdmins({
        User, module: 'LMS', kind: 'lms_batch_created',
        title: 'New Batch Created',
        message: `Batch "${batch.name}" has been created.`,
        dedupeKey: `lms:batch:${idOf(batch._id)}:created`,
        link: '/admin/batches',
        meta: { batchId: idOf(batch._id), batchName: batch.name, entityType: 'batch' },
      });
    } catch (_) {}
    return res.status(201).json({ success: true, data: batch });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/batches/:id  [admin] ────────────────────────────────────────────
router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    if (req.body.startDate) {
      const check = rejectPastDate(req.body.startDate, 'Batch start date');
      if (!check.ok) return res.status(400).json({ success: false, message: check.message });
    }
    const batch = await Batch.findByIdAndUpdate(
      req.params.id, req.body,
      { new: true, runValidators: true }
    );
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
    return res.json({ success: true, data: batch });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/batches/:id  [admin] ─────────────────────────────────────────
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const batch = await Batch.findByIdAndDelete(req.params.id);
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
    return res.json({ success: true, message: 'Batch deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;